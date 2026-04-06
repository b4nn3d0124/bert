// ══════════════════════════════════════════════════════════════
//  ADD THIS FUNCTION TO YOUR EXISTING GOOGLE APPS SCRIPT
//  This handles the sendNotificationEmail action called by user.js
//  and admin.js via the ADMIN_API_URL endpoint (no-cors GET request)
// ══════════════════════════════════════════════════════════════

// Inside your existing doGet(e) function, add this case:
// (find the switch/if block that handles e.parameter.action)

/*

  case 'sendNotificationEmail':
    return handleSendNotificationEmail(e.parameter);

*/

// Then add this function anywhere in your Apps Script file:

function handleSendNotificationEmail(params) {
  try {
    var to      = params.to      || "";
    var subject = params.subject || "[BorrowSmart Notification]";
    var body    = params.body    || "(no body)";

    if (!to || !to.includes("@")) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Invalid recipient email" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Build a clean HTML email
    var htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <div style="background:#ec4899;border-radius:10px 10px 0 0;padding:20px 24px;">
          <span style="color:white;font-size:18px;font-weight:700;">🔑 BorrowSmart</span>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:24px;">
          <p style="font-size:15px;color:#1e293b;line-height:1.6;">${body}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
          <p style="font-size:12px;color:#94a3b8;">This is an automatic notification from BorrowSmart Asset Tracking.</p>
        </div>
      </div>
    `;

    GmailApp.sendEmail(to, subject, body, { htmlBody: htmlBody });

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("sendNotificationEmail error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════════════
// Also make sure your doGet allows CORS — add this wrapper:
// ══════════════════════════════════════════════════════════════

/*

function doGet(e) {
  var result = handleRequest(e);
  return ContentService
    .createTextOutput(result)
    .setMimeType(ContentService.MimeType.JSON);
}

// ... or if you already use JSONP callback, just add the new action case.

*/
