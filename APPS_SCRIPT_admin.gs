// ======================
// CONFIG & CONSTANTS
// ======================
const ADMIN_SHEET = "Admin";

// ======================
// MAIN REQUEST HANDLER
// ======================
function doGet(e) {
  // Add safety check for the event object
  if (!e || !e.parameter) {
    e = { parameter: {} };
  }
  
  Logger.log("=== admin.doGet TRIGGERED ===");
  Logger.log("Full event object: " + JSON.stringify(e));
  Logger.log("Action parameter: '" + e.parameter.action + "'");
  
  try {
    const action = e.parameter.action;
    
    // If no action parameter, return a helpful response
    if (!action) {
      const errorResponse = { 
        success: false, 
        error: "Missing action parameter. Please include 'action' parameter in your request.",
        availableActions: [
          "getAdminAccounts",
          "addAdminAccount",
          "updateAdminAccount", 
          "deleteAdminAccount",
          "authenticate",
          "submitMessage",
          "getAdminEmails",
          "sendEmail"
        ]
      };
      return createJsonpResponse(e.parameter.callback, errorResponse);
    }
    
    let result;
    // Route to appropriate handler
    if (action === "getAdminAccounts") {
      result = getAdminAccounts();
    } else if (action === "addAdminAccount") {
      result = addAdminAccount(e.parameter);
    } else if (action === "updateAdminAccount") {
      result = updateAdminAccount(e.parameter);
    } else if (action === "deleteAdminAccount") {
      result = deleteAdminAccount(e.parameter);
    } else if (action === "authenticate") {
      result = authenticateAdmin(e.parameter.username, e.parameter.password);
    } else if (action === "submitMessage") {
      result = submitMessage(e.parameter);
    } else if (action === "getAdminEmails") {
      result = getAdminEmails();
    } else if (action === "sendEmail") {
      result = sendEmail(e.parameter);
    } else if (action === "sendNotificationEmail") {
      result = sendNotificationEmail(e.parameter);
    } else {
      result = {
        success: false, 
        error: "Invalid action: " + action + ". Available actions: getAdminAccounts, addAdminAccount, updateAdminAccount, deleteAdminAccount, authenticate, submitMessage, getAdminEmails, sendEmail,sendNotificationEmail"
      };
    }
    
    Logger.log("Result: " + JSON.stringify(result));
    
    // Create the response with proper JSONP callback
    return createJsonpResponse(e.parameter.callback, result);
  } catch (error) {
    Logger.log("CRITICAL ERROR in doGet: " + error.toString());
    const errorResponse = {
      success: false, 
      error: "A critical error occurred: " + error.toString(),
      stack: error.stack
    };
    return createJsonpResponse(e.parameter.callback, errorResponse);
  }
}

// ======================
// JSONP RESPONSE HELPER
// ======================
function createJsonpResponse(callback, data) {
  // If no callback is provided, return plain JSON
  if (!callback) {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Return JSONP response
  const jsonString = JSON.stringify(data);
  return ContentService.createTextOutput(callback + '(' + jsonString + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ======================
// GET ADMIN EMAILS
// ======================
function getAdminEmails() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Admin");
    if (!sheet) {
      return {success: false, error: "Admin sheet not found"};
    }
    
    const data = sheet.getDataRange().getValues();
    const emails = [];
    
    // Skip header row (start from index 1)
    for (let i = 1; i < data.length; i++) {
      if (data[i][3]) { // Email is in column 4 (index 3)
        emails.push(data[i][3]);
      }
    }
    
    Logger.log("Found admin emails: " + emails.join(", "));
    return {success: true, emails: emails};
  } catch (error) {
    Logger.log("Error getting admin emails: " + error.toString());
    return {success: false, error: error.toString()};
  }
}

// ======================
// SEND EMAIL (LIKE GMAIL)
// ======================
function sendEmail(params) {
  try {
    const to = params.to;
    const subject = params.subject;
    const message = params.message;
    const from = params.from || "BorrowSmart System";

    Logger.log("Attempting to send email to: " + to);
    Logger.log("Subject: " + subject);
    Logger.log("From: " + from);

    if (!to || !subject || !message) {
      return {success: false, error: "Recipient, subject, and message are required"};
    }

    // Validate that the recipient is an admin
    const adminEmailsResult = getAdminEmails();
    if (!adminEmailsResult.success) {
      return {success: false, error: "Failed to get admin emails"};
    }
    
    const adminEmails = adminEmailsResult.emails || [];
    if (!adminEmails.includes(to)) {
      return {success: false, error: "Recipient is not a registered administrator"};
    }

    // Send the email directly to Gmail
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">BorrowSmart</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Asset Management System</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">New Message</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>From:</strong> ${from}</p>
            <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <p style="margin: 8px 0;"><strong>Subject:</strong> ${subject}</p>
          </div>
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">Message:</p>
            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
          <p>This message was sent via BorrowSmart Contact Form</p>
          <p style="margin-top: 10px;">Please do not reply to this email</p>
        </div>
      </div>
    `;
    
    MailApp.sendEmail({
      to: to,
      subject: "BorrowSmart: " + subject,
      htmlBody: htmlBody
    });
    
    Logger.log("Email sent successfully to: " + to);
    return {success: true, message: "Email sent successfully to " + to};
    
  } catch (error) {
    Logger.log("Error sending email: " + error.toString());
    
    // Check if it's a permission error
    if (error.message.includes("permission") || error.message.includes("authorized")) {
      return {
        success: false, 
        error: "Email permission not granted. The script needs to be reauthorized with email sending permissions."
      };
    } else {
      return {success: false, error: "Failed to send email: " + error.toString()};
    }
  }
}

// ======================
// OTHER ADMIN FUNCTIONS (KEEP THESE FOR YOUR ADMIN SYSTEM)
// ======================
function getAdminAccounts(){
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMIN_SHEET);
    if (!sheet) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const newSheet = ss.insertSheet(ADMIN_SHEET);
      const headers = ["ID", "Username", "Password", "Email", "Created Date", "Last Login"];
      newSheet.appendRow(headers);
      newSheet.getRange("A1:G1").setFontWeight("bold");
      
      const defaultAdmin = {
        id: 1,
        username: "admin",
        password: "password123",
        email: "admin@gmail.com",
        createdDate: new Date().toISOString(),
        lastLogin: ""
      };
      addAdminAccountInternal(defaultAdmin);
      return getAdminAccounts();
    }
    
    const data = sheet.getDataRange().getValues();
    const accounts = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        accounts.push({
          id: data[i][0],
          username: data[i][1] || "",
          password: data[i][2] || "",
          email: data[i][3] || "",
          createdDate: data[i][4] || "",
          lastLogin: data[i][5] || ""
        });
      }
    }
    
    return {success: true, accounts: accounts};
  } catch (error) {
    Logger.log("Error getting admin accounts: " + error.toString());
    return {success: false, error: error.toString()};
  }
}

function authenticateAdmin(username, password){
  try {
    const result = getAdminAccounts();
    
    if (!result.success) {
      return {success: false, error: result.error};
    }
    
    const account = result.accounts.find(acc => 
      acc.username === username && acc.password === password
    );
    
    if (account) {
      updateAdminAccount(account.id, { lastLogin: new Date().toISOString() });
      return {
        success: true,
        account: {
          id: account.id,
          username: account.username,
          email: account.email,
          lastLogin: new Date().toISOString()
        }
      };
    } else {
      return {success: false, error: "Invalid credentials"};
    }
  } catch (error) {
    Logger.log("Error authenticating admin: " + error.toString());
    return {success: false, error: error.toString()};
  }
}

function addAdminAccount(params){
  try {
    const adminData = {
      username: params.username,
      password: params.password,
      email: params.email,
      createdDate: params.createdDate || new Date().toISOString(),
      lastLogin: params.lastLogin || ""
    };
    
    const result = addAdminAccountInternal(adminData);
    return result;
  } catch (error) {
    Logger.log("Error adding admin account: " + error.toString());
    return {success: false, error: error.toString()};
  }
}

function addAdminAccountInternal(adminData){
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMIN_SHEET);
  
  const data = sheet.getDataRange().getValues();
  let highestId = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && typeof data[i][0] === 'number') {
      highestId = Math.max(highestId, data[i][0]);
    }
  }
  
  const newId = highestId + 1;
  
  const row = [
    newId,
    adminData.username,
    adminData.password,
    adminData.email || "",
    adminData.createdDate || new Date().toISOString(),
    adminData.lastLogin || ""
  ];
  
  sheet.appendRow(row);
  return { success: true, id: newId };
}

function updateAdminAccount(params){
  try {
    const updateData = {
      username: params.username,
      email: params.email,
      password: params.password,
      lastLogin: params.lastLogin
    };
    
    const id = parseInt(params.id);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMIN_SHEET);
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, error: "Admin account not found" };
    }
    
    sheet.getRange(rowIndex + 1, 1, 1, 6).setValues([[
      id,
      updateData.username || data[rowIndex][1],
      updateData.password || data[rowIndex][2],
      updateData.email || data[rowIndex][3],
      data[rowIndex][4],
      updateData.lastLogin || data[rowIndex][5]
    ]]);
    
    return { success: true };
  } catch (error) {
    Logger.log("Error updating admin account: " + error.toString());
    return {success: false, error: error.toString()};
  }
}

function deleteAdminAccount(params){
  try {
    const id = parseInt(params.id);
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMIN_SHEET);
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        rowIndex = i;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, error: "Admin account not found" };
    }
    
    sheet.deleteRow(rowIndex + 1);
    return { success: true };
  } catch (error) {
    Logger.log("Error deleting admin account: " + error.toString());
    return {success: false, error: error.toString()};
  }
}

function submitMessage(params) {
  try {
    const name = params.name;
    const message = params.message;

    if (!name || !message) {
      return {success: false, error: "Name and message are required"};
    }

    const adminEmailsResult = getAdminEmails();
    if (!adminEmailsResult.success) {
      return {success: false, error: "Failed to get admin emails"};
    }
    
    const adminEmails = adminEmailsResult.emails || [];
    if (adminEmails.length === 0) {
      return {success: false, error: "No admin emails found to send to."};
    }
    
    // Send to all admins
    for (const email of adminEmails) {
      sendEmail({
        to: email,
        subject: "New Message from Contact Form",
        message: message,
        from: name
      });
    }
    
    return {success: true, message: "Your message has been sent to our administrators."};
    
  } catch (error) {
    Logger.log("Error submitting message: " + error.toString());
    return {success: false, error: error.toString()};
  }
}

// ======================
// INITIALIZATION
// ======================
function onOpen() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMIN_SHEET);
  if (!sheet) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const newSheet = ss.insertSheet(ADMIN_SHEET);
    const headers = ["ID", "Username", "Password", "Email", "Created Date", "Last Login"];
    newSheet.appendRow(headers);
    newSheet.getRange("A1:G1").setFontWeight("bold");
    
    const defaultAdmin = {
      id: 1,
      username: "admin",
      password: "password123",
      email: "admin@gmail.com",
      createdDate: new Date().toISOString(),
      lastLogin: ""
    };
    addAdminAccountInternal(defaultAdmin);
  }
}

function sendNotificationEmail(params) {
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
