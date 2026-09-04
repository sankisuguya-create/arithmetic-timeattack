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

var TTL = { config: 60, roster: 300, session: 21600, index: 30 };
var QN = 200;                              // 1セッションの出題数
var SCHEMA_VERSION = 3;                    // 2 = kind/best_count / 3 = モード名列・見やすい表示
var STAR_MAX = 99;                         // 個人内評価（自己ベスト更新回数）の上限
var GUEST_DOMAIN = '@edu.nishi.or.jp';     // 名簿になくても試用できる（記録なし）

function defaults_() {
  var d = {};
  for (var k in BASE_DEFAULTS) d[k] = BASE_DEFAULTS[k];
  var u = UNIT.defaults || {};
  for (var k2 in u) d[k2] = u[k2];
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

/**
 * クラスごとの公開設定。{ '3-1': { modes: {1:true,2:false,...}, seqOff: false } }
 *
 * 公開はモード単位で持つ。以前は「フラグ」（かけ算の拡張・計算モードなど）を単元が
 * 宣言し、複数のモードが1つのフラグを共有していた。その形では
 * 「わり算9×16 だけ閉じる」ができず、`flag: null` のモードは閉じる手段が無かった。
 * 20モードのうち単独で閉じられるものが1つも無い状態だったので、モード単位にした。
 */
function classConfig_(fresh) {
  // 教師画面は fresh で呼ぶ。設定した本人が見る画面が、
  // 最大60秒古い写しを見せると「保存できていない」と区別がつかない。
  // 児童側は毎回シートを読むと重いので、これまでどおりキャッシュを使う。
  if (!fresh) {
    var hit = cache_().get('classcfg');
    if (hit) return JSON.parse(hit);
  }
  var map = {};
  var sh = ss_().getSheetByName(SHEETS.CLASS);
  if (sh && sh.getLastRow() > 1) {
    var v = sh.getDataRange().getValues();
    var head = v[0].map(String);
    for (var i = 1; i < v.length; i++) {
      var ck = String(v[i][0]).trim();
      if (!ck) continue;
      var row = { modes: {}, seqOff: false };
      modeIds_().forEach(function (id) {
        var col = head.indexOf('mode_' + id);
        if (col >= 0) row.modes[id] = toBool_(v[i][col]);
      });
      var sc = head.indexOf('seq_off');
      if (sc >= 0) row.seqOff = toBool_(v[i][sc]);
      map[ck] = row;
    }
  }
  cache_().put('classcfg', JSON.stringify(map), TTL.config);
  return map;
}

/**
 * そのクラスで公開されているモード。{ modeId: true/false }
 *
 * 学年による既定は持たない。教師が class_config で明示したものだけを開ける。
 * 「学年が3以上なら自動で開く」は、担任が触っていないのに開いている状態を作る。
 * どのモードを出すかは進度の判断なので、既定で開けない側に倒す。
 */
function openFor_(grade, cls) {
  var over = classConfig_()[grade + '-' + cls];
  var out = {};
  modeIds_().forEach(function (id) { out[id] = !!(over && over.modes[id]); });
  return out;
}

/** そのクラスが順次開放を外しているか */
function seqOffFor_(grade, cls) {
  var over = classConfig_()[grade + '-' + cls];
  return !!(over && over.seqOff);
}

function modeAllowed_(mode, open, seqOff, tries) {
  var m = modeDef_(mode);
  if (!m) return false;
  if (!open[m.id]) return false;
  return needsMet_(m, seqOff, tries);
}

/**
 * 順次開放。前のモードを規定回数やるまで、次のモードを開けない。
 *
 *   modes: [{ id: 2, needs: { mode: 1, tries: 3 } }]
 *
 * 条件を「回数」にしてあるのは、成績（正答数）にすると閾値の適正値が学級ごとに違い、
 * 下位層が最後のモードに永久に到達しないため。README が到達バッジを却下したのと
 * 同型の欠陥で、それを個人内評価ではなく解禁の顔をして持ち込むことになる。
 * 回数なら遅い子でも必ず到達し、順序だけが担保される。
 *
 * class_config の seq_off にチェックを入れると、そのクラスだけ順序を外せる
 * （授業で全員に同じモードをやらせる場面のため）。
 *
 * tries が無いとき（名簿にない試用者）は開けておく。記録が無いので条件を判定できず、
 * 閉じる側に倒すと試用そのものができなくなる。
 */
function needsMet_(m, seqOff, tries) {
  var nd = m.needs;
  if (!nd) return true;
  if (!tries) return true;
  if (seqOff) return true;
  return (Number(tries[nd.mode]) || 0) >= Number(nd.tries);
}

/**
 * まだ開いていないモードに、開け方の案内文を付ける。{ モードid: 文言 }
 * 教師が非公開にしたモードはここに入れない（画面から消えるので案内する相手がいない）。
 */
function lockNotes_(open, seqOff, tries) {
  var out = {};
  UNIT.modes.forEach(function (m) {
    if (!open[m.id]) return;
    if (needsMet_(m, seqOff, tries)) return;
    out[m.id] = '「' + modeName_(m.needs.mode) + '」を ' +
                m.needs.tries + 'かい やると あきます';
  });
  return out;
}

/** 順次開放を使う単元か。教師画面に「じゅんばん解除」の列を出すかの判定に使う */
function hasNeeds_() {
  for (var i = 0; i < UNIT.modes.length; i++) if (UNIT.modes[i].needs) return true;
  return false;
}

function modeDef_(id) {
  for (var i = 0; i < UNIT.modes.length; i++) if (UNIT.modes[i].id === Number(id)) return UNIT.modes[i];
  return null;
}

function modeIds_() { return UNIT.modes.map(function (m) { return m.id; }); }

/** class_config の見出し。class | mode_1 … mode_n | seq_off（順次開放を使う単元だけ） */
function classHead_() {
  var head = ['class'].concat(modeIds_().map(function (id) { return 'mode_' + id; }));
  if (hasNeeds_()) head.push('seq_off');
  return head;
}

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

/**
 * そのモードに出る問題型を、gen を実際に回して求める。
 * Unit.gs に pool を別途宣言させると gen と二重管理になり、
 * 片方だけ直したときに「練習の選択肢」と「実際に出る問題」がずれる。
 * 出題の正本は gen ひとつだけ、を保つために derive する。
 *
 * 300回引く。プールが4型なら取りこぼす確率は事実上ゼロ。
 * 極端に出現率の低い型（1%未満）を作った単元では取りこぼしうる。
 */
function typesInMode_(mode) {
  var rand = rng_(20260903), seen = {}, out = [];
  for (var i = 0; i < 300; i++) {
    var t = UNIT.gen(rand, Number(mode)).t;
    if (t && !seen[t]) { seen[t] = true; out.push(t); }
  }
  return out;
}

function typesByMode_() {
  var hit = cache_().get('typesbymode');
  if (hit) return JSON.parse(hit);
  var out = {};
  modeIds_().forEach(function (m) { out[m] = typesInMode_(m); });
  cache_().put('typesbymode', JSON.stringify(out), 3600);
  return out;
}

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

/** 送信用に切り詰める: [出題トークン, 欄, 答え, まきじゃく, 問題型, はかりの文字盤] */
function packQueue_(q) {
  return q.map(function (x) {
    return [x.q, x.f, x.f.map(function (k) { return x.ans[k]; }),
            x.ruler || null, x.t, x.dial || null];
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
            units: UNIT.units || {}, digitCap: UNIT.digitCap || {},
            // 型を絞った練習の選択肢。ラベルは types、どの型がどのモードに出るかは gen から導出
            types: UNIT.types || {}, typesByMode: typesByMode_(),
            // 合計で判定するときの換算率。ui.html が単位名を決め打ちしないために渡す
            scale: UNIT.scale || {} },
    settings: uset,
    limitSec: cfg.limit_sec, missLimit: cfg.miss_limit, keyGap: Number(cfg.key_gap)
  };

  if (!c) {
    if (!isGuest_(mail)) {
      return { ok: false, msg: '名簿に登録がありません。担任の先生に伝えてください。' };
    }
    var allOn = {};
    modeIds_().forEach(function (m) { allOn[m] = true; });
    base.guest = true; base.name = ''; base.grade = 0;
    base.open = allOn;                // 名簿外の試用者。記録されないので全モード出す
    base.locked = {};                 // 記録が無いので順次開放は判定できない。開けておく
    base.best = {}; base.practiceBest = {}; base.stars = {}; base.medals = {};
    modeIds_().forEach(function (m) {
      base.best[m] = 0; base.practiceBest[m] = 0; base.stars[m] = 0; base.medals[m] = '';
    });
    return base;
  }

  base.guest = false; base.name = c.name; base.grade = c.grade;
  base.open = openFor_(c.grade, c.cls);
  var b = bests_(mail, cfg.limit_sec);
  base.best = b.best; base.practiceBest = b.practiceBest; base.stars = b.stars;
  base.locked = lockNotes_(base.open, seqOffFor_(c.grade, c.cls), b.tries);
  base.medals = medals_(classKey_(c), mail, cfg.limit_sec);
  return base;
}

/**
 * 記録しない練習（むせいげん）の1問。クライアントに出題ロジックを持たせないため、
 * ここで1問ずつ作って返す。記録しないので token もシードも要らない。
 */
function nextPracticeItem(mode, type) {
  var mail = email_();
  var c = child_(mail);
  if (!c && !isGuest_(mail)) return { ok: false };
  mode = Number(mode);
  if (modeIds_().indexOf(mode) < 0) return { ok: false };
  if (c && !modeAllowed_(mode, openFor_(c.grade, c.cls),
                         seqOffFor_(c.grade, c.cls), triesForGate_(mail))) return { ok: false };

  var rand = rng_(Math.floor(Math.random() * 2147483647));
  var it = UNIT.gen(rand, mode);

  // 型を絞った練習。gen を引き直して当たりを待つ（棄却法）。
  // 型ごとの生成関数を Unit.gs に足させると gen と二重管理になるので、
  // 出題の正本は gen のままにしておく。プールが4型なら平均4回で当たる。
  // 60回引いても当たらなければ、そのまま返す（画面が止まるよりはよい）。
  if (type) {
    for (var i = 0; i < 60 && it.t !== type; i++) it = UNIT.gen(rand, mode);
  }

  return {
    ok: true, q: it.q, f: it.f,
    ans: it.f.map(function (k) { return it.ans[k]; }),
    ruler: it.ruler || null, t: it.t || null, dial: it.dial || null
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

  if (!modeAllowed_(mode, openFor_(c.grade, c.cls),
                    seqOffFor_(c.grade, c.cls), triesForGate_(mail))) {
    return { ok: false, msg: 'このモードは まだ つかえません。' };
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
  var rank = 0, res = { best: correct, star: 0, updated: false };

  /*
   * 記録は直列に書く（同じ行を読んで書き換えるため）。
   * 待ち時間を30秒から10秒に縮めてある。40人が同じ1分の終わりに送ると、
   * 待っている実行が同時実行の枠（1ユーザーあたり30）を埋めたまま居座り、
   * その間、他の児童の boot と startSession が実行されない。
   * 教室で最初に壊れるのは記録ではなく「始められないこと」なので、
   * 混んでいるときは記録を諦めて枠を空ける。
   *
   * 諦めても失われない。token をキャッシュから消すのはロックの内側なので、
   * ここで抜けた回は何も書いていない。端末は未送信として持ち続け、
   * 次の起動でそのまま送り直す（pendFlush）。
   */
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, msg: 'こんでいます。あとで おくりなおします。' };
  }
  try {
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
    // 索引を作り直させる。次に起動した児童が古いベストを見ないように
    cache_().remove('sumidx_' + limSec);
    if (!isPractice) cache_().remove('top3_' + classKey_(c) + '_' + limSec);
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
      // 宣言（UNIT.scale）を正とする。unitScale(関数) は旧単元との互換のため残す
      var k = (UNIT.scale && UNIT.scale[u]) || (UNIT.unitScale ? UNIT.unitScale(u) : 1);
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

/**
 * summary をメール別に畳んだ索引。1回の読み取りを学級全体で分け合う。
 *
 * 帯活動では40人が同じ1分に起動する。児童ごとに summary 全体を読んでいると、
 * 同じ内容を40回読むことになり、実行時間がそのまま同時実行の枠を埋める。
 * 索引にすれば、シートを読むのは最初の1つの実行だけになる。
 *
 * TTL は30秒。自分の記録は submitSession の戻り値でその場で画面に入るので、
 * ここが数十秒古くても児童には見えない（送信時に該当キーは落とす）。
 */
function summaryIndex_(limitSec) {
  var key = 'sumidx_' + limitSec;
  var hit = cache_().get(key);
  if (hit) return JSON.parse(hit);

  var v = sh_(SHEETS.SUMMARY).getDataRange().getValues();
  var idx = {};
  for (var i = 1; i < v.length; i++) {
    var mail = String(v[i][SUM.MAIL]).toLowerCase().trim();
    if (!mail) continue;
    var e = idx[mail];
    if (!e) e = idx[mail] = { best: {}, prac: {}, stars: {}, tries: {} };
    var m = Number(v[i][SUM.MODE]);
    // 順次開放に使う試行回数だけは、制限時間も本番／練習も問わずに合算する。
    // 「何回やったか」の条件なので、条件を満たす道を制限時間の設定で塞がない。
    e.tries[m] = (e.tries[m] || 0) + (Number(v[i][SUM.TRIES]) || 0);
    if (Number(v[i][SUM.LIM]) !== Number(limitSec)) continue;
    if (String(v[i][SUM.KIND]) === 'p') {
      e.prac[m] = Number(v[i][SUM.BEST]) || 0;
    } else {
      e.best[m] = Number(v[i][SUM.BEST]) || 0;
      e.stars[m] = Math.min(Number(v[i][SUM.COUNT]) || 0, STAR_MAX);
    }
  }
  // キャッシュ1件は100KBまで。児童数が多い年は入らないので、その時は素で読む
  var json = JSON.stringify(idx);
  if (json.length < 90000) cache_().put(key, json, TTL.index);
  return idx;
}

function bests_(mail, limitSec) {
  var e = summaryIndex_(limitSec)[mail] || {};
  var real = {}, prac = {}, stars = {}, tries = {};
  modeIds_().forEach(function (m) {
    real[m]  = Number((e.best  || {})[m]) || 0;
    prac[m]  = Number((e.prac  || {})[m]) || 0;
    stars[m] = Number((e.stars || {})[m]) || 0;
    tries[m] = Number((e.tries || {})[m]) || 0;
  });
  return { best: real, practiceBest: prac, stars: stars, tries: tries };
}

/**
 * 順次開放の判定だけに使う。boot は bests_ が返す tries を使い、ここは通らない。
 *
 * needs を持たない単元（九九・長さ・おもさ）では判定そのものが不要なので読まない。
 * 以前は単元を問わず呼んでいて、児童が1回始めるたびに summary 全体を読んでいた。
 * 40人が同時に始める帯活動では、これが同時実行の枠を埋める側に回る。
 */
function triesForGate_(mail) { return hasNeeds_() ? triesByMode_(mail) : null; }

function triesByMode_(mail) {
  var v = sh_(SHEETS.SUMMARY).getDataRange().getValues();
  var out = {};
  modeIds_().forEach(function (m) { out[m] = 0; });
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][SUM.MAIL]).toLowerCase() !== mail) continue;
    var m = Number(v[i][SUM.MODE]);
    if (out[m] !== undefined) out[m] += Number(v[i][SUM.TRIES]) || 0;
  }
  return out;
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

/**
 * そのクラス・その制限時間の、当日の上位3名。{ モードid: [1位, 2位, 3位] }
 * 児童に見えるのは自分がメダル圏内かどうかだけなので、3人ぶんで足りる。
 * summary と同じ理由で、daily の読み取りも学級で1回にまとめる。
 */
function top3_(ck, limitSec) {
  var key = 'top3_' + ck + '_' + limitSec;
  var hit = cache_().get(key);
  if (hit) return JSON.parse(hit);

  var v = sh_(SHEETS.DAILY).getDataRange().getValues();
  var td = today_(), out = {};
  modeIds_().forEach(function (m) {
    var pool = [];
    for (var i = 1; i < v.length; i++) {
      if (dstr_(v[i][0]) === td && String(v[i][1]) === ck &&
          Number(v[i][2]) === m && Number(v[i][4]) === Number(limitSec)) {
        pool.push({ mail: String(v[i][5]).toLowerCase(), s: Number(v[i][6]), t: Number(v[i][7]) });
      }
    }
    pool.sort(function (a, b) { return b.s - a.s || a.t - b.t; });   // 同点は先着優先
    out[m] = pool.slice(0, 3).map(function (x) { return x.mail; });
  });
  cache_().put(key, JSON.stringify(out), TTL.index);
  return out;
}

function medals_(ck, mail, limitSec) {
  var t = top3_(ck, limitSec), out = {};
  modeIds_().forEach(function (m) {
    var k = (t[m] || []).indexOf(mail);
    out[m] = k >= 0 ? ['🥇', '🥈', '🥉'][k] : '';
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

/**
 * いまどの写しを操作しているか。教師画面の見出しに出す。
 *
 * 版を入れ替えた直後は、古い写しと新しい写しが両方開ける状態になる
 * （ゴミ箱に入れただけのスプレッドシートも、履歴やブックマークから開ける）。
 * 教師が古い方で公開し、児童が新しい方を開いていると、
 * 症状は「公開したのに反映されない」になり、どちらの画面を見ても原因が出ない。
 * 名前とURLを画面に出しておけば、取り違えはその場で分かる。
 */
function where_() {
  var out = { file: '', id: '', url: '' };
  try { out.file = ss_().getName(); } catch (e) {}
  // 名前は写しても同じになる。取り違えを確かめられるのは ID のほうで、
  // スプレッドシートの URL の /d/ と /edit のあいだにある文字列と突き合わせる
  try { out.id = ss_().getId(); } catch (e) {}
  try { out.url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return out;
}

function getConfigForUI() {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  return { config: config_(), where: where_(),
           unit: { id: UNIT.id, title: UNIT.title,
           modes: UNIT.modes, types: UNIT.types,
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
  var over = classConfig_(true);
  var classes = listClassesCore_(over);

  /*
   * class_config にあるのに、名簿から作られるクラスと一致しない行を拾う。
   *
   * 公開の判定は「学年-組」の文字列一致だけで決まる（openFor_）。
   * 名簿の組が「1」で class_config が「1組」なら、シートには TRUE が入っているのに
   * 児童には1つも開かない。この食い違いはどちらの画面にも出ないので、
   * 「保存したのに反映されない」としか見えない。名前を並べて出す。
   */
  var known = {};
  classes.forEach(function (c) { known[c.cls] = true; });
  var orphans = [];
  for (var k in over) if (!known[k]) orphans.push(k);

  return { classes: classes, modes: UNIT.modes, hasNeeds: hasNeeds_(),
           orphans: orphans, where: where_() };
}

function saveClassConfig(rows) {
  if (!isTeacher_(email_())) throw new Error('権限がありません');
  var sh = ss_().getSheetByName(SHEETS.CLASS) || ss_().insertSheet(SHEETS.CLASS);
  sh.clear();
  var head = classHead_();
  var ids = modeIds_();
  var out = [head];
  (rows || []).forEach(function (r) {
    var line = [String(r.cls)].concat(ids.map(function (id) { return !!(r.modes && r.modes[id]); }));
    if (hasNeeds_()) line.push(!!r.seqOff);
    out.push(line);
  });
  sh.getRange(1, 1, out.length, head.length).setValues(out);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  cache_().remove('classcfg');

  /*
   * 書いたら読み戻して照合する。
   *
   * 「保存しました」とだけ返していると、書けていない時に教師は児童側を疑い、
   * 原因のない場所を探し続けることになる（実際そうなった）。
   * 保存が通ったかどうかは、保存の瞬間に教師の画面で分かるべきもの。
   *
   * 読み戻しは classConfig_ を通す。児童の公開判定が読むのと同じ経路なので、
   * ここが一致していれば「教師が見ている状態＝児童に効く状態」が保証される。
   */
  var back = classConfig_(true);
  var bad = [];
  (rows || []).forEach(function (r) {
    var b = back[String(r.cls)];
    var same = ids.every(function (id) {
      return !!(b && b.modes[id]) === !!(r.modes && r.modes[id]);
    });
    if (!same) bad.push(String(r.cls));
  });
  if (bad.length) {
    throw new Error('保存できていません（' + bad.join('・') +
                    '）。class_config シートが編集中でないか確かめてください。');
  }
  return { msg: '保存しました（' + (out.length - 1) + ' クラス）',
           classes: listClassesCore_(back) };
}

/**
 * class_config の内容を、教師画面の表と同じ形にして返す。
 * listClasses と保存後の読み戻しで同じ組み立てを使う
 * （別々に書くと、保存直後の表示と再読み込み後の表示がずれる）。
 */
function listClassesCore_(over) {
  var v = sh_(SHEETS.ROSTER).getDataRange().getValues();
  var seen = {}, out = [];
  for (var i = 1; i < v.length; i++) {
    var grade = Number(v[i][1]), cls = String(v[i][2]).trim();
    if (!grade || !cls) continue;
    var ck = grade + '-' + cls;
    if (seen[ck]) { seen[ck].n++; continue; }
    var o = over[ck];
    var row = { cls: ck, grade: grade, room: cls, n: 1,
                modes: {}, seqOff: !!(o && o.seqOff) };
    modeIds_().forEach(function (id) { row.modes[id] = !!(o && o.modes[id]); });
    seen[ck] = row; out.push(row);
  }
  out.sort(function (a, b) { return a.grade - b.grade || (a.room < b.room ? -1 : 1); });
  return out;
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

/**
 * 準備が要るのは設置直後と版を上げた直後だけ。通常はプロパティを1つ読んで終わる。
 *
 * 以前は「済んだ印」をスクリプトキャッシュに置いていた。キャッシュは消えるので、
 * 消えた直後に40人が同時に開くと、40の実行が同じシート操作を並行に走らせる。
 * ensureSheets_ は書き込みを含み、ensureSchema_ は30秒待つロックを取るので、
 * 実行は直列化したまま同時実行の枠（1ユーザーあたり30）を埋め、
 * その間に来た boot / startSession が実行できなくなる。
 * 「40人中1人だけ動いた」の主因はここ。
 *
 * 印は消えないプロパティに持ち、ロックは取れなければ待たずに諦める。
 * 準備は誰か1つの実行がやれば足りる。待つ側に回るくらいなら、
 * その実行はそのまま先へ進めたほうがよい（シートは既にあることがほとんど）。
 */
var READY_KEY = 'ready_schema';

function ensureReady_() {
  // 速い順に見る。キャッシュは消えるので判断の正本ではないが、
  // 消えていない間はプロパティの読み取り（毎回100ms前後かかることがある）を省ける
  if (cache_().get('ready') === String(SCHEMA_VERSION)) return;

  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(READY_KEY) === String(SCHEMA_VERSION)) {
    cache_().put('ready', String(SCHEMA_VERSION), 3600);
    return;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return;              // 誰かが準備中。待たない
  try {
    if (props.getProperty(READY_KEY) === String(SCHEMA_VERSION)) return;
    ensureSheets_();
    ensureSchema_();
    ensureTriggers_();
    props.setProperty(READY_KEY, String(SCHEMA_VERSION));
    cache_().put('ready', String(SCHEMA_VERSION), 3600);
  } catch (e) {
    console.error('ensureReady_ 失敗: ' + e.message);   // 印を立てない＝次回再挑戦
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/**
 * スキーマの自動移行。手動実行は不要。
 * 呼ぶのは ensureReady_ だけで、そこで排他ロックを取っている。
 */
function ensureSchema_() {
  var props = PropertiesService.getScriptProperties();
  if (Number(props.getProperty('schema_version')) >= SCHEMA_VERSION) return;
  migrateSummaryV2_();
  migrateModeNameAndWrong_();
  props.setProperty('schema_version', String(SCHEMA_VERSION));
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
    config: '各種設定です。通常は教師用ページ（?page=teacher）から変更してください。\n直接編集した場合、児童への反映は最大1分遅れます（教師用ページから保存すると即時）。',
    class_config: 'クラスごとに、どのモードを児童に見せるかの設定です。チェックの無いモードは表示されません。\n' +
                  'A列は roster の「学年」「組」から作る「学年-組」と1文字も違ってはいけません（例: 3-1）。\n' +
                  '通常は教師用ページ（?page=teacher）から操作してください。直接編集した場合、児童への反映は最大1分遅れます。',
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
  defs[SHEETS.CLASS] = classHead_();
  defs[SHEETS.LOG] = ['ts', 'email', '学年', '組', '番号', '氏名', 'mode', 'モード名', 'limit_sec',
                      'correct', 'attempts', 'miss_items', 'slow_items', 'type_stats', 'wrong_items'];
  defs[SHEETS.DAILY] = ['date', 'class', 'mode', 'モード名', 'limit_sec', 'email', 'best', 'ts'];
  defs[SHEETS.SUMMARY] = ['email', 'mode', 'モード名', 'limit_sec', 'kind',
                          'tries', 'total_correct', 'total_attempts', 'best', 'best_count'];
  defs[SHEETS.WCHILD] = [];
  defs[SHEETS.WCLASS] = [];

  // 旧形式の class_config（フラグ単位の allow_* 列）が残っていると、
  // 列がずれたまま読み込んで公開設定を誤読する。見出しごと作り直す。
  // モード単位に変えた時点で中身は読めないので、残しても意味がない。
  var made = false, reset = {};
  var cls = ss.getSheetByName(SHEETS.CLASS);
  if (cls && cls.getLastRow() > 0) {
    var h0 = cls.getRange(1, 1, 1, cls.getLastColumn()).getValues()[0].map(String);
    var hasMode = h0.some(function (x) { return x.indexOf('mode_') === 0; });
    // 作り直したら made を立てる。キャッシュに旧形式の読み取り結果が残ったままだと、
    // 消した直後の最大60秒、公開設定を古い列のまま返し続ける。
    if (!hasMode) {
      cls.clear();
      // clear() の直後に getLastRow() が0を返すとは限らない（保留中の変更が
      // 反映される保証が無い）。見出しを書くかどうかをそこに賭けると、
      // 見出しの無い class_config が残り、公開設定が全部オフのまま読まれる。
      // 消したことは自分で覚えておく。
      reset[SHEETS.CLASS] = true;
      made = true;
    }
  }

  for (var name in defs) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); made = true; }
    if (defs[name].length && (reset[name] || sh.getLastRow() === 0)) {
      sh.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  // 書式の指定は書き込み。毎回やると、開いただけの実行が全部シートに書きに行く
  if (made) ss.getSheetByName(SHEETS.DAILY).getRange('A:A').setNumberFormat('@');

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
  PropertiesService.getScriptProperties().deleteProperty(READY_KEY);
  cache_().remove('ready');
  ensureReady_();
  return 'セットアップ完了（シート・トリガーを確認しました）';
}
