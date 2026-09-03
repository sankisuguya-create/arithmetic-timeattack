/**
 * Code.gs — 座席表ツール（メニュー・シート入出力）
 *
 * 担当は「名簿 → 座席表を並べる → 印刷」まで。
 * 席替えの自動生成（過去に同じ班・隣になっていない組を優先する）は
 * Assign.gs に分けてあり、この段階では入れていない。
 * ただし履歴だけは今から取り始める。後から遡って作れないため。
 *
 * 外部通信をしない。UrlFetchApp を使わず、HTML からも CDN を読まない。
 * Web アプリとして公開しない（名簿を扱うので到達経路を増やさない）。
 */

var SHEETS = {
  ROSTER: '名簿',
  CONFIG: '設定',
  PLAN: '平面図',
  ASSIGN: '配置',
  HISTORY: '履歴',
  HISTORY_PLAN: '履歴_平面図',
  RULES: '制約'
};

/**
 * 名簿の列。値は既定の列名で、設定シートの「名簿の列:番号」等で上書きする。
 * 学校ごとに列名が違うので、位置ではなくヘッダ名で引く。
 * 列を1本挿入しただけで全部ずれる、という壊れ方を避けるため。
 */
var ROSTER_FIELDS = ['番号', '姓', '名', 'せい', 'めい', '性別', '分散タグ'];

var CONFIG_ROWS = [
  ['学級名', '3年3組'],
  ['教卓の位置', '上'],   // 上 か 下のみ。左右は印刷の回転が90度になるので未対応
  ['実施回', 0]
];

/* ============================================================
 *  メニュー
 * ============================================================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('席替え')
    .addItem('配置ボードを開く', 'openBoard')
    .addItem('印刷', 'openPrint')
    .addSeparator()
    .addItem('この配置を確定して履歴に残す', 'commitAssign')
    .addItem('直前の確定を取り消す', 'undoCommit')
    .addSeparator()
    .addItem('初期設定（シートを作る）', 'setupSheets')
    .addItem('平面図の見た目を整える', 'tidyPlan')
    .addToUi();
}

function openBoard() {
  var html = HtmlService.createHtmlOutputFromFile('board')
    .setWidth(980).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, '配置ボード');
}

function openPrint() {
  var html = HtmlService.createHtmlOutputFromFile('print')
    .setWidth(980).setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, '印刷');
}

/* ============================================================
 *  初期設定
 * ============================================================ */

function setupSheets() {
  var ss = SpreadsheetApp.getActive();

  ensureSheet_(ss, SHEETS.ROSTER,
    [['番号', '姓', '名', 'せい', 'めい', '性別', '分散タグ', 'タグ更新日']]);
  ensureConfig_(ss);
  ensurePlan_(ss);
  ensureSheet_(ss, SHEETS.ASSIGN, [['席ID', '班ID', '番号', '氏名']]);
  ensureSheet_(ss, SHEETS.HISTORY, [['実施回', '実施日', '番号', '席ID', '班ID']]);
  ensureSheet_(ss, SHEETS.HISTORY_PLAN, [['実施回', '平面図(JSON)']]);
  ensureRules_(ss);

  tidyPlan();
  SpreadsheetApp.getUi().alert(
    'シートを用意しました。\n\n' +
    '1. 名簿シートに児童を貼り付ける\n' +
    '2. 設定シートで名簿の列名を合わせる\n' +
    '3. 平面図シートに教室を描く（机のセルに班ID、空白は通路）\n' +
    '4. メニュー「席替え」→「配置ボードを開く」');
}

function ensureSheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  if (header && header.length) {
    sh.getRange(1, 1, header.length, header[0].length).setValues(header)
      .setFontWeight('bold').setBackground('#eeeeee');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureConfig_(ss) {
  if (ss.getSheetByName(SHEETS.CONFIG)) return;
  var sh = ss.insertSheet(SHEETS.CONFIG);
  var rows = [['項目', '値']];
  for (var i = 0; i < CONFIG_ROWS.length; i++) rows.push(CONFIG_ROWS[i]);
  // 名簿の列マッピング。既定では列名がそのまま項目名と同じ
  for (var j = 0; j < ROSTER_FIELDS.length; j++) {
    rows.push(['名簿の列:' + ROSTER_FIELDS[j], ROSTER_FIELDS[j]]);
  }
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#eeeeee');
  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(2, 220);
  sh.setFrozenRows(1);
}

function ensureRules_(ss) {
  if (ss.getSheetByName(SHEETS.RULES)) return;
  var sh = ensureSheet_(ss, SHEETS.RULES,
    [['種別', '番号', '相手番号または席ID', 'メモ']]);
  // 制約は P1 では読まない。P2（自動生成）で使う。
  // ただし入力は今から始められるようにしておく（後で一度に入れるのは負担が大きい）
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['視力前列', '分離ペア', '固定席'], true).build();
  sh.getRange(2, 1, 200, 1).setDataValidation(rule);
  sh.setColumnWidth(3, 180);
  sh.setColumnWidth(4, 260);
}

/**
 * 平面図の見本。29名・7班（4人×6 + 5人×1）を島型で置いたもの。
 * 「#」で始まるセルは机ではなく注記として扱う。
 */
function ensurePlan_(ss) {
  if (ss.getSheetByName(SHEETS.PLAN)) return;
  var sh = ss.insertSheet(SHEETS.PLAN);
  var plan = [
    ['',  '',  '',  '', '#教卓', '', '',  '',  ''],
    ['A', 'A', '',  'B', 'B', '',  'C', 'C', ''],
    ['A', 'A', '',  'B', 'B', '',  'C', 'C', ''],
    ['',  '',  '',  '',  '',  '',  '',  '',  ''],
    ['D', 'D', '',  'E', 'E', '',  'F', 'F', 'F'],
    ['D', 'D', '',  'E', 'E', '',  'F', 'F', ''],
    ['',  '',  '',  '',  '',  '',  '',  '',  ''],
    ['',  '',  'G', 'G', 'G', 'G', '',  '',  '']
  ];
  sh.getRange(1, 1, plan.length, plan[0].length).setValues(plan);
}

/**
 * 平面図を教室図らしく見せる。列幅・行高をそろえ、班ごとに色を付ける。
 * 見た目を整えるだけで、解析には影響しない。
 */
function tidyPlan() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEETS.PLAN);
  if (!sh) return;
  var rng = sh.getDataRange();
  var vals = rng.getValues();
  var rows = vals.length, cols = vals[0].length;

  sh.setColumnWidths(1, Math.min(cols + 2, sh.getMaxColumns()), 62);
  sh.setRowHeights(1, sh.getMaxRows(), 44);

  var groups = planGroupOrder_(vals);
  var bg = [], fw = [];
  for (var i = 0; i < rows; i++) {
    bg.push([]); fw.push([]);
    for (var j = 0; j < cols; j++) {
      var v = String(vals[i][j]).trim();
      if (!v) { bg[i].push('#ffffff'); fw[i].push('normal'); }
      else if (v.charAt(0) === '#') { bg[i].push('#e8e8e8'); fw[i].push('bold'); }
      else { bg[i].push(groupColor_(groups.indexOf(v))); fw[i].push('bold'); }
    }
  }
  rng.setBackgrounds(bg).setFontWeights(fw)
     .setHorizontalAlignment('center').setVerticalAlignment('middle');
}

/** 班の並び順は、平面図を左上から右下に読んだ初出順。班の色と印刷順をこれで決める */
function planGroupOrder_(vals) {
  var seen = [];
  for (var i = 0; i < vals.length; i++) {
    for (var j = 0; j < vals[i].length; j++) {
      var v = String(vals[i][j]).trim();
      if (!v || v.charAt(0) === '#') continue;
      if (seen.indexOf(v) < 0) seen.push(v);
    }
  }
  return seen;
}

function groupColor_(idx) {
  if (idx < 0) return '#ffffff';
  var h = (idx * 47 + 20) % 360;
  return hslToHex_(h, 0.45, 0.90);
}

function hslToHex_(h, s, l) {
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = l - c / 2;
  var r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return '#' + [r, g, b].map(function (v) {
    var t = Math.round((v + m) * 255).toString(16);
    return t.length < 2 ? '0' + t : t;
  }).join('');
}

/* ============================================================
 *  設定・名簿の読み取り
 * ============================================================ */

function readConfig_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CONFIG);
  var cfg = {};
  if (!sh) return cfg;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var k = String(vals[i][0]).trim();
    if (k) cfg[k] = vals[i][1];
  }
  return cfg;
}

/**
 * 名簿を読む。列は設定シートのマッピングを通してヘッダ名で引く。
 * 番号が空の行は飛ばす（名簿末尾の空行や小計行が混ざっても壊れないように）。
 */
function readRoster_(cfg) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ROSTER);
  if (!sh) throw new Error('「' + SHEETS.ROSTER + '」シートがありません。先に初期設定を実行してください。');
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];

  var head = vals[0].map(function (v) { return String(v).trim(); });
  var col = {};
  for (var f = 0; f < ROSTER_FIELDS.length; f++) {
    var field = ROSTER_FIELDS[f];
    var name = String(cfg['名簿の列:' + field] || field).trim();
    col[field] = head.indexOf(name);
  }
  if (col['番号'] < 0) {
    throw new Error('名簿に「' + (cfg['名簿の列:番号'] || '番号') + '」列が見つかりません。設定シートの「名簿の列:番号」を実際の列名に合わせてください。');
  }

  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var num = vals[i][col['番号']];
    if (num === '' || num === null) continue;
    var pick = function (f) { return col[f] >= 0 ? String(vals[i][col[f]]).trim() : ''; };
    var sei = pick('姓'), mei = pick('名');
    out.push({
      num: String(num).trim(),
      sei: sei, mei: mei,
      name: (sei + ' ' + mei).trim(),
      yomi: (pick('せい') + ' ' + pick('めい')).trim(),
      sex: pick('性別'),
      tag: pick('分散タグ')
    });
  }
  return out;
}

/* ============================================================
 *  配置の読み書き
 * ============================================================ */

/** 配置シートは席ID→番号だけが正本。班IDと氏名は読みやすさのための写し */
function readAssign_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ASSIGN);
  var map = {};
  if (!sh) return map;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var id = String(vals[i][0]).trim();
    var num = String(vals[i][2]).trim();
    if (id && num) map[id] = num;
  }
  return map;
}

function writeAssign_(plan, roster, map) {
  var ss = SpreadsheetApp.getActive();
  var sh = ensureSheet_(ss, SHEETS.ASSIGN, [['席ID', '班ID', '番号', '氏名']]);
  var byNum = {};
  for (var i = 0; i < roster.length; i++) byNum[roster[i].num] = roster[i];

  var rows = [];
  for (var s = 0; s < plan.seats.length; s++) {
    var seat = plan.seats[s];
    var num = map[seat.id] || '';
    rows.push([seat.id, seat.group, num, num && byNum[num] ? byNum[num].name : '']);
  }
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 4).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
}

/* ============================================================
 *  ボード / 印刷 が呼ぶ入口
 * ============================================================ */

function getBoardData() {
  var cfg = readConfig_();
  var roster = readRoster_(cfg);
  var plan = readPlan_();
  var map = readAssign_();

  // 名簿から消えた児童が配置に残っていると、以後ずっと幽霊席になる。ここで落とす
  var known = {};
  for (var i = 0; i < roster.length; i++) known[roster[i].num] = true;
  var seatIds = {};
  for (var s = 0; s < plan.seats.length; s++) seatIds[plan.seats[s].id] = true;
  var clean = {};
  for (var id in map) {
    if (seatIds[id] && known[map[id]]) clean[id] = map[id];
  }

  return {
    className: String(cfg['学級名'] || ''),
    teacherDeskAt: String(cfg['教卓の位置'] || '上'),
    round: Number(cfg['実施回'] || 0),
    plan: plan,
    roster: roster,
    assign: clean
  };
}

function saveAssign(map) {
  var cfg = readConfig_();
  var roster = readRoster_(cfg);
  var plan = readPlan_();
  writeAssign_(plan, roster, map || {});
  return true;
}

/** ボードから印刷へ移る。ダイアログは1枚しか出せないので差し替える */
function switchToPrint() {
  openPrint();
  return true;
}

/* ============================================================
 *  確定（履歴に残す）
 * ============================================================ */

/**
 * いまの配置を1回ぶんの実績として履歴に追記する。
 * 履歴は席IDではなく「誰が誰と同じ班・隣だったか」を後から導出するための生ログで、
 * 教室の形が変われば意味が変わる。だから平面図も同じ実施回で控えておく。
 */
function commitAssign() {
  var ui = SpreadsheetApp.getUi();
  var cfg = readConfig_();
  var roster = readRoster_(cfg);
  var plan = readPlan_();
  var map = readAssign_();

  var placed = 0;
  for (var k in map) placed++;
  if (!placed) { ui.alert('配置が空です。先に児童を並べてください。'); return; }

  var unplaced = roster.length - placed;
  var msg = '実施回 ' + (Number(cfg['実施回'] || 0) + 1) + ' として履歴に残します。\n' +
            '配置済み ' + placed + '名' + (unplaced > 0 ? ' / 未配置 ' + unplaced + '名' : '') + '\n\n' +
            'よろしいですか。';
  if (ui.alert(msg, ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;

  var ss = SpreadsheetApp.getActive();
  var round = Number(cfg['実施回'] || 0) + 1;
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');

  var groupOf = {};
  for (var s = 0; s < plan.seats.length; s++) groupOf[plan.seats[s].id] = plan.seats[s].group;

  var rows = [];
  for (var id in map) rows.push([round, today, map[id], id, groupOf[id] || '']);
  var hs = ss.getSheetByName(SHEETS.HISTORY);
  hs.getRange(hs.getLastRow() + 1, 1, rows.length, 5).setValues(rows);

  var ps = ss.getSheetByName(SHEETS.HISTORY_PLAN);
  ps.getRange(ps.getLastRow() + 1, 1, 1, 2).setValues([[round, JSON.stringify(plan.raw)]]);

  setConfig_('実施回', round);
  ui.alert('実施回 ' + round + ' として記録しました。');
}

function undoCommit() {
  var ui = SpreadsheetApp.getUi();
  var cfg = readConfig_();
  var round = Number(cfg['実施回'] || 0);
  if (round <= 0) { ui.alert('取り消せる記録がありません。'); return; }
  if (ui.alert('実施回 ' + round + ' の記録を削除します。よろしいですか。',
      ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;

  deleteRoundRows_(SHEETS.HISTORY, round);
  deleteRoundRows_(SHEETS.HISTORY_PLAN, round);
  setConfig_('実施回', round - 1);
  ui.alert('実施回 ' + round + ' の記録を削除しました。');
}

function deleteRoundRows_(sheetName, round) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return;
  var vals = sh.getDataRange().getValues();
  for (var i = vals.length - 1; i >= 1; i--) {
    if (Number(vals[i][0]) === round) sh.deleteRow(i + 1);
  }
}

function setConfig_(key, value) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CONFIG);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[key, value]]);
}

/**
 * 名簿順に席へ流し込む。ほとんどの回はここから微修正するだけで済むので、
 * 初期配置を1クリックで作れることが効く。
 */
function fillByRoster(mode) {
  var cfg = readConfig_();
  var roster = readRoster_(cfg);
  var plan = readPlan_();
  var seats = seatOrder_(plan, mode);
  var map = {};
  for (var i = 0; i < roster.length && i < seats.length; i++) {
    map[seats[i].id] = roster[i].num;
  }
  writeAssign_(plan, roster, map);
  return map;
}
