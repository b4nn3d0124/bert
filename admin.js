
// ================= LOGIN STATE =================
let keySequence = [];
const secretKey = ["@", "@"]; // trigger sequence (you can change)

// ================= UI UPDATE =================
function updateUI() {
  const isLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
  const currentAdmin = JSON.parse(localStorage.getItem("currentAdmin") || "{}");

  const nav = document.getElementById("mainNav");
  const mobileNav = document.getElementById("mobileNav");
  const loginSection = document.getElementById("loginSection");
  const dashboardSection = document.getElementById("dashboardSection");

  if (!nav || !mobileNav || !loginSection || !dashboardSection) return;

  if (isLoggedIn) {
    loginSection.style.display = "none";
    dashboardSection.style.display = "block";

    const username = currentAdmin.username || "Admin";
    const formattedUsername =
      username.charAt(0).toUpperCase() + username.slice(1);

    nav.innerHTML = `
      <a href="index.html">User Page</a>
      <a href="#" class="nav-admin">${formattedUsername}</a>
      <a href="about.html">About</a>
      <a href="#" onclick="logout()">Logout</a>
    `;

    mobileNav.innerHTML = nav.innerHTML;
    loadAssets();
  } else {
    loginSection.style.display = "block";
    dashboardSection.style.display = "none";

    nav.innerHTML = `
      <a href="index.html">User Page</a>
      <a href="about.html">About</a>
      <a href="#">Admin</a>
    `;

    mobileNav.innerHTML = nav.innerHTML;
  }
}

// ================= LOGIN =================
async function handleLogin(e) {
  e.preventDefault();

  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();
  const errorDiv = document.getElementById("loginError");

  if (!user || !pass) {
    errorDiv.textContent = "Username and password are required";
    errorDiv.style.display = "block";
    return;
  }

  try {
    errorDiv.textContent = "Authenticating...";
    errorDiv.style.display = "block";

    const result = await apiRequest({
      action: "authenticate",
      username: user,
      password: pass
    });

    if (result.success) {
      localStorage.setItem("adminLoggedIn", "true");
      localStorage.setItem("currentAdmin", JSON.stringify(result.account));

      errorDiv.style.display = "none";

      notifyAdminAccess(user, result.account?.email || "");

      updateUI();
    } else {
      errorDiv.textContent = result.error || "Invalid credentials";
      errorDiv.style.display = "block";
    }
  } catch (err) {
    console.error(err);
    errorDiv.textContent = "Authentication failed.";
    errorDiv.style.display = "block";
  }
}

// ================= NOTIFICATION =================
function notifyAdminAccess(username) {
  const notifyEmail = localStorage.getItem("bs_notify_email") || "";
  if (!notifyEmail) return;

  apiRequest({
    action: "sendNotificationEmail",
    to: notifyEmail,
    subject: `[BorrowSmart] Admin Login: ${username}`,
    body: `Admin "${username}" logged in at ${new Date().toLocaleString()}`
  }).catch(() => {});
}

// ================= LOGOUT =================
function logout() {
  localStorage.removeItem("adminLoggedIn");
  localStorage.removeItem("currentAdmin");
  updateUI();
}

// ================= SECRET KEY ACCESS =================
function initSecretKey() {
  document.addEventListener("keydown", (event) => {
    const dash = document.getElementById("dashboardSection");

    if (dash && dash.style.display !== "none") {
      keySequence.push(event.key);

      if (keySequence.length > secretKey.length) {
        keySequence.shift();
      }

      if (keySequence.join("") === secretKey.join("")) {
        window.location.href = "super_admin.html";
        keySequence = [];
      }
    }
  });
}

// ================= LOAD ASSETS =================
async function loadAssets() {
  try {
    const data = await apiRequest({ action: "getAssets" }, "GET");

    const body = document.getElementById("assetBody");
    if (!body) return;

    let html = "";
    let borrowed = 0;
    let available = 0;

    data.forEach(asset => {
      if (asset.status === "Borrowed") borrowed++;
      if (asset.status === "Available") available++;

      const statusClass =
        asset.status === "Available"
          ? "badge badge-green"
          : "badge badge-red";

      const lockEdit =
        asset.status === "Borrowed"
          ? "disabled style='opacity:0.4;pointer-events:none;'"
          : "";

      const tx = formatTransactionDateTime(asset.updatedAt);

      html += `
        <tr>
          <td>${asset.id}</td>
          <td contenteditable="true">${asset.name}</td>
          <td contenteditable="true">${asset.category || ""}</td>
          <td><span class="${statusClass}">${asset.status}</span></td>
          <td>${asset.holder || ""}</td>
          <td>${tx}</td>
          <td>
            <button onclick="saveEdit(this,'${asset.id}')" ${lockEdit}>💾</button>
            <button onclick="deleteAsset('${asset.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });

    body.innerHTML = html;

    document.getElementById("borrowedAssets").innerText = borrowed;
    document.getElementById("availableAssets").innerText = available;

  } catch (err) {
    console.error("Load assets error:", err);
  }
}

// ================= FORMAT DATE =================
function formatTransactionDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

// ================= SAVE EDIT =================
async function saveEdit(btn, id) {
  const row = btn.closest("tr");

  await apiRequest({
    action: "editAsset",
    assetID: id,
    name: row.cells[1].innerText,
    category: row.cells[2].innerText
  });

  loadAssets();
}

// ================= DELETE ASSET =================
async function deleteAsset(id) {
  if (!confirm("Delete this asset?")) return;

  await apiRequest({
    action: "deleteAsset",
    assetID: id
  });

  loadAssets();
}

// ================= ADD ASSET =================
async function addAsset() {
  const name = document.getElementById("assetName").value.trim();
  const category = document.getElementById("category").value.trim();

  if (!name) return alert("Name required");

  const assetID = await generateNextAssetID();

  const res = await apiRequest({
    action: "addAsset",
    assetID,
    name,
    category
  });

  if (res.success) {
    alert("Asset added: " + assetID);
    loadAssets();
    document.getElementById("addAssetForm").reset();
  } else {
    alert(res.error || "Failed to add asset");
  }
}

// ================= GENERATE ASSET ID =================
async function generateNextAssetID() {
  const data = await apiRequest({ action: "getAssets" }, "GET");

  if (!data.length) return "AST-001";

  const max = Math.max(
    ...data.map(a => parseInt((a.id || "").replace("AST-", "")) || 0)
  );

  return "AST-" + String(max + 1).padStart(3, "0");
}

// ================= QR GENERATION =================
function generateQR(id) {
  const container = document.getElementById("qrPreviewContainer");
  const img = document.getElementById("qrPreview");

  if (!container || !img) return;

  container.style.display = "block";
  img.src =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + id;
}

// ================= QR DOWNLOAD (FIXED) =================
function downloadQR(id, url) {
  if (!url) return alert("No QR code available");

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    canvas.toBlob(blob => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${id}-QR.png`;
      link.click();
    });
  };

  img.onerror = () => {
    alert("Failed to load QR image");
  };
}

// ================= SEARCH =================
function searchInventory() {
  const input = document.getElementById("search").value.toLowerCase();

  document.querySelectorAll("#assetBody tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(input)
      ? ""
      : "none";
  });
}

// ================= CSV EXPORT =================
function downloadCSV() {
  const table = document.querySelector("table");
  if (!table) return;

  const csv = [];

  table.querySelectorAll("tr").forEach(row => {
    const cols = [...row.querySelectorAll("td,th")].map(col =>
      `"${col.innerText.replace(/"/g, '""')}"`
    );
    csv.push(cols.join(","));
  });

  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "BorrowSmart_Inventory.csv";
  link.click();
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  updateUI();
  initSecretKey();

  const btn = document.querySelector(".mobile-menu-btn");
  const nav = document.querySelector(".mobile-nav");

  if (btn && nav) {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      nav.classList.toggle("active");
      document.body.style.overflow = nav.classList.contains("active")
        ? "hidden"
        : "";
    });

    document.addEventListener("click", e => {
      if (!nav.contains(e.target) && !btn.contains(e.target)) {
        nav.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  }
});
