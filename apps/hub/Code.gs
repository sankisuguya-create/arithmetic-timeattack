/**
 * Code.gs — 算数タイムアタック ハブ
 *
 * 各単元サイトへの入口。リンク集に徹する。
 * 名簿はここを正本とし、各単元は IMPORTRANGE で参照する（三重管理を避ける）。
 */

var SHEETS = { LINKS: 'links', ROSTER: 'roster', CONFIG: 'config',
               UNITS: 'units', DASH: 'dashboard' };
var DEFAULTS = { title: '算数タイムアタック', teachers: '' };
var TTL = { links: 60, roster: 300 };
var GUEST_DOMAIN = '@edu.nishi.or.jp';

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
function isGuest_(mail) {
  return !!mail && mail.length > GUEST_DOMAIN.length &&
         mail.indexOf(GUEST_DOMAIN, mail.length - GUEST_DOMAIN.length) >= 0;
}
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
  try { if (mail === ss_().getOwner().getEmail().toLowerCase()) return true; } catch (e) {}
  var list = String(config_().teachers || '').toLowerCase().split(',');
  for (var i = 0; i < list.length; i++) if (list[i].trim() === mail) return true;
  return false;
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
  return {
    ok: true,
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
  return { links: links_(), colors: COLORS, config: config_() };
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
    // 単元アプリの「スプレッドシート」のURL。links の url はウェブアプリのURLで別物。
    // ダッシュボードは各単元の export シートを読むので、シートのURLが要る
    defs[SHEETS.UNITS] = ['単元名', 'スプレッドシートURL'];

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
  return 'セットアップ完了（links / roster / config / units を用意しました）';
}

/* ============================================================
 *  学年ダッシュボード
 * ============================================================ */

/**
 * 各単元の export シートを読んで、1行1児童の横断表を作る。
 *
 * 単元ごとにスプレッドシートを分けてあるので、**同じ児童の九九と
 * あまりのあるわり算を突き合わせられない**。「九九は速いのに あまりで詰まる」は
 * 最も指導価値の高い像で、それが単元をまたがないと作れない。
 *
 * IMPORTRANGE ではなくスクリプトで読むのは、単元が1つでも読めないと
 * 配列結合ごと壊れるため。ここでは単元ごとに try で囲み、
 * 読めなかった単元だけを「状態」に出して残りは表示する。
 *
 * 各単元の Core の版も並べる。単元ごとに Core.gs を手で貼っているので、
 * 貼り忘れた単元だけ古い版で動き続ける。版が揃っているかはここで分かる。
 */
function buildDashboard() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  ensureReady_();
  var ss = ss_();

  var uv = sh_(SHEETS.UNITS).getDataRange().getValues();
  var units = [];
  for (var i = 1; i < uv.length; i++) {
    var name = String(uv[i][0] || '').trim(), url = String(uv[i][1] || '').trim();
    if (name && url) units.push({ name: name, url: url });
  }
  if (!units.length) {
    return 'units シートに単元名とスプレッドシートURLを入れてください。';
  }

  var kids = {};          // email -> { grade, cls, no, name, u: { 単元名: {型, 比} } }
  units.forEach(function (u) {
    u.core = ''; u.rows = 0; u.state = '';
    var v;
    try {
      v = SpreadsheetApp.openByUrl(u.url).getSheetByName('export').getDataRange().getValues();
    } catch (e) {
      u.state = '読めません（URL・共有設定・export シートの有無を確認）';
      return;
    }
    if (!v || v.length < 2) { u.state = 'データがありません（先に単元側で集計する）'; return; }

    for (var r = 1; r < v.length; r++) {
      var row = v[r], mail = String(row[2] || '').toLowerCase();
      if (!mail) continue;
      u.core = u.core || String(row[1] || '');
      u.rows++;
      if (!kids[mail]) {
        kids[mail] = { grade: row[3], cls: row[4], no: row[5], name: row[6], u: {} };
      }
      // 単元ごとに「まん中比がいちばん大きかった型」だけを残す。
      // 全型を並べると単元数×型数の幅になり、横断表として読めなくなる
      var ratio = Number(row[9]);
      if (!ratio) continue;
      var cur = kids[mail].u[u.name];
      if (!cur || ratio > cur.ratio) {
        kids[mail].u[u.name] = { type: String(row[7] || ''), ratio: ratio, sec: Number(row[8]) };
      }
    }
    if (!u.state) u.state = '読めました';
  });

  var sh = ss.getSheetByName(SHEETS.DASH) || ss.insertSheet(SHEETS.DASH);
  sh.clear();

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
  var W = 5 + units.length;
  var rows = [], marks = [];
  function put(a, kind) {
    var x = (a || []).slice(0, W);
    while (x.length < W) x.push('');
    rows.push(x); marks.push(kind || '');
  }

  put(['学年ダッシュボード', stamp], 'title');
  put([]);

  put(['単元の状態（Core の版が揃っていなければ、どれかに貼り忘れています）'], 'head');
  put(['単元', 'Core の版', '行数', '状態', ''], 'sub');
  var cores = {};
  units.forEach(function (u) {
    if (u.core) cores[u.core] = 1;
    put([u.name, u.core || '—', u.rows, u.state, ''], u.state === '読めました' ? '' : 'warn');
  });
  if (Object.keys(cores).length > 1) {
    put(['↑ Core の版が単元ごとに違います。古いほうに貼り直してください。'], 'warn');
  }
  put([]);

  put(['児童ごとの横断表（数字は「学年のまん中の何倍か」。1.5倍以上を色つき）'], 'head');
  var head = ['学年', '組', '番号', '氏名'];
  units.forEach(function (u) { head.push(u.name); });
  head.push('気になる単元数');
  put(head, 'sub');

  var list = Object.keys(kids).map(function (k) { return kids[k]; });
  list.forEach(function (c) {
    c.flag = 0;
    units.forEach(function (u) {
      var x = c.u[u.name];
      if (x && x.ratio >= 1.5) c.flag++;
    });
  });
  list.sort(function (a, b) {
    return b.flag - a.flag || a.grade - b.grade ||
           (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0) || a.no - b.no;
  });

  if (!list.length) put(['（どの単元にもデータがありません）'], 'none');
  list.forEach(function (c) {
    var r = [c.grade, c.cls, c.no, c.name];
    units.forEach(function (u) {
      var x = c.u[u.name];
      r.push(x ? (x.type + ' ' + x.ratio.toFixed(1) + '倍') : '');
    });
    r.push(c.flag || '');
    put(r, c.flag ? 'warn' : '');
  });

  sh.getRange(1, 1, rows.length, W).setValues(rows);
  marks.forEach(function (kind, i) {
    var r = sh.getRange(i + 1, 1, 1, W);
    if (kind === 'title') r.setFontWeight('bold').setFontSize(14);
    else if (kind === 'head') r.setFontWeight('bold').setBackground('#E8F0E4');
    else if (kind === 'sub')  r.setFontColor('#666666').setBackground('#F5F5F5');
    else if (kind === 'warn') r.setBackground('#FDE4B8');
    else if (kind === 'none') r.setFontColor('#888888').setFontStyle('italic');
  });
  for (var w = 5; w <= W; w++) sh.setColumnWidth(w, 150);
  sh.setTabColor('#93C47D');

  sh.getRange('A1').setNote(
    '各単元の export シートを読んで作った横断表です。「ダッシュボードを作る」を押すたびに作り直されます。\n\n' +
    'セルは、その単元でその子がいちばん遅かった型と、学年のまん中の何倍かです。\n' +
    '「九九は普通なのに あまりのあるわり算だけ 1.8倍」のような読み方をします。\n' +
    '単元ごとの絶対の秒数ではなく比を並べているのは、単元によって想起にかかる時間が\n' +
    'そもそも違い、秒のままでは単元をまたいで比べられないためです。\n\n' +
    'この表は児童に見せないでください。'
  );

  var bad = units.filter(function (u) { return u.state !== '読めました'; });
  return 'ダッシュボードを作りました（' + list.length + '人 / ' + units.length + '単元' +
         (bad.length ? ' / 読めなかった単元 ' + bad.length : '') + '）';
}
