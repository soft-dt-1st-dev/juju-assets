// 予約項目
const itemTitles = ["第1希望日時", "第2希望日時", "メニュー", "お名前", "来店", "住所", "施設名", "TEL", "介護度", "予約者", "事業所名", "特記事項"];

function doPost(e) { 
  debug('doPost start.', e);

  //LINE Messaging APIのチャネルアクセストークンを設定
  let token = PropertiesService.getScriptProperties().getProperty("ACCESS_TOKEN");
  
  // WebHookで取得したJSONデータをオブジェクト化して取得
  let eventData = JSON.parse(e.postData.contents).events[0];
  // debug('eventData.', eventData);

  //取得したデータから、応答用のトークンを取得
  let replyToken = eventData.replyToken;
  //取得したデータから、メッセージ種別を取得
  let messageType = eventData.message.type;
  //取得したデータから、ユーザーが投稿したメッセージを取得
  let userMessage = eventData.message.text;

  if(!isReservationMessage(userMessage)) {
    // メッセージの先頭にタグ【仮予約】が含まれていない
    debug('メッセージの先頭にタグ【仮予約】が含まれていない', userMessage);
    return;
  }

  // 以下の項目ヘッダーの値を取得する。
  const obj = extractElementsFromMessage(userMessage, itemTitles);
  debug('receive items', obj);

  // 予約必須項目チェック（以下の項目ヘッダーがあれば、仮予約として許可する。）
  if (!validation(obj)) {
    // 予約内容に必須項目が含まれていない
    debug('予約内容に必須項目が含まれていない', userMessage);
    return;
  }
 
  try {
    // 仮予約内容をスプレッドシートに登録する
    outputSheet(obj);
  } catch(e) {
    debug('Error writing spreadsheet.', e);
  }

  // 応答メッセージ用のAPI URLを定義
  let url = PropertiesService.getScriptProperties().getProperty("REPLY_URL");
  //ユーザーの投稿メッセージから応答メッセージを用意
  let replyMessage = "ありがとうございます。\n仮予約を受け付けました。\n\n予約内容を確認後、折り返しご連絡いたします。";

  let payload = {
    'replyToken': replyToken,
    'messages': [{
        'type': 'text',
        'text': replyMessage
      }]
  };

  //HTTPSのPOST時のオプションパラメータを設定する
  let options = {
    'payload' : JSON.stringify(payload),
    'myamethod'  : 'POST',
    'headers' : {"Authorization" : "Bearer " + token},
    'contentType' : 'application/json'
  };

  debug('doPost end.', options);

  //LINE Messaging APIにリクエストし、ユーザーからの投稿に返答する
  UrlFetchApp.fetch(url, options);
}

/**
 * 予約メッセージ可否を判定（先頭メッセージに【仮予約】が含まれるか）
 */
function isReservationMessage(userMessage) {
  var lines = userMessage.split(/\r\n|\n/);
  if(lines.length > 0)
  {
    const regex = /【仮予約】/gm;
    var result = regex.exec(userMessage);
    return result != null;
  }

  return false;
}

/**
 * 予約メッセージ検証
 */
function validation(item) {
  const requiredItemTitles = ["第1希望日時", "メニュー", "お名前"];
  const isCorrectFormat = requiredItemTitles.every(title => item[title] != null);
  if(!isCorrectFormat) {
    return false;
  }

  if(!(item["来店"] != null || (item["住所"] != null && item["施設名"] != null))) {
    return false;
  }
  
  return true;
}

/**
 * Liffアプリのメッセージから入力内容を取りだす。
 */
function extractElementsFromMessage(userMessage, itemTitles) {
  const regex = new RegExp(`^[ 　]*(${itemTitles.join("|")}):(.*)$`,'gm');

  const obj = {};
  let result;
  // 正規表現パターンにマッチするものを順次とりだしてオブジェクトに格納する。

  while ((result = regex.exec(userMessage)) !== null) {
    obj[result[1]] = result[2];
  }

  return obj;
}

/**
 * 記録対象月のシートを取得
 */
function getTargetSheet() {
  const targetFileId = getTargetFileId();

  const spreadSheet = SpreadsheetApp.openById(targetFileId);
  const targetSheetName = `${new Date().getMonth() + 1}月`;

  let targetSheet = spreadSheet.getSheetByName(targetSheetName);
  if (targetSheet == null) {
    spreadSheet.insertSheet(targetSheetName);
    targetSheet = spreadSheet.getSheetByName(targetSheetName);
  };

  return targetSheet;
}

/**
 * 記録対象ファイルのIdを取得
 */
function getTargetFileId() {
  const FOLDER_ID = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
  // フォルダ取得
  const folder = DriveApp.getFolderById(FOLDER_ID);
　// 指定フォルダのファイルの読み込み
  const files = folder.getFiles();

  const filePrefix = "仮予約状況"
  const today = new Date(); 

  // 取得対象ファイル名
  const targetFileName = `${filePrefix}${today.getFullYear()}`;
  let targetFileId = "";

  let isFileFound = false;

  // フォルダ内のファイルを検索
  while (files.hasNext()) {
    let file = files.next();
    if (file.getName() === targetFileName) {
      targetFileId = file.getId();
      isFileFound = true;
      break;   
    }
  }

  if (!isFileFound) {
    // テンプレートファイルの読み込み
    const TEMPLATE_URL = PropertiesService.getScriptProperties().getProperty("TEMPLATE_URL");
    const templateFile = DriveApp.getFileById(TEMPLATE_URL);
    // ExcelからSpreadSheetに変換
    targetFileId = convertExcel2Sheet(templateFile, targetFileName, folder);
    // TODO: テンプレートがSpreadSheetの場合はそのままコピー
    //const targetFile = templateFile.makeCopy(targetFileName, folder);
    //targetFileId = targetFile.getId();    
  }

  return targetFileId;
}


/**
 * Spreadシートにデータを書き込む
 */
function outputSheet(obj) {
  
  // Spreadシート可否を取得
  let output = PropertiesService.getScriptProperties().getProperty("OUTPUT_RESERVATION_SHEET");
  if(output?.toLowerCase() != 'true') {
    return;
  }

  // Spreadシートを開く
  const sheet = getTargetSheet();

  sheet.activate();
  // 仮予約データオブジェクトを配列に変換
  //reserveArray = Object.entries(obj).map((x) => x[1]);

  // 登録するオブジェクトを作成
  reserveArray = [];
  itemTitles.forEach(title => {
    reserveArray.push(obj[title]);
  });

  // 2行目に行を挿入
  sheet.insertRowBefore(3);

  // 挿入行の色をリセットする
  var row = sheet.getRange(3,1,1,sheet.getMaxColumns());
  row.setBackground(null);

  // 2行目に仮予約データを挿入
  const range = sheet.getRange(3,3,1,reserveArray.length);
  // 書式設定
  // range.setBackground("yellow");
  range.setBorder(true, true, true, true, true, true);
  range.setValues([reserveArray])

  const cell1 = sheet.getRange("A3");
  cell1.setBorder(true, true, true, true, true, true);
  cell1.setFormula("= ROW()-2");

  const cell2 = sheet.getRange("B3");
  cell2.setBorder(true, true, true, true, true, true);
  cell2.setValue(getReceiveTime());
  
  // Spreadシート書き込み完了をログ出力
  debug('wrote spread sheet.', obj);
}

/**
 * 現在日時を取得する
 */
function getReceiveTime() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  return `${month}/${date} ${hour}:${minutes}:${seconds}`
}

/**
 * Excelファイルをスプレッドシートに変換する
 */
function convertExcel2Sheet(xlsFile, filename, targetfolder){
  //変換情報を作成する
  var options = {
      title: filename,
      mimeType: MimeType.GOOGLE_SHEETS,
      parents: [{id: targetfolder.getId()}],
  };
 
  //Drive APIで変換
  var res = Drive.Files.insert(options, xlsFile);
  
  //変換シートのIDを返す
  return res.id;
}

/**
 * ログをスプレッドシートに出力する
 */
function debug(msg='debug', value=null) {

  // ログ出力可否を取得
  let debug = PropertiesService.getScriptProperties().getProperty("DEBUG");
  if(debug?.toLowerCase() != 'true') {
   return;
  }

  try {
    let log_spread_id = PropertiesService.getScriptProperties().getProperty("LOG_SPREAD_ID");
    let log_sheet_name = PropertiesService.getScriptProperties().getProperty("LOG_SHEET_NAME");
  
    if(log_spread_id && log_sheet_name) {
    const sheet = SpreadsheetApp.openById(log_spread_id);
    const ss = sheet.getSheetByName(log_sheet_name);
      const date = new Date();
      const targetRow = ss.getLastRow() + 1;
      ss.getRange('A' + targetRow).setValue(date);
      if(msg) {
        ss.getRange('B' + targetRow).setValue(msg);
      }
      if(value) {
        ss.getRange('C' + targetRow).setValue(value);
      }
    }
  } catch {
    // ログ出力に失敗した場合は何もしない
  }
}
