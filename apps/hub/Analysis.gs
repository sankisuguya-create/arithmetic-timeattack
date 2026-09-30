/**
 * Analysis.gs — 単元横断の分析（段階1: 横断集約 / 段階2: 手立ての記録）
 *
 * 要件は docs/ANALYSIS_REQUIREMENTS.md。ここでの決まり:
 * - 児童の経路（doGet → links / boot）には一切載せない。集計は夜間のトリガー、閲覧は ?page=analysis
 * - 開けるのはスプレッドシートの所有者と config.an_analysts に並べた人だけ（教師ドメインの一致では開かない）
 * - 各単元の log は読むだけ。単元のシートには書かない
 * - 下位・伸びの基準は config の an_* に置き、データを見る前に決める（画面からは変えない）
 *
 * ファイルの中は「シートを触る薄い層（an*_ の一部と公開API）」と「純粋な計算（anCompute_ ほか）」に分けてある。
 * 計算は tests/analysis.test.cjs が Node で直接叩く。
 */

var AN = { FACTS: 'an_facts', SOURCES: 'an_sources', SUPPORT: 'an_support', DECISIONS: 'an_decisions' };
var AN_FACT_HEAD = ['email', 'unit', 'type', 'week', 'ok', 'miss', 'ntk', 'ln', 'ln2', 'sess'];
var AN_SOURCE_HEAD = ['sheet_id', 'unit', 'title', 'grade', 'types', 'cursor', 'updated', 'status'];
var AN_SUPPORT_HEAD = ['id', 'created', 'by', 'target', 'unit', 'types', 'start', 'end', 'content', 'freq', 'memo'];
var AN_DECISION_HEAD = ['ts', 'by', 'class', 'memo'];

/**
 * 基準値。根拠は docs/ANALYSIS_REQUIREMENTS.md「下位の定義」。
 * **データを見てから変えない。** 変えるなら理由と日付を docs に残してから config シートを直す。
 */
var AN_DEFAULTS = {
  an_min_trials: 20,        // 型×月でこれ未満は「データ不足」（計算による目安。85%・20試行で95%CI ±16%）
  an_band_strong: 10,       // 10パーセンタイル以下＝強い低さ（Murphy et al. 2007）
  an_band_low: 25,          // 25パーセンタイル以下＝低達成（Murphy et al. 2007 / Burns & Senesac 2005）
  an_persist_months: 2,     // 独立した2か月以上で帯に入ったら「下位が続く」（Francis et al. 2005）
  an_growth_weeks: 12,      // 伸びは最初と最後が12週以上離れてから（Christ et al. 2013）
  an_growth_edge_weeks: 4,  // 伸びの比較に使う、最初と最後の週数
  an_effect_weeks: 4,       // 手立ての前後に取る週数
  an_norm_min: 60,          // 学年の比較集団がこれ未満なら警告（根拠なし。仮の値）
  an_analysts: ''           // "a@x.jp:3-1|3-2, b@y.jp:*"。所有者は書かなくても全学級を見られる
};
var AN_TIME_BUDGET_MS = 270000;   // GAS の6分制限より手前で止め、続きは次回に回す
var AN_BATCH_ROWS = 5000;

/* ============================================================
 *  権限
 * ============================================================ */

function anCfg_() {
  var c = config_(), out = {};
  for (var k in AN_DEFAULTS) {
    var v = c[k];
    out[k] = (v === undefined || v === '') ? AN_DEFAULTS[k] : v;
    if (typeof AN_DEFAULTS[k] === 'number') out[k] = Number(out[k]) || AN_DEFAULTS[k];
  }
  return out;
}

function anOwner_(mail) {
  try { return !!mail && mail === ss_().getOwner().getEmail().toLowerCase(); } catch (e) { return false; }
}

/** config.an_analysts を { mail: '*' | { '3-1': true } } に */
function anParseAnalysts_(s) {
  var out = {};
  String(s || '').split(',').forEach(function (part) {
    part = part.trim();
    if (!part) return;
    var at = part.indexOf(':');
    var mail = (at < 0 ? part : part.slice(0, at)).trim().toLowerCase();
    var rest = at < 0 ? '*' : part.slice(at + 1).trim();
    if (!mail) return;
    if (rest === '*' || rest === '') { out[mail] = '*'; return; }
    var set = {};
    rest.split('|').forEach(function (k) { k = k.trim(); if (k) set[k] = true; });
    out[mail] = set;
  });
  return out;
}

/** '*'（全学級）/ { 'g-c': true } / null（見られない） */
function anScope_(mail) {
  if (!mail) return null;
  if (anOwner_(mail)) return '*';
  var list = anParseAnalysts_(anCfg_().an_analysts);
  return list.hasOwnProperty(mail) ? list[mail] : null;
}

function canAnalyze_(mail) { return !!anScope_(mail); }

function anCheck_(key) {
  var sc = anScope_(email_());
  if (!sc) throw new Error('権限がありません');
  if (key && sc !== '*' && !sc[key]) throw new Error('この学級を見る権限がありません');
  return sc;
}

function analysisUrl_() {
  try {
    var u = ScriptApp.getService().getUrl();
    return u ? (u + (u.indexOf('?') >= 0 ? '&' : '?') + 'page=analysis') : '';
  } catch (e) { return ''; }
}

/* ============================================================
 *  log の読み方（common/Core.gs の写し。tests/analysis.test.cjs が同じ結果になることを確かめる）
 * ============================================================ */

/** Core.gs typeStat_ と同じ。"型:試行数:Σ送信まで:初打鍵あり数:Σ初打鍵まで:Σ(初打鍵まで)^2[:Σln:Σln^2]" */
function anTypeStat_(e) {
  var p = String(e).split(':');
  if (p.length < 6 || !p[0]) return null;
  var o = { t: p[0], ntk: Number(p[3]) || 0, tk: Number(p[4]) || 0, tk2: Number(p[5]) || 0, ln: 0, ln2: 0 };
  if (p.length >= 8) { o.ln = Number(p[6]) || 0; o.ln2 = Number(p[7]) || 0; }
  else if (o.ntk > 0 && o.tk > 0) { var l = Math.log(o.tk / o.ntk); o.ln = o.ntk * l; o.ln2 = o.ntk * l * l; }
  return o;
}

/** Core.gs splitCellItems_ と同じ（円と球の初版の ',' を含むタグを継ぎ直す） */
function anSplitItems_(cell, typeSet) {
  var out = [];
  String(cell || '').split(',').forEach(function (f) {
    if (!f) return;
    var c0 = f.indexOf(':'), c1 = f.indexOf('|');
    var cut = c0 < 0 ? c1 : (c1 < 0 ? c0 : Math.min(c0, c1));
    var head = cut < 0 ? '' : f.slice(0, cut);
    if (head && typeSet[head]) out.push(f);
    else if (out.length) out[out.length - 1] += ',' + f;
    else out.push(f);
  });
  return out;
}

/**
 * log の1行を型ごとの寄与に分ける。
 * type_stats の「試行数」は**1回目で正解した問題**の数（Core.gs submitSession の firstTry）。
 * 間違えた・打ち直した問題は miss_items に1件ずつ入る。だから型の試行数 = ok + miss。
 */
function anRowFacts_(row, typeSet) {
  var by = {};
  function slot(t) { return by[t] || (by[t] = { ok: 0, miss: 0, ntk: 0, ln: 0, ln2: 0 }); }
  String(row[13] || '').split(',').forEach(function (e) {
    if (!e) return;
    var p = e.split(':');
    if (p.length < 2 || !p[0]) return;
    var s = slot(p[0]);
    s.ok += Number(p[1]) || 0;
    var x = anTypeStat_(e);
    if (x) { s.ntk += x.ntk; s.ln += x.ln; s.ln2 += x.ln2; }
  });
  anSplitItems_(row[11], typeSet).forEach(function (it) {
    var t = it.split(':')[0];
    if (t) slot(t).miss++;
  });
  return by;
}

/* ============================================================
 *  日付（週は月曜はじまり。'yyyy-MM-dd' の文字列で持ち、文字列の大小で比べる）
 * ============================================================ */

function anYmdToUtc_(ymd) {
  var p = String(ymd).split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function anUtcToYmd_(t) {
  var d = new Date(t);
  function z(n) { return (n < 10 ? '0' : '') + n; }
  return d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' + z(d.getUTCDate());
}
function anAddDays_(ymd, n) { return anUtcToYmd_(anYmdToUtc_(ymd) + n * 86400000); }
function anMondayOf_(ymd) {
  var dow = new Date(anYmdToUtc_(ymd)).getUTCDay();   // 0=日
  return anAddDays_(ymd, -((dow + 6) % 7));
}
/** GAS の日付（または読めるもの）→ スクリプトのタイムゾーンでの 'yyyy-MM-dd' */
function anYmd_(v) {
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function anFyStart_(todayYmd) {
  var y = Number(todayYmd.slice(0, 4)), m = Number(todayYmd.slice(5, 7));
  return (m >= 4 ? y : y - 1) + '-04-01';
}

/* ============================================================
 *  夜間集計（各単元の log → an_facts）
 * ============================================================ */

/** URL でも ID でも受ける */
function anSheetId_(s) {
  s = String(s || '').trim();
  var m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : s;
}

function anSheet_(name, head) {
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function anReadTable_(name, head) {
  var sh = anSheet_(name, head), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, head.length).getValues();
}

function anWriteTable_(name, head, rows) {
  var sh = anSheet_(name, head);
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, head.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
}

function anReadMeta_(ss) {
  var sh = ss.getSheetByName('meta');
  if (!sh || sh.getLastRow() < 1) return null;
  var v = sh.getRange(1, 1, sh.getLastRow(), 2).getValues(), o = {};
  v.forEach(function (r) { o[String(r[0])] = r[1]; });
  if (!o.unit_id) return null;
  var types = {};
  try { types = JSON.parse(o.types || '{}'); } catch (e) {}
  return { unit: String(o.unit_id), title: String(o.title || o.unit_id), grade: Number(o.grade) || 0, types: types };
}

/** facts の表を「キー → 行」の辞書にする（純粋） */
function anFactMap_(rows) {
  var m = {};
  rows.forEach(function (r) {
    var k = r[0] + '|' + r[1] + '|' + r[2] + '|' + r[3];
    m[k] = r.slice();
  });
  return m;
}
function anFactAdd_(m, mail, unit, type, week, a) {
  var k = mail + '|' + unit + '|' + type + '|' + week;
  var r = m[k] || (m[k] = [mail, unit, type, week, 0, 0, 0, 0, 0, 0]);
  r[4] += a.ok || 0; r[5] += a.miss || 0; r[6] += a.ntk || 0;
  r[7] += a.ln || 0; r[8] += a.ln2 || 0; r[9] += a.sess || 0;
}

/** 夜間トリガーの本体。所有者が setup で作る */
function nightlyAnalysis() { return anIngest_(); }

function anEnsureTrigger_() {
  var have = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'nightlyAnalysis'; });
  // 単元の nightlyAggregate（23時）より後に回す
  if (!have) ScriptApp.newTrigger('nightlyAnalysis').timeBased().atHour(1).everyDays(1).create();
}

function anIngest_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return '別の集計が動いています。しばらくしてから押してください。';
  try {
    var t0 = Date.now();
    var srcRows = anReadTable_(AN.SOURCES, AN_SOURCE_HEAD), srcBy = {};
    srcRows.forEach(function (r) { srcBy[String(r[0])] = r; });
    var facts = anFactMap_(anReadTable_(AN.FACTS, AN_FACT_HEAD));
    var ids = [], seen = {};
    links_().forEach(function (l) {
      var id = anSheetId_(l.sheet);
      if (id && !seen[id]) { seen[id] = true; ids.push(id); }
    });
    var outSrc = [], added = 0, pending = false;

    ids.forEach(function (id) {
      var prev = srcBy[id] || [id, '', '', '', '{}', 1, '', ''];
      var rec = prev.slice();
      rec[6] = new Date();
      if (Date.now() - t0 > AN_TIME_BUDGET_MS) { rec[7] = '時間切れ。次回つづき'; pending = true; outSrc.push(rec); return; }
      var ss;
      try { ss = SpreadsheetApp.openById(id); }
      catch (e) { rec[7] = '開けません（所有者の共有を確認）: ' + e.message; outSrc.push(rec); return; }
      var meta = anReadMeta_(ss);
      if (!meta) { rec[7] = 'meta がありません。単元の教師画面を一度開くか setup を実行'; outSrc.push(rec); return; }
      rec[1] = meta.unit; rec[2] = meta.title; rec[3] = meta.grade; rec[4] = JSON.stringify(meta.types);
      var log = ss.getSheetByName('log');
      if (!log) { rec[7] = 'log シートがありません'; outSrc.push(rec); return; }
      var last = log.getLastRow(), cur = Number(rec[5]) || 1;
      if (last < cur) {
        // log が短くなった（行を消した）。この単元の分を捨てて最初から読み直す
        Object.keys(facts).forEach(function (k) { if (facts[k][1] === meta.unit) delete facts[k]; });
        cur = 1;
      }
      var typeSet = {};
      Object.keys(meta.types).forEach(function (t) { typeSet[t] = true; });
      while (cur < last) {
        if (Date.now() - t0 > AN_TIME_BUDGET_MS) { pending = true; break; }
        var n = Math.min(AN_BATCH_ROWS, last - cur);
        var v = log.getRange(cur + 1, 1, n, 15).getValues();
        v.forEach(function (row) {
          var mail = String(row[1] || '').trim().toLowerCase();
          var ymd = anYmd_(row[0]);
          if (!mail || !ymd) return;
          var week = anMondayOf_(ymd), by = anRowFacts_(row, typeSet);
          Object.keys(by).forEach(function (t) { anFactAdd_(facts, mail, meta.unit, t, week, by[t]); });
          anFactAdd_(facts, mail, meta.unit, '*', week, { sess: 1 });
          added++;
        });
        cur += n;
      }
      rec[5] = cur;
      rec[7] = cur >= last ? 'OK' : '途中まで。次回つづき';
      outSrc.push(rec);
    });

    var rows = Object.keys(facts).sort().map(function (k) { return facts[k]; });
    anWriteTable_(AN.FACTS, AN_FACT_HEAD, rows);
    anWriteTable_(AN.SOURCES, AN_SOURCE_HEAD, outSrc);
    return '集計しました（新しく読んだ試行 ' + added + ' 件・単元 ' + ids.length + ' 件' +
      (pending ? '・時間切れのため続きは次回' : '') + '）';
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 *  純粋な計算
 * ============================================================ */

/**
 * 中間順位のパーセンタイル（0〜100）。**低いほど悪い。** 自分より悪い人の割合（同点は半分）。
 * higherIsWorse なら値の大きい方が悪い。並べ替えで求める（学年が大きくても O(n log n)）。
 */
function anPctRanks_(items, val, higherIsWorse) {
  var n = items.length, out = {};
  if (n === 1) { out[items[0].email] = 50; return out; }
  // 悪い順に並べる
  var xs = items.map(function (a) { return { e: a.email, v: val(a) }; })
    .sort(function (a, b) { return higherIsWorse ? b.v - a.v : a.v - b.v; });
  var i = 0;
  while (i < n) {
    var j = i;
    while (j + 1 < n && xs[j + 1].v === xs[i].v) j++;
    // 悪い側に i 人、同点は自分を除いて j - i 人
    var p = (i + 0.5 * (j - i)) / (n - 1) * 100;
    for (var k = i; k <= j; k++) out[xs[k].e] = p;
    i = j + 1;
  }
  return out;
}

/** 誤答率を経験ベイズで学年の平均側へ縮める（ベータ分布の積率法）。{ email: 縮めた率 } */
function anShrinkErr_(items) {
  var tot = 0, miss = 0;
  items.forEach(function (x) { tot += x.n; miss += x.miss; });
  var pbar = tot ? miss / tot : 0, out = {};
  if (!items.length) return out;
  var m = 0, v = 0, w = 0;
  items.forEach(function (x) { m += x.miss / x.n; });
  m /= items.length;
  items.forEach(function (x) { var d = x.miss / x.n - m; v += d * d; w += pbar * (1 - pbar) / x.n; });
  v /= items.length; w /= items.length;
  var between = v - w, k;
  if (!(between > 0) || pbar <= 0 || pbar >= 1) k = 1e9;           // 児童間の差が標本誤差で説明できる → 全員を平均に
  else k = Math.max(0, pbar * (1 - pbar) / between - 1);
  var a = pbar * k, b = (1 - pbar) * k;
  items.forEach(function (x) { out[x.email] = (x.miss + a) / (x.n + a + b); });
  return out;
}

function anBand_(pct, cfg) {
  if (pct == null) return 0;
  if (pct <= cfg.an_band_strong) return 2;
  if (pct <= cfg.an_band_low) return 1;
  return 0;
}

/**
 * 分析の本体。
 * facts: [[email, unit, type, week, ok, miss, ntk, ln, ln2, sess], ...]
 * roster: [{ mail, grade, cls, no, name }]（氏名のある児童だけ渡す）
 * units: { unitId: { title, types: { t: 名前 } } }
 * opt: { grade, cls, today }
 */
function anCompute_(facts, roster, units, cfg, opt) {
  var fy = anMondayOf_(anFyStart_(opt.today));
  var gradeKids = {}, classKids = {};
  roster.forEach(function (r) {
    if (Number(r.grade) !== Number(opt.grade)) return;
    gradeKids[r.mail] = r;
    if (String(r.cls) === String(opt.cls)) classKids[r.mail] = r;
  });
  var minT = cfg.an_min_trials;

  // (email, unit, type, month) と (email, unit, type, week) に畳む
  var cell = {}, weekly = {}, sess = {}, unitSeen = {};
  facts.forEach(function (f) {
    var mail = f[0], unit = f[1], t = f[2], week = String(f[3]);
    if (!gradeKids[mail] || week < fy) return;
    unitSeen[unit] = true;
    if (t === '*') { var sk = mail + '|' + unit; sess[sk] = (sess[sk] || 0) + (Number(f[9]) || 0); return; }
    var mon = week.slice(0, 7);
    var add = function (m, k) {
      var c = m[k] || (m[k] = { ok: 0, miss: 0, ntk: 0, ln: 0 });
      c.ok += Number(f[4]) || 0; c.miss += Number(f[5]) || 0; c.ntk += Number(f[6]) || 0; c.ln += Number(f[7]) || 0;
    };
    add(cell, unit + '|' + t + '|' + mon + '|' + mail);
    add(weekly, unit + '|' + t + '|' + week + '|' + mail);
  });

  // 型×月の学年分布 → 児童のパーセンタイル
  var groups = {};
  Object.keys(cell).forEach(function (k) {
    var p = k.split('|'), g = p[0] + '|' + p[1] + '|' + p[2];
    (groups[g] || (groups[g] = [])).push({ email: p[3], c: cell[k] });
  });
  var typePct = {};   // unit|month|email → { sp: [..], ac: [..] }
  var normN = {};     // unit → 最大の比較人数
  Object.keys(groups).forEach(function (g) {
    var p = g.split('|'), unit = p[0], mon = p[2];
    var accItems = [], spItems = [];
    groups[g].forEach(function (x) {
      var n = x.c.ok + x.c.miss;
      if (n >= minT) accItems.push({ email: x.email, n: n, miss: x.c.miss });
      if (x.c.ntk >= minT) spItems.push({ email: x.email, lm: x.c.ln / x.c.ntk });
    });
    normN[unit] = Math.max(normN[unit] || 0, accItems.length);
    var shr = anShrinkErr_(accItems);
    var accPct = anPctRanks_(accItems, function (x) { return shr[x.email]; }, true);
    var spPct = anPctRanks_(spItems, function (x) { return x.lm; }, true);
    function put(email, key, v) {
      var k2 = unit + '|' + mon + '|' + email;
      var o = typePct[k2] || (typePct[k2] = { sp: [], ac: [] });
      o[key].push(v);
    }
    Object.keys(accPct).forEach(function (e) { put(e, 'ac', accPct[e]); });
    Object.keys(spPct).forEach(function (e) { put(e, 'sp', spPct[e]); });
  });

  // 単元×月：型の平均パーセンタイルを学年の中で並べ直す → 帯
  var byUnitMonth = {};
  Object.keys(typePct).forEach(function (k) {
    var p = k.split('|'), um = p[0] + '|' + p[1];
    (byUnitMonth[um] || (byUnitMonth[um] = [])).push({ email: p[2], o: typePct[k] });
  });
  function mean(a) { var s = 0; a.forEach(function (x) { s += x; }); return a.length ? s / a.length : null; }
  var level = {};   // email|unit → { months: { mon: { sp, ac, bsp, bac } } }
  Object.keys(byUnitMonth).forEach(function (um) {
    var p = um.split('|'), unit = p[0], mon = p[1];
    var sp = [], ac = [];
    byUnitMonth[um].forEach(function (x) {
      var s = mean(x.o.sp), a = mean(x.o.ac);
      if (s != null) sp.push({ email: x.email, v: s });
      if (a != null) ac.push({ email: x.email, v: a });
    });
    var rsp = anPctRanks_(sp, function (x) { return -x.v; }, true);
    var rac = anPctRanks_(ac, function (x) { return -x.v; }, true);
    var mails = {};
    sp.concat(ac).forEach(function (x) { mails[x.email] = true; });
    Object.keys(mails).forEach(function (e) {
      var L = level[e + '|' + unit] || (level[e + '|' + unit] = { months: {} });
      L.months[mon] = { sp: rsp.hasOwnProperty(e) ? rsp[e] : null, ac: rac.hasOwnProperty(e) ? rac[e] : null };
      L.months[mon].bsp = anBand_(L.months[mon].sp, cfg);
      L.months[mon].bac = anBand_(L.months[mon].ac, cfg);
    });
  });

  // 伸び：単元ごと、型ごとに「最初の数週」と「最後の数週」の対数時間を比べ、型で平均する
  var edge = cfg.an_growth_edge_weeks, span = cfg.an_growth_weeks;
  var wk = {};   // email|unit → { t: { week: {ntk, ln} } }
  Object.keys(weekly).forEach(function (k) {
    var p = k.split('|'), c = weekly[k];
    if (!c.ntk) return;
    var o = wk[p[3] + '|' + p[0]] || (wk[p[3] + '|' + p[0]] = {});
    (o[p[1]] || (o[p[1]] = {}))[p[2]] = c;
  });
  var growth = {};   // email|unit → { g, first, last } または { short: true }
  Object.keys(wk).forEach(function (eu) {
    var all = [];
    Object.keys(wk[eu]).forEach(function (t) { all = all.concat(Object.keys(wk[eu][t])); });
    all.sort();
    var first = all[0], last = all[all.length - 1];
    if (!first || anYmdToUtc_(last) - anYmdToUtc_(first) < span * 7 * 86400000) { growth[eu] = { short: true, first: first, last: last }; return; }
    var fEnd = anAddDays_(first, edge * 7), lStart = anAddDays_(last, -(edge - 1) * 7);
    var ds = [];
    Object.keys(wk[eu]).forEach(function (t) {
      var a = { ntk: 0, ln: 0 }, b = { ntk: 0, ln: 0 };
      Object.keys(wk[eu][t]).forEach(function (w) {
        var c = wk[eu][t][w];
        if (w < fEnd) { a.ntk += c.ntk; a.ln += c.ln; }
        if (w >= lStart) { b.ntk += c.ntk; b.ln += c.ln; }
      });
      if (a.ntk >= 5 && b.ntk >= 5) ds.push(a.ln / a.ntk - b.ln / b.ntk);   // 正＝速くなった
    });
    growth[eu] = ds.length ? { g: mean(ds), first: first, last: last } : { short: true, first: first, last: last };
  });
  var gByUnit = {};
  Object.keys(growth).forEach(function (eu) {
    if (growth[eu].g == null) return;
    var p = eu.split('|');
    (gByUnit[p[1]] || (gByUnit[p[1]] = [])).push({ email: p[0], g: growth[eu].g });
  });
  Object.keys(gByUnit).forEach(function (u) {
    var pr = anPctRanks_(gByUnit[u], function (x) { return x.g; }, false);
    Object.keys(pr).forEach(function (e) { growth[e + '|' + u].pct = pr[e]; });
  });

  // 児童ごとのまとめ（学級の児童だけ返す。比較は学年全体でした）
  var unitIds = Object.keys(unitSeen).sort();
  var children = Object.keys(classKids).map(function (mail) {
    var r = classKids[mail], perUnit = {};
    unitIds.forEach(function (u) {
      var L = level[mail + '|' + u], G = growth[mail + '|' + u];
      var n = sess[mail + '|' + u] || 0;
      if (!L && !G && !n) return;
      var mons = L ? Object.keys(L.months).sort() : [];
      var latest = mons.length ? L.months[mons[mons.length - 1]] : null;
      function persist(key) {
        var c = 0, strong = 0;
        mons.forEach(function (m) { var b = L.months[m][key]; if (b >= 1) c++; if (b >= 2) strong++; });
        return { months: c, strong: strong, on: c >= cfg.an_persist_months };
      }
      var ps = L ? persist('bsp') : { months: 0, strong: 0, on: false };
      var pa = L ? persist('bac') : { months: 0, strong: 0, on: false };
      var dd = !!(latest && latest.sp != null && latest.sp <= cfg.an_band_low && G && G.pct != null && G.pct <= cfg.an_band_low);
      perUnit[u] = {
        sessions: n,
        latestMonth: mons.length ? mons[mons.length - 1] : '',
        speedPct: latest ? latest.sp : null, accPct: latest ? latest.ac : null,
        speedBand: latest ? latest.bsp : 0, accBand: latest ? latest.bac : 0,
        speedPersist: ps, accPersist: pa,
        growth: G ? { pct: G.pct == null ? null : G.pct, short: !!G.short, g: G.g == null ? null : G.g } : null,
        dual: dd,
        months: mons.map(function (m) { var x = L.months[m]; return { m: m, sp: x.sp, ac: x.ac, bsp: x.bsp, bac: x.bac }; })
      };
    });
    var lowUnits = Object.keys(perUnit).filter(function (u) { return perUnit[u].speedPersist.on || perUnit[u].accPersist.on; });
    return { email: mail, no: r.no, name: r.name, units: perUnit, lowUnits: lowUnits };
  }).sort(function (a, b) { return a.no - b.no; });

  // 学級の型別（年度の初めから）：学級と学年を並べる
  var classView = unitIds.map(function (u) {
    var types = Object.keys((units[u] && units[u].types) || {});
    var agg = {};
    Object.keys(cell).forEach(function (k) {
      var p = k.split('|');
      if (p[0] !== u) return;
      var t = p[1], mail = p[3], c = cell[k];
      if (types.indexOf(t) < 0) types.push(t);
      var a = agg[t] || (agg[t] = { cls: { ok: 0, miss: 0, ntk: 0, ln: 0, kids: {} }, grd: { ok: 0, miss: 0, ntk: 0, ln: 0, kids: {} } });
      [a.grd].concat(classKids[mail] ? [a.cls] : []).forEach(function (s) {
        s.ok += c.ok; s.miss += c.miss; s.ntk += c.ntk; s.ln += c.ln; s.kids[mail] = true;
      });
    });
    function out(s) {
      var n = s.ok + s.miss;
      return { n: n, kids: Object.keys(s.kids).length,
               err: n ? s.miss / n : null, sec: s.ntk ? Math.exp(s.ln / s.ntk) / 1000 : null };
    }
    var ids = Object.keys(classKids);
    function meanPct(key) {
      var xs = [];
      ids.forEach(function (e) { var L = level[e + '|' + u]; if (!L) return;
        var ms = Object.keys(L.months).sort(); var v = L.months[ms[ms.length - 1]][key]; if (v != null) xs.push(v); });
      return xs.length ? mean(xs) : null;
    }
    return {
      unit: u, title: (units[u] && units[u].title) || u,
      normN: normN[u] || 0, normWarn: (normN[u] || 0) < cfg.an_norm_min,
      classSpeedPct: meanPct('sp'), classAccPct: meanPct('ac'),
      types: types.filter(function (t) { return agg[t]; }).map(function (t) {
        return { t: t, name: (units[u] && units[u].types && units[u].types[t]) || t,
                 cls: out(agg[t].cls), grd: out(agg[t].grd) };
      })
    };
  });

  // 下位が続く児童の重なり（学級の中で、2単元ずつ）。偶然の期待人数と並べる
  var overlaps = [];
  for (var i = 0; i < unitIds.length; i++) for (var j = i + 1; j < unitIds.length; j++) {
    var u1 = unitIds[i], u2 = unitIds[j], N = 0, A = 0, B = 0, K = 0;
    children.forEach(function (c) {
      var x = c.units[u1], y = c.units[u2];
      if (!x || !y || !x.months.length || !y.months.length) return;
      N++;
      var a = x.speedPersist.on || x.accPersist.on, b = y.speedPersist.on || y.accPersist.on;
      if (a) A++; if (b) B++; if (a && b) K++;
    });
    if (N) overlaps.push({ u1: u1, u2: u2, t1: (units[u1] && units[u1].title) || u1, t2: (units[u2] && units[u2].title) || u2,
                           n: N, a: A, b: B, k: K, expected: A * B / N });
  }

  return { grade: Number(opt.grade), cls: String(opt.cls), fyStart: fy, units: unitIds, classView: classView,
           children: children, overlaps: overlaps, cfg: cfg };
}

/**
 * 手立ての前後比較。対象の変化から、比較群（対象外の学年の児童）の変化を引く。
 * 下位の児童は偶然でも上がりやすく（平均への回帰）、練習すれば誰でも伸びるため、単独の前後比較にしない。
 * support: { target: 'child:<mail>' | 'class:<g-c>', unit, types: [..], start, end }
 */
function anSupportEffect_(facts, roster, s, cfg, today) {
  var targets = {}, compare = {}, grade = null;
  var tg = String(s.target || '');
  if (tg.indexOf('child:') === 0) {
    var m = tg.slice(6).toLowerCase();
    roster.forEach(function (r) { if (r.mail === m) { targets[m] = true; grade = Number(r.grade); } });
    roster.forEach(function (r) { if (Number(r.grade) === grade && !targets[r.mail]) compare[r.mail] = true; });
  } else if (tg.indexOf('class:') === 0) {
    var key = tg.slice(6), gp = key.split('-'); grade = Number(gp[0]); var cls = gp.slice(1).join('-');
    roster.forEach(function (r) {
      if (Number(r.grade) !== grade) return;
      if (String(r.cls) === cls) targets[r.mail] = true; else compare[r.mail] = true;
    });
  }
  var E = cfg.an_effect_weeks;
  var w0 = anMondayOf_(s.start), pre0 = anAddDays_(w0, -7 * E), post1 = anAddDays_(w0, 7 * E);
  var endW = s.end ? anAddDays_(anMondayOf_(s.end), 7) : null;
  if (endW && endW < post1) post1 = endW;
  var types = (s.types && s.types.length) ? s.types : null;
  function blank() { return { ok: 0, miss: 0, ntk: 0, ln: 0 }; }
  var acc = { t: { pre: blank(), post: blank() }, c: { pre: blank(), post: blank() } };
  facts.forEach(function (f) {
    if (f[1] !== s.unit || f[2] === '*') return;
    if (types && types.indexOf(f[2]) < 0) return;
    var who = targets[f[0]] ? 't' : (compare[f[0]] ? 'c' : null);
    if (!who) return;
    var w = String(f[3]), win = (w >= pre0 && w < w0) ? 'pre' : ((w >= w0 && w < post1) ? 'post' : null);
    if (!win) return;
    var a = acc[who][win];
    a.ok += Number(f[4]) || 0; a.miss += Number(f[5]) || 0; a.ntk += Number(f[6]) || 0; a.ln += Number(f[7]) || 0;
  });
  function side(g) {
    var pre = acc[g].pre, post = acc[g].post, minT = cfg.an_min_trials, o = {};
    var npre = pre.ok + pre.miss, npost = post.ok + post.miss;
    o.nPre = npre; o.nPost = npost;
    o.errPre = npre ? pre.miss / npre : null; o.errPost = npost ? post.miss / npost : null;
    o.errDiff = (npre >= minT && npost >= minT) ? o.errPost - o.errPre : null;
    o.rtRatio = (pre.ntk >= minT && post.ntk >= minT) ? Math.exp(post.ln / post.ntk - pre.ln / pre.ntk) : null;
    return o;
  }
  var T = side('t'), C = side('c');
  var todayW = anMondayOf_(today);
  return {
    target: T, compare: Object.keys(compare).length ? C : null,
    // 比較群を引いた差。時間は比の比（1未満＝比較群より速くなった）、誤答率は差の差（負＝比較群より減った）
    rtRel: (T.rtRatio != null && C.rtRatio != null) ? T.rtRatio / C.rtRatio : null,
    errRel: (T.errDiff != null && C.errDiff != null) ? T.errDiff - C.errDiff : null,
    window: { pre: pre0, start: w0, end: post1 },
    ongoing: todayW < post1
  };
}

/** Notion などに貼る集計テキスト。名前・番号・メールを含めない（純粋） */
function anExportText_(res, supports, decisions) {
  function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }
  function sec(x) { return x == null ? '—' : x.toFixed(1) + '秒'; }
  var L = [];
  L.push('【単元横断の集計】' + res.grade + '年 学級（年度 ' + res.fyStart.slice(0, 4) + '）');
  L.push('比較は同じ学年の全児童。帯は ' + res.cfg.an_band_strong + '／' + res.cfg.an_band_low +
         'パーセンタイル、下位の持続は ' + res.cfg.an_persist_months + 'か月以上。個人名は含めない。');
  res.classView.forEach(function (u) {
    L.push('');
    L.push('■ ' + u.title + '（比較人数 最大' + u.normN + '人' + (u.normWarn ? '・少ないため参考' : '') + '）');
    u.types.forEach(function (t) {
      L.push('- ' + t.name + '：誤答率 学級' + pct(t.cls.err) + '／学年' + pct(t.grd.err) +
             '、想起 学級' + sec(t.cls.sec) + '／学年' + sec(t.grd.sec) + '（学級' + t.cls.kids + '人）');
    });
    var low = 0, strong = 0, dual = 0;
    res.children.forEach(function (c) {
      var x = c.units[u.unit]; if (!x) return;
      if (x.speedPersist.on || x.accPersist.on) low++;
      if (x.speedPersist.strong >= res.cfg.an_persist_months || x.accPersist.strong >= res.cfg.an_persist_months) strong++;
      if (x.dual) dual++;
    });
    L.push('- 下位が続く児童 ' + low + '人（うち強い低さが続く ' + strong + '人）、水準と伸びがともに低い ' + dual + '人');
  });
  if (res.overlaps.length) {
    L.push('');
    L.push('■ 下位が続く児童の重なり（偶然の期待人数）');
    res.overlaps.forEach(function (o) {
      L.push('- ' + o.t1 + ' × ' + o.t2 + '：' + o.k + '人（期待 ' + o.expected.toFixed(1) + '人、対象 ' + o.n + '人）');
    });
  }
  if (supports && supports.length) {
    L.push('');
    L.push('■ 手立て（比較群を引いた変化）');
    supports.forEach(function (s) {
      var e = s.effect || {};
      var who = String(s.target).indexOf('class:') === 0 ? '学級全体' : '児童1名';
      L.push('- ' + who + '・' + s.unit + '・' + s.content + '（' + s.start + '〜' + (s.end || '') + '）：' +
             '時間の比 ' + (e.rtRel == null ? '—' : e.rtRel.toFixed(2)) +
             '、誤答率の差 ' + (e.errRel == null ? '—' : (e.errRel * 100).toFixed(1) + 'pt') +
             (e.ongoing ? '（途中）' : ''));
    });
  }
  if (decisions != null) {
    L.push('');
    L.push('■ この画面を見て判断が変わった記録：' + decisions + '件（年度内）');
  }
  return L.join('\n');
}

/* ============================================================
 *  画面から呼ぶ API（すべて anCheck_ を通す）
 * ============================================================ */

function anRoster_() {
  var v = sh_(SHEETS.ROSTER).getDataRange().getValues(), out = [], seen = {};
  for (var i = 1; i < v.length; i++) {
    var mail = String(v[i][0] || '').trim().toLowerCase();
    var name = String(v[i][4] || '').trim();
    if (!mail || mail.indexOf('@') < 0 || !name || seen[mail]) continue;   // 分析の対象は氏名のある児童だけ
    seen[mail] = true;
    out.push({ mail: mail, grade: Number(v[i][1]) || 0, cls: String(v[i][2] || '').trim(), no: Number(v[i][3]) || 0, name: name });
  }
  return out;
}

function anUnits_() {
  var out = {};
  anReadTable_(AN.SOURCES, AN_SOURCE_HEAD).forEach(function (r) {
    if (!r[1]) return;
    var types = {};
    try { types = JSON.parse(r[4] || '{}'); } catch (e) {}
    out[String(r[1])] = { title: String(r[2] || r[1]), grade: Number(r[3]) || 0, types: types };
  });
  return out;
}

function anToday_() { return anYmd_(new Date()); }

function anBoot() {
  var sc = anCheck_(null);
  var classes = {};
  anRoster_().forEach(function (r) {
    var k = r.grade + '-' + r.cls;
    if (sc === '*' || sc[k]) classes[k] = { key: k, grade: r.grade, cls: r.cls };
  });
  var list = Object.keys(classes).map(function (k) { return classes[k]; })
    .sort(function (a, b) { return a.grade - b.grade || (a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0); });
  var src = anReadTable_(AN.SOURCES, AN_SOURCE_HEAD).map(function (r) {
    return { unit: r[1], title: r[2], status: r[7], updated: r[6] ? anYmd_(r[6]) : '' };
  });
  return { classes: list, cfg: anCfg_(), sources: src, units: anUnits_(), owner: anOwner_(email_()) };
}

function anClassData(key) {
  anCheck_(key);
  var p = String(key).split('-'), grade = Number(p[0]), cls = p.slice(1).join('-');
  var roster = anRoster_(), facts = anReadTable_(AN.FACTS, AN_FACT_HEAD), cfg = anCfg_(), today = anToday_();
  var res = anCompute_(facts, roster, anUnits_(), cfg, { grade: grade, cls: cls, today: today });
  res.supports = anSupports_(key, facts, roster, cfg, today);
  res.decisions = anDecisionCount_(key, today);
  res.today = today;
  return res;
}

function anRunIngest() {
  anCheck_(null);
  return anIngest_();
}

/** この学級に関わる手立て（学級全体、または学級の児童）と、その前後比較 */
function anSupports_(key, facts, roster, cfg, today) {
  var p = String(key).split('-'), grade = Number(p[0]), cls = p.slice(1).join('-'), mine = {};
  roster.forEach(function (r) { if (r.grade === grade && r.cls === cls) mine[r.mail] = r; });
  return anReadTable_(AN.SUPPORT, AN_SUPPORT_HEAD).filter(function (r) {
    var t = String(r[3]);
    return t === 'class:' + key || (t.indexOf('child:') === 0 && mine[t.slice(6)]);
  }).map(function (r) {
    var s = { id: String(r[0]), created: anYmd_(r[1]), by: String(r[2]), target: String(r[3]), unit: String(r[4]),
              types: String(r[5] || '').split(',').filter(Boolean),
              start: r[6] instanceof Date ? anYmd_(r[6]) : String(r[6]),
              end: r[7] ? (r[7] instanceof Date ? anYmd_(r[7]) : String(r[7])) : '',
              content: String(r[8]), freq: String(r[9]), memo: String(r[10] || '') };
    var t = s.target;
    if (t.indexOf('child:') === 0) { var c = mine[t.slice(6)]; s.who = c ? (c.no + ' ' + c.name) : t.slice(6); }
    else s.who = '学級全体';
    s.effect = anSupportEffect_(facts, roster, s, cfg, today);
    return s;
  }).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
}

/** 手立てを1件足す。入力は画面で最小限（対象・単元・内容・頻度。開始日は今日が既定） */
function anSaveSupport(key, o) {
  anCheck_(key);
  o = o || {};
  var t = String(o.target || '');
  if (!/^(child:[^\s@]+@[^\s@]+|class:\d+-.+)$/.test(t)) throw new Error('対象が正しくありません');
  if (!o.unit) throw new Error('単元を選んでください');
  if (!String(o.content || '').trim()) throw new Error('内容を書いてください');
  var start = /^\d{4}-\d{2}-\d{2}$/.test(String(o.start)) ? String(o.start) : anToday_();
  var row = [Utilities.getUuid().slice(0, 8), new Date(), email_(), t, String(o.unit),
             (o.types || []).join(','), start, '', String(o.content).trim(), String(o.freq || ''), String(o.memo || '')];
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { anSheet_(AN.SUPPORT, AN_SUPPORT_HEAD).appendRow(row); } finally { lock.releaseLock(); }
  return row[0];
}

/** 手立てを終える（終了日を入れる）。消さない：前後比較の記録を残すため */
function anEndSupport(key, id, end) {
  anCheck_(key);
  var sh = anSheet_(AN.SUPPORT, AN_SUPPORT_HEAD), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sh.getRange(i + 1, 8).setValue(/^\d{4}-\d{2}-\d{2}$/.test(String(end)) ? String(end) : anToday_());
      return '終了日を入れました';
    }
  }
  throw new Error('この手立てが見つかりません。画面を開き直してください。');
}

/** 「この画面を見て判断が変わった」の記録。システムが有用かの物差し（docs/ANALYSIS_REQUIREMENTS.md） */
function anLogDecision(key, memo) {
  anCheck_(key);
  anSheet_(AN.DECISIONS, AN_DECISION_HEAD).appendRow([new Date(), email_(), key, String(memo || '').slice(0, 500)]);
  return anDecisionCount_(key, anToday_());
}

function anDecisionCount_(key, today) {
  var fy = anFyStart_(today);
  return anReadTable_(AN.DECISIONS, AN_DECISION_HEAD).filter(function (r) {
    return String(r[2]) === key && anYmd_(r[0]) >= fy;
  }).length;
}

function anExport(key) {
  var res = anClassData(key);
  return anExportText_(res, res.supports, res.decisions);
}
