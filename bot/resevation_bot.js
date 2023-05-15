// �\�񍀖�
const itemTitles = ["��1��]��", "��2��]��", "���j���[", "�����O", "���X", "�Z��", "�{�ݖ�", "TEL", "���x", "�\���", "���Ə���", "���L����"];

function doPost(e) { 
  debug('doPost start.', e);

  //LINE Messaging API�̃`���l���A�N�Z�X�g�[�N����ݒ�
  let token = PropertiesService.getScriptProperties().getProperty("ACCESS_TOKEN");
  
  // WebHook�Ŏ擾����JSON�f�[�^���I�u�W�F�N�g�����Ď擾
  let eventData = JSON.parse(e.postData.contents).events[0];
  debug('eventData.', eventData);

  //�擾�����f�[�^����A�����p�̃g�[�N�����擾
  let replyToken = eventData.replyToken;
  //�擾�����f�[�^����A���b�Z�[�W��ʂ��擾
  let messageType = eventData.message.type;
  //�擾�����f�[�^����A���[�U�[�����e�������b�Z�[�W���擾
  let userMessage = eventData.message.text;

  if(!isReservationMessage(userMessage)) {
    // ���b�Z�[�W�̐擪�Ƀ^�O�y���\��z���܂܂�Ă��Ȃ�
    debug('���b�Z�[�W�̐擪�Ƀ^�O�y���\��z���܂܂�Ă��Ȃ�', userMessage);
    return;
  }
  debug('receive userMessage', userMessage);

  // �ȉ��̍��ڃw�b�_�[�̒l���擾����B
  const obj = extractElementsFromMessage(userMessage, itemTitles);
  debug('receive items', obj);

  // �\��K�{���ڃ`�F�b�N�i�ȉ��̍��ڃw�b�_�[������΁A���\��Ƃ��ċ�����B�j
  if (!validation(obj)) {
    // �\����e�ɕK�{���ڂ��܂܂�Ă��Ȃ�
    debug('�\����e�ɕK�{���ڂ��܂܂�Ă��Ȃ�', userMessage);
    return;
  }
 
  try {
    // ���\����e���X�v���b�h�V�[�g�ɓo�^����
    outputSheet(obj);
  } catch(e) {
    debug('Error writing spreadsheet.', e);
  }

  // �������b�Z�[�W�p��API URL���`
  let url = PropertiesService.getScriptProperties().getProperty("REPLY_URL");
  //���[�U�[�̓��e���b�Z�[�W���牞�����b�Z�[�W��p��
  let replyMessage = "���肪�Ƃ��������܂��B\n���\����󂯕t���܂����B\n\n�\����e���m�F��A�܂�Ԃ����A���������܂��B";

  let payload = {
    'replyToken': replyToken,
    'messages': [{
        'type': 'text',
        'text': replyMessage
      }]
  };

  //HTTPS��POST���̃I�v�V�����p�����[�^��ݒ肷��
  let options = {
    'payload' : JSON.stringify(payload),
    'myamethod'  : 'POST',
    'headers' : {"Authorization" : "Bearer " + token},
    'contentType' : 'application/json'
  };

  debug('doPost end.', options);

  //LINE Messaging API�Ƀ��N�G�X�g���A���[�U�[����̓��e�ɕԓ�����
  UrlFetchApp.fetch(url, options);
}

/**
 * �\�񃁃b�Z�[�W�ۂ𔻒�i�擪���b�Z�[�W�Ɂy���\��z���܂܂�邩�j
 */
function isReservationMessage(userMessage) {
  var lines = userMessage.split(/\r\n|\n/);
  if(lines.length > 0)
  {
    const regex = /�y���\��z/gm;
    var result = regex.exec(userMessage);
    return result != null;
  }

  return false;
}

/**
 * �\�񃁃b�Z�[�W����
 */
function validation(item) {
  const requiredItemTitles = ["��1��]��", "���j���[", "�����O"];
  const isCorrectFormat = requiredItemTitles.every(title => item[title] != null);
  if(!isCorrectFormat) {
    return false;
  }
  
  return true;
}

/**
 * Liff�A�v���̃��b�Z�[�W������͓��e����肾���B
 */
function extractElementsFromMessage(userMessage, itemTitles) {
  const regex = new RegExp(`^[ �@]*(${itemTitles.join("|")}):(.*)$`,'gm');

  const obj = {};
  let result;
  // ���K�\���p�^�[���Ƀ}�b�`������̂������Ƃ肾���ăI�u�W�F�N�g�Ɋi�[����B

  while ((result = regex.exec(userMessage)) !== null) {
    obj[result[1]] = result[2];
  }

  return obj;
}

/**
 * �L�^�Ώی��̃V�[�g���擾
 */
function getTargetSheet() {
  const targetFileId = getTargetFileId();

  const spreadSheet = SpreadsheetApp.openById(targetFileId);
  const targetSheetName = `${new Date().getMonth() + 1}��`;

  let targetSheet = spreadSheet.getSheetByName(targetSheetName);
  if (targetSheet == null) {
    spreadSheet.insertSheet(targetSheetName);
    targetSheet = spreadSheet.getSheetByName(targetSheetName);
  };

  return targetSheet;
}

/**
 * �L�^�Ώۃt�@�C����Id���擾
 */
function getTargetFileId() {
  const FOLDER_ID = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
  // �t�H���_�擾
  const folder = DriveApp.getFolderById(FOLDER_ID);
�@// �w��t�H���_�̃t�@�C���̓ǂݍ���
  const files = folder.getFiles();

  const filePrefix = "���\���"
  const today = new Date(); 

  // �擾�Ώۃt�@�C����
  const targetFileName = `${filePrefix}${today.getFullYear()}`;
  let targetFileId = "";

  let isFileFound = false;

  // �t�H���_���̃t�@�C��������
  while (files.hasNext()) {
    let file = files.next();
    if (file.getName() === targetFileName) {
      targetFileId = file.getId();
      isFileFound = true;
      break;   
    }
  }

  if (!isFileFound) {
    // �e���v���[�g�t�@�C���̓ǂݍ���
    const TEMPLATE_URL = PropertiesService.getScriptProperties().getProperty("TEMPLATE_URL");
    const templateFile = DriveApp.getFileById(TEMPLATE_URL);
    // Excel����SpreadSheet�ɕϊ�
    targetFileId = convertExcel2Sheet(templateFile, targetFileName, folder);
    // TODO: �e���v���[�g��SpreadSheet�̏ꍇ�͂��̂܂܃R�s�[
    //const targetFile = templateFile.makeCopy(targetFileName, folder);
    //targetFileId = targetFile.getId();    
  }

  return targetFileId;
}


/**
 * Spread�V�[�g�Ƀf�[�^����������
 */
function outputSheet(obj) {
  
  // Spread�V�[�g�ۂ��擾
  let output = PropertiesService.getScriptProperties().getProperty("OUTPUT_RESERVATION_SHEET");
  if(output?.toLowerCase() != 'true') {
    return;
  }

  // Spread�V�[�g���J��
  const sheet = getTargetSheet();

  sheet.activate();
  // ���\��f�[�^�I�u�W�F�N�g��z��ɕϊ�
  //reserveArray = Object.entries(obj).map((x) => x[1]);

  // �o�^����I�u�W�F�N�g���쐬
  reserveArray = [];
  itemTitles.forEach(title => {
    reserveArray.push(obj[title]);
  });

  // 2�s�ڂɍs��}��
  sheet.insertRowBefore(3);

  // �}���s�̐F�����Z�b�g����
  var row = sheet.getRange(3,1,1,sheet.getMaxColumns());
  row.setBackground(null);

  // 2�s�ڂɉ��\��f�[�^��}��
  const range = sheet.getRange(3,3,1,reserveArray.length);
  // �����ݒ�
  // range.setBackground("yellow");
  range.setBorder(true, true, true, true, true, true);
  range.setValues([reserveArray])

  const cell1 = sheet.getRange("A3");
  cell1.setBorder(true, true, true, true, true, true);
  cell1.setFormula("= ROW()-2");

  const cell2 = sheet.getRange("B3");
  cell2.setBorder(true, true, true, true, true, true);
  cell2.setValue(getReceiveTime());
  
  // Spread�V�[�g�������݊��������O�o��
  debug('wrote spread sheet.', obj);
}

/**
 * ���ݓ������擾����
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
 * Excel�t�@�C�����X�v���b�h�V�[�g�ɕϊ�����
 */
function convertExcel2Sheet(xlsFile, filename, targetfolder){
  //�ϊ������쐬����
  var options = {
      title: filename,
      mimeType: MimeType.GOOGLE_SHEETS,
      parents: [{id: targetfolder.getId()}],
  };
 
  //Drive API�ŕϊ�
  var res = Drive.Files.insert(options, xlsFile);
  
  //�ϊ��V�[�g��ID��Ԃ�
  return res.id;
}

/**
 * ���O���X�v���b�h�V�[�g�ɏo�͂���
 */
function debug(msg='debug', value=null) {

  // ���O�o�͉ۂ��擾
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
    // ���O�o�͂Ɏ��s�����ꍇ�͉������Ȃ�
  }
}
