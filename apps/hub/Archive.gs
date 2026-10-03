/**
 * Archive.gs — 過年度（ハブ）。名簿の年度保存と、過年度の個人情報の消去
 *
 * 1. 名簿の年度保存（rolloverHubRoster）
 *    毎朝のトリガーから呼び、4/1 にだけ動く。ハブの roster を値のまま roster_<前年度> に写す。
 *    ハブの roster は消さない（消すと、新しい名簿を入れるまで全単元で児童が「おためし」になり記録が残らない）。
 *    新年度の名簿は、教師が準備できた時に roster を書き換える。単元側は Core.gs の rolloverRoster が
 *    同じ日に自分の roster を roster_<前年度> に写す。
 *
 * 2. 過年度の個人情報の消去（arAnonymize）
 *    指定した年度の記録から、児童のメールアドレスと氏名を「<年度>-児童001」「児童001」に置き換える。
 *    - 全単元をまとめて行う。番号は年度の中で単元をまたいで同じ（同じ児童は、どの単元でも同じ番号）。
 *      番号は 学年 → 組 → 番号 → メール の順に振る（記録に残っている、その年度の所属で並べる）。
 *    - 学年・組・番号の列は残す（学級ごとの統計に使う）。単元の分析タブの過去年度表示は、
 *      log の行に残る所属と「児童001」で今まで通り出る（buildAnalysis_ の年度名簿が無い時の経路）。
 *    - 対象: 各単元の log・summary・mistakes・coop・coop_log・coop_save、roster_<年度>（シートごと削除）、
 *      ハブの an_facts・an_support・roster_<年度>（削除）。
 *    - 今年度は消せない（今年度の児童の記録・ベスト・名簿は使用中）。
 *    - summary（自己ベスト）は年度で区切られていないので、今の名簿にいる児童の行は残す（今年度も使う）。
 *    - 元に戻せない。途中で時間切れになっても、番号の対応表 ar_work_<年度>（ハブ）を残すので、
 *      もう一度押せば同じ番号で続きから進む。最後まで終わると対応表は消す。
 *    - スプレッドシートの「版の履歴」には書き換える前の値が残る。完全に消す手順は docs/SETUP.md「過年度」。
 *
 * 権限: スプレッドシートの所有者だけ（各単元のスプレッドシートを開いて書き換えるため）。
 * 計算（番号の振り方・行の書き換え）は ar*_ の純粋関数に分け、tests/archive.test.cjs が Node で直接叩く。
 */

var AR_LOG_SHEET = 'ar_log';
var AR_LOG_HEAD = ['日時', '年度', '実行した人', '児童数', '単元数', '結果'];
var AR_WORK_PREFIX = 'ar_work_';              // 途中の番号の対応表（終わったら消す）
var AR_TIME_BUDGET_MS = 270000;               // GAS の6分制限より手前で止める

/* ============================================================
 *  純粋な計算
 * ============================================================ */

/** その時刻がその年度か。年度の境目はスクリプトのタイムゾーンで見るので、境目の関数 fyOf を受け取る（テストでは UTC の関数を渡す） */
function arInFy_(ts, fy, fyOf) { return !!ts && fyOf(ts) === fy; }

function arPad_(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }
function arName_(n) { return '児童' + arPad_(n); }
function arToken_(fy, n) { return fy + '-' + arName_(n); }
function arIsMail_(s) { return String(s || '').indexOf('@') >= 0; }
/** 消去の確認で打たせる語。画面はこの関数の結果を arStatus から受け取って出す（文言の正本） */
function arConfirmWord_(fy) { return fy + '年度を消去'; }

/**
 * 「いまの名簿を前年度の名簿として保存」の年度。1〜3月はいまの年度（もうすぐ終わる）、4〜12月は1つ前（終わった）。
 * 4/1 の自動保存（rolloverHubRoster）と同じ年度になる
 */
function arRosterFyAt_(fy, month) { return month >= 4 ? fy - 1 : fy; }

/**
 * 番号を振る。entries: [{ mail, grade, cls, no }]（同じ mail が複数あってよい。最初の所属を使う）
 * prev: 前回までの対応表 { mail: 番号 }（途中で止まった時の続き）。既にある児童の番号は変えない。
 * 返り値: { mail: 番号 }
 */
function arNumber_(entries, prev) {
  var map = {}, max = 0, first = {};
  Object.keys(prev || {}).forEach(function (m) { map[m] = prev[m]; if (prev[m] > max) max = prev[m]; });
  entries.forEach(function (e) {
    var m = String(e.mail || '').trim().toLowerCase();
    if (!arIsMail_(m) || map[m] || first[m]) return;
    first[m] = { mail: m, grade: Number(e.grade) || 0, cls: String(e.cls == null ? '' : e.cls).trim(), no: Number(e.no) || 0 };
  });
  Object.keys(first).map(function (m) { return first[m]; }).sort(function (a, b) {
    return a.grade - b.grade ||
      (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0) ||
      a.no - b.no || (a.mail < b.mail ? -1 : a.mail > b.mail ? 1 : 0);
  }).forEach(function (e) { map[e.mail] = ++max; });
  return map;
}

/** 所属（学年-組-番号）→ 番号。氏名しか持たない表（mistakes・coop）を照らすのに使う。同じ所属に2人いれば先の児童 */
function arByKey_(entries, map) {
  var out = {};
  entries.forEach(function (e) {
    var m = String(e.mail || '').trim().toLowerCase(), k = Number(e.grade) + '-' + String(e.cls).trim() + '-' + Number(e.no);
    if (map[m] && !out[k]) out[k] = map[m];
  });
  return out;
}

/** log の行（見出しを含む）から、その年度の児童の所属を集める */
function arLogEntries_(rows, fy, fyOf) {
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!arInFy_(rowMs_(r[0]), fy, fyOf) || !arIsMail_(r[1])) continue;
    out.push({ mail: r[1], grade: r[2], cls: r[3], no: r[4] });
  }
  return out;
}

/** 名簿の行（見出しを含む。email, 学年, 組, 番号, 氏名）から所属を集める */
function arRosterEntries_(rows) {
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (arIsMail_(rows[i][0])) out.push({ mail: rows[i][0], grade: rows[i][1], cls: rows[i][2], no: rows[i][3] });
  }
  return out;
}

/** Core.gs の rowTime_ と同じ（ハブには Core.gs が無いので持つ。tests/past.test.cjs が同じ結果を確かめる）。読めなければ 0 */
function rowMs_(x) {
  if (x instanceof Date) return x.getTime();
  if (x === '' || x == null) return 0;
  var d = new Date(x);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** 対応表に無いメール（記録の途中で名簿から外れた等）。番号を振れないので「児童?」にする */
function arMailOf_(mail, map, fy) {
  var m = String(mail || '').trim().toLowerCase();
  if (!arIsMail_(m)) return mail;
  return map[m] ? arToken_(fy, map[m]) : fy + '-児童?';
}
function arNameOfMail_(mail, map) {
  var m = String(mail || '').trim().toLowerCase();
  return map[m] ? arName_(map[m]) : '児童?';
}

/**
 * log: その年度の行の email（B）と氏名（F）を置き換える。rows を書き換え、書き換えた行の添字を返す（以下の ar*Scrub*_ も同じ）
 */
function arScrubLog_(rows, fy, fyOf, map) {
  var n = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!arInFy_(rowMs_(r[0]), fy, fyOf) || !arIsMail_(r[1])) continue;
    r[5] = arNameOfMail_(r[1], map);
    r[1] = arMailOf_(r[1], map, fy);
    n.push(i);
  }
  return n;
}

/** summary: 年度で区切られていない。今の名簿にいない児童の行だけ置き換える（今の児童のベストは使用中） */
function arScrubSummary_(rows, fy, map, current) {
  var n = [];
  for (var i = 1; i < rows.length; i++) {
    var m = String(rows[i][0] || '').trim().toLowerCase();
    if (!arIsMail_(m) || !map[m] || current[m]) continue;
    rows[i][0] = arToken_(fy, map[m]);
    n.push(i);
  }
  return n;
}

/** mistakes: 日時, 学年, 組, 番号, 氏名, … 。所属から番号を引く */
function arScrubMistakes_(rows, fy, fyOf, byKey) {
  var n = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!arInFy_(rowMs_(r[0]), fy, fyOf) || !String(r[4] || '').trim()) continue;
    var k = Number(r[1]) + '-' + String(r[2]).trim() + '-' + Number(r[3]);
    var name = byKey[k] ? arName_(byKey[k]) : '児童?';
    if (r[4] !== name) { r[4] = name; n.push(i); }
  }
  return n;
}

function arJson_(s, dflt) { try { return JSON.parse(s); } catch (e) { return dflt; } }

/** 協力の回の氏名の並び names を、同じ並びの nos とクラス "学年-組" から置き換える */
function arNames_(names, nos, cls, byKey) {
  if (!Array.isArray(names)) return names;
  return names.map(function (nm, i) {
    var k = String(cls) + '-' + Number((nos || [])[i]);
    return byKey[k] ? arName_(byKey[k]) : (String(nm || '') ? '児童?' : nm);
  });
}

/** 値の中のメールアドレス（文字列・配列・オブジェクトのキーと値）を置き換える。order などに使う */
function arDeepMail_(x, map, fy) {
  if (typeof x === 'string') return arIsMail_(x) ? arMailOf_(x, map, fy) : x;
  if (Array.isArray(x)) return x.map(function (v) { return arDeepMail_(v, map, fy); });
  if (x && typeof x === 'object') {
    var o = {};
    Object.keys(x).forEach(function (k) { o[arIsMail_(k) ? arMailOf_(k, map, fy) : k] = arDeepMail_(x[k], map, fy); });
    return o;
  }
  return x;
}

/** coop: id, class, pattern, seed, mode, gn, groups, names, nos, start, … */
function arScrubCoop_(rows, fy, fyOf, byKey) {
  var n = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!arInFy_(rowMs_(r[9]), fy, fyOf)) continue;
    var names = arJson_(r[7], null), nos = arJson_(r[8], []);
    if (!Array.isArray(names)) continue;
    var nn = JSON.stringify(arNames_(names, nos, r[1], byKey));
    if (nn !== r[7]) { r[7] = nn; n.push(i); }
  }
  return n;
}

/** coop_log: session, t, email, correct, mode */
function arScrubCoopLog_(rows, fy, fyOf, map) {
  var n = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!arInFy_(rowMs_(r[1]), fy, fyOf) || !arIsMail_(r[2])) continue;
    r[2] = arMailOf_(r[2], map, fy); n.push(i);
  }
  return n;
}

/** coop_save: save_id, name, saved, session, payload（JSON。names・nos・cls・order） */
function arScrubCoopSave_(rows, fy, fyOf, map, byKey) {
  var n = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!arInFy_(rowMs_(r[2]), fy, fyOf)) continue;
    var p = arJson_(r[4], null);
    if (!p || typeof p !== 'object') continue;
    p.names = arNames_(p.names, p.nos, p.cls, byKey);
    p = arDeepMail_(p, map, fy);
    var j = JSON.stringify(p);
    if (j !== r[4]) { r[4] = j; n.push(i); }
  }
  return n;
}

/** an_facts（ハブ）: email, unit, type, week(yyyy-mm-dd), … */
function arScrubFacts_(rows, fy, fyOf, map) {
  var n = [];
  rows.forEach(function (r, i) {
    if (!arIsMail_(r[0]) || !arInFy_(rowMs_(r[3]), fy, fyOf)) return;
    r[0] = arMailOf_(r[0], map, fy); n.push(i);
  });
  return n;
}

/** an_support（ハブ）: id, created, by, target('child:<mail>'), unit, types, start, … */
function arScrubSupport_(rows, fy, fyOf, map) {
  var n = [];
  rows.forEach(function (r, i) {
    var t = String(r[3] || '');
    if (t.indexOf('child:') !== 0 || !arInFy_(rowMs_(r[6]), fy, fyOf)) return;
    var m = t.slice(6);
    if (!arIsMail_(m)) return;
    r[3] = 'child:' + arMailOf_(m, map, fy); n.push(i);
  });
  return n;
}

/* ============================================================
 *  シートを触る層
 * ============================================================ */

/** Core.gs の fyOfTime_ と同じ（年度の境目。ハブ側の正本） */
function arFyOf_(ts) {
  var d = new Date(ts), tz = Session.getScriptTimeZone();
  var y = Number(Utilities.formatDate(d, tz, 'yyyy')), m = Number(Utilities.formatDate(d, tz, 'M'));
  return m >= 4 ? y : y - 1;
}
function arCurFy_() { return arFyOf_(Date.now()); }

function arOwnerCheck_() {
  var me = email_(), owner = '';
  try { owner = ss_().getOwner().getEmail().toLowerCase(); } catch (e) {}
  if (!me || me !== owner) throw new Error('この操作はスプレッドシートの所有者だけができます');
}

/** links の sheet 欄から、単元の記録スプレッドシートを重複なく */
function arUnitSheets_() {
  var out = [], seen = {};
  links_().forEach(function (l) {
    var id = anSheetIdOf_(l.sheet);
    if (id && !seen[id]) { seen[id] = true; out.push({ id: id, title: l.title || l.id }); }
  });
  return out;
}
/** Analysis.gs の anSheetId_ と同じ（Analysis.gs を貼っていない写しでも動くように持つ） */
function anSheetIdOf_(s) {
  s = String(s || '').trim();
  var m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : s;
}

function arValues_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 1 || sh.getLastColumn() < 1) return null;
  return { sh: sh, v: sh.getDataRange().getValues() };
}
/**
 * 書き換えた行の、決まった列だけを書き戻す。シート全体を書き戻さないのは、
 * 単元のスクリプトが同じ時刻に summary や coop の行を更新していると、古い値で上書きしてしまうため
 * （単元のスクリプトのロックはハブからは取れない）。行は追記されるだけで動かないので、行番号は変わらない。
 * cols: 0始まりの列の添字（連続していること）
 */
function arWriteRows_(t, idx, cols) {
  if (!t || !idx.length) return;
  var c0 = cols[0], w = cols.length;
  // 連続した行はまとめて書く（log は年度の行がほぼ連続している）
  var i = 0;
  while (i < idx.length) {
    var j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    var block = [];
    for (var k = idx[i]; k <= idx[j]; k++) block.push(t.v[k].slice(c0, c0 + w));
    t.sh.getRange(idx[i] + 1, c0 + 1, block.length, w).setValues(block);
    i = j + 1;
  }
}

function arReadWork_(fy) {
  var sh = ss_().getSheetByName(AR_WORK_PREFIX + fy), map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (arIsMail_(r[0])) map[String(r[0]).toLowerCase()] = Number(r[1]);
  });
  return map;
}
function arSaveWork_(fy, map) {
  var ss = ss_(), sh = ss.getSheetByName(AR_WORK_PREFIX + fy) || ss.insertSheet(AR_WORK_PREFIX + fy);
  sh.clear();
  var rows = [['email', '番号']].concat(Object.keys(map).map(function (m) { return [m, map[m]]; }));
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  try { sh.hideSheet(); } catch (e) {}
}

function arLog_(fy, nKids, nUnits, msg) {
  var ss = ss_(), sh = ss.getSheetByName(AR_LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(AR_LOG_SHEET);
    sh.getRange(1, 1, 1, AR_LOG_HEAD.length).setValues([AR_LOG_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), fy, email_(), nKids, nUnits, msg]);
}

/** 今の名簿（ハブ）のメール集合。summary の行を残すかの判定に使う */
function arCurrentMails_() {
  var set = {};
  arRosterEntries_(sh_(SHEETS.ROSTER).getDataRange().getValues()).forEach(function (e) {
    set[String(e.mail).trim().toLowerCase()] = true;
  });
  return set;
}

/**
 * 過年度タブの表。年度ごとに、単元ごとの「氏名・メールが残っている児童の数」と名簿シートの有無。
 * 読むだけ。教師なら見られる（消去は所有者だけ）
 */
function arStatus() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  var cur = arCurFy_(), years = {}, units = [];
  function y(fy) { return years[fy] || (years[fy] = { fy: fy, pii: 0, units: {}, rosters: [] }); }
  arUnitSheets_().forEach(function (u) {
    var rec = { id: u.id, title: u.title, err: '' };
    units.push(rec);
    var ss;
    try { ss = SpreadsheetApp.openById(u.id); } catch (e) { rec.err = '開けません（共有を確認）'; return; }
    var log = arValues_(ss, 'log');
    if (log) {
      var kids = {};
      for (var i = 1; i < log.v.length; i++) {
        var ts = rowMs_(log.v[i][0]);
        if (!ts) continue;
        var fy = arFyOf_(ts);
        y(fy);
        if (arIsMail_(log.v[i][1])) (kids[fy] || (kids[fy] = {}))[String(log.v[i][1]).toLowerCase()] = true;
      }
      Object.keys(kids).forEach(function (fy) { y(Number(fy)).units[u.id] = Object.keys(kids[fy]).length; });
    }
    ss.getSheets().forEach(function (s) {
      var m = s.getName().match(/^roster_(\d{4})$/);
      if (m) y(Number(m[1])).rosters.push(u.title);
    });
  });
  ss_().getSheets().forEach(function (s) {
    var m = s.getName().match(/^roster_(\d{4})$/);
    if (m) y(Number(m[1])).rosters.push('ハブ');
  });
  var log = [];
  var lsh = ss_().getSheetByName(AR_LOG_SHEET);
  if (lsh && lsh.getLastRow() > 1) {
    log = lsh.getRange(2, 1, lsh.getLastRow() - 1, AR_LOG_HEAD.length).getValues().map(function (r) {
      return { at: Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), 'yyyy/M/d H:mm'), fy: Number(r[1]), by: String(r[2]), kids: r[3], units: r[4], msg: String(r[5]) };
    }).reverse().slice(0, 20);
  }
  var owner = false;
  try { owner = email_() === ss_().getOwner().getEmail().toLowerCase(); } catch (e) {}
  var month = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M'));
  var rfy = arRosterFyAt_(cur, month);
  return {
    cur: cur, owner: owner, units: units, log: log,
    rosterFy: rfy, rosterSaved: !!ss_().getSheetByName('roster_' + rfy),
    years: Object.keys(years).map(Number).sort(function (a, b) { return b - a; }).map(function (fy) {
      var o = years[fy];
      o.pii = 0;
      Object.keys(o.units).forEach(function (k) { o.pii += o.units[k]; });
      o.pending = !!ss_().getSheetByName(AR_WORK_PREFIX + fy);
      o.confirm = arConfirmWord_(fy);
      return o;
    })
  };
}

/**
 * 過年度の個人情報を消す（児童001 などに置き換える）。元に戻せない。
 * confirm には「<年度>年度を消去」と打ったものを渡す（押し間違いを防ぐ）。
 */
function arAnonymize(fy, confirm) {
  arOwnerCheck_();
  fy = Number(fy);
  if (!(fy > 2000) || fy >= arCurFy_()) throw new Error('今年度とこれから先の年度は消せません');
  if (String(confirm || '').trim() !== arConfirmWord_(fy)) throw new Error('確認の文字が違います（「' + arConfirmWord_(fy) + '」と入力）');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('別の処理が動いています。しばらくしてから押してください');
  try {
    var t0 = Date.now(), units = arUnitSheets_(), opened = [], errs = [];

    // 1. 全単元から、その年度の児童の所属を集めて番号を振る（前回の続きなら前回の番号を引き継ぐ）
    var entries = [];
    units.forEach(function (u) {
      var ss;
      try { ss = SpreadsheetApp.openById(u.id); } catch (e) { errs.push(u.title + '：開けません'); return; }
      var log = arValues_(ss, 'log');
      if (log) entries = entries.concat(arLogEntries_(log.v, fy, arFyOf_));
      var ro = arValues_(ss, 'roster_' + fy);
      if (ro) entries = entries.concat(arRosterEntries_(ro.v));
      opened.push({ u: u, ss: ss, log: log });
    });
    if (errs.length) throw new Error('開けない単元があるため止めました（番号が単元ごとにずれるのを防ぐため）: ' + errs.join(' / '));
    var hro = arValues_(ss_(), 'roster_' + fy);
    if (hro) entries = entries.concat(arRosterEntries_(hro.v));
    var map = arNumber_(entries, arReadWork_(fy));
    var byKey = arByKey_(entries, map);
    arSaveWork_(fy, map);
    var current = arCurrentMails_();

    // 2. 単元ごとに書き換える。時間切れなら止めて、次に押した時に続きから（済んだ行はメールが無いので飛ばされる）
    var done = 0, rowsN = 0;
    for (var i = 0; i < opened.length; i++) {
      if (Date.now() - t0 > AR_TIME_BUDGET_MS) {
        arLog_(fy, Object.keys(map).length, done, '時間切れ（' + done + '/' + opened.length + ' 単元）。もう一度押すと続きから');
        return { ok: true, partial: true, msg: '時間切れのため ' + done + '/' + opened.length + ' 単元で止めました。もう一度押すと、同じ番号で続きから進みます。' };
      }
      var o = opened[i], ss = o.ss, t;
      if (o.log) { var li = arScrubLog_(o.log.v, fy, arFyOf_, map); rowsN += li.length; arWriteRows_(o.log, li, [1, 2, 3, 4, 5]); }
      if ((t = arValues_(ss, 'summary'))) arWriteRows_(t, arScrubSummary_(t.v, fy, map, current), [0]);
      if ((t = arValues_(ss, 'mistakes'))) arWriteRows_(t, arScrubMistakes_(t.v, fy, arFyOf_, byKey), [4]);
      if ((t = arValues_(ss, 'coop'))) arWriteRows_(t, arScrubCoop_(t.v, fy, arFyOf_, byKey), [7]);
      if ((t = arValues_(ss, 'coop_log'))) arWriteRows_(t, arScrubCoopLog_(t.v, fy, arFyOf_, map), [2]);
      if ((t = arValues_(ss, 'coop_save'))) arWriteRows_(t, arScrubCoopSave_(t.v, fy, arFyOf_, map, byKey), [4]);
      var rs = ss.getSheetByName('roster_' + fy);
      if (rs) ss.deleteSheet(rs);
      SpreadsheetApp.flush();
      done++;
    }

    // 3. ハブ側
    var hub = ss_(), ft = hub.getSheetByName('an_facts');
    if (ft && ft.getLastRow() > 1) {
      var fv = ft.getRange(2, 1, ft.getLastRow() - 1, ft.getLastColumn()).getValues();
      arWriteRows_({ sh: ft, v: [null].concat(fv) }, arScrubFacts_(fv, fy, arFyOf_, map).map(function (i) { return i + 1; }), [0]);
    }
    var st = hub.getSheetByName('an_support');
    if (st && st.getLastRow() > 1) {
      var sv = st.getRange(2, 1, st.getLastRow() - 1, st.getLastColumn()).getValues();
      arWriteRows_({ sh: st, v: [null].concat(sv) }, arScrubSupport_(sv, fy, arFyOf_, map).map(function (i) { return i + 1; }), [3]);
    }
    var hr = hub.getSheetByName('roster_' + fy);
    if (hr) hub.deleteSheet(hr);
    var wk = hub.getSheetByName(AR_WORK_PREFIX + fy);
    if (wk) hub.deleteSheet(wk);

    var n = Object.keys(map).length;
    arLog_(fy, n, done, '完了（log ' + rowsN + ' 行）');
    return { ok: true, partial: false,
             msg: fy + '年度の ' + n + ' 人分を「児童001」などに置き換えました（' + done + ' 単元・log ' + rowsN + ' 行）。名簿シート roster_' + fy + ' は削除しました。' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 名簿の年度保存。毎朝のトリガーから呼び、4/1 にだけ動く。roster を値のまま roster_<前年度> に写す。
 * roster は消さない（上の説明）。roster_<前年度> がすでにあれば何もしない（冪等）
 */
function rolloverHubRoster(now) {
  now = (now instanceof Date) ? now : new Date();   // トリガー呼び出しはイベントobjが来る
  var tz = Session.getScriptTimeZone();
  if (Utilities.formatDate(now, tz, 'MMdd') !== '0401') return;
  arArchiveRoster_(arRosterFyAt_(arFyOf_(now.getTime()), 4));   // 4/1 は新年度。保存するのは1つ前
}

/** roster を roster_<fy> に値で写す。済みなら何もしない。写したら true */
function arArchiveRoster_(fy) {
  var ss = ss_(), name = 'roster_' + fy;
  if (ss.getSheetByName(name)) return false;
  var v = sh_(SHEETS.ROSTER).getDataRange().getValues();
  if (!v.some(function (r) { return arIsMail_(r[0]); })) return false;   // 空の名簿は残さない
  var arch = ss.insertSheet(name);
  arch.getRange(1, 1, v.length, v[0].length).setValues(v);
  arch.setTabColor('#93C47D');
  return true;
}

/**
 * 教師画面から：今の roster を前年度の名簿として今すぐ保存する（4/1 のトリガーを待たずに名簿を入れ替えたい時）。
 * 年度は画面に選ばせず、ここで決める（arRosterFyAt_）
 */
function arArchiveRosterNow() {
  arOwnerCheck_();
  var fy = arRosterFyAt_(arCurFy_(), Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M')));
  return arArchiveRoster_(fy) ? 'roster_' + fy + ' に保存しました。' : 'roster_' + fy + ' はすでにあるか、名簿が空です。';
}

function arEnsureTrigger_() {
  var have = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'rolloverHubRoster'; });
  // 単元の rolloverRoster（2時）と同じ時間帯。どちらも 4/1 にだけ動く
  if (!have) ScriptApp.newTrigger('rolloverHubRoster').timeBased().atHour(2).everyDays(1).create();
}
