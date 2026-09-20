/**
 * gas_push_server.gs — Push Server สำหรับ ตารางงาน & นัดหมาย PWA
 * ============================================================
 * ขั้นตอนตั้งค่า (ดูรายละเอียดใน SETUP_PUSH.md):
 *
 * 1. สร้าง Google Sheet ใหม่ แล้ว Extensions > Apps Script วางโค้ดนี้
 * 2. Script Properties (ไอคอนฟันเฟือง > Project Settings > Script Properties):
 *      FCM_PROJECT_ID          = Project ID จาก Firebase Console
 *      FCM_SERVICE_ACCOUNT_JSON = เนื้อหา JSON ที่ดาวน์โหลดจาก Firebase > Service Accounts
 * 3. Deploy > New deployment > Web App
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 4. คัดลอก Web App URL ไปใส่ GAS_PUSH_URL ใน index.html
 * 5. ตั้ง Trigger: checkAndSendPush > Time-driven > Minute timer > Every minute
 */

const SHEET_NAME = "push_queue";

/* ─── รับการลงทะเบียน / อัปเดตรายการแจ้งเตือนจาก PWA ─── */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = data.token;
    const items = data.items || [];
    if (!token) return jsonResp({ ok: false, msg: "no token" });

    const sheet = getOrCreateSheet();
    const existing = sheet.getDataRange().getValues();
    const hdr = existing[0];
    const col = (h) => hdr.indexOf(h);

    for (const item of items) {
      const rowIdx = existing.slice(1).findIndex(
        (r) => r[col("token")] === token && r[col("notif_id")] === item.notif_id
      );
      if (rowIdx >= 0) {
        if (!existing[rowIdx + 1][col("sent")]) {
          const r = rowIdx + 2;
          sheet.getRange(r, col("title") + 1).setValue(item.title);
          sheet.getRange(r, col("body") + 1).setValue(item.body);
          sheet.getRange(r, col("scheduled_at") + 1).setValue(item.scheduled_at);
        }
      } else {
        sheet.appendRow([
          token, item.notif_id, item.title, item.body,
          item.scheduled_at, false, ""
        ]);
      }
    }
    return jsonResp({ ok: true, received: items.length });
  } catch (err) {
    return jsonResp({ ok: false, msg: err.toString() });
  }
}

/* ─── Trigger ทุก 1 นาที: ส่ง push ที่ถึงเวลา ─── */
function checkAndSendPush() {
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const hdr = data[0];
  const col = (h) => hdr.indexOf(h);
  const now = new Date();

  let projectId, accessToken;
  try {
    projectId = PropertiesService.getScriptProperties().getProperty("FCM_PROJECT_ID");
    if (!projectId) return;
    accessToken = getFCMAccessToken();
  } catch (err) {
    Logger.log("Auth error: " + err);
    return;
  }

  const updates = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[col("sent")]) continue;
    const scheduledAt = new Date(row[col("scheduled_at")]);
    if (scheduledAt > now) continue;

    const ok = sendFCM(projectId, accessToken, row[col("token")], row[col("title")], row[col("body")]);
    if (ok) updates.push({ rowNum: i + 1, sentAt: now.toISOString(), sentCol: col("sent") + 1, sentAtCol: col("sent_at") + 1 });
  }

  // Write results in batch
  for (const u of updates) {
    sheet.getRange(u.rowNum, u.sentCol).setValue(true);
    sheet.getRange(u.rowNum, u.sentAtCol).setValue(u.sentAt);
  }
  if (updates.length) Logger.log(`Sent ${updates.length} push notifications`);
}

/* ─── Helpers ─── */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["token", "notif_id", "title", "body", "scheduled_at", "sent", "sent_at"]);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(5, 160);
  }
  return sheet;
}

function getFCMAccessToken() {
  const sa = JSON.parse(
    PropertiesService.getScriptProperties().getProperty("FCM_SERVICE_ACCOUNT_JSON")
  );
  const now = Math.floor(Date.now() / 1000);
  const hdr = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600
  }));
  const sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(`${hdr}.${claim}`, sa.private_key)
  );
  const jwt = `${hdr}.${claim}.${sig}`;
  const resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    payload: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  return JSON.parse(resp.getContentText()).access_token;
}

function sendFCM(projectId, accessToken, token, title, body) {
  try {
    const resp = UrlFetchApp.fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        payload: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            webpush: { headers: { TTL: "86400" }, notification: { icon: "icons/icon-192.png", requireInteraction: false } }
          }
        }),
        muteHttpExceptions: true
      }
    );
    const code = resp.getResponseCode();
    if (code !== 200) Logger.log("FCM error " + code + ": " + resp.getContentText());
    return code === 200;
  } catch (err) {
    Logger.log("sendFCM: " + err);
    return false;
  }
}

function jsonResp(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
