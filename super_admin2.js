// =============================================================
// super_admin2.js  —  BorrowSmart Super Admin Frontend (Enhanced)
// =============================================================

let accounts = [];
let selectedAccounts = new Set();
let assets = [];
let savingRows = new Set(); // track rows being saved

// ── Config wait ───────────────────────────────────────────────
function waitForConfig() {
  return new Promise((resolve) => {
    if (typeof CONFIG !== "undefined" && CONFIG.ADMIN_API_URL) {
      resolve(CONFIG); return;
    }
    const check = setInterval(() => {
      if (typeof CONFIG !== "undefined" && CONFIG.ADMIN_API_URL) {
        clearInterval(check); resolve(CONFIG);
      }
    }, 100);
  });
}

// ── Single API helper — GET only, no preflight ────────────────
async function apiGet(baseUrl, params = {}, timeoutMs = 15000) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return safeParseJson(await res.text());
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new Error("Request timed out (" + timeoutMs / 1000 + "s)");
    throw err;
  }
}

function safeParseJson(text) {
  const clean = (text || "").trim().replace(/^\)\]\}'/, "").trim();
  try { return JSON.parse(clean); }
  catch { throw new Error("Server returned invalid JSON: " + clean.slice(0, 150)); }
}

// ── Loading overlay ───────────────────────────────────────────
function ensureFallbackLoadingOverlay() {
  let overlay = document.getElementById("fallbackLoadingOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "fallbackLoadingOverlay";
  overlay.innerHTML = `<div class="fallback-loading-card"><p>Loading…</p></div>`;
  const style = document.createElement("style");
  style.id = "fallbackLoadingOverlayStyle";
  style.textContent = `
    #fallbackLoadingOverlay{position:fixed;inset:0;display:none;align-items:center;
      justify-content:center;background:rgba(10,15,25,.65);z-index:99999;
      backdrop-filter:blur(2px);padding:24px;box-sizing:border-box}
    #fallbackLoadingOverlay.is-active{display:flex}
    #fallbackLoadingOverlay .fallback-loading-card{display:flex;flex-direction:column;
      align-items:center;gap:12px;background:rgba(15,23,42,.88);
      border:1px solid rgba(148,163,184,.35);border-radius:16px;
      padding:24px 32px;color:#f8fafc;font-weight:600;
      box-shadow:0 10px 28px rgba(0,0,0,.45)}
    #fallbackLoadingOverlay p{margin:0;letter-spacing:.02em;font-size:16px}`;
  if (!document.getElementById("fallbackLoadingOverlayStyle")) document.head.appendChild(style);
  document.body.appendChild(overlay);
  return overlay;
}

function setLoading(active) {
  ensureFallbackLoadingOverlay().classList.toggle("is-active", Boolean(active));
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async function () {
  const config = await waitForConfig();
  if (!config || !config.ADMIN_API_URL) {
    showErrorPopup("Configuration Error", "Admin API URL is not configured."); return;
  }
  loadAccounts();
  loadAssetsForSuperAdmin();
  const mobileBtn = document.querySelector(".mobile-menu-btn");
  if (mobileBtn) {
    mobileBtn.addEventListener("click", function () {
      const nav = document.getElementById("mobileNav");
      if (nav) nav.classList.toggle("active");
    });
  }
});

function getAssetsApiUrl() {
  return CONFIG.API_URL || CONFIG.ADMIN_API_URL;
}

// ── Load accounts ─────────────────────────────────────────────
async function loadAccounts() {
  setLoading(true);
  try {
    const result = await apiGet(CONFIG.ADMIN_API_URL, { action: "getAdminAccounts", t: Date.now() });
    if (result.success) { accounts = result.accounts || []; displayAccounts(); }
    else showErrorPopup("Error", result.error || "Failed to load admin accounts");
  } catch (err) {
    showErrorPopup("Error", "Failed to load admin accounts: " + err.message);
  } finally { setLoading(false); }
}

// ── Load assets ───────────────────────────────────────────────
async function loadAssetsForSuperAdmin() {
  const body = document.getElementById("superAssetsBody");
  const cardContainer = document.getElementById("superAssetsCards");
  if (!body && !cardContainer) return;
  setLoading(true);
  try {
    const result = await apiGet(getAssetsApiUrl(), { action: "getAssets", t: Date.now() });
    assets = Array.isArray(result) ? result : [];
    displaySuperAssets();
    renderAssetCards();
  } catch (err) {
    showErrorPopup("Error", "Failed to load assets: " + err.message);
  } finally { setLoading(false); }
}

// ── Display assets — desktop table ───────────────────────────
function displaySuperAssets() {
  const body = document.getElementById("superAssetsBody");
  if (!body) return;
  body.innerHTML = "";

  if (!assets.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">No assets found</td></tr>';
    return;
  }

  assets.forEach((asset) => {
    const row = document.createElement("tr");
    row.setAttribute("data-id", asset.id);
    const statusClass = asset.status === "Available" ? "status-available" : "status-borrowed";

    row.innerHTML = `
      <td>
        <input class="inline-input" type="text" value="${esc(asset.name)}" data-field="name"
          placeholder="Asset name" />
      </td>
      <td>
        <input class="inline-input" type="text" value="${esc(asset.category || "")}" data-field="category"
          placeholder="Category" />
      </td>
      <td>
        <select class="inline-select ${statusClass}" data-field="status">
          <option value="Available" ${asset.status === "Available" ? "selected" : ""}>✅ Available</option>
          <option value="Borrowed"  ${asset.status === "Borrowed"  ? "selected" : ""}>🔴 Borrowed</option>
        </select>
      </td>
      <td>
        <input class="inline-input" type="text" value="${esc(asset.holder || "")}" data-field="holder"
          placeholder="None" />
      </td>
      <td class="action-cell">
        <button class="action-btn save-btn"   onclick="saveSuperAssetRow('${esc(asset.id)}', this)" title="Save changes">💾 Save</button>
        <button class="action-btn return-btn" onclick="returnSuperAsset('${esc(asset.id)}', this)"  title="Mark as Available"
          ${asset.status === "Available" ? "disabled" : ""}>♻️ Return</button>
        <button class="action-btn delete-btn" onclick="deleteSuperAsset('${esc(asset.id)}')"        title="Delete asset">🗑️</button>
      </td>`;

    // Live status class update on select change
    row.querySelector('select[data-field="status"]').addEventListener("change", function () {
      this.className = "inline-select " + (this.value === "Available" ? "status-available" : "status-borrowed");
      const returnBtn = row.querySelector(".return-btn");
      if (returnBtn) returnBtn.disabled = this.value === "Available";
    });

    body.appendChild(row);
  });
}

// ── Display assets — mobile cards ─────────────────────────────
function renderAssetCards() {
  const container = document.getElementById("superAssetsCards");
  if (!container) return;
  container.innerHTML = "";

  if (!assets.length) {
    container.innerHTML = '<div class="empty-card">No assets found</div>';
    return;
  }

  assets.forEach((asset) => {
    const card = document.createElement("div");
    card.className = "asset-card";
    card.setAttribute("data-id", asset.id);
    const statusClass = asset.status === "Available" ? "status-available" : "status-borrowed";
    const statusLabel = asset.status === "Available" ? "✅ Available" : "🔴 Borrowed";

    card.innerHTML = `
      <div class="card-header">
        <span class="card-id">${esc(asset.id)}</span>
        <span class="card-status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="card-field">
        <label>Asset Name</label>
        <input class="card-input" type="text" value="${esc(asset.name)}" data-field="name" placeholder="Asset name" />
      </div>
      <div class="card-field">
        <label>Category</label>
        <input class="card-input" type="text" value="${esc(asset.category || "")}" data-field="category" placeholder="Category" />
      </div>
      <div class="card-field">
        <label>Status</label>
        <select class="card-select ${statusClass}" data-field="status">
          <option value="Available" ${asset.status === "Available" ? "selected" : ""}>✅ Available</option>
          <option value="Borrowed"  ${asset.status === "Borrowed"  ? "selected" : ""}>🔴 Borrowed</option>
        </select>
      </div>
      <div class="card-field">
        <label>Current Holder</label>
        <input class="card-input" type="text" value="${esc(asset.holder || "")}" data-field="holder" placeholder="None" />
      </div>
      <div class="card-actions">
        <button class="action-btn save-btn"   onclick="saveSuperAssetCard('${esc(asset.id)}', this)">💾 Save</button>
        <button class="action-btn return-btn" onclick="returnSuperAssetCard('${esc(asset.id)}', this)"
          ${asset.status === "Available" ? "disabled" : ""}>♻️ Return</button>
        <button class="action-btn delete-btn" onclick="deleteSuperAsset('${esc(asset.id)}')">🗑️ Delete</button>
      </div>`;

    // Live status badge update
    card.querySelector('select[data-field="status"]').addEventListener("change", function () {
      this.className = "card-select " + (this.value === "Available" ? "status-available" : "status-borrowed");
      const badge = card.querySelector(".card-status-badge");
      if (badge) {
        badge.className = "card-status-badge " + (this.value === "Available" ? "status-available" : "status-borrowed");
        badge.textContent = this.value === "Available" ? "✅ Available" : "🔴 Borrowed";
      }
      const returnBtn = card.querySelector(".return-btn");
      if (returnBtn) returnBtn.disabled = this.value === "Available";
    });

    container.appendChild(card);
  });
}

// ── Read row data from desktop table ─────────────────────────
function getRowData(row) {
  return {
    name:     (row.querySelector('[data-field="name"]')?.value     || "").trim(),
    category: (row.querySelector('[data-field="category"]')?.value || "").trim(),
    status:   (row.querySelector('[data-field="status"]')?.value   || "Available"),
    holder:   (row.querySelector('[data-field="holder"]')?.value   || "").trim(),
  };
}

// ── Read card data from mobile card ──────────────────────────
function getCardData(card) {
  return {
    name:     (card.querySelector('[data-field="name"]')?.value     || "").trim(),
    category: (card.querySelector('[data-field="category"]')?.value || "").trim(),
    status:   (card.querySelector('[data-field="status"]')?.value   || "Available"),
    holder:   (card.querySelector('[data-field="holder"]')?.value   || "").trim(),
  };
}

// ── Validate ──────────────────────────────────────────────────
function validateAssetData(data) {
  if (!data.name)     return "Asset name cannot be empty.";
  if (!data.category) return "Category cannot be empty.";
  const validStatuses = ["Available", "Borrowed"];
  if (!validStatuses.includes(data.status)) return "Invalid status value.";
  return null;
}

// ── Set button loading state ──────────────────────────────────
function setBtnLoading(btn, loading, originalText) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "⏳ Saving…" : originalText;
}

// ── Save row (desktop) ────────────────────────────────────────
async function saveSuperAssetRow(assetId, btn) {
  if (savingRows.has(assetId)) return;
  const row = document.querySelector(`#superAssetsBody tr[data-id="${assetId}"]`);
  if (!row) return;

  const data = getRowData(row);
  const err  = validateAssetData(data);
  if (err) { showErrorPopup("Validation Error", err); return; }

  if (!confirm(`Save changes to asset ${assetId}?`)) return;

  savingRows.add(assetId);
  setBtnLoading(btn, true, "💾 Save");
  try {
    const result = await apiGet(getAssetsApiUrl(), {
      action: "editAssetSuper", assetID: assetId, ...data,
    });
    if (result.success) {
      await loadAssetsForSuperAdmin();
      showSuccessPopup("Saved", `Asset ${assetId} updated successfully.`);
    } else {
      showErrorPopup("Error", result.error || "Failed to update asset.");
    }
  } catch (e) {
    showErrorPopup("Error", "Failed to update asset: " + e.message);
  } finally {
    savingRows.delete(assetId);
    setBtnLoading(btn, false, "💾 Save");
  }
}

// ── Save card (mobile) ────────────────────────────────────────
async function saveSuperAssetCard(assetId, btn) {
  if (savingRows.has(assetId)) return;
  const card = document.querySelector(`#superAssetsCards .asset-card[data-id="${assetId}"]`);
  if (!card) return;

  const data = getCardData(card);
  const err  = validateAssetData(data);
  if (err) { showErrorPopup("Validation Error", err); return; }

  if (!confirm(`Save changes to asset ${assetId}?`)) return;

  savingRows.add(assetId);
  setBtnLoading(btn, true, "💾 Save");
  try {
    const result = await apiGet(getAssetsApiUrl(), {
      action: "editAssetSuper", assetID: assetId, ...data,
    });
    if (result.success) {
      await loadAssetsForSuperAdmin();
      showSuccessPopup("Saved", `Asset ${assetId} updated successfully.`);
    } else {
      showErrorPopup("Error", result.error || "Failed to update asset.");
    }
  } catch (e) {
    showErrorPopup("Error", "Failed to update asset: " + e.message);
  } finally {
    savingRows.delete(assetId);
  }
}

// ── Return asset (desktop) ────────────────────────────────────
async function returnSuperAsset(assetId, btn) {
  if (savingRows.has(assetId)) return;
  const asset = assets.find(a => String(a.id) === String(assetId));
  const holder = asset?.holder || "current holder";
  if (!confirm(`Mark asset ${assetId} as Available and clear holder (${holder})?`)) return;

  savingRows.add(assetId);
  setBtnLoading(btn, true, "♻️ Return");
  setLoading(true);
  try {
    const result = await apiGet(getAssetsApiUrl(), {
      action: "editAssetSuper", assetID: assetId, status: "Available", holder: "",
    });
    if (result.success) {
      await loadAssetsForSuperAdmin();
      showSuccessPopup("Returned", `Asset ${assetId} is now Available.`);
    } else {
      showErrorPopup("Error", result.error || "Failed to return asset.");
    }
  } catch (e) {
    showErrorPopup("Error", "Failed to return asset: " + e.message);
  } finally {
    savingRows.delete(assetId);
    setLoading(false);
  }
}

// ── Return asset (mobile card) ────────────────────────────────
async function returnSuperAssetCard(assetId, btn) {
  if (savingRows.has(assetId)) return;
  const asset = assets.find(a => String(a.id) === String(assetId));
  const holder = asset?.holder || "current holder";
  if (!confirm(`Mark asset ${assetId} as Available and clear holder (${holder})?`)) return;

  savingRows.add(assetId);
  setBtnLoading(btn, true, "♻️ Return");
  setLoading(true);
  try {
    const result = await apiGet(getAssetsApiUrl(), {
      action: "editAssetSuper", assetID: assetId, status: "Available", holder: "",
    });
    if (result.success) {
      await loadAssetsForSuperAdmin();
      showSuccessPopup("Returned", `Asset ${assetId} is now Available.`);
    } else {
      showErrorPopup("Error", result.error || "Failed to return asset.");
    }
  } catch (e) {
    showErrorPopup("Error", "Failed to return asset: " + e.message);
  } finally {
    savingRows.delete(assetId);
    setLoading(false);
  }
}

// ── Delete asset ──────────────────────────────────────────────
async function deleteSuperAsset(assetId) {
  if (!confirm(`Permanently delete asset ${assetId}? This cannot be undone.`)) return;
  setLoading(true);
  try {
    const result = await apiGet(getAssetsApiUrl(), { action: "deleteAssetSuper", assetID: assetId });
    if (result.success) {
      await loadAssetsForSuperAdmin();
      showSuccessPopup("Deleted", "Asset deleted successfully.");
    } else {
      showErrorPopup("Error", result.error || "Failed to delete asset.");
    }
  } catch (e) {
    showErrorPopup("Error", "Failed to delete asset: " + e.message);
  } finally { setLoading(false); }
}

// ── Add asset ─────────────────────────────────────────────────
async function addSuperAsset() {
  const nameInput     = document.getElementById("superAssetName");
  const categoryInput = document.getElementById("superAssetCategory");
  const name          = nameInput?.value.trim();
  const category      = categoryInput?.value.trim();

  if (!name || !category) {
    showErrorPopup("Error", "Asset name and category are required.");
    return;
  }

  const assetID = generateSuperAssetId();
  setLoading(true);
  try {
    const result = await apiGet(getAssetsApiUrl(), {
      action: "addAsset", assetID, name, category, location: "",
    });
    if (result.success || (result.message || "").toLowerCase().includes("success")) {
      document.getElementById("addSuperAssetForm")?.reset();
      await loadAssetsForSuperAdmin();
      showSuccessPopup("Success", "Asset added successfully.");
    } else {
      showErrorPopup("Error", result.error || "Failed to add asset.");
    }
  } catch (e) {
    showErrorPopup("Error", "Failed to add asset: " + e.message);
  } finally { setLoading(false); }
}

function generateSuperAssetId() {
  const max = Math.max(0, ...assets.map(a => {
    const m = String(a.id || "").match(/AST-(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }));
  return "AST-" + String(max + 1).padStart(3, "0");
}

function searchAssetsSuper() {
  const q = (document.getElementById("searchAssetsSuper")?.value || "").toLowerCase();
  // Desktop rows
  document.querySelectorAll("#superAssetsBody tr").forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
  // Mobile cards
  document.querySelectorAll("#superAssetsCards .asset-card").forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

// ── Admin accounts ────────────────────────────────────────────
async function addAccount() {
  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value;
  const email    = document.getElementById("email")?.value.trim();

  if (!username || !password || !email) { showErrorPopup("Error", "All fields are required"); return; }
  if (CONFIG.COMPANY_DOMAIN && !email.endsWith("@" + CONFIG.COMPANY_DOMAIN)) {
    showErrorPopup("Error", "Email must be from " + CONFIG.COMPANY_DOMAIN + " domain"); return;
  }
  if (accounts.some(a => a.username === username)) { showErrorPopup("Error", "Username already exists"); return; }

  setLoading(true);
  try {
    const result = await apiGet(CONFIG.ADMIN_API_URL, {
      action: "addAdminAccount", username, password, email, createdDate: new Date().toISOString(),
    });
    if (result.success) {
      await loadAccounts();
      document.getElementById("addAccountForm")?.reset();
      showSuccessPopup("Success", "Admin account added successfully");
    } else { showErrorPopup("Error", result.error || "Failed to add admin account"); }
  } catch (err) { showErrorPopup("Error", "Failed to add admin account: " + err.message); }
  finally { setLoading(false); }
}

async function saveAccountChanges() {
  const id       = parseInt(document.getElementById("editAccountId")?.value);
  const username = document.getElementById("editUsername")?.value.trim();
  const email    = document.getElementById("editEmail")?.value.trim();
  const password = document.getElementById("editPassword")?.value;

  if (!username || !email) { showErrorPopup("Error", "Username and email are required"); return; }
  if (CONFIG.COMPANY_DOMAIN && !email.endsWith("@" + CONFIG.COMPANY_DOMAIN)) {
    showErrorPopup("Error", "Email must be from " + CONFIG.COMPANY_DOMAIN + " domain"); return;
  }
  if (accounts.some(a => a.username === username && a.id !== id)) {
    showErrorPopup("Error", "Username already exists"); return;
  }

  setLoading(true);
  try {
    const params = { action: "updateAdminAccount", id, username, email };
    if (password) params.password = password;
    const result = await apiGet(CONFIG.ADMIN_API_URL, params);
    if (result.success) {
      await loadAccounts(); closeEditPopup();
      showSuccessPopup("Success", "Admin account updated successfully");
    } else { showErrorPopup("Error", result.error || "Failed to update admin account"); }
  } catch (err) { showErrorPopup("Error", "Failed to update admin account: " + err.message); }
  finally { setLoading(false); }
}

async function deleteAccount(id) {
  const account = accounts.find(a => a.id === id);
  if (accounts.length <= 1) { showWarningPopup("Cannot Delete", "You cannot delete the last admin account."); return; }
  if (!confirm('Delete admin account "' + account.username + '"?')) return;

  setLoading(true);
  try {
    const result = await apiGet(CONFIG.ADMIN_API_URL, { action: "deleteAdminAccount", id });
    if (result.success) { await loadAccounts(); showSuccessPopup("Success", "Admin account deleted successfully"); }
    else { showErrorPopup("Error", result.error || "Failed to delete admin account"); }
  } catch (err) { showErrorPopup("Error", "Failed to delete admin account: " + err.message); }
  finally { setLoading(false); }
}

async function confirmDelete() {
  setLoading(true);
  try {
    for (const id of selectedAccounts) {
      const result = await apiGet(CONFIG.ADMIN_API_URL, { action: "deleteAdminAccount", id });
      if (!result.success) throw new Error(result.error || "Delete failed");
    }
    selectedAccounts.clear();
    const sel = document.getElementById("selectAll");
    if (sel) sel.checked = false;
    await loadAccounts();
    updateDeleteButton();
    closeDeletePopup();
    showSuccessPopup("Success", "Selected admin accounts deleted successfully");
  } catch (err) {
    closeDeletePopup();
    showErrorPopup("Error", "Failed to delete admin accounts: " + err.message);
  } finally { setLoading(false); }
}

function displayAccounts() {
  const accountsBody = document.getElementById("accountsBody");
  if (!accountsBody) return;
  accountsBody.innerHTML = "";
  if (!accounts.length) {
    accountsBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--fg-muted);">No admin accounts found</td></tr>';
    return;
  }
  const isLastAccount = accounts.length <= 1;
  accounts.forEach(account => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="account-checkbox" data-id="${account.id}"
          onchange="toggleAccountSelection(${account.id})"></td>
      <td>${account.username}</td>
      <td>${account.email || ""}</td>
      <td>
        <button class="btn-secondary" style="padding:6px 12px;font-size:12px;"
            onclick="editAccount(${account.id})">Edit</button>
        ${!isLastAccount
          ? `<button class="btn-secondary" style="padding:6px 12px;font-size:12px;background:var(--danger);"
                onclick="deleteAccount(${account.id})">Delete</button>`
          : `<button class="btn-secondary" style="padding:6px 12px;font-size:12px;opacity:.5;cursor:not-allowed;" disabled>Delete</button>`
        }
      </td>`;
    accountsBody.appendChild(row);
  });
  updateDeleteButtonVisibility();
}

function editAccount(id) {
  const account = accounts.find(a => a.id === id);
  if (!account) return;
  document.getElementById("editAccountId").value = account.id;
  document.getElementById("editUsername").value  = account.username;
  document.getElementById("editEmail").value     = account.email || "";
  document.getElementById("editPassword").value  = "";
  document.getElementById("editPopup").classList.add("active");
}

function closeEditPopup() { document.getElementById("editPopup")?.classList.remove("active"); }

function toggleSelectAll() {
  const checked = document.getElementById("selectAll")?.checked;
  document.querySelectorAll(".account-checkbox").forEach(cb => {
    cb.checked = checked;
    const id = parseInt(cb.getAttribute("data-id"));
    checked ? selectedAccounts.add(id) : selectedAccounts.delete(id);
  });
  updateDeleteButton();
}

function toggleAccountSelection(id) {
  selectedAccounts.has(id) ? selectedAccounts.delete(id) : selectedAccounts.add(id);
  updateDeleteButton();
  const allChecked = Array.from(document.querySelectorAll(".account-checkbox")).every(cb => cb.checked);
  const sel = document.getElementById("selectAll");
  if (sel) sel.checked = allChecked;
}

function updateDeleteButton() {
  const btn = document.getElementById("deleteSelectedBtn");
  if (!btn) return;
  if (accounts.length <= 1) { btn.style.display = "none"; return; }
  if (selectedAccounts.size > 0) {
    btn.style.display = "block";
    btn.textContent   = "Delete Selected (" + selectedAccounts.size + ")";
  } else { btn.style.display = "none"; }
}

function updateDeleteButtonVisibility() {
  const btn = document.getElementById("deleteSelectedBtn");
  if (btn && accounts.length <= 1) btn.style.display = "none";
}

function deleteSelectedAccounts() {
  const remaining = accounts.filter(a => !selectedAccounts.has(a.id));
  if (!remaining.length) {
    showWarningPopup("Cannot Delete", "You cannot delete all admin accounts. At least one must remain.");
    return;
  }
  document.getElementById("deletePopup")?.classList.add("active");
}

function closeDeletePopup() { document.getElementById("deletePopup")?.classList.remove("active"); }

function searchAccounts() {
  const q = (document.getElementById("searchAccounts")?.value || "").toLowerCase();
  document.querySelectorAll("#accountsBody tr").forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

// ── Utilities ─────────────────────────────────────────────────
function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function resolveTransactionDate(asset) {
  return asset.transactionDateTime || asset.transactionAt || asset.lastTransactionAt ||
    asset.lastUpdated || asset.updatedAt || asset.borrowedAt || asset.returnedAt || "";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleString();
}

function downloadQR(id, url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 200;
      canvas.height = img.naturalHeight || 200;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { window.open(url, "_blank"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${id}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    } catch { window.open(url, "_blank"); }
  };
  img.onerror = () => window.open(url, "_blank");
  img.src = url;
}

// ── Popups ────────────────────────────────────────────────────
function showSuccessPopup(title, message) {
  const t = document.getElementById("successTitle");
  const m = document.getElementById("successMessage");
  const p = document.getElementById("successPopup");
  if (t) t.textContent = title;
  if (m) m.textContent = message;
  if (p) p.classList.add("active");
}
function closeSuccessPopup() { document.getElementById("successPopup")?.classList.remove("active"); }

function showErrorPopup(title, message) {
  const t = document.getElementById("errorTitle");
  const m = document.getElementById("errorMessage");
  const p = document.getElementById("errorPopup");
  if (t) t.textContent = title;
  if (m) m.textContent = message;
  if (p) p.classList.add("active");
}
function closeErrorPopup() { document.getElementById("errorPopup")?.classList.remove("active"); }

function showWarningPopup(title, message) {
  const t = document.getElementById("warningTitle");
  const m = document.getElementById("warningMessage");
  const p = document.getElementById("warningPopup");
  if (t) t.textContent = title;
  if (m) m.textContent = message;
  if (p) p.classList.add("active");
}
function closeWarningPopup() { document.getElementById("warningPopup")?.classList.remove("active"); }
