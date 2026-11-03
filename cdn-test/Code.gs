// jsDelivr 読込試験（スプレッドシートに紐づけて使う）
var CDN_TAG = 'ddb3fa3b7494299bd4dc4db2d795a4a46cc11d9d';
var CDN_URL = 'https://cdn.jsdelivr.net/gh/sankisuguya-create/arithmetic-timeattack@' + CDN_TAG + '/cdn-test/test.js';

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Shell');
  t.mode = (e && e.parameter && e.parameter.mode === 'direct') ? 'direct' : 'cdn';
  t.cdnUrl = CDN_URL;
  t.tag = CDN_TAG;
  t.execUrl = ScriptApp.getService().getUrl();
  return t.evaluate()
    .setTitle('読込試験')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function getMe() {
  return { active: Session.getActiveUser().getEmail() };
}

function saveResult(r) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('結果') || ss.insertSheet('結果');
    if (sh.getLastRow() === 0) {
      sh.appendRow(['日時', 'アカウント', '方式', '版', 'ボタン→動作開始ms', '画面内準備ms', 'jsDelivr取得ms', '端末保存分', '記録往復ms', '端末メモリGB', '回線', 'UA']);
    }
    sh.appendRow([new Date(), r.email, r.mode, r.tag, r.tapToExecMs, r.execMs, r.cdnMs, r.cdnFromCache, r.rpcMs, r.deviceMemory, r.conn, r.ua]);
  } finally {
    lock.releaseLock();
  }
}
