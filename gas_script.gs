/**
 * Nalbuphine 止痛評估電子化系統 - Google Apps Script (GAS) 後端腳本
 * 支援：
 * 1. 表單紀錄與 1 頁 A4 PDF 上傳歸檔 (單位_民國日期_單號.pdf)
 * 2. 遠端主管剩餘劑量銷毀簽核 (一次性 Token 驗證 + 併發鎖定 LockService)
 * 
 * 部署步驟：
 * 1. 前往 Google 雲端硬碟 -> 新增 -> 更多 -> Google Apps Script
 * 2. 清空裡面所有程式碼，將本檔案內容完整貼上並儲存。
 * 3. 點選右上角「部署」->「管理部署作業」->「編輯」-> 版本選「新增版本」->「部署」。
 *    - 執行身分：我 (Me)
 *    - 誰可以存取：任何人 (Anyone)
 */

const FOLDER_NAME = "Nalbuphine 止痛評估表";
const SPREADSHEET_NAME = "Nalbuphine 止痛評估表紀錄總表";
const SIGN_SHEET_NAME = "SupervisorSignRequests";

const EXPECTED_HEADERS = [
  "記錄識別碼",
  "填表時間",
  "出勤單位",
  "給藥日期",
  "給藥時間",
  "救護紀錄表單號",
  "性別",
  "年齡",
  "適用條件",
  "給藥劑量(mg)",
  "剩餘銷毀劑量(mg)",
  "給藥途徑",
  "重複給藥",
  "重複給藥備註",
  "給藥前 VAS",
  "給藥後半小時 VAS",
  "VAS 改善幅度",
  "副作用反應",
  "其他副作用說明",
  "給藥滿意度",
  "病患簽名狀態",
  "救護人員簽名狀態",
  "主管銷毀簽核狀態",
  "主管簽核時間",
  "雲端 PDF 檔案連結"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action || "submitRecord";

    const ss = getOrCreateSpreadsheet(SPREADSHEET_NAME);

    if (action === "createSignRequest") {
      return handleCreateSignRequest(ss, postData);
    }

    if (action === "submitSupervisorSign") {
      return handleSubmitSupervisorSign(ss, postData);
    }

    return handleSubmitRecord(ss, postData);
  } catch (error) {
    return jsonResponse({
      result: "error",
      message: error.toString()
    });
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (params.action === "getSignStatus") {
      const ss = getOrCreateSpreadsheet(SPREADSHEET_NAME);
      return handleGetSignStatus(ss, params.signId, params.token);
    }
    if (params.action === "repairSheet") {
      const ss = getOrCreateSpreadsheet(SPREADSHEET_NAME);
      const sheet = ss.getSheets()[0];
      const count = ensureAndMigrateSheet(sheet);
      return jsonResponse({ result: "success", message: "試算表欄位與歷史資料對齊完成", rowsProcessed: count });
    }
    return ContentService.createTextOutput("Nalbuphine 止痛評估電子化系統 GAS Webhook 運作正常！");
  } catch (error) {
    return jsonResponse({
      result: "error",
      message: error.toString()
    });
  }
}

function repairSheet() {
  const ss = getOrCreateSpreadsheet(SPREADSHEET_NAME);
  const sheet = ss.getSheets()[0];
  ensureAndMigrateSheet(sheet);
}

function ensureAndMigrateSheet(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(EXPECTED_HEADERS);
    sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length).setFontWeight("bold").setBackground("#0D9488").setFontColor("#FFFFFF");
    return 1;
  }

  const lastRow = sheet.getLastRow();
  const maxCols = Math.max(sheet.getLastColumn(), EXPECTED_HEADERS.length);
  const allValues = sheet.getRange(1, 1, lastRow, maxCols).getValues();
  const header = allValues[0];

  let headersMatch = true;
  for (let c = 0; c < EXPECTED_HEADERS.length; c++) {
    if (String(header[c] || "").trim() !== EXPECTED_HEADERS[c]) {
      headersMatch = false;
      break;
    }
  }
  if (headersMatch) return lastRow;

  const isSigText = (val) => val === "已簽名" || val === "未簽名" || val === "因故無法簽名";
  const isHttp = (val) => String(val || "").indexOf("http") === 0;

  const migratedRows = [EXPECTED_HEADERS];
  for (let i = 1; i < allValues.length; i++) {
    const r = allValues[i];
    const is25 = isHttp(r[24]) || isSigText(r[20]);
    const is21 = !is25 && (isHttp(r[20]) || isSigText(r[18]));
    const is19 = !is25 && !is21 && (isHttp(r[18]) || isSigText(r[16]));

    if (is25) {
      const row25 = r.slice(0, 25);
      while (row25.length < 25) row25.push("");
      migratedRows.push(row25);
    } else if (is21) {
      migratedRows.push([
        r[0], r[1], "", r[2], r[3], r[4], r[5], r[6], r[7], r[8],
        "", r[9], r[10], r[11], r[12], r[13], r[14], r[15], r[16], r[17],
        r[18], r[19], "", "", r[20]
      ]);
    } else if (is19) {
      migratedRows.push([
        r[0], r[1], "", r[2], r[3], r[4], r[5], r[6], r[7], r[8],
        "", r[9], "", "", r[10], r[11], r[12], r[13], r[14], r[15],
        r[16], r[17], "", "", r[18]
      ]);
    } else {
      const padded = r.slice(0, 25);
      while (padded.length < 25) padded.push("");
      migratedRows.push(padded);
    }
  }

  sheet.getRange(1, 1, migratedRows.length, EXPECTED_HEADERS.length).setValues(migratedRows);
  sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length).setFontWeight("bold").setBackground("#0D9488").setFontColor("#FFFFFF");
  return migratedRows.length;
}

function handleSubmitRecord(ss, postData) {
  const sheet = ss.getSheets()[0];
  ensureAndMigrateSheet(sheet);

  const folder = getOrCreateFolder(FOLDER_NAME);

  let targetFileName = postData.fileName;
  if (!targetFileName) {
    const unit = postData.unit || "光明91";
    const formNo = postData.formNo || postData.recordId;
    let minguoDate = "1151004";
    if (postData.date) {
      const parts = postData.date.split("-");
      const yyyy = parseInt(parts[0], 10);
      minguoDate = `${yyyy - 1911}${parts[1]}${parts[2]}`;
    }
    targetFileName = `${unit}_${minguoDate}_${formNo}.pdf`;
  }

  let driveFileUrl = "";
  if (postData.pdfBase64) {
    const pdfBlob = Utilities.newBlob(
      Utilities.base64Decode(postData.pdfBase64),
      "application/pdf",
      targetFileName
    );
    const pdfFile = folder.createFile(pdfBlob);
    driveFileUrl = pdfFile.getUrl();
  }

  let vasDeltaStr = "";
  if (postData.vasUnconscious) {
    vasDeltaStr = "意識不清無法評估";
  } else if (postData.vasPre !== undefined && postData.vasPre !== "" && postData.vasPost !== undefined && postData.vasPost !== "") {
    const delta = Number(postData.vasPre) - Number(postData.vasPost);
    if (!isNaN(delta)) {
      vasDeltaStr = `${delta > 0 ? "改善 " + delta + " 分" : delta === 0 ? "無變化" : "增加 " + Math.abs(delta) + " 分"}`;
    }
  }

  const wasteDoseNum = Number(postData.wasteDosage || 0);
  const supStatus = wasteDoseNum <= 0
    ? "無剩餘免簽"
    : (postData.supervisorSignature ? (postData.supervisorSignMode === "remote" ? "已遠端簽核" : "已現場簽核") : "未簽核");

  const rowData = [
    postData.recordId || "",
    postData.timestamp || Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss"),
    postData.unit || "光明91",
    postData.date || "",
    postData.time || "",
    postData.formNo || "",
    postData.gender || "",
    postData.age || "",
    postData.conditions || "",
    postData.dosage || "5",
    postData.wasteDosage !== undefined ? postData.wasteDosage : "0",
    postData.route || "",
    postData.repeatDose || "否",
    postData.repeatDoseRemark || "",
    postData.vasUnconscious ? "無法評估" : (postData.vasPre !== undefined ? postData.vasPre : ""),
    postData.vasUnconscious ? "無法評估" : (postData.vasPost !== undefined ? postData.vasPost : ""),
    vasDeltaStr,
    postData.sideEffects || "",
    postData.sideEffectOther || "",
    postData.satisfaction || "",
    postData.patientSignature ? "已簽名" : (postData.patientUnableToSign ? "因故無法簽名" : "未簽名"),
    postData.emtSignature ? "已簽名" : "未簽名",
    supStatus,
    postData.supervisorSignedAt || "",
    driveFileUrl
  ];

  sheet.appendRow(rowData);
  const lastRow = sheet.getLastRow();

  return jsonResponse({
    result: "success",
    sheetRow: lastRow,
    driveUrl: driveFileUrl
  });
}

function getOrCreateSignSheet(ss) {
  let signSheet = ss.getSheetByName(SIGN_SHEET_NAME);
  if (!signSheet) {
    signSheet = ss.insertSheet(SIGN_SHEET_NAME);
    signSheet.appendRow([
      "signId",
      "token",
      "createdAt",
      "expiresAt",
      "status",
      "unit",
      "formNo",
      "date",
      "time",
      "route",
      "dosage",
      "wasteDosage",
      "supervisorSignature",
      "supervisorSignedAt"
    ]);
    signSheet.getRange(1, 1, 1, 14).setFontWeight("bold").setBackground("#0F172A").setFontColor("#FFFFFF");
  }
  return signSheet;
}

function handleCreateSignRequest(ss, postData) {
  const signSheet = getOrCreateSignSheet(ss);
  const signId = postData.signId || ("SIG_" + Date.now());
  const token = postData.token || Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  const nowMs = Date.now();
  const createdAt = Utilities.formatDate(new Date(nowMs), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
  const expiresAt = nowMs + 24 * 60 * 60 * 1000;

  signSheet.appendRow([
    signId,
    token,
    createdAt,
    expiresAt,
    "pending",
    postData.unit || "光明91",
    postData.formNo || "",
    postData.date || "",
    postData.time || "",
    postData.route || "IV",
    postData.dosage || "5",
    postData.wasteDosage || "0",
    "",
    ""
  ]);

  return jsonResponse({
    result: "success",
    signId: signId,
    token: token,
    createdAt: createdAt
  });
}

function handleGetSignStatus(ss, signId, token) {
  if (!signId || !token) {
    return jsonResponse({ result: "error", message: "缺少簽核識別碼或驗證碼" });
  }
  const signSheet = getOrCreateSignSheet(ss);
  const values = signSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[0]) === String(signId) && String(row[1]) === String(token)) {
      const expiresAt = Number(row[3] || 0);
      const isExpired = expiresAt > 0 && Date.now() > expiresAt && row[4] === "pending";
      return jsonResponse({
        result: "success",
        signId: row[0],
        status: isExpired ? "expired" : row[4],
        unit: row[5],
        formNo: row[6],
        date: row[7],
        time: row[8],
        route: row[9],
        dosage: row[10],
        wasteDosage: row[11],
        supervisorSignature: row[12] || "",
        supervisorSignedAt: row[13] || ""
      });
    }
  }

  return jsonResponse({ result: "error", message: "找不到對應的遠端簽核案件" });
}

function handleSubmitSupervisorSign(ss, postData) {
  const signId = postData.signId;
  const token = postData.token;
  const sig = postData.supervisorSignature;

  if (!signId || !token || !sig) {
    return jsonResponse({ result: "error", message: "缺少簽核必要資料" });
  }

  const signSheet = getOrCreateSignSheet(ss);
  const values = signSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[0]) === String(signId) && String(row[1]) === String(token)) {
      if (row[4] === "signed") {
        return jsonResponse({ result: "error", message: "此簽核連結已完成簽署，無法重複覆蓋" });
      }
      const expiresAt = Number(row[3] || 0);
      if (expiresAt > 0 && Date.now() > expiresAt) {
        return jsonResponse({ result: "error", message: "此簽核連結已超過 24 小時效期" });
      }

      const signedAt = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy/MM/dd HH:mm:ss");
      const rowIndex = i + 1;
      signSheet.getRange(rowIndex, 5).setValue("signed");
      signSheet.getRange(rowIndex, 13).setValue(sig);
      signSheet.getRange(rowIndex, 14).setValue(signedAt);

      return jsonResponse({
        result: "success",
        status: "signed",
        supervisorSignedAt: signedAt
      });
    }
  }

  return jsonResponse({ result: "error", message: "無效的簽核連結或驗證碼錯誤" });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

function getOrCreateSpreadsheet(sheetName) {
  const files = DriveApp.getFilesByName(sheetName);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  } else {
    const ss = SpreadsheetApp.create(sheetName);
    const folder = getOrCreateFolder(FOLDER_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    return ss;
  }
}
