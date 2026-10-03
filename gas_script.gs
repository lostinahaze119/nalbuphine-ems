/**
 * Nalbuphine 止痛評估電子化系統 - Google Apps Script (GAS) 後端腳本
 * 
 * 部署步驟：
 * 1. 前往 Google 雲端硬碟 (https://drive.google.com)
 * 2. 點擊「新增」->「更多」->「Google Apps Script」
 * 3. 清空裡面所有程式碼，將本檔案內容完整貼上。
 * 4. 點選右上角「部署」->「新增部署作業」
 * 5. 選擇類型：「Web 應用程式」
 * 6. 設定：
 *    - 說明：Nalbuphine 止痛評估 API
 *    - 執行身分：我 (Me)
 *    - 誰可以存取：任何人 (Anyone)  <-- 重要！這樣平板才能無障礙存取
 * 7. 點擊「部署」，並授權存取權限。
 * 8. 複製產生的「Web 應用程式 URL」(網址以 https://script.google.com/macros/s/.../exec 結尾)。
 * 9. 將該網址貼回 Tablet 網頁應用的「Google 雲端設定」視窗中即可完成連線！
 */

// 可選：可自訂指定儲存 PDF 檔案的 Google Drive 資料夾名稱
const FOLDER_NAME = "Nalbuphine 止痛評估表";
const SPREADSHEET_NAME = "Nalbuphine 止痛評估表紀錄總表";

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    
    // 1. 取得或建立 Google 試算表
    const ss = getOrCreateSpreadsheet(SPREADSHEET_NAME);
    const sheet = ss.getActiveSheet();

    // 如果試算表是新的，先寫入表頭
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "記錄識別碼",
        "填表時間",
        "給藥日期",
        "給藥時間",
        "救護紀錄表單號",
        "性別",
        "年齡",
        "適用條件",
        "給藥劑量(mg)",
        "給藥途徑",
        "給藥前 VAS",
        "給藥後半小時 VAS",
        "VAS 改善幅度",
        "副作用反應",
        "其他副作用說明",
        "給藥滿意度",
        "病患簽名狀態",
        "救護人員簽名狀態",
        "雲端 PDF 檔案連結"
      ]);
      sheet.getRange(1, 1, 1, 19).setFontWeight("bold").setBackground("#D90429").setFontColor("#FFFFFF");
    }

    // 2. 取得或建立 Google Drive 資料夾
    const folder = getOrCreateFolder(FOLDER_NAME);

    // 3. 處理 PDF 檔案儲存
    let driveFileUrl = "";
    if (postData.pdfBase64) {
      const pdfBlob = Utilities.newBlob(
        Utilities.base64Decode(postData.pdfBase64),
        "application/pdf",
        `Nalbuphine評估表_${postData.formNo || postData.recordId}.pdf`
      );
      const pdfFile = folder.createFile(pdfBlob);
      driveFileUrl = pdfFile.getUrl();
    }

    // 計算 VAS 改善幅度
    let vasDeltaStr = "";
    if (postData.vasPre !== undefined && postData.vasPost !== undefined) {
      const delta = postData.vasPre - postData.vasPost;
      vasDeltaStr = `${delta > 0 ? '改善 ' + delta + ' 分' : delta === 0 ? '無變化' : '增加 ' + Math.abs(delta) + ' 分'}`;
    }

    // 4. 新增試算表資料列
    const rowData = [
      postData.recordId || "",
      postData.timestamp || new Date().toLocaleString("zh-TW"),
      postData.date || "",
      postData.time || "",
      postData.formNo || "",
      postData.gender || "",
      postData.age || "",
      postData.conditions || "",
      postData.dosage || "",
      postData.route || "",
      postData.vasPre !== undefined ? postData.vasPre : "",
      postData.vasPost !== undefined ? postData.vasPost : "",
      vasDeltaStr,
      postData.sideEffects || "",
      postData.sideEffectOther || "",
      postData.satisfaction || "",
      postData.patientSignature ? "已簽名" : "未簽名",
      postData.emtSignature ? "已簽名" : "未簽名",
      driveFileUrl
    ];

    sheet.appendRow(rowData);
    const lastRow = sheet.getLastRow();

    // 回傳成功結果 JSON
    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      sheetRow: lastRow,
      driveUrl: driveFileUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Nalbuphine 止痛評估電子化系統 GAS Webhook 運作正常！");
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
