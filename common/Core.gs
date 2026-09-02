/**
 * Core.gs — 算数タイムアタック 共通エンジン
 *
 * 単元固有の知識をここに書かないこと。
 * 「この単元のときだけ」という分岐が現れたら、それは Unit.gs に置くべきもの。
 *
 * 必要なもの: 同じプロジェクトに UNIT を定義した Unit.gs があること。
 */

var SHEETS = {
  CONFIG: 'config', ROSTER: 'roster', CLASS: 'class_config',
  LOG: 'log', DAILY: 'daily', SUMMARY: 'summary',
  WCHILD: 'weak_child', WCLASS: 'weak_class'
};

/** 全単元で共通の既定値。UNIT.defaults で上書きできる */
var BASE_DEFAULTS = {
  limit_sec: 60,      // 制限時間（秒）
  miss_limit: 3,      // 何回誤答したら正答を提示して次へ
  slow_ms: 3000,      // 送信までの時間の閾値（log の slow_items 用）
  key_gap: 8,         // 画面キーの横間隔(px)
  teachers: '',       // 教師のメールアドレス（カンマ区切り）

  // weak_child は「初打鍵まで（想起）」で見る。閾値は slow_ms とは別物で、
  // 打鍵ぶんだけ小さい。0 なら slow_ms の 0.7 倍を使う。
  // この 0.7 は暫定値で、実測ではない。log の type_stats から
  // 型ごとの平均msを答えの桁数に回帰すれば1打鍵あたりのコストが出るので、
  // 1〜2週ぶん貯まったらこの値を実測で置き換えること。
  slow_tk_ms: 0,

  // 想起時間のばらつきの閾値（%）。標準偏差 ÷ 平均。
  // 秒ではなく比にするのは、閾値が単元の速さに依存しないようにするため
  // （九九と単位換算では平均が倍ちがうので、秒で決めるとどちらかで必ず外れる）。
  // 想起が自動化していれば 20〜30%程度。想起と計数が混ざると 50%を超える。
  wobble_pct: 40,

  // weak_child / weak_class の集計に使う期間（日）。0 なら全期間。
  // 全期間平均にすると、年間数百試行に対して直近の変化が1%程度に薄まり、
  // 伸びも落ちも見えなくなる。
  window_days: 30
};

var TTL = { config: 60, roster: 300, session: 21600 };
var QN = 200;                              // 1セッションの出題数
var SCHEMA_VERSION = 3;                    // 2 = kind/best_count / 3 = モード名列・見やすい表示
var STAR_MAX = 99;                         // 個人内評価（自己ベスト更新回数）の上限
var GUEST_DOMAIN = '@edu.nishi.or.jp';     // 名簿になくても試用できる（記録なし）

function defaults_() {
  var d = {};
  for (var k in BASE_DEFAULTS) d[k] = BASE_DEFAULTS[k];
  var u = UNIT.defaults || {};
  for (var k2 in u) d[k2] = u[k2];
  (UNIT.flags || []).forEach(function (f) { d[f.gradeKey] = f.defaultGrade; });
  return d;
}

/* ============================================================
 *  基盤
 * ============================================================ */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function cache_() { return CacheService.getScriptCache(); }

function sh_(name) {
  var s = ss_().getSheetByName(name);
  if (!s) throw new Error('シートが見つかりません: ' + name);
  return s;
}

function email_() {
  var e = Session.getActiveUser().getEmail();
  return e ? e.toLowerCase() : '';
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** log の ts を数値時刻にする。読めなければ 0（＝期間窓で捨てない側に倒す） */
function rowTime_(x) {
  if (x instanceof Date) return x.getTime();
  var d = new Date(x);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** シートが日付を Date に変換していても文字列比較できるようにする */
function dstr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
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

  var def = defaults_(), c = {};
  for (var k in def) c[k] = def[k];
  var v = sh_(SHEETS.CONFIG).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    var key = String(v[i][0]).trim();
    if (!key) continue;
    c[key] = (typeof def[key] === 'number') ? Number(v[i][1]) : v[i][1];
  }
  cache_().put('config', JSON.stringify(c), TTL.config);
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
      var c = { email: mail, grade: Number(v[i][1]), cls: String(v[i][2]),
                no: Number(v[i][3]), name: String(v[i][4]) };
      cache_().put(key, JSON.stringify(c), TTL.roster);
      return c;
    }
  }
  return null;   // 未登録はキャッシュしない（名簿追加が即反映されるように）
}

function classKey_(c) { return c.grade + '-' + c.cls; }

/* ---- モードの解禁フラグ（学年既定 + クラスごとの上書き） ---- */

function classConfig_() {
  var hit = cache_().get('classcfg');
  if (hit) return JSON.parse(hit);
  var map = {};
  var sh = ss_().getSheetByName(SHEETS.CLASS);
  if (sh && sh.getLastRow() > 1) {
    var v = sh.getDataRange().getValues();
    var head = v[0].map(String);
    for (var i = 1; i < v.length; i++) {
      var ck = String(v[i][0]).trim();
      if (!ck) continue;
      var o = {};
      (UNIT.flags || []).forEach(function (f) {
        var col = head.indexOf('allow_' + f.key);
        if (col >= 0) o[f.key] = toBool_(v[i][col]);
      });
      map[ck] = o;
    }
  }
  cache_().put('classcfg', JSON.stringify(map), TTL.config);
  return map;
}

/** 返り値: { flagKey: true/false, ... } */
function flagsFor_(grade, cls) {
  var cfg = config_();
  var out = {}, over = classConfig_()[grade + '-' + cls];
  (UNIT.flags || []).forEach(function (f) {
    out[f.key] = (over && over[f.key] !== undefined)
      ? over[f.key]
      : (Number(grade) >= Number(cfg[f.gradeKey]));
  });
  return out;
}

function modeAllowed_(mode, flags) {
  var m = modeDef_(mode);
  if (!m) return false;
  if (!m.flag) return true;
  return !!flags[m.flag];
}

function modeDef_(id) {
  for (var i = 0; i < UNIT.modes.length; i++) if (UNIT.modes[i].id === Number(id)) return UNIT.modes[i];
  return null;
}

function modeIds_() { return UNIT.modes.map(function (m) { return m.id; }); }

/** シート上で mode 番号の意味が分かるように、名前も並べて記録する */
function modeName_(m) { var d = modeDef_(m); return d ? d.name : ('mode' + m); }

/* ============================================================
 *  出題 — 生成はサーバーだけが行う
 * ============================================================ */

function rng_(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function ri_(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
function pick_(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

/** 直前3問と同じ問題を避けながら n 問作る */
function genQueue_(seed, mode, n) {
  var rand = rng_(seed);
  var out = [], recent = [];
  for (var i = 0; i < n; i++) {
    var it, guard = 0;
    do { it = UNIT.gen(rand, Number(mode)); guard++; }
    while (recent.indexOf(it.tag) >= 0 && guard < 8);
    recent.push(it.tag); if (recent.length > 3) recent.shift();
    out.push(it);
  }
  return out;
}

/** 送信用に切り詰める: [出題トークン, 欄, 答え, 目盛り] */
function packQueue_(q) {
  return q.map(function (x) {
    return [x.q, x.f, x.f.map(function (k) { return x.ans[k]; }), x.ruler || null, x.t];
  });
}

/* ============================================================
 *  ルーティング
 * ============================================================ */

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function doGet(e) {
  ensureReady_();
  var page = (e && e.parameter && e.parameter.page) || '';
  if (page === 'teacher') {
    if (!isTeacher_(email_())) {
      return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">この画面を開く権限がありません。</p>');
    }
    return HtmlService.createTemplateFromFile('teacher').evaluate()
      .setTitle(UNIT.teacherTitle)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle(UNIT.title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ============================================================
 *  児童用 API
 * ============================================================ */

function boot() {
  var mail = email_();
  if (!mail) return { ok: false, msg: 'ログイン情報を取得できません。学校のアカウントで開いてください。' };
  var cfg = config_();
  var c = child_(mail);

  // 単元が UNIT.settings で宣言した設定だけを児童画面に渡す。
  // Core はキーの意味を知らない（何に使うかは単元と ui.html の描画側の取り決め）。
  var uset = {};
  (UNIT.settings || []).forEach(function (s) {
    var v = cfg[s.key];
    uset[s.key] = (s.type === 'text') ? v : Number(v);
  });

  var base = {
    ok: true,
    // digitCap は「宣言」なので、そのままクライアントへ渡してよい（答えは含まない）。
    // 渡さないと ui.html の digitCap_() が宣言を読めず、自動確定も欄移動も動かない。
    // gen は絶対に渡さない（クライアントに出題ロジックを持たせない）。
    unit: { id: UNIT.id, title: UNIT.title, modes: UNIT.modes,
            units: UNIT.units || {}, digitCap: UNIT.digitCap || {} },
    settings: uset,
    limitSec: cfg.limit_sec, missLimit: cfg.miss_limit, keyGap: Number(cfg.key_gap)
  };

  if (!c) {
    if (!isGuest_(mail)) {
      return { ok: false, msg: '名簿に登録がありません。担任の先生に伝えてください。' };
    }
    var allOn = {};
    (UNIT.flags || []).forEach(function (f) { allOn[f.key] = true; });
    base.guest = true; base.name = ''; base.grade = 0;
    base.flags = allOn;
    base.best = {}; base.practiceBest = {}; base.stars = {}; base.medals = {};
    modeIds_().forEach(function (m) {
      base.best[m] = 0; base.practiceBest[m] = 0; base.stars[m] = 0; base.medals[m] = '';
    });
    return base;
  }

  base.guest = false; base.name = c.name; base.grade = c.grade;
  base.flags = flagsFor_(c.grade, c.cls);
  var b = bests_(mail, cfg.limit_sec);
  base.best = b.best; base.practiceBest = b.practiceBest; base.stars = b.stars;
  base.medals = medals_(classKey_(c), mail, cfg.limit_sec);
  return base;
}

/**
 * 記録しない練習（むせいげん）の1問。クライアントに出題ロジックを持たせないため、
 * ここで1問ずつ作って返す。記録しないので token もシードも要らない。
 */
function nextPracticeItem(mode) {
  var mail = email_();
  var c = child_(mail);
  if (!c && !isGuest_(mail)) return { ok: false };
  mode = Number(mode);
  if (modeIds_().indexOf(mode) < 0) return { ok: false };
  if (c && !modeAllowed_(mode, flagsFor_(c.grade, c.cls))) return { ok: false };

  var rand = rng_(Math.floor(Math.random() * 2147483647));
  var it = UNIT.gen(rand, mode);
  return {
    ok: true, q: it.q, f: it.f,
    ans: it.f.map(function (k) { return it.ans[k]; }),
    ruler: it.ruler || null, t: it.t || null
  };
}

function startSession(mode, practice) {
  var mail = email_();
  var c = child_(mail);
  var cfg = config_();
  mode = Number(mode);
  if (modeIds_().indexOf(mode) < 0) return { ok: false, msg: 'モードが不正です。' };

  if (!c) {
    if (!isGuest_(mail)) return { ok: false, msg: '名簿に登録がありません。' };
    return {
      ok: true, guest: true, token: '',
      limitSec: cfg.limit_sec, missLimit: cfg.miss_limit,
      qs: packQueue_(genQueue_(Math.floor(Math.random() * 2147483647), mode, QN))
    };
  }

  if (!modeAllowed_(mode, flagsFor_(c.grade, c.cls))) {
    return { ok: false, msg: 'このモードはまだ使えません。' };
  }

  var seed = Math.floor(Math.random() * 2147483647);
  var token = Utilities.getUuid();
  cache_().put('sess_' + token,
    JSON.stringify({ seed: seed, mode: mode, mail: mail, t: Date.now(),
                     lim: Number(cfg.limit_sec), p: !!practice }), TTL.session);

  return {
    ok: true, token: token,
    limitSec: cfg.limit_sec, missLimit: cfg.miss_limit,
    qs: packQueue_(genQueue_(seed, mode, QN))
  };
}

/**
 * items = [{i:出題index, a:[解答の履歴], ms:最初の解答までのミリ秒}, ...]
 * サーバーがシードから問題列を再生成して採点し直す。点数は受け取らない。
 */
function submitSession(token, items) {
  var mail = email_();
  var raw = cache_().get('sess_' + token);
  if (!raw) return { ok: false, code: 'gone', msg: 'この記録は すでに ほぞんされています。' };
  var s = JSON.parse(raw);
  if (s.mail !== mail) return { ok: false, code: 'bad', msg: '不正なリクエストです。' };

  var cfg = config_();
  var c = child_(mail);
  if (!c) return { ok: false, code: 'bad', msg: '名簿に登録がありません。' };
  var limSec = Number(s.lim) || Number(cfg.limit_sec);

  if (!items || !items.length || items.length > 500) {
    return { ok: false, code: 'bad', msg: '記録できませんでした。' };
  }
  var sumMs = 0;
  for (var n = 0; n < items.length; n++) sumMs += Number(items[n].ms) || 0;
  if (sumMs > (limSec + 5) * 1000) {
    return { ok: false, code: 'bad', msg: '時間が合いません。記録できませんでした。' };
  }

  var q = genQueue_(s.seed, s.mode, QN);
  var correct = 0, attempts = 0;
  var miss = [], slow = [], wrong = [], stat = {};

  for (var i = 0; i < items.length; i++) {
    var it = items[i], qq = q[it.i];
    if (!qq) continue;
    var hist = it.a || [];
    attempts += hist.length;

    var byTotal = UNIT.byTotal ? !!UNIT.byTotal(qq) : false;
    var want = qq.f.map(function (u) { return qq.ans[u]; });
    var last = hist.length ? hist[hist.length - 1] : null;
    var hit = !!last && match_(last, qq, byTotal);
    var firstTry = hist.length === 1 && hit;

    if (hit) correct++;
    if (!hit || hist.length > 1) {
      miss.push(qq.t + ':' + qq.tag);
      // 誤答明細シート用に、正しい答えと最初に間違えた値をセットで残す
      for (var w = 0; w < hist.length; w++) {
        if (!match_(hist[w], qq, byTotal)) {
          wrong.push(qq.t + '|' + qq.tag + '|' + want.join('/') + '|' + hist[w].join('/'));
          break;
        }
      }
    }
    if (firstTry) {
      // [試行数, Σ送信まで, 初打鍵が取れた数, Σ初打鍵まで, Σ(初打鍵まで)^2]
      // 二乗和まで持つのは、平均だけでは「毎回同じ速さで遅い子」と
      // 「想起と計数を行き来していて時々速い子」が区別できないため。
      // 前者は手続きの短縮、後者は想起そのものの練習が要る。
      if (!stat[qq.t]) stat[qq.t] = [0, 0, 0, 0, 0];
      var tk = Number(it.tk) || 0;
      stat[qq.t][0]++; stat[qq.t][1] += Number(it.ms) || 0;
      if (tk > 0) { stat[qq.t][2]++; stat[qq.t][3] += tk; stat[qq.t][4] += tk * tk; }
      if (Number(it.ms) > cfg.slow_ms) slow.push(qq.t + ':' + qq.tag + ':' + Math.round(it.ms));
    }
  }

  var statStr = Object.keys(stat).map(function (k) {
    return k + ':' + stat[k].join(':');
  }).join(',');

  var isPractice = !!s.p;
  var lock = LockService.getScriptLock();
  var rank = 0, res = { best: correct, star: 0, updated: false };
  try {
    lock.waitLock(30000);
    cache_().remove('sess_' + token);

    if (!isPractice) {
      // 本番だけ log に残す。練習を混ぜると分析が濁る
      sh_(SHEETS.LOG).appendRow([
        new Date(), mail, c.grade, c.cls, c.no, c.name,
        s.mode, modeName_(s.mode), limSec, correct, attempts,
        miss.join(','), slow.join(','), statStr, wrong.join(',')
      ]);
    }
    res = updateSummary_(mail, s.mode, limSec, isPractice ? 'p' : 'r', correct, attempts);
    if (!isPractice) rank = updateDaily_(classKey_(c), s.mode, limSec, mail, correct);
  } catch (err) {
    return { ok: false, msg: '記録に失敗しました。' };   // code 無し = 再送する
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  return {
    ok: true, mode: s.mode, limitSec: limSec, practice: isPractice,
    score: correct, attempts: attempts,
    best: res.best, star: res.star, updated: res.updated, rank: rank,
    medal: (!isPractice && rank >= 1 && rank <= 3) ? ['🥇', '🥈', '🥉'][rank - 1] : ''
  };
}

/** 空欄は 0 とみなす。byTotal なら合計で、そうでなければ欄ごとに比べる */
function match_(a, qq, byTotal) {
  if (!a || a.length !== qq.f.length) return false;
  var got = 0, want = 0;
  for (var i = 0; i < qq.f.length; i++) {
    var u = qq.f[i];
    var v = (a[i] === '' || a[i] === null || a[i] === undefined) ? 0 : Number(a[i]);
    if (isNaN(v)) return false;
    if (byTotal) {
      var k = UNIT.unitScale ? UNIT.unitScale(u) : 1;
      got += v * k; want += Number(qq.ans[u]) * k;
    } else {
      if (v !== Number(qq.ans[u])) return false;
    }
  }
  return byTotal ? (got === want) : true;
}

/* ============================================================
 *  summary / daily（制限時間ごとに別の記録として持つ）
 * ============================================================ */

/**
 * summary: email | mode | limit_sec | kind | tries | total_correct | total_attempts | best | best_count
 *   kind … 'r' 本番 / 'p' 練習（時間制限あり・ランダムのみ）
 *   best_count … 自己ベストを塗り替えた回数。個人内評価の★になる
 */
var SUM = { MAIL:0, MODE:1, NAME:2, LIM:3, KIND:4, TRIES:5, TC:6, TA:7, BEST:8, COUNT:9 };

function bests_(mail, limitSec) {
  var v = sh_(SHEETS.SUMMARY).getDataRange().getValues();
  var real = {}, prac = {}, stars = {};
  modeIds_().forEach(function (m) { real[m] = 0; prac[m] = 0; stars[m] = 0; });

  for (var i = 1; i < v.length; i++) {
    if (String(v[i][SUM.MAIL]).toLowerCase() !== mail) continue;
    if (Number(v[i][SUM.LIM]) !== Number(limitSec)) continue;
    var m = Number(v[i][SUM.MODE]);
    if (String(v[i][SUM.KIND]) === 'p') {
      prac[m] = Number(v[i][SUM.BEST]) || 0;
    } else {
      real[m] = Number(v[i][SUM.BEST]) || 0;
      stars[m] = Math.min(Number(v[i][SUM.COUNT]) || 0, STAR_MAX);
    }
  }
  return { best: real, practiceBest: prac, stars: stars };
}

/**
 * 記録を更新して { best, star, updated } を返す。
 * star は本番だけ増える（練習で増やすと個人内評価の意味が薄れる）。
 */
function updateSummary_(mail, mode, limitSec, kind, correct, attempts) {
  var sh = sh_(SHEETS.SUMMARY);
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][SUM.MAIL]).toLowerCase() === mail &&
        Number(v[i][SUM.MODE]) === mode &&
        Number(v[i][SUM.LIM]) === Number(limitSec) &&
        String(v[i][SUM.KIND]) === kind) {
      var prev = Number(v[i][SUM.BEST]) || 0;
      var updated = correct > prev;
      var star = Number(v[i][SUM.COUNT]) || 0;
      if (updated && kind === 'r') star = Math.min(star + 1, STAR_MAX);
      sh.getRange(i + 1, SUM.TRIES + 1, 1, 5).setValues([[
        Number(v[i][SUM.TRIES]) + 1,
        Number(v[i][SUM.TC]) + correct,
        Number(v[i][SUM.TA]) + attempts,
        Math.max(prev, correct),
        star
      ]]);
      return { best: Math.max(prev, correct), star: star, updated: updated };
    }
  }
  var first = (kind === 'r') ? 1 : 0;      // 初回の記録も「自己ベスト更新」と数える
  sh.appendRow([mail, mode, modeName_(mode), Number(limitSec), kind, 1, correct, attempts, correct, first]);
  return { best: correct, star: first, updated: true };
}

/** 当日・同一学級・同一モード・同一制限時間の中での順位。同点は先着優先 */
function rankOf_(rows, ck, mode, limitSec, mail) {
  var td = today_(), pool = [];
  for (var i = 1; i < rows.length; i++) {
    if (dstr_(rows[i][0]) === td && String(rows[i][1]) === ck &&
        Number(rows[i][2]) === mode && Number(rows[i][4]) === Number(limitSec)) {
      pool.push({ mail: String(rows[i][5]).toLowerCase(), s: Number(rows[i][6]), t: Number(rows[i][7]) });
    }
  }
  pool.sort(function (a, b) { return b.s - a.s || a.t - b.t; });
  for (var k = 0; k < pool.length; k++) if (pool[k].mail === mail) return k + 1;
  return 0;
}

function updateDaily_(ck, mode, limitSec, mail, score) {
  var sh = sh_(SHEETS.DAILY);
  var v = sh.getDataRange().getValues();
  var td = today_();
  limitSec = Number(limitSec);

  var row = -1;
  for (var i = 1; i < v.length; i++) {
    if (dstr_(v[i][0]) === td && String(v[i][1]) === ck &&
        Number(v[i][2]) === mode && Number(v[i][4]) === limitSec &&
        String(v[i][5]).toLowerCase() === mail) { row = i; break; }
  }
  var now = new Date();   // 内部の並び替え用。Date型にすると daily を開いたときも読める
  if (row < 0) {
    var line = [td, ck, mode, modeName_(mode), limitSec, mail, score, now];
    sh.appendRow(line); v.push(line);
  } else if (score > Number(v[row][6])) {
    sh.getRange(row + 1, 7, 1, 2).setValues([[score, now]]);
    v[row][6] = score; v[row][7] = now;
  }
  return rankOf_(v, ck, mode, limitSec, mail);
}

function medals_(ck, mail, limitSec) {
  var v = sh_(SHEETS.DAILY).getDataRange().getValues();
  var out = {};
  modeIds_().forEach(function (m) {
    var r = rankOf_(v, ck, m, limitSec, mail);
    out[m] = (r >= 1 && r <= 3) ? ['🥇', '🥈', '🥉'][r - 1] : '';
  });
  return out;
}

/** 時間主導トリガー。前日以前の行を落とすだけ */
function resetDaily() {
  var sh = sh_(SHEETS.DAILY);
  var v = sh.getDataRange().getValues();
  if (v.length <= 1) return;
  var td = today_(), keep = [v[0]];
  for (var i = 1; i < v.length; i++) if (dstr_(v[i][0]) === td) keep.push(v[i]);
  sh.clearContents();
  sh.getRange(1, 1, keep.length, 8).setValues(keep);
  sh.getRange('A:A').setNumberFormat('@');
}

/* ============================================================
 *  教師用 API
 * ============================================================ */

function getConfigForUI() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  return { config: config_(), unit: { id: UNIT.id, title: UNIT.title,
           modes: UNIT.modes, flags: UNIT.flags || [], types: UNIT.types,
           settings: UNIT.settings || [],
           tips: UNIT.tips || '' } };
}

function saveConfig(obj) {
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
  cache_().remove('config'); cache_().remove('classcfg');
  return config_();
}

function listClasses() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  var cfg = config_(), over = classConfig_();
  var v = sh_(SHEETS.ROSTER).getDataRange().getValues();

  var seen = {}, out = [];
  for (var i = 1; i < v.length; i++) {
    var grade = Number(v[i][1]), cls = String(v[i][2]).trim();
    if (!grade || !cls) continue;
    var ck = grade + '-' + cls;
    if (seen[ck]) { seen[ck].n++; continue; }
    var o = over[ck], row = { cls: ck, grade: grade, room: cls, n: 1, flags: {} };
    (UNIT.flags || []).forEach(function (f) {
      row.flags[f.key] = (o && o[f.key] !== undefined) ? o[f.key]
                       : (grade >= Number(cfg[f.gradeKey]));
    });
    seen[ck] = row; out.push(row);
  }
  out.sort(function (a, b) { return a.grade - b.grade || (a.room < b.room ? -1 : 1); });
  return { classes: out, flags: UNIT.flags || [] };   // flags に defaultGrade が入っている
}

function saveClassConfig(rows) {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  var sh = ss_().getSheetByName(SHEETS.CLASS) || ss_().insertSheet(SHEETS.CLASS);
  sh.clear();
  var keys = (UNIT.flags || []).map(function (f) { return f.key; });
  var head = ['class'].concat(keys.map(function (k) { return 'allow_' + k; }));
  var out = [head];
  (rows || []).forEach(function (r) {
    out.push([String(r.cls)].concat(keys.map(function (k) { return !!(r.flags && r.flags[k]); })));
  });
  sh.getRange(1, 1, out.length, head.length).setValues(out);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  cache_().remove('classcfg');
  return '保存しました（' + (out.length - 1) + ' クラス）';
}

/* ---- 集計 ---- */

function aggregate() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  return aggregateCore_();
}

function nightlyAggregate() {
  try { aggregateCore_(); } catch (e) { console.error('nightlyAggregate 失敗: ' + e.message); }
}

function typeOrder_() { return Object.keys(UNIT.types); }

function aggregateCore_() {
  var cfg = config_();
  var v = sh_(SHEETS.LOG).getDataRange().getValues();
  var child = {}, typeMiss = {}, wrongCnt = {};

  function slot(mail, row) {
    if (!child[mail]) {
      child[mail] = { name: row[5], grade: row[2], cls: row[3], no: row[4], t: {}, miss: 0 };
    }
    return child[mail];
  }

  // 期間窓。全期間平均にすると直近の変化が薄まって伸びが見えなくなる。
  var days = Number(cfg.window_days) || 0;
  var cutoff = days > 0 ? (Date.now() - days * 86400000) : 0;
  var used = 0;

  for (var i = 1; i < v.length; i++) {
    var mail = String(v[i][1]).toLowerCase();
    if (!mail) continue;
    var row = v[i];

    if (cutoff) {
      var ts = rowTime_(row[0]);
      if (ts && ts < cutoff) continue;    // 読めない ts は残す（見落としを避ける）
    }
    used++;

    String(row[13] || '').split(',').forEach(function (t) {
      if (!t) return;
      var p = t.split(':');
      if (p.length < 3) return;
      var c = slot(mail, row);
      if (!c.t[p[0]]) c.t[p[0]] = [0, 0, 0, 0, 0];
      c.t[p[0]][0] += Number(p[1]) || 0;
      c.t[p[0]][1] += Number(p[2]) || 0;
      if (p.length >= 6) {                // 初打鍵を記録するようになってからの行
        c.t[p[0]][2] += Number(p[3]) || 0;
        c.t[p[0]][3] += Number(p[4]) || 0;
        c.t[p[0]][4] += Number(p[5]) || 0;
      }
    });

    String(row[11] || '').split(',').forEach(function (t) {
      if (!t) return;
      var ty = t.split(':')[0];
      if (!ty) return;
      typeMiss[ty] = (typeMiss[ty] || 0) + 1;
      slot(mail, row).miss++;
    });

    String(row[14] || '').split(',').forEach(function (t) {
      if (!t || t.indexOf('|') < 0) return;
      wrongCnt[t] = (wrongCnt[t] || 0) + 1;
    });
  }

  writeWeakChild_(child, cfg);
  writeWeakClass_(typeMiss, wrongCnt);
  writeMistakes_(v);

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
  var span = days > 0 ? ('直近' + days + '日') : '全期間';
  try {
    sh_(SHEETS.WCHILD).getRange(1, typeOrder_().length + 9)
      .setValue('最終集計: ' + stamp + '（' + span + '）').setFontColor('#888888');
  } catch (e) {}
  return '集計しました（' + span + ' ' + used + ' 試行 / 全 ' + (v.length - 1) + ' 試行 / ' + stamp + '）';
}

/**
 * "1/200" と問題型から "1km200m" のような単位つき表示を作る。
 * UNIT.fieldsByType が無い単元（九九など、答えが単一値でよい単元）では素の値を返す。
 */
function fmtByType_(type, joined) {
  var fields = UNIT.fieldsByType && UNIT.fieldsByType[type];
  var vals = String(joined).split('/');
  if (!fields || fields.length !== vals.length) return vals.join(' ');
  return vals.map(function (v, i) { return v + fields[i]; }).join('');
}

/**
 * 誰が・どの問題を・何と間違えたかを1行1件で並べる。
 * log の wrong_items を展開する。新しい記録ほど上に来る。直近2000件まで。
 * 旧形式（型｜出題｜誤答 の3分割）にも後方互換で対応する（正答欄は空欄になる）。
 */
function writeMistakes_(logRows) {
  var sh = ss_().getSheetByName('mistakes') || ss_().insertSheet('mistakes');
  sh.clear(); sh.setConditionalFormatRules([]);

  var head = ['日時', '学年', '組', '番号', '氏名', 'モード', '問題型', 'もんだい', '正しい答え', 'こたえた値'];
  var body = [];

  for (var i = 1; i < logRows.length; i++) {
    var row = logRows[i];
    var wrongStr = String(row[14] || '');
    if (!wrongStr) continue;
    wrongStr.split(',').forEach(function (entry) {
      var p = entry.split('|');
      if (p.length < 3) return;
      var type = p[0], tag = p[1], correct, wrong;
      if (p.length >= 4) { correct = fmtByType_(type, p[2]); wrong = fmtByType_(type, p[3]); }
      else { correct = ''; wrong = fmtByType_(type, p[2]); }   // 旧形式
      body.push([row[0], row[2], row[3], row[4], row[5], row[7], type, tag, correct, wrong]);
    });
  }
  body.reverse();
  if (body.length > 2000) body = body.slice(0, 2000);

  var out = [head].concat(body);
  sh.getRange(1, 1, out.length, head.length).setValues(out);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  if (body.length) sh.getRange(2, 1, body.length, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  else sh.getRange(2, 1).setValue('まだ誤答のデータがありません（この機能を入れる前の記録は対象外です）。');

  sh.getRange('A1').setNote(
    '誰が・どの問題を・何と間違えたかを1行1件で並べたものです。新しい記録ほど上にあります。\n' +
    '個別に声をかけるときの参考にしてください。全体の傾向を見るなら weak_class を見てください。'
  );
  sh.setTabColor('#93C47D');
}

function writeWeakChild_(child, cfg) {
  var sh = sh_(SHEETS.WCHILD);
  sh.clear(); sh.setConditionalFormatRules([]);
  var order = typeOrder_();

  // 想起（初打鍵まで）の閾値は、送信までの閾値より打鍵ぶん小さい。
  // 0.7 は暫定。log から1打鍵あたりのコストを実測して置き換えること
  var slowTk = Number(cfg.slow_tk_ms) || Math.round(Number(cfg.slow_ms) * 0.7);
  var wobble = Number(cfg.wobble_pct) || 40;

  var head = ['学年', '組', '番号', '氏名'];
  order.forEach(function (t) { head.push(UNIT.types[t]); });
  head.push('ゆらぎ', 'ゆらぎの型', '誤答数');

  var rows = [head];
  Object.keys(child).sort(function (a, b) {
    var x = child[a], y = child[b];
    return x.grade - y.grade || (x.cls < y.cls ? -1 : x.cls > y.cls ? 1 : 0) || x.no - y.no;
  }).forEach(function (k) {
    var c = child[k], r = [c.grade, c.cls, c.no, c.name];
    var wMax = 0, wType = '';
    order.forEach(function (t) {
      var x = c.t[t];
      if (!x || !x[2]) { r.push(''); return; }   // 初打鍵のデータが無い型は空欄
      var n = x[2], mean = x[3] / n;
      r.push(Math.round(mean / 100) / 10);       // 表示は秒。下の閾値判定も同じ単位

      // ばらつきは 標準偏差÷平均（%）。試行が少ないと不安定なので5回以上の型だけ候補にする
      if (n >= 5 && mean > 0) {
        var vr = x[4] / n - mean * mean;
        var cv = Math.round((vr > 0 ? Math.sqrt(vr) : 0) / mean * 100);
        if (cv > wMax) { wMax = cv; wType = UNIT.types[t]; }
      }
    });
    r.push(wMax || '', wType, c.miss);
    rows.push(r);
  });

  sh.getRange(1, 1, rows.length, head.length).setValues(rows);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1); sh.setFrozenColumns(4);

  if (rows.length > 1) {
    var n = rows.length - 1, wob = 5 + order.length;   // ゆらぎ列 / その右が型名 / さらに右が誤答数
    sh.getRange(2, 5, n, order.length).setNumberFormat('0.0"秒"');
    sh.getRange(2, wob, n, 1).setNumberFormat('0"%"');
    sh.getRange(2, wob + 2, n, 1).setNumberFormat('0"回"');
    sh.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(slowTk / 1000).setBackground('#F8C9C9')
        .setRanges([sh.getRange(2, 5, n, order.length)]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(wobble).setBackground('#FDE4B8')
        .setRanges([sh.getRange(2, wob, n, 1)]).build()
    ]);
  }
  sh.getRange('A1').setNote(
    (UNIT.tips ? UNIT.tips.replace(/<[^>]+>/g, '') + '\n\n' : '') +
    '各型の数字は「問題が出てから最初のキーを押すまで」の平均です（想起にかかった時間）。\n' +
    '打鍵にかかる時間を含まないので、答えの桁数が違う型どうしを比べられます。\n' +
    '赤いセルは ' + (slowTk / 1000).toFixed(1) + ' 秒を超えています。\n\n' +
    '「ゆらぎ」は、その子がいちばん不安定だった型の ばらつき（標準偏差÷平均）です（' + wobble + '%超で色）。\n' +
    '平均が基準内でもここが大きい子は、想起できる時と数えている時が混ざっています。\n' +
    '平均だけを見ていると、この子は「基準内」に見えて素通りします。\n' +
    '平均が遅い子は手続きの短縮、ゆらぎが大きい子は想起そのものの練習が要ります。\n\n' +
    '空欄は、この期間にその型のデータが無いという意味です。\n' +
    '（初打鍵の記録は途中から始めたため、それ以前の記録しかない子は空欄になります）'
  );
  sh.setTabColor('#93C47D');
}

function writeWeakClass_(typeMiss, wrongCnt) {
  var sh = sh_(SHEETS.WCLASS);
  sh.clear(); sh.setConditionalFormatRules([]);

  var rows = [['問題型', '説明', '誤答数']];
  typeOrder_().forEach(function (t) { rows.push([t, UNIT.types[t], typeMiss[t] || 0]); });
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold');

  var start = rows.length + 2;
  sh.getRange(start, 1).setValue('よくある誤答（多い順）').setFontWeight('bold');
  sh.getRange(start + 1, 1, 1, 5)
    .setValues([['問題型', '出題', '正しい答え', 'こたえた値', '回数']]).setFontWeight('bold');

  var list = Object.keys(wrongCnt).map(function (k) {
    var p = k.split('|');
    var type = p[0], tag = p[1], correct, wrong;
    if (p.length >= 4) { correct = fmtByType_(type, p[2]); wrong = fmtByType_(type, p[3]); }
    else { correct = ''; wrong = fmtByType_(type, p[2]); }   // 旧形式（正答が無い）
    return [type, tag, correct, wrong, wrongCnt[k]];
  }).sort(function (a, b) { return b[4] - a[4]; }).slice(0, 40);

  if (list.length) sh.getRange(start + 2, 1, list.length, 5).setValues(list);
  else sh.getRange(start + 2, 1).setValue('データなし');
  sh.setColumnWidth(2, 150); sh.setColumnWidth(3, 130); sh.setColumnWidth(4, 130);

  sh.getRange('A1').setNote(
    '学級全体で、どの型の問題がよく間違えられているかの一覧です。\n' +
    '下の「よくある誤答」は、正しい答えと実際の誤答を並べたものです。\n' +
    '一斉指導でどの型を扱うか決めるときに使ってください。'
  );
  sh.setTabColor('#93C47D');
}

/* ============================================================
 *  自動セットアップ（手動実行は不要）
 * ============================================================ */

function ensureReady_() {
  if (cache_().get('ready')) return;
  try {
    ensureSheets_();
    ensureSchema_();
    ensureTriggers_();
    cache_().put('ready', '1', 3600);
  } catch (e) {
    console.error('ensureReady_ 失敗: ' + e.message);   // キャッシュしない＝次回再挑戦
  }
}

/**
 * スキーマの自動移行。手動実行は不要。
 * 排他ロックで守るので、40人が同時に開いても1回しか走らない。
 */
function ensureSchema_() {
  var props = PropertiesService.getScriptProperties();
  if (Number(props.getProperty('schema_version')) >= SCHEMA_VERSION) return;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (Number(props.getProperty('schema_version')) < SCHEMA_VERSION) {
      migrateSummaryV2_();
      migrateModeNameAndWrong_();
      props.setProperty('schema_version', String(SCHEMA_VERSION));
    }
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/** v1 (kind / best_count なし) から v2 へ。既存データは本番・更新1回として扱う */
function migrateSummaryV2_() {
  var sh = ss_().getSheetByName(SHEETS.SUMMARY);
  if (!sh || sh.getLastRow() === 0) return;
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  if (head.indexOf('kind') >= 0) return;                 // 既に v2

  sh.insertColumnAfter(3);
  sh.getRange(1, 4).setValue('kind').setFontWeight('bold');
  var n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 4, n, 1).setValue('r');

  var last = sh.getLastColumn() + 1;
  sh.getRange(1, last).setValue('best_count').setFontWeight('bold');
  if (n > 0) sh.getRange(2, last, n, 1).setValue(1);      // 少なくとも1回は達成している
}

/**
 * log / summary / daily に「モード名」列を追加する。
 * 既存データの「モード名」は、その行の mode 番号から逆引きして埋める。
 * 各シートの見た目（タブ色・A1の注記）もここで整える。冪等。
 */
function migrateModeNameAndWrong_() {
  function insertModeName(sh, modeCol) {
    if (!sh || sh.getLastRow() === 0) return;
    var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    if (head.indexOf('モード名') >= 0) return;               // 済み
    sh.insertColumnAfter(modeCol);
    sh.getRange(1, modeCol + 1).setValue('モード名').setFontWeight('bold');
    var n = sh.getLastRow() - 1;
    if (n > 0) {
      var modes = sh.getRange(2, modeCol, n, 1).getValues();
      var names = modes.map(function (r) { return [modeName_(Number(r[0])) || '']; });
      sh.getRange(2, modeCol + 1, n, 1).setValues(names);
    }
  }

  insertModeName(ss_().getSheetByName(SHEETS.LOG), 7);
  insertModeName(ss_().getSheetByName(SHEETS.SUMMARY), 2);
  insertModeName(ss_().getSheetByName(SHEETS.DAILY), 3);

  applyFriendlyStyling_();
}

/**
 * どのシートを見ればよいか一目で分かるよう、タブに色をつけ、
 * 直接編集しないほうがよいシートには A1 に注記を入れる。冪等。
 */
function applyFriendlyStyling_() {
  var ss = ss_();
  var technical = { config: '#B7B7B7', class_config: '#B7B7B7', roster: '#4A86E8',
                     log: '#B7B7B7', daily: '#B7B7B7' };
  var friendly = { summary: '#93C47D', weak_child: '#93C47D', weak_class: '#93C47D' };

  Object.keys(technical).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh) sh.setTabColor(technical[name]);
  });
  Object.keys(friendly).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh) sh.setTabColor(friendly[name]);
  });

  var notes = {
    roster: 'ここに児童を登録します（email／学年／組／番号／氏名）。\n学年・組の表記はそろえてください（「2」に統一。「2組」などを混ぜない）。',
    config: '各種設定です。通常は教師用ページ（?page=teacher）から変更してください。\n直接編集すると、反映まで最大5分かかります。',
    class_config: 'クラスごとにモードの解禁を上書きする設定です。通常は教師用ページから操作してください。',
    log: '1回のプレイ（1試行）を1行で記録した内部データです。直接は読まなくてよいシートです。\n個々の誤答を読みたいときは mistakes シートを、傾向を見たいときは weak_child / weak_class を見てください。',
    daily: '当日の学級内ランキングを計算するための内部データです。直接は見なくてよいシートです。',
    summary: '児童ごと・モードごと・制限時間ごとの累計成績とハイスコアです。kind列は r=本番／p=練習です。'
  };
  Object.keys(notes).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh) sh.getRange('A1').setNote(notes[name]);
  });
}

function ensureSheets_() {
  var ss = ss_(), defs = {};
  defs[SHEETS.CONFIG] = ['key', 'value'];
  defs[SHEETS.ROSTER] = ['email', '学年', '組', '番号', '氏名'];
  defs[SHEETS.CLASS] = ['class'].concat((UNIT.flags || []).map(function (f) { return 'allow_' + f.key; }));
  defs[SHEETS.LOG] = ['ts', 'email', '学年', '組', '番号', '氏名', 'mode', 'モード名', 'limit_sec',
                      'correct', 'attempts', 'miss_items', 'slow_items', 'type_stats', 'wrong_items'];
  defs[SHEETS.DAILY] = ['date', 'class', 'mode', 'モード名', 'limit_sec', 'email', 'best', 'ts'];
  defs[SHEETS.SUMMARY] = ['email', 'mode', 'モード名', 'limit_sec', 'kind',
                          'tries', 'total_correct', 'total_attempts', 'best', 'best_count'];
  defs[SHEETS.WCHILD] = [];
  defs[SHEETS.WCLASS] = [];

  var made = false;
  for (var name in defs) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); made = true; }
    if (defs[name].length && sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  ss.getSheetByName(SHEETS.DAILY).getRange('A:A').setNumberFormat('@');

  var cf = ss.getSheetByName(SHEETS.CONFIG);
  if (cf.getLastRow() <= 1) {
    var def = defaults_(), rows = [];
    for (var k in def) rows.push([k, def[k]]);
    cf.getRange(2, 1, rows.length, 2).setValues(rows);
    made = true;
  }
  if (made) {
    cache_().remove('config'); cache_().remove('classcfg');
    applyFriendlyStyling_();
  }
  return made;
}

function ensureTriggers_() {
  var want = { nightlyAggregate: 23, resetDaily: 1 }, have = {};
  ScriptApp.getProjectTriggers().forEach(function (t) { have[t.getHandlerFunction()] = true; });
  for (var fn in want) {
    if (!have[fn]) ScriptApp.newTrigger(fn).timeBased().atHour(want[fn]).everyDays(1).create();
  }
}

/** 承認のために最初に1度だけ実行する */
function setup() {
  cache_().remove('ready');
  ensureReady_();
  return 'セットアップ完了（シート・トリガーを確認しました）';
}
