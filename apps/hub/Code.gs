/**
 * Code.gs — 算数タイムアタック ハブ
 *
 * 各単元サイトへの入口。リンク集に徹する。
 * 名簿はここを正本とし、各単元は IMPORTRANGE で参照する（三重管理を避ける）。
 */

var SHEETS = { LINKS: 'links', ROSTER: 'roster', CONFIG: 'config' };
var DEFAULTS = { title: '算数タイムアタック', teachers: '' };
var TTL = { links: 60, roster: 300 };
/**
 * 教師のドメイン。ここに属するアカウントは、名簿になくても教師として扱う。
 *
 * **児童は @kyoiku.edu.nishi.or.jp で、教師ドメインのサブドメインになっている。**
 * 「edu.nishi.or.jp を含む」で判定すると児童が全員教師になり、
 * リンクの編集画面が児童から開けてしまう。@ の右側の完全一致でだけ判定すること。
 */
var TEACHER_DOMAIN = 'edu.nishi.or.jp';

/* 各リンクの色。児童が見分けやすいよう6色から選ぶ。
 * fg は bg に対して 36px 太字（WCAG の大きい文字 3:1）を満たす値を選んである。
 * キー名を変えると links シートの color 列が総崩れになるので、増やすことはあっても
 * 既存キーの名前は変えないこと。 */
var COLORS = {
  mint:   { bg: '#12C48B', fg: '#052A1F' },
  blue:   { bg: '#2B4CF2', fg: '#F0F3FF' },
  amber:  { bg: '#FFC400', fg: '#2E2200' },
  red:    { bg: '#FF5C38', fg: '#2C0A02' },
  purple: { bg: '#6D4AE0', fg: '#F3EEFF' },
  gray:   { bg: '#4A5568', fg: '#EEF1F6' }
};

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function cache_() { return CacheService.getScriptCache(); }
function sh_(n) {
  var s = ss_().getSheetByName(n);
  if (!s) throw new Error('シートが見つかりません: ' + n);
  return s;
}
function email_() {
  var e = Session.getActiveUser().getEmail();
  return e ? e.toLowerCase() : '';
}
function domainOf_(mail) {
  var at = String(mail || '').lastIndexOf('@');
  return at < 0 ? '' : String(mail).slice(at + 1);
}
function isTeacherDomain_(mail) { return domainOf_(mail) === TEACHER_DOMAIN; }

/** 名簿になくても開ける（記録しない）。教師ドメインだけ */
function isGuest_(mail) { return isTeacherDomain_(mail); }
function toBool_(x) {
  if (x === true) return true;
  if (x === false || x === '' || x == null) return false;
  var s = String(x).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'yes' || s === '○';
}

function config_() {
  var hit = cache_().get('config');
  if (hit) return JSON.parse(hit);
  var c = {};
  for (var k in DEFAULTS) c[k] = DEFAULTS[k];
  var v = sh_(SHEETS.CONFIG).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    var key = String(v[i][0]).trim();
    if (key) c[key] = v[i][1];
  }
  cache_().put('config', JSON.stringify(c), TTL.links);
  return c;
}

function isTeacher_(mail) {
  if (!mail) return false;
  if (isTeacherDomain_(mail)) return true;          // 設定を読まずに済むので先に見る
  try { if (mail === ss_().getOwner().getEmail().toLowerCase()) return true; } catch (e) {}
  // config.teachers は例外の口。別ドメインの教師を1件ずつ足す
  var list = String(config_().teachers || '').toLowerCase().split(',');
  for (var i = 0; i < list.length; i++) if (list[i].trim() === mail) return true;
  return false;
}

/** 教師画面の URL。いま動いているデプロイに ?page=teacher を付ける */
function teacherUrl_() {
  try {
    var u = ScriptApp.getService().getUrl();
    return u ? (u + (u.indexOf('?') >= 0 ? '&' : '?') + 'page=teacher') : '';
  } catch (e) { return ''; }
}

/** いまどの写しを操作しているか。教師画面の行き先に使う */
function where_() {
  var out = { file: '', id: '', url: '', sheetUrl: '' };
  try { out.file = ss_().getName(); } catch (e) {}
  try { out.id = ss_().getId(); } catch (e) {}
  try { out.sheetUrl = ss_().getUrl(); } catch (e) {}
  try { out.url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return out;
}

function child_(mail) {
  if (!mail) return null;
  var key = 'roster_' + mail;
  var hit = cache_().get(key);
  if (hit) return JSON.parse(hit);
  var v = sh_(SHEETS.ROSTER).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === mail) {
      var c = { email: mail, grade: Number(v[i][1]), cls: String(v[i][2]), name: String(v[i][4] || '') };
      cache_().put(key, JSON.stringify(c), TTL.roster);
      return c;
    }
  }
  return null;
}

/**
 * links シート: id / title / subtitle / url / grades / color / visible / order
 * grades は "3,4" のようなカンマ区切り。空か "all" なら全学年。
 */
function links_() {
  var hit = cache_().get('links');
  if (hit) return JSON.parse(hit);
  var v = sh_(SHEETS.LINKS).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim();
    if (!id) continue;
    out.push({
      id: id,
      title: String(v[i][1] || ''),
      subtitle: String(v[i][2] || ''),
      url: String(v[i][3] || ''),
      grades: String(v[i][4] || '').trim(),
      color: String(v[i][5] || 'mint').trim(),
      visible: toBool_(v[i][6]),
      order: Number(v[i][7]) || 0
    });
  }
  out.sort(function (a, b) { return a.order - b.order; });
  cache_().put('links', JSON.stringify(out), TTL.links);
  return out;
}

function forGrade_(list, grade) {
  return list.filter(function (l) {
    if (!l.visible || !l.url) return false;
    if (!l.grades || l.grades.toLowerCase() === 'all') return true;
    if (!grade) return true;                    // 学年不明なら全部見せる
    return l.grades.split(',').some(function (g) { return Number(g.trim()) === Number(grade); });
  });
}

/* ============================================================
 *  ルーティング
 * ============================================================ */

function doGet(e) {
  ensureReady_();
  var page = (e && e.parameter && e.parameter.page) || '';
  if (page === 'teacher') {
    if (!isTeacher_(email_())) {
      return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">この画面を開く権限がありません。</p>');
    }
    return HtmlService.createHtmlOutputFromFile('teacher')
      .setTitle('リンク集 設定')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle(config_().title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ============================================================
 *  児童用 API
 * ============================================================ */

function boot() {
  var mail = email_();
  if (!mail) return { ok: false, msg: 'ログイン情報を取得できません。学校のアカウントで開いてください。' };
  var c = child_(mail);
  if (!c && !isGuest_(mail)) {
    return { ok: false, msg: '名簿に登録がありません。担任の先生に伝えてください。' };
  }
  var grade = c ? c.grade : 0;
  var teacher = isTeacher_(mail);
  return {
    ok: true,
    // 教師が児童画面から設定画面へ移れるようにする。
    // 児童のアカウントではこの2つが入らないので、リンク自体が描かれない
    teacher: teacher,
    teacherUrl: teacher ? teacherUrl_() : '',
    title: config_().title,
    name: c ? c.name : '',
    grade: grade,
    colors: COLORS,
    links: forGrade_(links_(), grade).map(function (l) {
      return { title: l.title, subtitle: l.subtitle, url: l.url, color: l.color };
    })
  };
}

/* ============================================================
 *  教師用 API
 * ============================================================ */

function getAllLinks() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  return { links: links_(), colors: COLORS, config: config_(), where: where_() };
}

/** 画面の一覧をそのまま保存する（並び順は配列の順） */
function saveLinks(rows) {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  var sh = sh_(SHEETS.LINKS);
  sh.clear();
  var head = ['id', 'title', 'subtitle', 'url', 'grades', 'color', 'visible', 'order'];
  var out = [head];
  (rows || []).forEach(function (r, i) {
    out.push([
      String(r.id || Utilities.getUuid().slice(0, 8)),
      String(r.title || ''), String(r.subtitle || ''), String(r.url || ''),
      String(r.grades || ''), String(r.color || 'mint'),
      r.visible ? true : false, i + 1
    ]);
  });
  sh.getRange(1, 1, out.length, head.length).setValues(out);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidth(4, 320);
  cache_().remove('links');
  return '保存しました（' + (out.length - 1) + ' 件）';
}

/**
 * 公開／非公開の1クリック切替。
 * saveLinks はシート全体を書き直すが、こちらは該当行の visible 列だけを触る。
 * 教師が他の欄を編集している最中でも、その未保存の入力を巻き込まない。
 */
function setVisible(id, visible) {
  if (!isTeacher_(email_())) throw new Error('権限がありません');

  var sh = sh_(SHEETS.LINKS);
  var v = sh.getDataRange().getValues();

  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === String(id)) {
      sh.getRange(i + 1, 7).setValue(visible ? true : false);   // 7 = visible 列
      cache_().remove('links');
      return visible ? '公開にしました' : '非公開にしました';
    }
  }
  throw new Error('この行が見つかりません。ページを開き直してください。');
}

function saveHubConfig(obj) {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  var sh = sh_(SHEETS.CONFIG);
  var v = sh.getDataRange().getValues();
  for (var key in obj) {
    var found = false;
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(obj[key]); found = true; break; }
    }
    if (!found) sh.appendRow([key, obj[key]]);
  }
  cache_().remove('config');
  return config_();
}

/** 名簿にある学年の一覧（学年フィルタの選択肢に使う） */
function listGrades() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  var v = sh_(SHEETS.ROSTER).getDataRange().getValues();
  var set = {};
  for (var i = 1; i < v.length; i++) {
    var g = Number(v[i][1]);
    if (g) set[g] = true;
  }
  return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
}

/* ============================================================
 *  自動セットアップ
 * ============================================================ */

function ensureReady_() {
  if (cache_().get('ready')) return;
  try {
    var ss = ss_(), defs = {};
    defs[SHEETS.CONFIG] = ['key', 'value'];
    defs[SHEETS.ROSTER] = ['email', '学年', '組', '番号', '氏名'];
    defs[SHEETS.LINKS] = ['id', 'title', 'subtitle', 'url', 'grades', 'color', 'visible', 'order'];

    for (var name in defs) {
      var sh = ss.getSheetByName(name) || ss.insertSheet(name);
      if (sh.getLastRow() === 0) {
        sh.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
    }
    var cf = ss.getSheetByName(SHEETS.CONFIG);
    if (cf.getLastRow() <= 1) {
      var rows = [];
      for (var k in DEFAULTS) rows.push([k, DEFAULTS[k]]);
      cf.getRange(2, 1, rows.length, 2).setValues(rows);
    }
    cache_().put('ready', '1', 3600);
  } catch (e) {
    console.error('ensureReady_ 失敗: ' + e.message);
  }
}

function setup() {
  cache_().remove('ready');
  ensureReady_();
  return 'セットアップ完了（links / roster / config を用意しました）';
}
