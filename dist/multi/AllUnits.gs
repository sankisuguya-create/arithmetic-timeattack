// AllUnits.gs — 全単元の Unit.gs をつないだもの（tools/bundle/build.cjs が作る。直接直さない）
// 単元: bai, bignum, circle, decimal, divmod, factor, hiku, kakehissan, kuku, length, operation-choice, tasu, volume, weight

// ===== apps/grade3/bai/Unit.gs =====
/**
 * Unit.gs — 何倍でしょう（3年：倍の第1〜第3用法、a×b×c）
 *
 * モードは前提スキルの依存順。型の混在は最後の「ぜんぶ」だけ。
 *
 *   ① もとにする大きさ  「赤は 青の 4倍」→ もとにする大きさは どちら？（タップ）
 *   ② ずに かく         文と図（テープ図／関係図）→ 図の ア に入る数は？
 *   ③ しきを えらぶ      文 → ① 24×4 ② 24÷4 ③ 24＋4 から選ぶ（計算はさせない）
 *   ④ なんばい けいさん  第1・第2・第3用法を 1:1:1
 *   ⑤ ばいの ばい        2倍の3倍は何倍？／3つの数のかけ算の場面
 *   ⑥ ぜんぶ            ①〜⑤をまぜる
 *
 * 【語順は①から混ぜる】数が出てくる順と計算の順がそろう文だけで練習すると、
 * 「出てきた順に式を立てる」方略でも正解できてしまい、その誤り（N2）を練習が強める。
 * 各型の半分は、数の出てくる順が計算の順と逆になる文にする。tag の o/r がその区別
 * （o＝そろう、r＝逆）。同じ児童の o と r の正答率の差が、N2 の手がかりになる。
 *
 * 【③は選ぶだけ】演算を決める力と計算の速さを分けて測る。計算の速さは九九・わり算の
 * タイムアタックで測れる。誤りの選択肢は「倍ならかける」（N1）と「倍を差とみる」（N3）。
 *
 * 【④⑤は Enter で確定】第1・第3用法の答えは1桁、第2用法は2桁になる。1桁で自動確定
 * すると、かけてしまった児童（N1）の2桁目が切られ、誤答の値が記録に残らない。
 * 「何倍」は九九の範囲なので全問2桁にもそろえられない。digitCap は2で宣言し、
 * 1桁の答えは Enter で確定する（正しい答えは打った時点で通る）。
 *
 * 【②はテープ図と関係図を半々】同じ場面を両方の図で出し、tag に図の種類を残す。
 * 片方の図だけで誤る児童は、倍の概念ではなく図の読み方（N6）でつまずいている。
 *
 * 文は図（fig）の中に書く。式の欄の大きな字で文を出すと、2行に折り返して図と欄が押し出される。
 */

var BA_INK = '#FFFFFF';
var BA_SUB = '#C9D1E8';
var BA_LINE = '#8C93AC';
var BA_MARK = ['①', '②', '③'];
var BA_NAMES = [['赤', '青'], ['白', '黄'], ['ながい', 'みじかい']];

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['bai'] = {
  id: 'bai',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: '何倍でしょう タイムアタック！',
  teacherTitle: '何倍でしょう 設定・分析',

  units: { cm: '', '倍': '' },

  modes: [
    { id: 1, name: 'もとにする大きさ', desc: '赤は 青の 4倍 → もとにする大きさは？（タップ）' },
    { id: 2, name: 'ずに かく', desc: 'テープ図・関係図の ア に入る数', needs: { mode: 1, tries: 3 },
      help: 'Enter で こたえあわせ' },
    { id: 3, name: 'しきを えらぶ', desc: '24×4 ／ 24÷4 ／ 24＋4 から選ぶ', needs: { mode: 2, tries: 3 } },
    { id: 4, name: 'なんばい けいさん', desc: '第1・第2・第3用法', needs: { mode: 3, tries: 3 },
      help: 'Enter で こたえあわせ' },
    { id: 5, name: 'ばいの ばい', desc: '2倍の3倍は？／a×b×c の場面', needs: { mode: 4, tries: 3 },
      help: 'Enter で こたえあわせ' },
    { id: 6, name: 'ぜんぶ', desc: '①〜⑤をまぜて出す', needs: { mode: 5, tries: 3 },
      help: 'Enter で こたえあわせ' }
  ],

  types: {
    A: 'もとにする大きさ',
    D: 'ず テープ', E: 'ず 関係図',
    S: 'しき えらび',
    F: '何倍（第1）', G: 'くらべる量（第2）', H: 'もとにする量（第3）',
    I: '倍の倍', J: 'a×b×c'
  },

  digitCap: {
    A: { '': 1 }, S: { '': 1 },
    D: { cm: 2, '倍': 2 }, E: { cm: 2, '倍': 2 },
    F: { '倍': 2 }, G: { cm: 2 }, H: { cm: 2 },
    I: { '倍': 2 }, J: { cm: 2 }
  },

  tips: 'tag の o は「数の出てくる順＝計算の順」の文、r は逆順の文。' +
        'r だけで誤る児童は、出てきた順に式を立てている可能性がある。' +
        '第3用法（H）の誤答が正答×倍×倍（くらべる量×倍）なら「倍ならかける」、' +
        '倍の倍（I）の誤答が2つの倍の和なら、倍を足している。' +
        'しき えらび（S）の誤りは、tag の並び（例 S:mul-div-add）と答えた番号で読む。',

  gen: function (rand, mode) {
    switch (mode) {
      case 1: return baBase_(rand);
      case 2: return baDiagram_(rand);
      case 3: return baPick_(rand);
      case 4: return baCalc_(rand);
      case 5: return baTwice_(rand);
      case 6: return UNIT_DEFS['bai'].gen(rand, ri_(rand, 1, 5));   // 全単元をまとめた時も自分の gen を呼ぶ
    }
    throw new Error('mode ' + mode);
  }
};

/* ============================================================
 *  場面（数と文）
 * ============================================================ */

/**
 * 1つの場面：くらべる量 c ＝ もとにする量 m × 倍 k。
 * m・k は 2〜9（c は九九の範囲）。u は 1〜3（第1〜第3用法＝何を問うか）、
 * ord は 'o'（数の出てくる順＝計算の順）か 'r'（逆順）。
 */
function baScene_(rand, u) {
  var nm = pick_(rand, BA_NAMES), m = ri_(rand, 2, 9), k = ri_(rand, 2, 9);
  return { big: nm[0], small: nm[1], m: m, k: k, c: m * k, u: u, ord: rand() < 0.5 ? 'o' : 'r' };
}

/**
 * 場面を文にする（行の配列）。関係の文は常に「<くらべる>は <もと>の k倍」。
 * 「の」の前がもとにする量、という読み方だけで判定できるようにする。
 *
 *   第1用法（何倍）  そろう: c → m（c÷m）   逆: m → c
 *   第2用法（くらべる量）かけ算なので順は答えに影響しない。関係の文を先か後かで分ける
 *   第3用法（もとにする量）そろう: c → k（c÷k） 逆: k → c
 */
function baText_(s) {
  var B = s.big, S = s.small, rel = B + 'は ' + S + 'の ' + s.k + '倍です。';
  var cLine = B + 'は ' + s.c + 'cmです。', mLine = S + 'は ' + s.m + 'cmです。';
  if (s.u === 1) {
    return s.ord === 'o' ? [cLine, mLine, B + 'は ' + S + 'の 何倍？']
                         : [mLine, cLine, B + 'は ' + S + 'の 何倍？'];
  }
  if (s.u === 2) {
    return s.ord === 'o' ? [mLine, rel, B + 'は 何cm？'] : [rel, mLine, B + 'は 何cm？'];
  }
  return s.ord === 'o' ? [cLine, rel, S + 'は 何cm？'] : [rel, cLine, S + 'は 何cm？'];
}

function baTag_(s) {
  return 'u' + s.u + s.ord + ' m' + s.m + ' k' + s.k;
}

/* ============================================================
 *  図（SVG 文字列）
 * ============================================================ */

function baR_(x) { return Math.round(x); }

function baShuffle_(rand, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function baSvg_(w, h, body) {
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" ' +
         'font-family="sans-serif" font-weight="800">' + body + '</svg>';
}
function baText1_(x, y, s, size, fill, anchor, cls) {
  return '<text' + (cls ? ' class="' + cls + '"' : '') + ' x="' + baR_(x) + '" y="' + baR_(y) + '" font-size="' + (size || 44) +
         '" fill="' + (fill || BA_INK) + '" text-anchor="' + (anchor || 'start') +
         '" dominant-baseline="middle">' + s + '</text>';
}
/** 文の行を上から並べる。返り値は次に描ける y */
function baLines_(lines, y0) {
  var body = '', y = y0;
  lines.forEach(function (ln) { body += baText1_(40, y, ln, 44); y += 62; });
  return { svg: body, y: y };
}
function baRect_(x, y, w, h, fill) {
  return '<rect x="' + baR_(x) + '" y="' + baR_(y) + '" width="' + baR_(w) + '" height="' + baR_(h) +
         '" fill="' + (fill || 'none') + '" stroke="' + BA_LINE + '" stroke-width="4"/>';
}
function baLine_(x1, y1, x2, y2, color, w) {
  return '<line x1="' + baR_(x1) + '" y1="' + baR_(y1) + '" x2="' + baR_(x2) + '" y2="' + baR_(y2) +
         '" stroke="' + (color || BA_LINE) + '" stroke-width="' + (w || 4) + '"/>';
}

/** 文だけの図（④⑤）。選択肢があれば下に1行で並べる */
function baPlain_(lines, choices) {
  var W = 960, t = baLines_(lines, 50), body = t.svg, y = t.y + 10;
  if (choices) {
    var boxW = choices.length === 2 ? 330 : 260, boxH = 96, gap = choices.length === 2 ? 80 : 60;
    var x = (W - (choices.length * boxW + (choices.length - 1) * gap)) / 2;
    choices.forEach(function (c, i) {
      body += '<g data-pick="' + (i + 1) + '">' +
              '<rect class="pkb" x="' + baR_(x) + '" y="' + baR_(y) + '" width="' + boxW + '" height="' + boxH +
              '" rx="6" fill="#000" fill-opacity="0" stroke="' + BA_LINE + '" stroke-width="3"/>' +
              baText1_(x + 22, y + boxH / 2, BA_MARK[i], 40, BA_SUB) +
              baText1_(x + boxW / 2 + 24, y + boxH / 2, c, 48, BA_SUB, 'middle', 'pkv') +
              '</g>';
      x += boxW + gap;
    });
    y += boxH + 10;
  }
  return baSvg_(W, y, body);
}

/**
 * テープ図。上＝もとにする量（1つ分）、下＝くらべる量（k つ分に区切る）。
 * 数の欄は vals（'ア' '？' や数）で受け、図は数の大きさに比例させない
 * （比例させると長さの比から答えが読めてしまう）。倍は下のテープの右に書く。
 */
/** '？'や'ア'の問い印なら「？」の色（Core.gs の questionColor_）、数なら既定色 */
function baQfill_(v) { return (v === '？' || v === 'ア') ? questionColor_() : BA_INK; }

function baTape_(s, vals, y0) {
  var x0 = 170, full = 620, one = full / s.k, h = 50, body = '';
  var yS = y0, yB = y0 + 90;
  body += baText1_(40, yS + h / 2, s.small, 40, BA_SUB) + baText1_(40, yB + h / 2, s.big, 40, BA_SUB);
  body += baRect_(x0, yS, one, h, 'rgba(255,255,255,.12)');
  body += baRect_(x0, yB, full, h, 'rgba(255,255,255,.12)');
  for (var i = 1; i < s.k; i++) body += baLine_(x0 + one * i, yB, x0 + one * i, yB + h, BA_LINE, 3);
  body += baText1_(x0 + one + 16, yS + h / 2, vals.m + 'cm', 40, baQfill_(vals.m));
  body += baText1_(x0 + full + 16, yB + h / 2, vals.c + 'cm', 40, baQfill_(vals.c));
  body += baText1_(x0 + full / 2, yB + h + 40, '（' + vals.k + '倍）', 40, baQfill_(vals.k), 'middle');
  return { svg: body, y: yB + h + 80 };
}

/** 関係図。[もとにする量] —×倍→ [くらべる量]。矢印の向きは常に もと→くらべる */
function baRel_(s, vals, y0) {
  var bw = 240, bh = 80, xL = 60, xR = 660, y = y0, body = '';
  body += baRect_(xL, y, bw, bh) + baRect_(xR, y, bw, bh);
  body += baText1_(xL + bw / 2, y + bh / 2, vals.m + 'cm', 44, baQfill_(vals.m), 'middle');
  body += baText1_(xR + bw / 2, y + bh / 2, vals.c + 'cm', 44, baQfill_(vals.c), 'middle');
  body += baText1_(xL + bw / 2, y + bh + 34, s.small, 36, BA_SUB, 'middle');
  body += baText1_(xR + bw / 2, y + bh + 34, s.big, 36, BA_SUB, 'middle');
  var ay = y + bh / 2;
  body += baLine_(xL + bw + 10, ay, xR - 20, ay, BA_INK, 5) +
          '<path d="M' + (xR - 10) + ' ' + ay + ' L' + (xR - 34) + ' ' + (ay - 14) + ' L' + (xR - 34) + ' ' + (ay + 14) + ' Z" fill="' + BA_INK + '"/>';
  body += baText1_((xL + bw + xR) / 2, ay - 36, '×' + vals.k, 44, baQfill_(vals.k), 'middle');
  return { svg: body, y: y + bh + 70 };
}

/* ============================================================
 *  ① もとにする大きさ
 * ============================================================ */

function baBase_(rand) {
  var s = baScene_(rand, 1 + Math.floor(rand() * 3));
  // 関係の文だけを2通りの語順で出す：「赤は 青の k倍」／「青の k倍が 赤」
  var form = rand() < 0.5 ? 'o' : 'r';
  var rel = form === 'o' ? s.big + 'は ' + s.small + 'の ' + s.k + '倍です。'
                         : s.small + 'の ' + s.k + '倍が ' + s.big + 'です。';
  var order = baShuffle_(rand, ['small', 'big']);
  var fig = baPlain_([rel], order.map(function (x) { return s[x]; }));
  return {
    t: 'A', q: ['もとにする 大きさは？'], f: [''], ans: { '': order.indexOf('small') + 1 },
    tag: 'A:' + form + ' ' + order.join('-'), fig: fig
  };
}

/* ============================================================
 *  ② ずに かく（テープ図／関係図）
 * ============================================================ */

function baDiagram_(rand) {
  var s = baScene_(rand, 1 + Math.floor(rand() * 3));
  var unknown = ['k', 'c', 'm'][s.u - 1];               // 第1＝倍、第2＝くらべる、第3＝もと
  var known = unknown === 'k' ? ['m', 'c'] : unknown === 'c' ? ['m', 'k'] : ['c', 'k'];
  var ask = pick_(rand, known);
  var vals = { m: s.m, c: s.c, k: s.k };
  vals[unknown] = '？';
  vals[ask] = 'ア';
  var tape = rand() < 0.5, t = tape ? 'D' : 'E';
  var head = baLines_(baText_(s).slice(0, 2), 50);
  var fig = tape ? baTape_(s, vals, head.y + 10) : baRel_(s, vals, head.y + 10);
  var f = ask === 'k' ? '倍' : 'cm', ans = {};
  ans[f] = s[ask];
  return {
    t: t, q: ['ア に 入る 数は'], f: [f], ans: ans,
    tag: t + ':' + baTag_(s) + ' ア=' + ask,
    fig: baSvg_(960, fig.y, head.svg + fig.svg)
  };
}

/* ============================================================
 *  ③ しきを えらぶ
 * ============================================================ */

function baPick_(rand) {
  var s = baScene_(rand, 1 + Math.floor(rand() * 3));
  // 文に出てくる2つの数。式は大きい数を先に書く（÷が3年で読める形になる）
  var nums = s.u === 1 ? [s.c, s.m] : s.u === 2 ? [s.m, s.k] : [s.c, s.k];
  var a = Math.max(nums[0], nums[1]), b = Math.min(nums[0], nums[1]);
  var right = s.u === 2 ? 'mul' : 'div';
  var exp = { mul: a + '×' + b, div: a + '÷' + b, add: a + '＋' + b };
  var order = baShuffle_(rand, ['mul', 'div', 'add']);
  return {
    t: 'S', q: ['しきは どれ？'], f: [''], ans: { '': order.indexOf(right) + 1 },
    tag: 'S:' + order.join('-') + ' ' + baTag_(s),
    fig: baPlain_(baText_(s), order.map(function (x) { return exp[x]; }))
  };
}

/* ============================================================
 *  ④ なんばい けいさん
 * ============================================================ */

function baCalc_(rand) {
  var u = 1 + Math.floor(rand() * 3), s = baScene_(rand, u);
  var t = ['F', 'G', 'H'][u - 1];
  var f = u === 1 ? '倍' : 'cm', ans = {};
  ans[f] = u === 1 ? s.k : u === 2 ? s.c : s.m;
  return { t: t, q: ['こたえは'], f: [f], ans: ans, tag: t + ':' + baTag_(s), fig: baPlain_(baText_(s)) };
}

/* ============================================================
 *  ⑤ ばいの ばい
 * ============================================================ */

function baTwice_(rand) {
  var nm = pick_(rand, [['赤', '青', '白'], ['黄', '白', '青']]);
  var a = ri_(rand, 2, 5), b = ri_(rand, 2, 4), ord = rand() < 0.5 ? 'o' : 'r';
  // C → B（b倍）→ A（a倍）。A は C の a×b 倍
  var l1 = nm[1] + 'は ' + nm[2] + 'の ' + b + '倍です。';
  var l2 = nm[0] + 'は ' + nm[1] + 'の ' + a + '倍です。';
  var rel = ord === 'o' ? [l1, l2] : [l2, l1];
  if (rand() < 0.5) {
    return { t: 'I', q: ['こたえは'], f: ['倍'], ans: { '倍': a * b },
             tag: 'I:' + ord + ' a' + a + ' b' + b,
             fig: baPlain_(rel.concat([nm[0] + 'は ' + nm[2] + 'の 何倍？'])) };
  }
  var m = ri_(rand, 2, 4);   // m×a×b ≦ 4×5×4 ＝ 80（2桁に収める）
  return { t: 'J', q: ['こたえは'], f: ['cm'], ans: { cm: m * a * b },
           tag: 'J:' + ord + ' m' + m + ' a' + a + ' b' + b,
           fig: baPlain_([nm[2] + 'は ' + m + 'cmです。'].concat(rel, [nm[0] + 'は 何cm？'])) };
}

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['bai'];

// ===== apps/grade3/bignum/Unit.gs =====
/** 大きな数TA。万・億・兆の位取りを、各欄4桁以内で練習する。 */
// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['bignum'] = {
  id: 'bignum',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: '大きな数 タイムアタック！',
  teacherTitle: '大きな数 設定・分析',
  units: { '万': '#F1B1E4', '億': '#8A6CE5', '兆': '', 'こ': '' },
  modes: [
    { id: 1, name: '万に わける', desc: '30506 → 3万506（1〜9万の範囲）', help: 'つぎの欄は →、こたえあわせは Enter' },
    { id: 2, name: '億・兆に わける', desc: '300040000 → 3億4万 ／ 3000400000000 → 3兆4億', help: 'つぎの欄は →、こたえあわせは Enter' },
    { id: 3, name: '位の 数字', desc: '大きな数の、指定された位の数字（0も出題）' },
    { id: 4, name: 'いくつ分', desc: '3500000 は 10000 が 350こ', help: 'Enter で こたえあわせ' },
    { id: 5, name: '10倍・100倍', desc: '35万 × 10 = 350万', help: 'Enter で こたえあわせ' },
    { id: 6, name: '10分の1・100分の1', desc: '350万 ÷ 10 = 35万', help: 'Enter で こたえあわせ' }
  ],
  types: {
    splitMan: '万と残り', splitOku: '億と万', splitCho: '兆と億',
    digitMan: '万のまとまりの位', digitOku: '億のまとまりの位', digitCho: '一兆の位',
    countSen: '千がいくつ', countMan: '一万がいくつ', countOku: '一億がいくつ',
    times10: '10倍', times100: '100倍', divide10: '10分の1', divide100: '100分の1'
  },
  digitCap: {
    splitMan: { '万': 1, '': 4 }, splitOku: { '億': 1, '万': 4 }, splitCho: { '兆': 1, '億': 4 },
    3: { '': 1 }, 4: { 'こ': 4 }, 5: { '万': 4, '億': 4 }, 6: { '万': 4, '億': 4 }
  },
  fieldsByType: {
    splitMan: ['万', ''], splitOku: ['億', '万'], splitCho: ['兆', '億'],
    countSen: ['こ'], countMan: ['こ'], countOku: ['こ']
  },
  tips: '万・億・兆は4桁ずつのまとまり。0のある問題の誤答も確認してください。<br>' +
    '位の数字、いくつ分、10倍と10分の1を分けて見ると、指導する内容を選べます。<br>' +
    '初打鍵までの時間には読む時間や操作への慣れも含まれます。遅さだけで未定着とは判断せず、誤答や授業中の様子と合わせてください。',

  gen: function (rand, mode) {
    var high, low, names, ans, q, t, n, unit, factor;
    if (mode === 1 || mode === 2) {
      // 上位は1桁。下位は0や途中の0を含む4桁のまとまり。
      // 下位を1000以上に絞ると、位を埋める0の練習ができない。
      high = ri_(rand, 1, 9);
      low = ri_(rand, 0, 9999);
      var level = mode === 1 ? 0 : ri_(rand, 1, 2);
      names = [['万', ''], ['億', '万'], ['兆', '億']][level];
      t = ['splitMan', 'splitOku', 'splitCho'][level];
      n = (high * 10000 + low) * Math.pow(10000, level);
      ans = {}; ans[names[0]] = high; ans[names[1]] = low;
      return { t: t, q: [String(n)], f: names, ans: ans, tag: t + ':' + n };
    }
    if (mode === 3) {
      // 各位を同じ頻度で選ぶ。文字列で作って途中の0も保持する。
      var pos = ri_(rand, 4, 12);
      var places = ['一万', '十万', '百万', '千万', '一億', '十億', '百億', '千億', '一兆'];
      var width = Math.min(13, pos + 2);
      var digits = [String(ri_(rand, 1, 9))];
      for (var i = 1; i < width; i++) digits.push(String(ri_(rand, 0, 9)));
      n = digits.join('');
      t = pos < 8 ? 'digitMan' : (pos < 12 ? 'digitOku' : 'digitCho');
      return { t: t, q: [n, 'の', places[pos - 4] + 'の位の数字'], f: [''],
        ans: { '': Number(digits[width - pos - 1]) }, tag: n + ':place' + pos };
    }
    if (mode === 4) {
      var ix = ri_(rand, 0, 2);
      unit = [1000, 10000, 100000000][ix];
      n = ri_(rand, 1, 9999);
      return { t: ['countSen', 'countMan', 'countOku'][ix],
        q: [String(n * unit), 'は', String(unit) + 'が'], f: ['こ'],
        ans: { 'こ': n }, tag: (n * unit) + ':groups' + unit };
    }
    if (mode !== 5 && mode !== 6) throw new Error('大きな数: モードが不正です');
    factor = pick_(rand, [10, 100]);
    unit = pick_(rand, ['万', '億']);
    // 積も被除数も9999以下。除算は整数になり、全回答が4桁欄に収まる。
    n = ri_(rand, 1, Math.floor(9999 / factor));
    var divide = mode === 6;
    t = (divide ? 'divide' : 'times') + factor;
    q = [String(divide ? n * factor : n), unit, divide ? '÷' : '×', String(factor)];
    ans = {}; ans[unit] = divide ? n : n * factor;
    return { t: t, q: q, f: [unit], ans: ans, tag: t + ':' + n + unit };
  }
};

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['bignum'];

// ===== apps/grade3/circle/Unit.gs =====
/**
 * Unit.gs — 円と球（3年）
 *
 * モードは前提スキルの依存順に並べ、土台に近いものを先に置く。
 * 型の混在（ランダム出題）は最後の「ぜんぶ」だけ。
 *
 *   ① ちゅうしん・はんけい  中心はどれ／半径はどれ（タップで答える）
 *   ② ちょっけい            直径はどれ（タップで答える）
 *   ③ はんけい⇄ちょっけい   半径→直径／直径→半径（同じモードに両向きを混ぜる）
 *   ④ きゅう                いちばん大きい切り口はどれ／球の半径⇄直径
 *   ⑤ ならんだ まる          箱に並んだボールの長さ（1列・たてよこ・逆算）
 *   ⑥ ぜんぶ                ①〜⑤を混ぜる
 *
 * 図の向きは①から毎問ランダムに回す。向きを固定して練習すると
 * 「半径は右向きの1本」「直径は横の端から端」という典型図への固着を
 * 練習がかえって強める（推定）。「ランダムは最後」は型の混在のことで、図の向きのことではない。
 *
 * タップで答える問いの誤答の選択肢は、誤概念ごとに1つずつ置く。
 * 並びは毎問入れ替わるので、答えた番号だけでは何を選んだか分からない。
 * tag に並び（例 'B:chord-rad-short-off'）を入れておき、mistakes シートの
 * 「もんだい」と「こたえた値」から、どの誤りの選択肢を選んだかを読めるようにしている。
 *
 *   A 中心    center＝正答 near/mid/edge＝中心からずれた点（内側の点ならどれでも中心、とみなす誤り）
 *   B 半径    rad＝正答 short＝円周まで届かない chord＝半径と同じ長さの弦（「半分の長さ＝半径」）
 *             off＝中心以外から円周へ
 *   C 直径    dia＝正答 hchord＝中心を通らない横の弦（「横の端から端＝直径」） rad＝半径
 *             part＝中心を通るが円周まで届かない
 *   F 切り口  mid＝正答 up/top/down＝中心を通らない切り口（「切り口はどれも同じ大きさ」）
 *
 * 長さの答えはすべて2桁（10〜99）にそろえる。桁数が確定のタイミングとして漏れないため
 * （docs/ADD_UNIT.md 3章）。半径を答える問いは直径を偶数に限る（小数は未習）。
 */

var CI_MARK = ['①', '②', '③', '④'];
/** タップの問いの誤答の選択肢 → 誤概念（UNIT.wrongLabel）。並びの意味は先頭の注記の表と同じ */
var CI_WRONG_ = {
  'A:near': '中心からずれた点を中心とみる', 'A:mid': '中心からずれた点を中心とみる', 'A:edge': '中心からずれた点を中心とみる',
  'B:short': '円周まで届かない線を半径とみる', 'B:chord': '半分の長さの線（弦）を半径とみる', 'B:off': '中心を通らない線を半径とみる',
  'C:hchord': '横の端から端（中心を通らない）を直径とみる', 'C:rad': '半径を直径とみる', 'C:part': '円周まで届かない線を直径とみる',
  'F:up': '中心を通らない切り口を最大とみる', 'F:top': '中心を通らない切り口を最大とみる', 'F:down': '中心を通らない切り口を最大とみる'
};
var CI_LINE = '#8C93AC';    // 円の輪郭（背景の図）
var CI_INK = '#FFFFFF';     // 選ぶ対象の線・点
var CI_LABEL = '#C9D1E8';   // 長さの字

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['circle'] = {
  id: 'circle',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: '円と球 タイムアタック！',
  teacherTitle: '円と球 設定・分析',

  defaults: {
    // 最初のメニューの背景に敷く「成長する図形」（docs/ARCHITECTURE.md「背景の床」）
    floor_on: 1,
    floor_per_answer: 0.75
  },

  /** 教師画面に出す単元固有の設定欄（Core も teacher.html もキーの意味を知らず、ここの宣言だけを見て欄を描く） */
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）。0.75 なら、1分20問の速さでおよそ3,700問で全部そろう',
      min: 0.05, max: 10, step: 0.05 }
  ],

  /**
   * 床の図形と第二の色。このサイトは「円と球」：起点が2つで、左下（縦長の画面では上）から円の模様（鱗のピルの渦）、
   * 反対側の隅寄りから球の模様（フィボナッチ球）が、どのモードの正答でも同じ割合ずつ交互に育つ。
   * 球は床の上に乗っている見え方。台帳は design リポジトリの growing-figures/COLORS.md
   */
  floorPattern: 'circlesphere',
  floorColor: 'amethyst',

  units: { cm: '' },

  modes: [
    { id: 1, name: 'ちゅうしん・はんけい', desc: '中心はどれ？／半径はどれ？（タップ）' },
    { id: 2, name: 'ちょっけい', desc: '直径はどれ？（タップ）', needs: { mode: 1, tries: 3 } },
    { id: 3, name: 'はんけい⇄ちょっけい', desc: '半径12cm → 直径は？', needs: { mode: 2, tries: 3 } },
    { id: 4, name: 'きゅう', desc: 'いちばん大きい切り口／球の半径⇄直径', needs: { mode: 3, tries: 3 } },
    { id: 5, name: 'ならんだ まる', desc: '箱に並んだボールの長さ', needs: { mode: 4, tries: 3 } },
    { id: 6, name: 'ぜんぶ', desc: '①〜⑤をまぜて出す', needs: { mode: 5, tries: 3 } }
  ],

  types: {
    A: '中心', B: '半径', C: '直径',
    D: '半径→直径', E: '直径→半径',
    F: '切り口', G: '球 半径→直径', H: '球 直径→半径',
    I: 'ならび 1れつ', J: 'ならび 1こ分', K: 'ならび たてよこ'
  },

  digitCap: {
    A: { '': 1 }, B: { '': 1 }, C: { '': 1 }, F: { '': 1 },
    D: { cm: 2 }, E: { cm: 2 }, G: { cm: 2 }, H: { cm: 2 },
    I: { cm: 2 }, J: { cm: 2 }, K: { cm: 2 }
  },

  tips: 'タップの問い（中心・半径・直径・切り口）の誤りは mistakes シートで読む。' +
        '「もんだい」の欄が選択肢の並び（例 B:chord-rad-short-off）で、' +
        '「こたえた値」が3なら③の short（円周まで届かない線）を選んだ、と読む。' +
        'ならび（I・J）で答えが正答のちょうど半分なら、ボール1こ分を半径で数えている可能性がある。',

  /** 用語モード（教師画面の「ようご」）に出す用語。台帳は Core.gs の TERMS_ */
  terms: ['circle', 'center', 'radius', 'diameter', 'sphere'],

  /**
   * 誤答 → 誤概念（教師画面の抜け一覧）。tag と、正しい答え・最初に間違えた値（文字列）から読む。
   * 読めない誤り（単なる計算違い）は '' を返す。
   */
  wrongLabel: function (t, tag, want, got) {
    var g = Number(got), w = Number(want);
    if (/^[ABCF]$/.test(t)) {
      var kinds = String(tag).split(':')[1];
      var k = kinds ? kinds.split('-')[g - 1] : '';
      return CI_WRONG_[t + ':' + k] || '';
    }
    if (/^[DEGH]$/.test(t) && g && (g * 2 === w || g === w * 2)) return '半径と直径を取りちがえる';
    if (/^[IJK]$/.test(t) && g && (g * 2 === w || g === w * 2)) return 'ボール1こ分を半径で数える';
    return '';
  },

  gen: function (rand, mode) {
    switch (mode) {
      case 1: return rand() < 0.5 ? ciCenter_(rand) : ciRadius_(rand);
      case 2: return ciDiameter_(rand);
      case 3: return ciConvert_(rand);
      case 4: return rand() < 0.4 ? ciCut_(rand) : ciSphere_(rand);
      case 5: return ciRow_(rand);
      case 6: return UNIT_DEFS['circle'].gen(rand, ri_(rand, 1, 5));   // 全単元をまとめた時も自分の gen を呼ぶ
    }
    throw new Error('mode ' + mode);
  }
};

/* ============================================================
 *  図の部品（SVG 文字列）
 * ============================================================ */

function ciR_(x) { return Math.round(x); }

/** rand で並べ替える（Math.random を使うとサーバーの再採点と食い違う） */
function ciShuffle_(rand, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** 中心 (cx,cy)、半径 r、角 th（ラジアン、上向きが正）の点 */
function ciAt_(cx, cy, r, th) {
  return [cx + r * Math.cos(th), cy - r * Math.sin(th)];
}

function ciSvg_(w, h, body) {
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" ' +
         'font-family="sans-serif" font-weight="800">' + body + '</svg>';
}
function ciCircle_(cx, cy, r, stroke, width, className) {
  return '<circle cx="' + ciR_(cx) + '" cy="' + ciR_(cy) + '" r="' + ciR_(r) +
         '" fill="none" stroke="' + (stroke || CI_LINE) + '" stroke-width="' + (width || 4) +
         '"' + (className ? ' class="' + className + '"' : '') + '/>';
}
function ciDot_(p) {
  return '<circle cx="' + ciR_(p[0]) + '" cy="' + ciR_(p[1]) + '" r="6" fill="' + CI_INK + '"/>';
}
function ciSeg_(p, q) {
  return '<line x1="' + ciR_(p[0]) + '" y1="' + ciR_(p[1]) + '" x2="' + ciR_(q[0]) + '" y2="' + ciR_(q[1]) +
         '" stroke="' + CI_INK + '" stroke-width="6" stroke-linecap="round"/>';
}
function ciText_(x, y, s, size, fill) {
  return '<text x="' + ciR_(x) + '" y="' + ciR_(y) + '" font-size="' + (size || 30) +
         '" fill="' + (fill || CI_LABEL) + '" text-anchor="middle" dominant-baseline="middle">' + s + '</text>';
}
/** 線分 p→q の中点から、線に垂直に d だけずらした位置に長さを書く */
function ciLenLabel_(p, q, s, d) {
  var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / L, ny = dx / L;
  if (ny > 0) { nx = -nx; ny = -ny; }   // 上側に書く
  // 縦に近い線では字の横幅（「40cm」で約70画素）が線に掛かるので、横へのずれを足す
  var k = (d || 26) + Math.abs(nx) * 40;
  return ciText_(mx + nx * k, my + ny * k, s, 30);
}

/**
 * タップで答える問い。4つの小さな図を横に並べる。
 * draw(kind, cx, cy, r) が1枚分の図を返す。
 */
function ciChoice_(rand, t, ask, kinds, right, draw) {
  var order = ciShuffle_(rand, kinds);
  var W = 240, H = 220, r = 78, body = '';
  order.forEach(function (k, i) {
    var cx = i * W + W / 2, cy = H / 2 + 12;
    body += '<g data-pick="' + (i + 1) + '">' +
            '<rect x="' + (i * W) + '" y="0" width="' + W + '" height="' + H + '" fill="none" stroke="none" pointer-events="all"/>' +
            ciText_(i * W + 22, 24, CI_MARK[i], 32) + draw(k, cx, cy, r) + '</g>';
  });
  return {
    t: t, q: ask, f: [''], ans: { '': order.indexOf(right) + 1 },
    tag: t + ':' + order.join('-'),   // ',' は記録の区切りなので使わない
    fig: ciSvg_(W * 4, H, body)
  };
}

function ciAngle_(rand) { return rand() * Math.PI * 2; }

/* ============================================================
 *  ① ちゅうしん・はんけい
 * ============================================================ */

function ciCenter_(rand) {
  var off = { center: 0, near: 0.32, mid: 0.5, edge: 0.7 };
  return ciChoice_(rand, 'A', ['ちゅうしんは', 'どれ？'], ['center', 'near', 'mid', 'edge'], 'center',
    function (k, cx, cy, r) {
      return ciCircle_(cx, cy, r, CI_LINE, 4, 'pkb') + ciDot_(ciAt_(cx, cy, r * off[k], ciAngle_(rand)));
    });
}

function ciRadius_(rand) {
  return ciChoice_(rand, 'B', ['はんけいは', 'どれ？'], ['rad', 'short', 'chord', 'off'], 'rad',
    function (k, cx, cy, r) {
      var th = ciAngle_(rand), c = [cx, cy], s = '';
      if (k === 'rad') s = ciSeg_(c, ciAt_(cx, cy, r, th));
      else if (k === 'short') s = ciSeg_(c, ciAt_(cx, cy, r * 0.55, th));
      else if (k === 'chord') s = ciSeg_(ciAt_(cx, cy, r, th), ciAt_(cx, cy, r, th + Math.PI / 3));
      else s = ciSeg_(ciAt_(cx, cy, r * 0.45, th), ciAt_(cx, cy, r, th + Math.PI / 2));
      return ciCircle_(cx, cy, r, CI_LINE, 4, 'pkb') + s + ciDot_(c);
    });
}

/* ============================================================
 *  ② ちょっけい
 * ============================================================ */

function ciDiameter_(rand) {
  return ciChoice_(rand, 'C', ['ちょっけいは', 'どれ？'], ['dia', 'hchord', 'rad', 'part'], 'dia',
    function (k, cx, cy, r) {
      var th = ciAngle_(rand), c = [cx, cy], s = '';
      if (k === 'dia') s = ciSeg_(ciAt_(cx, cy, r, th), ciAt_(cx, cy, r, th + Math.PI));
      else if (k === 'hchord') {
        // 中心を通らない横の弦。中心から上か下へ 0.35r ずらす
        var y = cy + (rand() < 0.5 ? -1 : 1) * r * 0.35, hw = r * Math.sqrt(1 - 0.35 * 0.35);
        s = ciSeg_([cx - hw, y], [cx + hw, y]);
      } else if (k === 'rad') s = ciSeg_(c, ciAt_(cx, cy, r, th));
      else s = ciSeg_(ciAt_(cx, cy, r * 0.6, th), ciAt_(cx, cy, r * 0.6, th + Math.PI));
      return ciCircle_(cx, cy, r, CI_LINE, 4, 'pkb') + s + ciDot_(c);
    });
}

/* ============================================================
 *  ③ はんけい⇄ちょっけい
 * ============================================================ */

/** 半径 r（5〜20）→ 直径、または 直径 d（20〜40 の偶数）→ 半径。答えは常に2桁 */
function ciPair_(rand) {
  return rand() < 0.5 ? { give: 'r', r: ri_(rand, 5, 20) } : { give: 'd', r: ri_(rand, 10, 20) };
}

function ciConvert_(rand) {
  var p = ciPair_(rand), W = 420, H = 300, cx = W / 2, cy = H / 2 + 8, R = 120;
  var th = ciAngle_(rand), c = [cx, cy], body = ciCircle_(cx, cy, R), a, b, t, ask, ans, label;
  if (p.give === 'r') {
    a = c; b = ciAt_(cx, cy, R, th);
    t = 'D'; ask = ['ちょっけいは']; ans = p.r * 2; label = p.r + 'cm';
  } else {
    a = ciAt_(cx, cy, R, th + Math.PI); b = ciAt_(cx, cy, R, th);
    t = 'E'; ask = ['はんけいは']; ans = p.r; label = (p.r * 2) + 'cm';
  }
  body += ciSeg_(a, b) + ciDot_(c) + ciLenLabel_(a, b, label, 28);
  return { t: t, q: ask, f: ['cm'], ans: { cm: ans }, tag: t + ':' + label, fig: ciSvg_(W, H, body) };
}

/* ============================================================
 *  ④ きゅう
 * ============================================================ */

/** 球（輪郭）と、高さ h（-1〜1、上が正）の水平な切り口 */
function ciBall_(cx, cy, r, h, className) {
  var rx = r * Math.sqrt(1 - h * h), ry = Math.max(4, rx * 0.28), y = cy - h * r;
  return ciCircle_(cx, cy, r, CI_LINE, 4, className) +
         '<ellipse cx="' + ciR_(cx) + '" cy="' + ciR_(y) + '" rx="' + ciR_(rx) + '" ry="' + ciR_(ry) +
         '" fill="rgba(255,255,255,.18)" stroke="' + CI_INK + '" stroke-width="5"/>';
}

function ciCut_(rand) {
  var h = { mid: 0, up: 0.5, top: 0.8, down: -0.6 };
  return ciChoice_(rand, 'F', ['いちばん大きい', 'きり口は？'], ['mid', 'up', 'top', 'down'], 'mid',
    function (k, cx, cy, r) { return ciBall_(cx, cy, r, h[k], 'pkb'); });
}

/** 球を中心で切った切り口に、半径か直径を引いて長さを書く */
function ciSphere_(rand) {
  var p = ciPair_(rand), W = 420, H = 300, cx = W / 2, cy = H / 2 + 8, R = 120, ry = R * 0.28;
  var body = ciBall_(cx, cy, R, 0), c = [cx, cy], a, b, t, ask, ans, label;
  if (p.give === 'r') {
    a = c; b = [cx + R, cy];
    t = 'G'; ask = ['この きゅうの', 'ちょっけいは']; ans = p.r * 2; label = p.r + 'cm';
  } else {
    a = [cx - R, cy]; b = [cx + R, cy];
    t = 'H'; ask = ['この きゅうの', 'はんけいは']; ans = p.r; label = (p.r * 2) + 'cm';
  }
  body += ciSeg_(a, b) + ciDot_(c) + ciText_((a[0] + b[0]) / 2, cy + ry + 30, label, 30);
  return { t: t, q: ask, f: ['cm'], ans: { cm: ans }, tag: t + ':' + label, fig: ciSvg_(W, H, body) };
}

/**
 * p から q までの長さを示す括弧（｛ を横倒しにした形）。side は括弧の張り出す向き（+1/-1、
 * p→q の進行方向に対して右が +1）。返り値の tip は括弧の先端（字を置く位置の手前）。
 *
 * 点線（線分）で示すと、図の中の半径・直径の線と同じ「線」に見え、
 * 「箱の辺に線が引いてある＝その線の長さ」と、長さを線そのものと取り違えさせる。
 * 括弧は「ここからここまで」という範囲の記号で、線分の仲間に見えない。
 * 色も選ぶ対象の線（白）と分けて、長さの字と同じ色にする。
 */
function ciBrace_(p, q, side) {
  var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy);
  var ux = dx / L, uy = dy / L, nx = -uy * side, ny = ux * side, k = 14;
  function pt(t, o) { return ciR_(p[0] + ux * t + nx * o) + ' ' + ciR_(p[1] + uy * t + ny * o); }
  var m = L / 2;
  var d = 'M' + pt(0, 0) + ' Q' + pt(0, k) + ' ' + pt(k, k) +
          ' L' + pt(m - k, k) + ' Q' + pt(m, k) + ' ' + pt(m, 2 * k) +
          ' Q' + pt(m, k) + ' ' + pt(m + k, k) +
          ' L' + pt(L - k, k) + ' Q' + pt(L, k) + ' ' + pt(L, 0);
  return {
    svg: '<path d="' + d + '" fill="none" stroke="' + CI_LABEL + '" stroke-width="4" stroke-linejoin="round"/>',
    tip: [p[0] + ux * m + nx * 2 * k, p[1] + uy * m + ny * 2 * k]
  };
}

/* ============================================================
 *  ⑤ ならんだ まる（箱に入ったボール）
 * ============================================================ */

/**
 * rows×cols に並べたボールと箱を描く。
 * give: 'd'（1こに直径を引く）/'r'（1こに半径を引く）/'box'（箱のよこに長さ）/null
 * ask:  'w'（よこに？の寸法線）/'h'（たてに？）/null
 */
function ciBox_(rows, cols, d, give, ask, boxLen) {
  // ボール1こ分を120画素に固定し、図の外枠を中身に合わせて切る。
  // 外枠を固定幅にすると、ボールが少ない図ほど余白ばかりになり、表示が縮んで長さの字が読めない
  var u = 120, pad = 90;
  var bw = u * cols, bh = u * rows, x0 = pad, y0 = pad;
  var W = bw + pad * 2, H = bh + pad * 2;
  var body = '<rect x="' + ciR_(x0) + '" y="' + ciR_(y0) + '" width="' + ciR_(bw) + '" height="' + ciR_(bh) +
             '" fill="none" stroke="' + CI_LINE + '" stroke-width="5"/>';
  for (var i = 0; i < rows; i++) for (var j = 0; j < cols; j++) {
    body += ciCircle_(x0 + u * (j + 0.5), y0 + u * (i + 0.5), u / 2, CI_LINE, 3);
  }
  // 長さを示すのは左上のボール（向きは横に固定：箱の辺と平行で、比べる向きがそろう）
  var c = [x0 + u / 2, y0 + u / 2];
  if (give === 'd') {
    body += ciSeg_([x0, c[1]], [x0 + u, c[1]]) + ciDot_(c) + ciText_(c[0], c[1] - 26, d + 'cm', 34);
  } else if (give === 'r') {
    body += ciSeg_(c, [x0 + u, c[1]]) + ciDot_(c) + ciText_(c[0] + u / 4, c[1] - 26, (d / 2) + 'cm', 34);
  } else if (give === 'box') {
    var bt = ciBrace_([x0, y0 - 6], [x0 + bw, y0 - 6], -1);   // 箱の上、上へ張り出す
    body += bt.svg + ciText_(bt.tip[0], bt.tip[1] - 22, boxLen + 'cm', 36);
  }
  if (ask === 'w') {
    var bw_ = ciBrace_([x0, y0 + bh + 6], [x0 + bw, y0 + bh + 6], 1);   // 箱の下、下へ
    body += bw_.svg + ciText_(bw_.tip[0], bw_.tip[1] + 24, '？', 38, questionColor_());
  } else if (ask === 'h') {
    var bh_ = ciBrace_([x0 + bw + 6, y0], [x0 + bw + 6, y0 + bh], -1);   // 箱の右、右へ
    body += bh_.svg + ciText_(bh_.tip[0] + 24, bh_.tip[1], '？', 38, questionColor_());
  }
  return ciSvg_(W, H, body);
}

function ciRow_(rand) {
  var k = rand();
  if (k < 0.4) {
    // I：1列に n こ、1こ分の長さ（直径か半径）から箱のよこを出す。答え 10〜99
    var n = ri_(rand, 2, 5), d = 2 * ri_(rand, Math.ceil(5 / n), Math.floor(49 / n));
    var give = rand() < 0.5 ? 'd' : 'r';
    return { t: 'I', q: ['はこの', 'よこは'], f: ['cm'], ans: { cm: n * d },
             tag: 'I:' + n + 'こ ' + (give === 'd' ? 'ちょっけい' + d : 'はんけい' + (d / 2)),
             fig: ciBox_(1, n, d, give, 'w') };
  }
  if (k < 0.7) {
    // J：箱のよこ L と個数 n から、1こ分の直径か半径を出す。答え 10〜20台
    var n2 = ri_(rand, 2, 4), wantR = rand() < 0.5;
    var d2 = wantR ? 2 * ri_(rand, 10, Math.floor(49 / n2)) : ri_(rand, 10, Math.floor(99 / n2));
    return { t: 'J', q: ['ボール1この', wantR ? 'はんけいは' : 'ちょっけいは'], f: ['cm'],
             ans: { cm: wantR ? d2 / 2 : d2 },
             tag: 'J:' + n2 + 'こ ' + (n2 * d2) + (wantR ? '→はんけい' : '→ちょっけい'),
             fig: ciBox_(1, n2, d2, 'box', null, n2 * d2) };
  }
  // K：たて rows × よこ cols に並べ、たてかよこを問う。直径で与える
  var rows = ri_(rand, 2, 3), cols = ri_(rand, 2, 4), side = rand() < 0.5 ? 'w' : 'h';
  var cnt = side === 'w' ? cols : rows;
  var d3 = ri_(rand, Math.ceil(10 / cnt), Math.floor(99 / cnt));
  return { t: 'K', q: ['はこの', side === 'w' ? 'よこは' : 'たては'], f: ['cm'], ans: { cm: cnt * d3 },
           tag: 'K:' + rows + 'x' + cols + ' ちょっけい' + d3 + (side === 'w' ? ' よこ' : ' たて'),
           fig: ciBox_(rows, cols, d3, 'd', side) };
}

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['circle'];

// ===== apps/grade3/decimal/Unit.gs =====
/** 小数TA。小数を整数化して生成し、浮動小数の丸め誤差を採点に持ち込まない。 */
// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['decimal'] = {
  id: 'decimal',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: '小数 タイムアタック！',
  teacherTitle: '小数 設定・分析',
  units: { 'こ': '' },
  modes: [
    { id: 1, name: '0.1の いくつ分', desc: '3.7 は 0.1 が 37こ' },
    { id: 2, name: '0.01の いくつ分', desc: '3.70 は 0.01 が 370こ' },
    { id: 3, name: '位の 数字', desc: '4.08 の 百分の一の位' },
    { id: 4, name: '10倍・100倍', desc: '0.36 × 10 をした数の 一の位' },
    { id: 5, name: '10分の1・100分の1', desc: '36 ÷ 100 をした数の 十分の一の位' }
  ],
  types: {
    countTenth: '0.1がいくつ', countHundredth: '0.01がいくつ',
    digitOnes: '一の位', digitTenth: '十分の一の位', digitHundredth: '百分の一の位',
    times10Ones: '10倍後の一の位', times10Tenth: '10倍後の十分の一の位',
    times100Tens: '100倍後の十の位', times100Ones: '100倍後の一の位',
    divide10Ones: '10分の1後の一の位', divide10Tenth: '10分の1後の十分の一の位',
    divide100Tenth: '100分の1後の十分の一の位',
    divide100Hundredth: '100分の1後の百分の一の位'
  },
  digitCap: {
    countTenth: { 'こ': 2 }, countHundredth: { 'こ': 3 },
    digitOnes: { '': 1 }, digitTenth: { '': 1 }, digitHundredth: { '': 1 },
    times10Ones: { '': 1 }, times10Tenth: { '': 1 },
    times100Tens: { '': 1 }, times100Ones: { '': 1 },
    divide10Ones: { '': 1 }, divide10Tenth: { '': 1 },
    divide100Tenth: { '': 1 }, divide100Hundredth: { '': 1 }
  },
  fieldsByType: { countTenth: ['こ'], countHundredth: ['こ'] },
  tips: 'いくつ分、位の数字、10倍・100倍とその逆を分けて見ると、つまずきを絞れます。<br>' +
    '初打鍵までの時間だけで理解を決めず、正答率と誤答も合わせて確認してください。',

  /** 百分の一を1とする整数を、末尾の0を保った小数にする。 */
  decimal_: function (n) {
    var whole = Math.floor(n / 100);
    var fraction = String(n % 100);
    if (fraction.length < 2) fraction = '0' + fraction;
    return whole + '.' + fraction;
  },

  /** 十分の一を1とする整数を、小数第1位まで表示する。 */
  tenth_: function (n) {
    return Math.floor(n / 10) + '.' + (n % 10);
  },

  gen: function (rand, mode) {
    var n, type, place, answer, factor;
    if (mode === 1) {
      n = ri_(rand, 10, 99);
      return { t: 'countTenth', q: [this.tenth_(n), 'は', '0.1 が'],
        f: ['こ'], ans: { 'こ': n }, tag: 'tenth:' + n };
    }
    if (mode === 2) {
      n = ri_(rand, 100, 999);
      return { t: 'countHundredth', q: [this.decimal_(n), 'は', '0.01 が'],
        f: ['こ'], ans: { 'こ': n }, tag: 'hundredth:' + n };
    }
    if (mode === 3) {
      n = ri_(rand, 100, 999);
      place = ri_(rand, 0, 2);
      type = ['digitOnes', 'digitTenth', 'digitHundredth'][place];
      answer = [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10][place];
      return { t: type, q: [this.decimal_(n), 'の',
        ['一の位の数字', '十分の一の位の数字', '百分の一の位の数字'][place]],
        f: [''], ans: { '': answer }, tag: 'digit:' + n + ':' + place };
    }
    if (mode === 4) {
      // 0.ab を10倍／100倍し、移動先の2つの位から一つを問う。
      n = ri_(rand, 10, 99);
      factor = pick_(rand, [10, 100]);
      place = ri_(rand, 0, 1);
      if (factor === 10) {
        type = place === 0 ? 'times10Ones' : 'times10Tenth';
      } else {
        type = place === 0 ? 'times100Tens' : 'times100Ones';
      }
      answer = place === 0 ? Math.floor(n / 10) : n % 10;
      return { t: type, q: [this.decimal_(n), '×', String(factor), 'をした数の',
        factor === 10 ? (place === 0 ? '一の位' : '十分の一の位')
                      : (place === 0 ? '十の位' : '一の位')],
        f: [''], ans: { '': answer }, tag: 'times:' + n + ':' + factor + ':' + place };
    }
    if (mode === 5) {
      // ab を10分の1／100分の1にし、移動先の2つの位から一つを問う。
      n = ri_(rand, 10, 99);
      factor = pick_(rand, [10, 100]);
      place = ri_(rand, 0, 1);
      if (factor === 10) {
        type = place === 0 ? 'divide10Ones' : 'divide10Tenth';
      } else {
        type = place === 0 ? 'divide100Tenth' : 'divide100Hundredth';
      }
      answer = place === 0 ? Math.floor(n / 10) : n % 10;
      return { t: type, q: [String(n), '÷', String(factor), 'をした数の',
        factor === 10 ? (place === 0 ? '一の位' : '十分の一の位')
                      : (place === 0 ? '十分の一の位' : '百分の一の位')],
        f: [''], ans: { '': answer }, tag: 'divide:' + n + ':' + factor + ':' + place };
    }
    throw new Error('小数: モードが不正です');
  }
};

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['decimal'];

// ===== apps/grade3/divmod/Unit.gs =====
/**
 * Unit.gs — あまりのあるわり算（3年）
 *
 * 九九タイムアタックが測るのは「1回の想起の速さ」。
 * こちらが測るのは「あまりを出す手続きが1手で出るか、数え上げているか」。
 * 同じ児童を並べると「わり切れるわり算は速いのに、あまりが出ると遅い」が見える。
 *
 * ③が遅い児童がいても、現行の型だけでは原因が絞れない。
 * 九九の逆が出ないのか、上限つきの探索ができないのか、引き算で止まるのか、
 * 商とあまりの同時表記で落ちるのか——候補が4つあって弁別できない。
 * そこで手続きを分解し、1段階＝1モードにしてある。
 *
 *   ① くくのあな   四□32               九九の となえの 空き（積から、かけた数）
 *   ② 九九さがし   64まで ／ 七□□      こえない最大の九九（かけた数と積）
 *   ③ あといくつ   73−72 → 1           差を出す（あまりの決定）
 *   ④ ひとつなぎ   73÷8＝／八【九】【72】／73−72＝【1】  ②③を同じ数値で通す
 *   ⑤ あってる？   32÷9＝2あまり14      示された式を確かめて正しい答えを書く
 *   ⑥ わり算      32÷9                 あまりのあるわり算
 *
 * ④は2段組みで、1段目を正答するまで2段目を覚っておく。
 * 覚いが無いと「73−72」の72を先に読めてしまい、
 * 九九を探す手続きを飛ばして引き算だけで答えが出る。
 *
 * ①②は九九の唱えの形（「四八32」）で出し、埋める字を欄にしてある。
 * 「4のだん 32」と書くと、段と積を読んでから唱えに翻訳する一手が挟まる。
 * 唱えの形のまま出せば、探すもの（□）と唱えが同じ並びになる。
 * ①は積が示してあり埋めるのは かけた数だけ、②は上限だけが示してあり
 * かけた数と積の両方を埋める。差は「ぴったりの数」か「こえない数」かで、
 * その差がそのまま わり切れる場合とあまりが出る場合の差になる。
 *
 * ②の1行目は「64まで」だけにしてある。「いちばん大きい」は
 * モード名（こえない 九九さがし）と help が持つ。式の場に文を置くと、
 * 大きな字で2行に折り返して、探す対象の「七□□」が画面の下に押される。
 *
 * 混合モードは置いていない。モードは6つまで（児童の数字キー1〜6）で、
 * この6段階で枠が埋まるため。
 */

/**
 * 数字 → 漢数字。④の商の表示と、④の1段目に置く「わる数」の両方で使う。
 * 九九は唱えで覚えるので、「八 九 72」と漢数字で並べると唱え（はちく72）に重なる。
 * 「8 9 72」だと、かけ算の式にも読めて唱えに乗らない。
 */
var DM_KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['divmod'] = {
  id: 'divmod',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: 'あまりのあるわり算 タイムアタック！',
  teacherTitle: 'あまりのあるわり算 設定・分析',

  // 「遅い」は秒の閾値ではなく、同じ学年・同じ型の児童の分布と比べる（Core の slowBand_）。
  // 以前は単元で1つの slow_ms を⑤に合わせて持っていたため、①③は赤が出にくかった。

  /** 「あまり」は答えの欄のあいだに出る。q の中にも同じトークンで出す */
  units: { 'あまり': '' },

  /**
   * モードidは据え置いてある。①③を 5・6 にしたのは、既存の log / summary が
   * mode=1〜4 で記録済みで、idを振り直すと過去の行が別モードの記録に混ざるため。
   * 児童が見る番号は表示順（index.html の cardTop が idx+1 を振る）なので、
   * 配列を学習順に並べておけば画面では 1〜5 の連番になる。
   *
   * id=4 の「ぜんぶまぜ」は外した。枠が6つしかなく、分解した5段階で埋まる。
   * 保持の面では混合練習のほうがよい（docs/ADD_UNIT.md 7章）ので、
   * 混ぜたいときは⑤の「むせいげん」を型を絞らずに回す運用で代える。
   */
  modes: [
    { id: 5, name: 'くくの あな', desc: '四□32',
      help: '九九の となえに なるように、□に かずを 入れよう' },

    { id: 1, name: 'こえない 九九さがし', desc: '64まで ／ 七□□',
      needs: { mode: 5, tries: 3 },
      help: 'その かずを こえない、いちばん 大きい 九九。□は かける かずと こたえ' },

    { id: 6, name: 'あと いくつ', desc: '73−72',
      needs: { mode: 1, tries: 3 },
      help: 'ひいた のこりが、そのまま あまりに なる' },

    { id: 7, name: 'ひとつなぎ', desc: '73÷8＝ ／ 八□□ ／ 73−72＝□',
      needs: { mode: 6, tries: 3 },
      help: '上の くくが あったら、したの しきが 見える' },

    { id: 2, name: 'あってる？', desc: '32÷9＝2あまり14',
      needs: { mode: 7, tries: 3 },
      help: '上の しきを たしかめて、正しい こたえを 書こう' },

    { id: 3, name: 'あまりのある わり算', desc: '32÷9',
      needs: { mode: 2, tries: 3 } }
  ],

  /**
   * 分析の軸。段別（2〜9の段）に割らない。
   * 段の想起は九九タイムアタックが既に測っていて、ここで8列作ると二重計測になり、
   * weak_child が読めない幅になる。ここで見たいのは段ではなく手続きの段階。
   *
   * ④を「正しい式」と「誤りの式」に分けてあるのは、
   * 正しい式まで直してしまう過剰修正（あまりを見ずに解き直す子）を切り分けるため。
   */
  types: {
    K:  '①くくのあな',
    P:  '②九九さがし',
    D:  '③あといくつ',
    C:  '④ひとつなぎ',
    Jo: '⑤はんだん(正しい式)',
    Jx: '⑤はんだん(あまりが大)',
    R:  '⑥あまりのあるわり算'
  },

  /**
   * ①③は1打、⑤⑥は2打（商1桁＋あまり1桁）、②は3打（かける数1桁＋積2桁）、
   * ④は4打。モードの中では打鍵数が揃うので、モード内の児童間比較は成立する。
   * 揃わないのは型をまたいだときで、①③と②④⑤⑥を直接くらべてはいけない
   * （docs/ARCHITECTURE.md「自動判定と情報漏れ」。tips にも書いてある）。
   *
   * ①③の答えは必ず1桁。②のかける数は必ず1桁（積を2桁に絞ってあるので
   * かける数は2〜9）、積は必ず2桁なので、宣言と実際の桁数は食い違わない。
   */
  /**
   * 教師が調整する設定。最初のメニューの背景に敷く「成長する図形」（九九と同じ仕組み）。
   * 本番の正答を「標準の分数」（そのモードの1分あたり平均正答で割った値）に直して積み、
   * 無地 → 輪郭 → 学年の色 → 第二の色 と画面全体を覆うたびに次の層へ進む。
   * このサイトはペンローズ（5回対称：太い菱形と細い菱形）。色1＝太い菱形、色2＝細い菱形。
   * 表示だけに効き、出題にも採点にも関わらない。仕様の正本は design リポジトリの growing-figures/
   */
  defaults: {
    floor_on: 1,
    floor_per_answer: 0.75
  },
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '練習を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）。0.75 なら、1分20問の速さでおよそ6,000問（約5時間の練習）で全部そろう',
      min: 0.05, max: 10, step: 0.05 }
  ],

  /** 床の図形と第二の色。サイトごとに変える（台帳は design リポジトリの growing-figures/COLORS.md） */
  floorPattern: 'penrose',
  floorColor: 'sapphire',

  /** 育ちの倍率の既定（教師画面の全般設定で変えられる）。単元の仕上げの「あまりのある わり算」をいちばん練習させたいので2倍 */
  growWeights: { 3: 2 },

  digitCap: {
    K:  { 'かける': 1 },
    P:  { 'かける': 1, 'つみ': 2 },
    D:  { '': 1 },
    C:  { 'しょう': 1, 'つみ': 2, 'のこり': 1 },
    Jo: { 'あまり': 1, '': 1 },
    Jx: { 'あまり': 1, '': 1 },
    R:  { 'あまり': 1, '': 1 }
  },

  /**
   * 欄ごとの数字の字形。九九の唱えの位置にある欄だけ、打った数字を漢数字で描く。
   * ①②の「かける」と④の「しょう」がそれで、どちらも唱えの2字目に当たる。
   * 共通画面はこの表の意味を知らず、宣言された欄の数字を引き当てるだけ。
   *
   * 欄キー '' には宣言しないこと。③⑤⑥のあまりの欄が '' なので、
   * 宣言するとあまりまで漢数字になる。
   */
  glyph: { 'かける': DM_KANJI, 'しょう': DM_KANJI },

  /**
   * ④で目立たせる欄。商とあまり＝そのまま「73÷8」の答えになる2つだけを色で示し、
   * 途中の積（つみ）は白のままにする。手続きの断片と答えを見分けるため。
   *
   * 色は 4年の すみれ #8A6CE5（別学年の色をもう1色として使う決まり。Core.gs の GRADE_EXTRA_）。
   * 実測（check-palette.mjs、背景 #101728）：白との ΔE00 は最小 38.4、赤 #FF1A30 とは 41.0、
   * 3年のミントとは 3型で 13.9 に下がるが明るさの比 2.0 が残る。背景とのコントラスト 4.6。
   *
   * 色だけに意味を持たせない。色を宣言した欄は共通画面が下線も太くし、薄く塗るので、
   * 色相が潰れる見え方でも太さと塗りが残る。
   *
   * ①②の欄には宣言しない。この2つは全部の欄が答えで、分ける対象が無い。
   * 分けるもののないところに色を足すと、④の紫（途中の積と最終の答えを分ける）が
   * 何を指しているのか読めなくなる。
   */
  slotColor: { 'しょう': '#8A6CE5', 'のこり': '#8A6CE5' },

  /** 誤答を「3あまり5」の形で出す。欄キーがそのまま後ろに付く */
  fieldsByType: {
    K:  ['かける'],
    P:  ['かける', 'つみ'],
    D:  [''],
    C:  ['しょう', 'つみ', 'のこり'],
    Jo: ['あまり', ''],
    Jx: ['あまり', ''],
    R:  ['あまり', '']
  },

  tips:
    '<b>weak_child</b>：児童ごと・型ごとの平均想起時間(秒)。同じ学年・同じ型の児童の平均より標準偏差1つ分以上遅いと赤。<br>' +
    '測っているのは想起の速さではなく、あまりを出す手続きが1手で出るかどうか。<br>' +
    '⑥までの手続きを①〜④に分解してあるので、⑥が遅い原因をどこか1つに絞れる。<br><br>' +
    '・①が赤 → 九九の逆（積から、かけた数）が出ない。九九タイムアタックの段別を見る<br>' +
    '・①は緑で②が赤 → 逆は出るが、こえない最大をさがす手続きで止まっている<br>' +
    '・③が赤 → 引き算で止まっている。あまりの意味の前に、くり下がりの手当てが要る<br>' +
    '・①②③が緑で⑥が赤 → 部品はあるが、つなげて1手にできていない。④の反復へ<br>' +
    '・④で1段目のまちがいが多い → 部品は出るが、同じ数値で通すところで落ちている<br>' +
    '・⑤が⑥より遅い → 示された答えを確かめられず、一から解き直している<br>' +
    '・Jo（正しい式）だけ誤答が多い → あまりを見ずに直す過剰修正。「たしかめ」の指導へ<br>' +
    '・Jx（あまりが大）だけ誤答が多い → あまり＜わる数 が条件として入っていない<br>' +
    '・ゆらぎが大きい → 想起と数え上げを行き来している。手続きの短縮より想起の練習<br><br>' +
    '<b>型をまたいで秒数をくらべないこと。</b> 打つ数が型ごとに違う' +
    '（①③は1打、⑤⑥は2打、②は3打、④は4打）。差の打鍵ぶんは想起ではない。' +
    'くらべるのは同じ型の中の児童どうし、または同じ児童の同じ型の推移。<br>' +
    '赤は型ごとに学年の分布と比べて付くので、打つ数の違う型どうしでも赤の有無はくらべてよい。<br>' +
    '<b>④の秒数は1段目までしか測っていない。</b> 所要msは提示から最初の打鍵までなので、' +
    '2段目の引き算にかかった時間は入らない。④は連結の練習用で、引き算の速さは③で見る。',

  /**
   * 1問作る。
   *
   * ①の積と②の答えは2桁（10〜81）、③の答えは1桁（1〜8）、
   * ④⑤は商1桁・あまり1〜(わる数-1)、わられる数は2桁（10〜89）に揃えてある。
   *
   * あまり0（わり切れる）を④⑤で出さないのは2つ理由がある。
   * 1つは指導との整合で、3年ではわり切れるとき「あまり0」とは書かない。
   * もう1つは画面の仕様で、index.html は空欄を0として扱い、
   * 全欄が正解と一致した瞬間に自動送信する。あまり0の問題を出すと、
   * 商を打った時点（あまり欄は空＝0）で正解と一致してしまい、
   * あまりを書かせないまま次の問題へ進む。
   *
   * ①はわり切れる場合そのものだが、欄が1つで「あまり」が無いので
   * この事故は起きない。むしろ①と②を並べることで、
   * ぴったり分けられる場合と そうでない場合の差が型として見える。
   */
  gen: function (rand, mode) {
    if (mode === 5) return dmFactor_(rand);
    if (mode === 1) return dmSearch_(rand);
    if (mode === 6) return dmGap_(rand);
    if (mode === 7) return dmChain_(rand);
    if (mode === 2) return dmJudge_(rand);
    if (mode === 3) return dmDivide_(rand);
    // 知らないモードでは落とす。既定を⑤にすると、modes と gen が食い違ったときに
    // 「なぜか全部わり算が出る」という形でしか表に出ず、原因にたどり着けない。
    throw new Error('divmod: 知らないモード ' + mode);
  }
};

/**
 * ①「四□32」＝ 四八32 の となえの 2字目を埋める → 8（欄は漢数字で「八」と出る）。
 *
 * 唱えの形のまま出す。「4のだん　32」だと、段と積を読んでから唱えに翻訳する
 * 一手が挟まり、測っているものに翻訳の時間が乗る。
 * 欄が式の途中に入るので rows を使う（既定の経路は欄を右端にまとめてしまう）。
 * 覆いは要らないので veil は載せない。
 *
 * ②と同じ並び（漢数字の段 → 欄）にしてある。違いは、積が示してあるか
 * 上限だけが示してあるかで、その差が ぴったりの数（わり切れる）と
 * こえない数（あまりが出る）の対比になる。
 *
 * 積を2桁（10〜81）に絞るのは、1桁の積（二一2）が混ざると
 * 同じ型の中で難度が割れるため。答えは必ず1桁なので桁数は漏れない。
 */
function dmFactor_(rand) {
  var a = ri_(rand, 2, 9);                               // だん
  var b = ri_(rand, Math.ceil(10 / a), 9);               // かけた数＝答え（積を2桁に）
  return {
    t: 'K',
    q: [DM_KANJI[a], '□', String(a * b)],                // 記録用。画面は rows で描く
    rows: [[DM_KANJI[a], '_', String(a * b)]],
    f: ['かける'], ans: { 'かける': b },
    tag: 'K' + a + '*' + b
  };
}

/**
 * ②「64まで ／ 七□□」＝ 64 をこえない 七の段の九九のうち いちばん大きいもの
 * → 七九63（欄は「九」と「63」）。
 *
 * ①から変えたのは、埋める字を1つ増やしたところ。
 * 積だけを書かせると、九九の唱えを通さずに「64に近い7の倍数」を
 * 引き算で当てにいく経路が残る。かける数を先に置くと、唱えを通す順になり、
 * 主指標（提示から初打鍵まで）が「何をかけるか」の決定時刻を指す。
 * これは④の1段目（八□□）と同じ形で、②が④の部品であることが見た目で伝わる。
 *
 * 1行目は「64まで」だけ。「いちばん大きい」はモード名と help が持つ
 * （式の場は字が大きく、文を置くと折り返して問題本体が下へ押される）。
 *
 * 基準数は必ず「その段の倍数ではない数」にする（dmFit_ の あまりが1以上）。
 * 倍数を出すと、教科書の「64より小さい」と手続き上の「64以下」で答えが割れ、
 * 同じ問題文が2通りに読めてしまう。
 */
function dmSearch_(rand) {
  var x = dmFit_(rand);
  return {
    t: 'P',
    q: [String(x.n), 'まで', DM_KANJI[x.a], '□', '□'],   // 記録用。画面は rows で描く
    rows: [
      [String(x.n), 'まで'],
      [DM_KANJI[x.a], '_', '_']
    ],
    f: ['かける', 'つみ'], ans: { 'かける': x.b, 'つみ': x.p },
    tag: x.n + '<' + x.a
  };
}

/**
 * ④「73÷8＝ ／ 八 □ □ ／ 73−72＝□」＝ 商・積・あまりを、同じ数値のまま順に通す。
 *
 * 0段目は解いている式そのもの。欄が無いので覆いはかからず、最後まで出したままにする。
 * 何の問題を解いているかが見えていないと、下の2段が手続きの断片にしか見えない。
 * 1段目は九九の唱え。わる数（八）は出してあり、児童が埋めるのは
 * かけた数（九＝商）と答え（72＝積）。商だけ漢数字で出るのは glyph の宣言による。
 * 2段目は覆いの下にあり、1段目を両方とも正解するまで見えない（veil: 2）。
 *
 * 覆いが要るのは、2段目に「73−72」と書いてあるため。
 * 先に読めてしまうと、九九を探す手続きを飛ばして引き算だけで答えが出る。
 * ②と③を別々に通せる児童が、つなげて通せるかを見るのがこの型の目的なので、
 * 順番を飛ばせる状態にすると測るものが変わる。
 *
 * 値域は②と同じ dmFit_。積を2桁に揃えてあるので、
 * 「つみ」の欄は常に2桁で、宣言した桁数と食い違わない。
 */
function dmChain_(rand) {
  var x = dmFit_(rand);
  return {
    t: 'C',
    q: [String(x.n), '÷', String(x.a)],
    rows: [
      [String(x.n), '÷', String(x.a), '='],
      [DM_KANJI[x.a], '_', '_'],
      [String(x.n), '-', String(x.p), '=', '_']
    ],
    veil: 2,
    f: ['しょう', 'つみ', 'のこり'],
    ans: { 'しょう': x.b, 'つみ': x.p, 'のこり': x.r },
    tag: 'C' + x.n + '/' + x.a
  };
}

/**
 * ②④が共有する値域。わる数 2〜9、積は2桁（10〜81）、
 * あまり 1〜(わる数−1)、わられる数 11〜89。
 *
 * 基準数は必ず「その段の倍数ではない数」になる（あまりが1以上だから）。
 * 倍数を出すと、教科書の「29より小さい」と手続き上の「29以下」で答えが割れ、
 * 同じ問題文が2通りに読めてしまう。
 *
 * 積を2桁に絞ってあるので、商は必ず1桁になる（積が2桁になる最小の
 * かける数が2以上のため）。④の桁数の宣言はこれに依っている。
 */
function dmFit_(rand) {
  var a = ri_(rand, 2, 9);
  var b = ri_(rand, Math.ceil(10 / a), 9);
  var r = ri_(rand, 1, a - 1);
  return { a: a, b: b, r: r, p: a * b, n: a * b + r };
}

/**
 * ③「73−72」＝ 1。②で見つけた積を引いて、あまりを出す段階。
 *
 * ただの2桁−2桁ではなく、④⑤に実際に出てくる組だけを引く。
 * 引かれる数は わられる数、引く数は その段の こえない最大の積で、
 * 差は必ず 1〜(わる数−1)＝1〜8 になる。くり下がりのある組（42−35）も
 * そのまま出る。ここで止まる児童は、あまりの意味以前に引き算で止まっている。
 */
function dmGap_(rand) {
  var x = dmParts_(rand);
  return {
    t: 'D',
    q: [String(x.n), '-', String(x.a * x.b)],
    f: [''], ans: { '': x.r },
    tag: x.n + '-' + (x.a * x.b)
  };
}

/**
 * ④示された式を確かめて、正しい商とあまりを書く。
 *
 * ○×の2択にしていない。スコアは正答数だけで誤答に減点が無く、
 * miss_limit 回まちがえると正答が出る作りなので、2択は連打が最適戦略になり、
 * 順位と weak_child の想起時間が同時に壊れる。
 *
 * 誤りは「商が1小さく、あまりが わる数だけ大きい」の1種類だけ。
 * 商を1大きくするとあまりが負になるので、3年の範囲で作れる誤りはこの向きしかない。
 * 正しい式を3問に1問まぜ、「いつも直せばよい」戦略を潰す。
 */
function dmJudge_(rand) {
  var x = dmParts_(rand);
  var ok = (ri_(rand, 1, 3) === 1);
  var sb = ok ? x.b : x.b - 1;                           // 示された商
  var sr = ok ? x.r : x.r + x.a;                         // 示されたあまり
  return {
    t: ok ? 'Jo' : 'Jx',
    q: [String(x.n), '÷', String(x.a), '=', String(sb), 'あまり', String(sr)],
    f: ['あまり', ''], ans: { 'あまり': x.b, '': x.r },
    tag: x.n + '/' + x.a + '>' + sb + 'a' + sr
  };
}

/** ⑤あまりのあるわり算 */
function dmDivide_(rand) {
  var x = dmParts_(rand);
  return {
    t: 'R',
    q: [String(x.n), '÷', String(x.a)],
    f: ['あまり', ''], ans: { 'あまり': x.b, '': x.r },
    tag: x.n + '/' + x.a
  };
}

/**
 * ③④⑤が共有する値域。わる数 2〜9、商 2〜9、あまり 1〜(わる数-1)、
 * わられる数は2桁（10〜89）。
 * 商が2以上なのは、④の誤り式（商を1小さくする）が作れるようにするため。
 */
function dmParts_(rand) {
  var a = ri_(rand, 2, 9);
  var r = ri_(rand, 1, a - 1);
  var b = ri_(rand, Math.max(2, Math.ceil((10 - r) / a)), 9);
  return { a: a, b: b, r: r, n: a * b + r };
}

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['divmod'];

// ===== apps/special/factor/Unit.gs =====
/** 素因数分解。学年に属さない特殊枠。出題・再採点の正本。 */
// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['factor'] = {
  id: 'factor', category: 'special', grade: null,
  title: '素因数分解タイムアタック！',
  // 児童メニューのタイトルのふりがな。[漢字, 読み] か、読みの要らない文字列を並べる（つなぐと title と同じ文字列になる）
  titleRuby: [['素','そ'],['因','いん'],['数','すう'],['分','ぶん'],['解','かい'],'タイムアタック！'], teacherTitle: '素因数分解 設定・分析',
  units: {}, answerOrder: 'unordered',
  interaction: { kind: 'prime-division', keys: factorPrimes_(179) },   // 既定。今は全モードが keys を持つ（そのモードに出る素数の上限までのキーだけ出す）
  modes: [
    { id: 1, name: '16まで', desc: '4〜16の合成数', diagram: true, keys: factorPrimes_(7) },
    { id: 2, name: '九九まで', desc: '九九に現れる合成数', diagram: true, keys: factorPrimes_(7) },
    { id: 3, name: '360まで(素数〜13)', desc: '360までの合成数で、素因数が2・3・5・7・11・13だけのもの', diagram: true, keys: factorPrimes_(13) },
    { id: 4, name: '360まで(素数〜97)', desc: '360までの合成数で、最大の素因数が97以下のもの', diagram: true, keys: factorPrimes_(97) },
    // 画面では5・6番目。id 5・6 は旧「図なし」の記録をそのまま引き継ぐために図なし側へ回したので、7・8にする。
    // 1024＝2の10乗は、このモードで最も長い分解（因数10個）
    { id: 7, name: '1024まで(素数〜13)', desc: '1024までの合成数で、素因数が2・3・5・7・11・13だけのもの', diagram: true, keys: factorPrimes_(13) },
    { id: 8, name: '1024まで(素数〜97)', desc: '1024までの合成数で、最大の素因数が97以下のもの', diagram: true, keys: factorPrimes_(97) },
    // 図なし。pair のモードと同じ出題範囲・同じ公開設定で、記録だけ分ける。メニューでは左下の切り替えで出す。
    // 5・6 は旧モード5「九九まで（図なし）」・旧モード6「360まで（図なし）」の id。既存の記録をそのまま使う
    { id: 11, name: '16まで（図なし）', desc: 'モード1と同じ出題範囲', diagram: false, pair: 1, keys: factorPrimes_(7) },
    { id: 5, name: '九九まで（図なし）', desc: 'モード2と同じ出題範囲', diagram: false, pair: 2, keys: factorPrimes_(7) },
    { id: 13, name: '360まで(素数〜13)（図なし）', desc: 'モード3と同じ出題範囲', diagram: false, pair: 3, keys: factorPrimes_(13) },
    { id: 6, name: '360まで(素数〜97)（図なし）', desc: 'モード4と同じ出題範囲', diagram: false, pair: 4, keys: factorPrimes_(97) },
    { id: 17, name: '1024まで(素数〜13)（図なし）', desc: 'モード7と同じ出題範囲', diagram: false, pair: 7, keys: factorPrimes_(13) },
    { id: 18, name: '1024まで(素数〜97)（図なし）', desc: 'モード8と同じ出題範囲', diagram: false, pair: 8, keys: factorPrimes_(97) }
  ],
  // 正答回数による段階解放の閾値（画面の番号 2〜6）。教師画面のクラス設定で「段階解放」を入れたクラスだけに効く。
  // 図なしは相方の閾値に従う
  nUnlock: { 2: 20, 3: 40, 4: 80, 7: 160, 8: 320 },
  // 図なしは図形の育ちを3倍にする（倍率の上限。教師画面の全般設定で変えられる）
  growWeights: { 11: 3, 5: 3, 13: 3, 6: 3, 17: 3, 18: 3 },
  types: factorTypes_(),
  digitCap: factorCaps_(),
  // メニューの背景の床は使わない（menuFigure の「正答回数の図」に置き換え）。床の表示・育ちの設定欄は置かない
  defaults: {},
  settings: [],
  floorPattern: 'factor720', floorColor: 'amethyst',
  /** メニューの背景の図形の代わりに、モードの左へ「正答回数の数の図」（素因数で入れ子にした円）を出す。
   *  正答回数＝モードごとの本番の正答 × 育ちの倍率（小数点以下切り捨て）の合計。10000で止める */
  menuFigure: 'factor',
  tips: '図あり・図なしは別モード（5・6・11・13・17・18が図なし。5・6は旧「図なし」の記録を引き継ぐ）で記録します。公開は図ありのモードの設定に従います。初打鍵は最初の素数を選ぶまでの時間で、分解全体の想起時間ではありません。完成時間には素数キーの選択・縦スクロール・複数回の入力が含まれます。型は素因数の個数（重複を含む）です。',
  fmtAnswer: function (type, vals) { return vals.filter(function(v){ return Number(v) > 0; }).join(' × '); },
  gen: function (rand, mode) {
    var pool = factorPool_(mode);
    return factorItem_(pool[Math.floor(rand() * pool.length)], mode);
  },
  // 同じ問題は一巡するまで再出題しない。rand は署名されたシード由来。
  queue: function (rand, mode, count) {
    var out = [], last = 0;
    while (out.length < count) {
      var bag = factorPool_(mode).slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1)), v = bag[i]; bag[i] = bag[j]; bag[j] = v;
      }
      if (bag[0] === last) { var t = bag[0]; bag[0] = bag[1]; bag[1] = t; }
      for (var k = 0; k < bag.length && out.length < count; k++) out.push(factorItem_(bag[k], mode));
      last = bag[bag.length - 1];
    }
    return out;
  }
};
// UNIT の宣言より前に評価されるよう、変数ではなく関数で持つ
function factorModes_() { return [1, 2, 3, 4, 7, 8, 11, 5, 13, 6, 17, 18]; }
/** 図なしのモードを、出題範囲の元になる図ありのモードに写す */
function factorBase_(mode) { return { 11: 1, 5: 2, 13: 3, 6: 4, 17: 7, 18: 8 }[mode] || Number(mode); }
function factorPrimes_(max) {
  var out = [];
  for (var n = 2; n <= max; n++) {
    var ok = true;
    for (var d = 2; d * d <= n; d++) if (n % d === 0) { ok = false; break; }
    if (ok) out.push(n);
  }
  return out;
}
function factorParts_(n) {
  var out = [];
  for (var p = 2; p * p <= n; p++) while (n % p === 0) { out.push(p); n /= p; }
  if (n > 1) out.push(n);
  return out;
}
function factorPool_(mode) {
  var base = factorBase_(mode);
  var max = {1:16, 2:81, 3:360, 4:360, 7:1024, 8:1024}[base], maxP = {3:13, 4:97, 7:13, 8:97}[base] || 0;
  if (!max) throw new Error('不正なモード');
  var out = [], kuku = base === 2;
  for (var n = 4; n <= max; n++) {
    var parts = factorParts_(n);
    if (parts.length < 2) continue;
    if (maxP && parts[parts.length - 1] > maxP) continue;   // 大きな素数を因数に持つ数は出さない
    if (kuku) {
      var inTable = false;
      for (var a = 1; a <= 9; a++) if (n % a === 0 && n / a <= 9) { inTable = true; break; }
      if (!inTable) continue;
    }
    out.push(n);
  }
  return out;
}
function factorItem_(n, mode) {
  var parts = factorParts_(n), f = [], ans = {};
  parts.forEach(function(p, i){ var key = 'p' + i; f.push(key); ans[key] = p; });
  return { t: 'm' + mode + 'p' + Math.min(6, parts.length), q: [String(n)], f: f, ans: ans, tag: String(n) };
}
function factorCaps_() {
  var out = {};
  factorModes_().forEach(function (m) { out[m] = {}; for (var i = 0; i < 10; i++) out[m]['p' + i] = 3; });
  return out;
}

function factorTypes_() {
  var out = {}, names = { 1: '16まで', 2: '九九まで', 3: '360まで(素数〜13)', 4: '360まで(素数〜97)', 7: '1024まで(素数〜13)', 8: '1024まで(素数〜97)' };
  // 実際に出題される型だけを宣言する（出ない型を宣言すると教師画面に「宣言だけ残っている」注意が出る）
  factorModes_().forEach(function (m) { factorPool_(m).forEach(function(n){ var p=Math.min(6,factorParts_(n).length); var b=factorBase_(m); out['m'+m+'p'+p]=names[b]+(b!==m?'（図なし）':'')+'・'+p+(p===6?'個以上':'個')+'の素因数'; }); });
  return out;
}

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['factor'];

// ===== apps/grade2/hiku/Unit.gs =====
/**
 * ひきざん あんざんTA。中身は2けたの筆算で、画面も筆算の形に並べる。
 * 児童には暗算の練習として出す。答えは一の位から打つ（f の順＝打つ順。画面の並びは rows の '_0' '_1'）。
 *
 * 頭の中で位ごとに引くやり方は、くり下がりで「大きい数から小さい数を引く」誤り（52−37=25）を
 * 生みやすいと報告されている（Beishuizen 1993, JRME 24(4)）。誤答明細でこの形が出ていないかを見る。
 */
// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['hiku'] = {
  id: 'hiku',
  grade: 2,                 // 学習指導要領 2年 A(2) 2位数の加法の逆の減法。置き場 apps/grade2/ と一致させる
  title: '暗算(ひき算) タイムアタック！',
  teacherTitle: '暗算(ひき算) 設定・分析',

  /**
   * 教師が調整する設定。最初のメニューの背景に敷く「成長する図形」。このサイトはくり下がりの三角（三角のマスごとに m−j の筆算。くり下がるマスが第二の色）。
   * 本番の正答を「標準の分数」に直して積み、無地 → 輪郭 → 学年の色 → 第二の色 と育つ。表示だけで、出題にも採点にも関わらない。
   */
  defaults: { limit_sec: 60, floor_on: 1, floor_per_answer: 0.75 },
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）',
      min: 0.05, max: 10, step: 0.05 }
  ],
  /** 床の図形と第二の色（台帳は design リポジトリの growing-figures/COLORS.md） */
  floorPattern: 'borrow',
  floorColor: 'garnet',

  // 筆算の形の答えを、右（一の位）から打つか左から打つか、児童がすうじキーせっていで選べる（index.html の COLDIR）
  colDir: true,
  units: {},
  modes: [
    { id: 1, name: '1けたの くりさがり', desc: '16−9' },
    { id: 2, name: 'くりさがり なし', desc: '87−52（筆算の形）',
      needs: { mode: 1, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 3, name: 'くりさがり', desc: '52−37',
      needs: { mode: 2, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 4, name: 'こたえが 1けた・0の ある かず', desc: '52−47 ／ 60−24',
      needs: { mode: 3, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 5, name: 'ぜんぶ いり', desc: '1〜4 を同じ割合で',
      needs: { mode: 4, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true }
  ],
  types: { K: '1けた くりさがり', D: 'くりさがりなし', E: 'くりさがり', F: 'こたえ1けた・0のある数' },

  // 1けたは答えが必ず1けた（1〜9）。2けたは十・一の欄が毎回2つ
  digitCap: { K: { '': 1 }, D: { '一': 1, '十': 1 }, E: { '一': 1, '十': 1 }, F: { '一': 1, '十': 1 } },

  tips: '型Eと型Fの誤答を見てください。52−38 なら、「大きい数から小さい数を引く」は 26、' +
    '「くりさがりを忘れる（十の位を1へらさない）」は 24 になります（正しくは 14）。<br>' +
    '型K（1けた）が遅い児童は、2けたより先に1けたを練習させてください。<br>' +
    '初打鍵までの時間は「一の位を出すまで」の時間です。',

  fmtAnswer: function (type, vals) {
    if (type === 'K') return vals.join('');
    return String(Number(vals[1] || 0) * 10 + Number(vals[0] || 0));
  },

  gen: function (rand, mode) {
    var t = mode === 5 ? pick_(rand, ['K', 'D', 'E', 'F']) : ['', 'K', 'D', 'E', 'F'][mode];
    if (!t) throw new Error('ひきざん: モードが不正です');
    if (t === 'K') {          // 10〜18 − 1けた で、一の位からは引けないもの
      var x = ri_(rand, 0, 8), y = ri_(rand, x + 1, 9);
      return { t: 'K', q: [String(10 + x), '-', String(y)], f: [''], ans: { '': 10 + x - y }, tag: 'K' + (10 + x) + '-' + y };
    }
    var a1, a0, b1, b0;
    if (t === 'D') {          // 一の位はそのまま引ける。十の位は ひく数より大きい（答えは2けた）
      a0 = ri_(rand, 0, 9); b0 = ri_(rand, 0, a0);
      a1 = ri_(rand, 2, 9); b1 = ri_(rand, 1, a1 - 1);
    } else if (t === 'E') {   // くりさがり。ひかれる数の一の位は0でなく、答えは2けた
      a0 = ri_(rand, 1, 8); b0 = ri_(rand, a0 + 1, 9);
      a1 = ri_(rand, 3, 9); b1 = ri_(rand, 1, a1 - 2);
    } else if (rand() < 0.5) { // F：答えが1けた（52−47 ／ 58−52）
      a1 = ri_(rand, 2, 9);
      if (rand() < 0.5) { a0 = ri_(rand, 0, 8); b0 = ri_(rand, a0 + 1, 9); b1 = a1 - 1; }
      else { a0 = ri_(rand, 1, 9); b0 = ri_(rand, 0, a0 - 1); b1 = a1; }
    } else {                  // F：ひかれる数の一の位が0（60−24）。答えは2けた
      a0 = 0; b0 = ri_(rand, 1, 9);
      a1 = ri_(rand, 3, 9); b1 = ri_(rand, 1, a1 - 2);
    }
    var a = a1 * 10 + a0, b = b1 * 10 + b0, d = a - b;
    return {
      t: t, q: [String(a), '-', String(b)],
      rows: [['', String(a1), String(a0)], ['-', String(b1), String(b0)], ['', '_1', '_0']],
      col: true,
      f: ['一', '十'], ans: { '一': d % 10, '十': Math.floor(d / 10) },
      tag: t + a + '-' + b
    };
  }
};

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['hiku'];

// ===== apps/grade3/kakehissan/Unit.gs =====
/**
 * かけ算の筆算(1けた) タイムアタック。3年「1けたをかけるかけ算の筆算」（11時間）。
 * (何十・何百)×(1位数)、(2位数)×(1位数)、(3位数)×(1位数) を筆算の形に並べて出す。
 *
 * 答えは筆算と同じく一の位から打つ（f の順＝打つ順。画面の並びは rows の '_0' '_1' … が決める）。
 * colDir: true なので、児童が「すうじキーせってい」で左から打つ（ふつうの数の順）にも切り替えられる。
 *
 * 欄の数は型で固定する（2けた×1けた は百・十・一の3欄、3けた×1けた と 何百×1けた は千・百・十・一の4欄）。
 * 実際の答えの桁数で欄を減らすと、欄の数が答えの大きさのヒントになる（docs/ADD_UNIT.md 3章）。
 * 上の位が 0 の欄は空けたまま「こたえあわせ」でよい（空欄は 0 とみなす。Core の match_）。
 */
// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['kakehissan'] = {
  id: 'kakehissan',
  grade: 3,                 // 学習指導要領 3年 A(3) 2位数や3位数に1位数をかける乗法。置き場 apps/grade3/ と一致させる
  title: 'かけ算の筆算(1けた) タイムアタック！',
  teacherTitle: 'かけ算の筆算(1けた) 設定・分析',

  defaults: { limit_sec: 60, floor_on: 1, floor_per_answer: 0.75 },
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）',
      min: 0.05, max: 10, step: 0.05 }
  ],
  /** 床の図形と第二の色（台帳は design リポジトリの growing-figures/COLORS.md。3年の他サイトと図形を変える） */
  floorPattern: 'kake1',   // かけ算の渦（1けた・腕1本）。2けたをかけるサイトは kake2（腕2本）で一組
  floorColor: 'amethyst',

  // 筆算の形の答えを、右（一の位）から打つか左から打つか、児童がすうじキーせっていで選べる（index.html の COLDIR）
  colDir: true,
  units: {},
  modes: [
    { id: 1, name: 'なんじゅう・なんびゃく', desc: '20×3 ／ 300×4（第1時。筆算でなく ふつうの式）',
      help: 'うったら こたえあわせ', enterKey: true },
    { id: 2, name: '2けた くりあがり なし', desc: '12×4（第2・3時）',
      needs: { mode: 1, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 3, name: '2けた くりあがり', desc: '24×3 ／ 32×4 ／ 43×6（第4〜6時）',
      needs: { mode: 2, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 4, name: '3けた', desc: '212×3 ／ 387×4 ／ 406×7（第8・9時）',
      needs: { mode: 3, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 5, name: 'ぜんぶ いり', desc: '1〜4 を同じ割合で',
      needs: { mode: 4, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true }
  ],
  types: {
    N: '何十×1けた', M: '何百×1けた',
    A: '2けた くりあがりなし', B: '一の位から くりあがり', C: '百の位へ くりあがり', D: 'くりあがり2回',
    E: '3けた くりあがりなし', F: '3けた くりあがり', G: '3けた 空位（十の位が0）'
  },

  // 欄は各1けた。欄の数は型で決まり、答えの大きさでは変わらない
  digitCap: {
    N: { '': 3 },                     // 何十×1けた はふつうの式。答えは最大 90×9=810 の3けた
    A: { '一': 1, '十': 1, '百': 1 }, B: { '一': 1, '十': 1, '百': 1 },
    C: { '一': 1, '十': 1, '百': 1 }, D: { '一': 1, '十': 1, '百': 1 },
    M: { '': 4 },                     // 何百×1けた。最大 900×9=8100 の4けた
    E: { '一': 1, '十': 1, '百': 1, '千': 1 }, F: { '一': 1, '十': 1, '百': 1, '千': 1 },
    G: { '一': 1, '十': 1, '百': 1, '千': 1 }
  },

  tips: '型B〜D・F・Gの誤答を見てください。24×3 なら、「くりあがりを たし忘れる」は 62、' +
    '「くりあがりの数を先に たしてから かける」（(2+1)×3）は 92 になります（正しくは 72）。<br>' +
    '406×7 で 322 は「空位の0を飛ばして 46×7 と計算した」誤りです（指導書は 282 も誤答例に挙げています）。<br>' +
    '型N・Mが遅い児童は九九の想起から遅い可能性があります。九九TAの記録と合わせて見てください。<br>' +
    '初打鍵までの時間は、右から打つ設定では「一の位を出すまで」、左から打つ設定では「いちばん上の位を出すまで」の時間です（同じ児童でも設定で意味が変わります）。',

  // 誤答明細は欄の順（一/十/百/千）で届く。教師には普通の数で見せる
  fmtAnswer: function (type, vals) {
    if (type === 'N' || type === 'M') return vals.join('');
    var s = 0;
    for (var i = vals.length - 1; i >= 0; i--) s = s * 10 + Number(vals[i] || 0);
    return String(s);
  },

  gen: function (rand, mode) {
    var pools = { 1: ['N', 'M'], 2: ['A'], 3: ['B', 'C', 'D'], 4: ['E', 'F', 'G'] };
    var t;
    if (mode === 5) {
      // モード1〜4を同じ割合で選び、その中で型を選ぶ
      t = pick_(rand, pools[pick_(rand, [1, 2, 3, 4])]);
    } else if (pools[mode]) {
      t = pick_(rand, pools[mode]);
    } else {
      throw new Error('かけ算の筆算: モードが不正です');
    }

    var b = ri_(rand, 2, 9), d;   // d：かけられる数の位（d[0]=一の位）
    if (t === 'N') d = [0, ri_(rand, 1, 9)];
    else if (t === 'M') d = [0, 0, ri_(rand, 1, 9)];
    else {
      // 条件を満たすまで引き直す（どの型も満たす組が多く、数回で当たる）
      for (var guard = 0; guard < 500; guard++) {
        b = ri_(rand, 2, 9);
        if (t === 'A' || t === 'B' || t === 'C' || t === 'D') d = [ri_(rand, 1, 9), ri_(rand, 1, 9)];
        else if (t === 'G') d = [ri_(rand, 1, 9), 0, ri_(rand, 1, 9)];
        else d = [ri_(rand, 1, 9), ri_(rand, 1, 9), ri_(rand, 1, 9)];
        if (kakeKind_(d, b) === t) break;
      }
      if (kakeKind_(d, b) !== t) throw new Error('かけ算の筆算: 型 ' + t + ' の問題が作れません');
    }

    if (t === 'N' || t === 'M') {
      // 第1時は「10や100のいくつ分」で九九に帰着させる。筆算の形にせず、ふつうの式で出す
      var a0 = d[d.length - 1] * Math.pow(10, d.length - 1);
      return { t: t, q: [String(a0), '×', String(b)], f: [''], ans: { '': a0 * b }, tag: t + a0 + 'x' + b };
    }
    var a = 0;
    for (var i = d.length - 1; i >= 0; i--) a = a * 10 + d[i];
    var p = a * b;
    var n = (t === 'N' || t === 'A' || t === 'B' || t === 'C' || t === 'D') ? 3 : 4;   // 答えの欄の数
    var keys = ['一', '十', '百', '千'].slice(0, n), ans = {};
    keys.forEach(function (k, j) { ans[k] = Math.floor(p / Math.pow(10, j)) % 10; });

    // 升目は左から [演算子, (千,) 百, 十, 一]。かけられる数・かける数・答えを位でそろえる
    var row1 = [''], row2 = ['×'], row3 = [''];
    for (var c = n - 1; c >= 0; c--) {
      row1.push(c < d.length ? String(d[c]) : '');
      row2.push(c === 0 ? String(b) : '');
      row3.push('_' + c);
    }
    return {
      t: t, q: [String(a), '×', String(b)],
      rows: [row1, row2, row3],
      col: true,
      f: keys, ans: ans,
      tag: t + a + 'x' + b
    };
  }
};

/** かけられる数の位 d（一の位から）とかける数 b から、型を決める（gen の棄却法と検査で使う） */
function kakeKind_(d, b) {
  var c = 0, carries = [];
  for (var i = 0; i < d.length; i++) {
    var v = d[i] * b + c;
    carries.push(v >= 10);
    c = Math.floor(v / 10);
  }
  var any = carries.some(function (x) { return x; });
  if (d.length === 2) {
    if (!carries[0] && !carries[1]) return 'A';
    if (carries[0] && !carries[1]) return 'B';
    if (!carries[0] && carries[1]) return 'C';
    return 'D';
  }
  if (d[1] === 0) return any ? 'G' : 'E0';   // 空位でくりあがり無しは出さない
  return any ? 'F' : 'E';
}

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['kakehissan'];

// ===== apps/grade3/kuku/Unit.gs =====
/**
 * Unit.gs — 九九・わり算
 *
 * Core.gs が期待する形に合わせるだけ。共通の仕組みには触れない。
 */

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['kuku'] = {
  id: 'kuku',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: '九九表タイムアタック！',
  teacherTitle: '九九トレーニング 設定・分析',

  /** 答えが整数1つなので単位は出ない */
  units: {},

  /** どのモードを児童に見せるかは、教師がクラスごとに指定する（class_config） */
  modes: [
    { id: 1, name: 'かけ算 9×9',  desc: '2×6 のような九九' },
    { id: 2, name: 'かけ算 9×16', desc: '9×14 まで広げる' },
    { id: 3, name: 'わり算 9×9',  desc: '48÷6 のようなわり切れるわり算' },
    { id: 4, name: 'わり算 9×16', desc: '126÷9 まで広げる' }
  ],

  /** 分析の軸。段ごとに見る */
  types: {
    x1: '1の段', x2: '2の段', x3: '3の段', x4: '4の段', x5: '5の段',
    x6: '6の段', x7: '7の段', x8: '8の段', x9: '9の段'
  },

  tips:
    '<b>weak_child</b>：児童ごと・段ごとの平均想起時間(秒)。同じ学年の児童の平均より標準偏差1つ分以上遅いと赤。<br>' +
    '九九は既習なので正答率では差が出ない。差が出るのは想起の速さ。<br><br>' +
    '・同じ段がかけ算・わり算の両方で赤 → 想起そのものが未定着<br>' +
    '・わり算だけ赤 → 逆算への変換が課題<br>' +
    '・全段が均等に赤 → 打鍵速度か閾値設定を疑う（下の桁数差は補正済み）<br>' +
    '・誤答計だけ突出 → 当てずっぽう連打を疑い、log の ms を確認',

  /**
   * 自動確定に使う桁数（欄キーは '' 固定）。
   * モードごとに答えが取りうる最大桁数を宣言する。この問題の答え(ans)は
   * 一切参照しない — 参照すると「早く確定する／しない」が桁数のヒントになる
   * （docs/ARCHITECTURE.md「自動判定と情報漏れ」参照）。
   *
   * 積は1〜144と桁数が問題ごとにバラつくため、以前は答えの桁数をそのまま
   * 見て確定させていた。1桁の答え（1×1〜9×9の28%）は1打で確定し、
   * 2〜3桁の答えは2〜3打かかる。これは「その段の想起が遅い」のではなく
   * 「積が大きい段は入力に打鍵が余計にかかる」だけの差で、
   * 主指標である所要msに段ごとの下駄を履かせていた。
   * 宣言する桁数を「そのモードの最大値」に固定し、全問題を同じ確定タイミング
   * で揃えることでこの下駄を消す。
   *   モード1 かけ算9×9：積は最大81 → 2桁
   *   モード2 かけ算9×16：積は最大144 → 3桁
   *   モード3 わり算9×9：商は割る数と同じ1〜9 → 常に1桁（構造的に均一）
   *   モード4 わり算9×16：商は1〜16 → 2桁
   */
  /**
   * 教師が調整する設定。最初のメニューの背景に敷く「成長する図形」。このサイトは八角の星（8回対称：正方形と45°の菱形）。色1＝正方形、色2＝菱形。
   * 本番の正答を「標準の分数」（そのモードの1分あたり平均正答で割った値）に直して積み、無地 → 輪郭 → 学年の色 → 第二の色 と
   * 画面全体を覆うたびに次の層へ進む。表示だけに効き、出題にも採点にも関わらない。
   */
  defaults: {
    floor_on: 1,
    floor_per_answer: 0.75
  },
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）。0.75 なら、1分20問の速さでおよそ6,000問（約5時間の練習）で全部そろう',
      min: 0.05, max: 10, step: 0.05 }
  ],

  /** 床の第二の色。サイトごとに変える（台帳は design リポジトリの growing-figures/COLORS.md） */
  floorPattern: 'octagon',
  floorColor: 'amethyst',

  digitCap: {
    1: { '': 2 },
    2: { '': 3 },
    3: { '': 1 },
    4: { '': 2 }
  },

  /** 1問作る。答えは整数1つなので欄は1つ、単位ラベルは空 */
  gen: function (rand, mode) {
    var maxB = (mode === 2 || mode === 4) ? 16 : 9;
    var div  = (mode >= 3);
    var a = ri_(rand, 1, 9);
    var b = ri_(rand, 1, maxB);
    if (div) {
      return { t: 'x' + a, q: [String(a * b), '÷', String(a)],
               f: [''], ans: { '': b }, tag: (a * b) + '/' + a };
    }
    return { t: 'x' + a, q: [String(a), '×', String(b)],
             f: [''], ans: { '': a * b }, tag: a + 'x' + b };
  }
};

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['kuku'];

// ===== apps/grade3/length/Unit.gs =====
/**
 * Unit.gs — 長さのたんい（km と m、まきじゃく）
 * 3年「長さ」第1〜3時に対応する。
 */

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['length'] = {
  id: 'length',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: '長さのたんい タイムアタック！',
  teacherTitle: '長さのたんい 設定・分析',

  defaults: {
    // まきじゃくの見た目。表示だけで、出題（span・at の値域）には触らない。
    // 教室のプロジェクタや端末の画面サイズに合わせて担任が調整するための値。
    ruler_width:  100,   // 画面幅に対する横幅(%)
    ruler_tape:   128,   // テープの太さ(px)
    ruler_font:    44,   // 目盛りの数字の大きさ(px)
    ruler_offset:   0,   // 上下位置の調整(px)。+で下がる
    // 最初のメニューの背景に敷く「成長する図形」（九九と同じ仕組み。docs/ARCHITECTURE.md「背景の床」）
    floor_on: 1,
    floor_per_answer: 0.75
  },

  /**
   * 教師画面に出す単元固有の設定欄。Core も teacher.html もキーの意味を知らず、
   * ここでの宣言だけを見て欄を描く（九九の教師画面にこの欄は出ない）。
   * 表示範囲(span)を入れていないのは、span が出題側の at の値域と結合していて、
   * 教師が変えると矢印が窓の外に出るため。変えるなら gen の作り直しが要る。
   */
  settings: [
    { key: 'ruler_width',  label: 'まきじゃくの横幅',
      note: '画面幅に対する%。50〜100', min: 50, max: 100, step: 1 },
    { key: 'ruler_tape',   label: 'テープの太さ',
      note: 'px。60〜200。太いほど目盛りが読みやすい', min: 60, max: 200, step: 4 },
    { key: 'ruler_font',   label: '目盛りの数字の大きさ',
      note: 'px。24〜72', min: 24, max: 72, step: 2 },
    { key: 'ruler_offset', label: '上下の位置',
      note: 'px。+で下、−で上に動く。−60〜120', min: -60, max: 120, step: 4 },
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）。0.75 なら、1分20問の速さでおよそ3,200問で全部そろう',
      min: 0.05, max: 10, step: 0.05 }
  ],

  /**
   * 床の図形と第二の色。このサイトは巻き尺の渦（一定幅の帯が渦を巻き、1目盛りずつ区切る。10目盛りごとに色が替わる）。
   * 台帳は design リポジトリの growing-figures/COLORS.md
   */
  floorPattern: 'tape',
  floorColor: 'amethyst',

  /** 出題に出る単位と、その表示色（空文字は既定のグレー） */
  units: { km: '#F1B1E4', m: '', cm: '#8A6CE5' },

  modes: [
    { id: 1, name: 'かんさん きほん',   desc: '3km=□m ／ 7000m=□km' },
    { id: 2, name: 'かんさん ぜんぶ',   desc: '1200m=□km□m もあり' },
    { id: 3, name: 'けいさん たしざん', desc: '1km700m + 600m' },
    { id: 4, name: 'けいさん ひきざん', desc: '2km100m − 1km700m' },
    { id: 5, name: 'めもり きほん', wide: true,     desc: 'まきじゃく 1mまで' },
    { id: 6, name: 'めもり ぜんぶ', wide: true,     desc: 'まきじゃく 1mより長い',
      help: 'Enter で こたえあわせ' }   // 答えの桁数が 1〜3 と変わり自動確定できない
  ],

  types: {
    C: 'km→m', D: 'm→km', A: 'm→km m', B: 'km m→m',
    E: 'たしざん', F: 'ひきざん', G: 'めもり(1m以内)', H: 'めもり(1m超)'
  },

  /**
   * 自動確定に使う桁数（宣言のみ。この問題の答え(ans)は参照しない）。
   * 問題型ごとに宣言する。モードキーだと「かんさん ぜんぶ」で
   * A の m（km m の下位、3桁）と B・C の m（合計、4桁）が同じ m キーで衝突する。
   * A〜F は以前は未宣言で、実際の答えの桁数で確定していた（＝桁数がヒントとして漏れ、
   * 打鍵数の差が所要msに乗っていた）。値は gen の値域設計から一意に決まる。
   */
  digitCap: {
    C: { m: 4 },            // k*1000（k=1〜9） → 1000〜9000
    D: { km: 1 },           // k（1〜9）
    A: { km: 1, m: 3 },     // km=1〜9、m=100〜900（100の倍数）
    B: { m: 4 },            // k*1000+m（m=50〜900） → 1050〜9900
    E: { km: 1, m: 3 },     // 繰り上がり後も km=1〜9、m部は0を避けた100〜900
    F: { km: 1, m: 3 },     // km=0〜4（0も1桁）、m部は100〜900
    G: { cm: 2 },           // めもり：10〜78cm の範囲内なので常に2桁
    H: { m: 1, cm: 3 }      // めもり：at=101〜260cm なので m は常に1桁。cm欄だけで「187」と答える書き方も認めるため cm は3桁固定
  },

  tips:
    '<b>weak_child</b>：児童ごと・問題型ごとの平均想起時間(秒)＝出題から<b>最初のキーを押すまで</b>。<br>' +
    '打鍵の時間を含まないので、答えの桁数が違う型どうしを並べて比べてよい' +
    '（km→m は4桁、m→km は1桁なので、送信までの時間で比べると桁数の差がそのまま乗る）。<br>' +
    '・km→m と m→km だけ遅い → 1000倍の関係そのものが未定着<br>' +
    '・m→km m が遅い → 位取りで分ける操作につまずいている<br>' +
    '・たしざんよりひきざんが極端に遅い → 繰り下がりが課題<br>' +
    '・平均は基準内なのに<b>ゆらぎ</b>が大きい → 覚えている時と数えている時が混ざっている。' +
    '平均だけを見ていると素通りする層で、必要なのは手続きの練習ではなく想起の練習<br><br>' +
    '<b>weak_class</b> の下段が<b>よくある誤答の一覧</b>。' +
    '1200m を「12km 0m」とする<b>1000倍のずれ</b>や、' +
    '3km50m を「350」とする<b>位取りの崩れ</b>が、実際の答えとして見える。',

  /** めもりは合計で判定する（1m87cm も 187 も正解にする） */
  byTotal: function (item) { return item.t === 'G' || item.t === 'H'; },
  /** 合計判定に使う換算率（cm 換算）。関数ではなく宣言にしてあるのは、
   *  同じ値を児童画面にも渡して、index.html が単位名を決め打ちしないで済むようにするため */
  scale: { m: 100, cm: 1 },

  /** weak_class / mistakes で「1/200」を「1km200m」のように表示するための単位マップ */
  fieldsByType: {
    C: ['m'], D: ['km'], A: ['km', 'm'], B: ['m'],
    E: ['km', 'm'], F: ['km', 'm'], G: ['cm'], H: ['m', 'cm']
  },

  gen: function (rand, mode) {
    var pool;
    if (mode === 1) pool = ['C', 'D'];
    else if (mode === 2) pool = ['A', 'B', 'C', 'D'];
    else if (mode === 3) pool = ['E'];
    else if (mode === 4) pool = ['F'];
    else if (mode === 5) pool = ['G'];
    else pool = ['H'];
    return this.item(rand, pick_(rand, pool));
  },

  item: function (rand, type) {
    var k, m, m2, sum, a, b, res;

    if (type === 'C') {                        // 3km = □m
      k = ri_(rand, 1, 9);
      return { t: 'C', q: [String(k), 'km'], f: ['m'], ans: { m: k * 1000 }, tag: k + 'km' };
    }
    if (type === 'D') {                        // 7000m = □km
      k = ri_(rand, 1, 9);
      return { t: 'D', q: [String(k * 1000), 'm'], f: ['km'], ans: { km: k }, tag: (k * 1000) + 'm' };
    }
    if (type === 'A') {                        // 1200m = □km□m（m部は3桁固定＝桁数が漏れない）
      k = ri_(rand, 1, 9); m = ri_(rand, 1, 9) * 100;
      return { t: 'A', q: [String(k * 1000 + m), 'm'], f: ['km', 'm'],
               ans: { km: k, m: m }, tag: (k * 1000 + m) + 'm' };
    }
    if (type === 'B') {                        // 1km500m = □m（答えは常に4桁）
      k = ri_(rand, 1, 9);
      m = pick_(rand, [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
      return { t: 'B', q: [String(k), 'km', String(m), 'm'], f: ['m'],
               ans: { m: k * 1000 + m }, tag: k + 'km' + m + 'm' };
    }
    if (type === 'E') {                        // 1km700m + 600m = □km□m
      k = ri_(rand, 1, 8); m = ri_(rand, 1, 9) * 100; m2 = ri_(rand, 1, 9) * 100;
      sum = k * 1000 + m + m2;
      if (sum % 1000 === 0) { m2 += 100; sum += 100; }      // m部が0になるのを避ける
      return { t: 'E', q: [String(k), 'km', String(m), 'm', '+', String(m2), 'm'],
               f: ['km', 'm'], ans: { km: Math.floor(sum / 1000), m: sum % 1000 },
               tag: k + 'km' + m + 'm+' + m2 + 'm' };
    }
    if (type === 'G') {                        // まきじゃく 1m以内
      // 窓を 85cm に狭めて1cmあたりの表示幅を稼ぐ（読みやすさを範囲より優先）。
      // 10〜78cm に限るのは、1桁の答えを混ぜると桁数が定まらず自動確定できなくなるため。
      var g = ri_(rand, 10, 78);
      return { t: 'G', ruler: { from: 0, span: 85, at: g },
               q: [], f: ['cm'], ans: { cm: g }, tag: g + 'cm' };
    }
    if (type === 'H') {                        // まきじゃく 1m超
      // 答えを先に決めてから窓を合わせる。窓を先に決めると答えが1m台に偏る。
      // at は 101cm 以上に限る。モード名が「1mより長い」である以上、
      // 1m未満（40〜99cm）が出るのはモードの説明と出題内容が食い違う不具合。
      var span = 90;
      var at = ri_(rand, 101, 260);
      var lo = Math.max(0, at - (span - 10)), hi = Math.max(0, at - 10);
      var from = Math.round(ri_(rand, lo, hi) / 10) * 10;
      if (from > at - 6) from = Math.max(0, from - 10);
      return { t: 'H', ruler: { from: from, span: span, at: at },
               q: [], f: ['m', 'cm'],
               ans: { m: Math.floor(at / 100), cm: at % 100 }, tag: at + 'cm' };
    }

    // F: ひきざん。答えを先に決めてから引く数を作る。
    // 引かれる数を先に決めると、答えの km 部が 0〜1 に偏る。
    // res(答えのm部)は100〜4900、b(引く数)は1100〜4900なので a=res+bは常に1200〜9800。
    // 桁あふれ・繰り上がりは値域の設計自体で構造的に起きない（到達しない補正は置かない）。
    res = ri_(rand, 0, 4) * 1000 + ri_(rand, 1, 9) * 100;
    b = ri_(rand, 1, 4) * 1000 + ri_(rand, 1, 9) * 100;
    a = res + b;

    var qa = (a % 1000 === 0) ? [String(a / 1000), 'km']
           : [String(Math.floor(a / 1000)), 'km', String(a % 1000), 'm'];
    var qb = (b % 1000 === 0) ? [String(b / 1000), 'km']
           : [String(Math.floor(b / 1000)), 'km', String(b % 1000), 'm'];
    return { t: 'F', q: qa.concat(['-'], qb), f: ['km', 'm'],
             ans: { km: Math.floor((a - b) / 1000), m: (a - b) % 1000 },
             tag: a + '-' + b };
  }
};

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['length'];

// ===== apps/grade3/operation-choice/Unit.gs =====
/**
 * 文の手がかりと演算を分けて見られるよう、c/i を半数ずつ混ぜる。
 * 式は演算だけを選ばせ、数の計算は求めない。
 */
var OC_INK = '#FFFFFF';
var OC_SUB = '#C9D1E8';
var OC_LINE = '#8C93AC';
var OC_MARK = ['①', '②', '③', '④'];
var OC_OPS = ['+', '−', '×', '÷'];

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['operation-choice'] = {
  id: 'operation-choice',
  grade: 3,
  title: 'なに算？ タイムアタック！',
  teacherTitle: '演算決定（なに算？） 設定・分析',
  units: {},
  modes: [
    { id: 1, name: 'えらぶ', desc: '文を読んで ＋−×÷ を選ぶ' },
    { id: 2, name: 'しきを えらぶ', desc: '文とテープ図から式を選ぶ', needs: { mode: 1, tries: 3 } },
    { id: 3, name: 'ふたつの しき', desc: '2つの式で解く問題の、1つ目か2つ目の式を選ぶ', needs: { mode: 2, tries: 3 } }
  ],
  types: {
    A: 'たし算',
    B: 'ひき算',
    C: 'かけ算',
    D: 'わり算（等分）',
    E: 'わり算（包含）',
    S: '2つの式'
  },
  digitCap: {
    1: { '': 1 },
    2: { '': 1 },
    3: { '': 1 }
  },
  tips: 'tag の c は「全部で→たし算」「のこり→ひき算」などの言葉の手がかりどおりに解ける文、i は手がかりと逆になる文。i だけで誤る児童は、言葉だけで演算を決めている可能性がある。D（等分）と E（包含）はどちらもわり算。E だけ誤る児童は「いくつ分」を求める場面をかけ算・ひき算と取り違えている。S は2つの式で解く問題で、s1＝はじめの式、s2＝つぎの式。倍の場面（倍ならかける）は「何倍でしょう」TAで扱う。',
  gen: function (rand, mode) {
    if (mode === 1) return ocOp_(rand);
    if (mode === 2) return ocExpr_(rand);
    if (mode === 3) return ocTwo_(rand);
    throw new Error('mode ' + mode);
  }
};

function ocEsc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ocText_(x, y, text, size, anchor, color, useAccent) {
  return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="' + (anchor || 'start') +
    '" dominant-baseline="middle" fill="' + (color || OC_INK) + '"' +
    (useAccent ? ' style="fill:var(--acc)"' : '') + '>' + ocEsc_(text) + '</text>';
}

function ocSvg_(body, height) {
  return '<svg viewBox="0 0 1040 ' + (height + 16) +
    '" xmlns="http://www.w3.org/2000/svg" lang="ja" ' +
    'font-family="system-ui,-apple-system,\'Noto Sans JP\',\'Hiragino Sans\',sans-serif" font-weight="800">' +
    body + '</svg>';
}

function ocPickBox_(x, y, w, h, i, label, size, centeredLabel) {
  return '<g data-pick="' + (i + 1) + '">' +
    '<rect class="pkb" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" rx="6" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>' +
    ocText_(x + 24, y + h / 2, OC_MARK[i], 32, 'start', '#35D0A5', true) +
    ocText_(centeredLabel ? x + w / 2 : x + w / 2 + 24, y + h / 2, label, size, 'middle', OC_INK) +
    '</g>';
}

function ocOperatorChoices_(y) {
  var body = '', x;
  for (var i = 0; i < 4; i++) {
    x = 35 + i * 250;
    body += ocPickBox_(x, y, 220, 96, i, OC_OPS[i], 48, true);
  }
  return body;
}

function ocExprChoices_(choices, y) {
  var body = '', xs = [70, 540], ys = [y, y + 104];
  for (var i = 0; i < 4; i++) {
    body += ocPickBox_(xs[i % 2], ys[Math.floor(i / 2)], 430, 88, i, choices[i], 36, false);
  }
  return body;
}

function ocLines_(lines, size) {
  var body = '', y = 56;
  lines.forEach(function (line) {
    body += ocText_(42, y, line, size);
    y += 48;
  });
  return { body: body, lastY: y - 48 };
}

function ocFormula_(x, y, op) {
  var b = Math.max(x, y), s = Math.min(x, y);
  if (op === '+') return b + '+' + s;
  if (op === '−') return b + '−' + s;
  if (op === '×') return b + '×' + s;
  return b + '÷' + s;
}

function ocValues_(x, y) {
  var b = Math.max(x, y), s = Math.min(x, y);
  return [b + s, b - s, b * s, b / s];
}

function ocValidPair_(x, y, op) {
  if (x === y) return false;
  var answer = OC_OPS.indexOf(op), values = ocValues_(x, y), correct = values[answer];
  for (var i = 0; i < values.length; i++) {
    if (i !== answer && Math.abs(values[i] - correct) < 1e-9) return false;
  }
  return true;
}

function ocTypeOp_(type) {
  return type === 'A' ? '+' : type === 'B' ? '−' : type === 'C' ? '×' : '÷';
}

function ocTemplate_(rand) {
  var type = pick_(rand, ['A', 'B', 'C', 'D']);
  if (type === 'D' && rand() < 0.5) type = 'E';
  return { type: type, n: ri_(rand, 1, 4), op: ocTypeOp_(type) };
}

function ocScene_(rand, type, n) {
  var id = type + n, a, b, m, k, q, d, count, total, scene;
  for (var attempt = 0; attempt < 50; attempt++) {
    scene = { type: type, n: n, id: id, cue: n <= 2 ? 'c' : 'i', op: ocTypeOp_(type) };
    if (type === 'A') {
      if (n === 1) { a = ri_(rand, 12, 48); b = ri_(rand, 11, 39); }
      else if (n === 2) { a = ri_(rand, 12, 38); b = ri_(rand, 5, 19); }
      else if (n === 3) { a = ri_(rand, 12, 40); b = ri_(rand, 5, 19); }
      else { a = ri_(rand, 12, 40); b = ri_(rand, 11, 29); }
      scene.a = a; scene.b = b; scene.x = a; scene.y = b;
      if (n === 1) scene.lines = ['赤い花が ' + a + '本、白い花が ' + b + '本 あります。', '花は 全部で 何本？'];
      if (n === 2) scene.lines = ['子どもが ' + a + '人 います。' + b + '人 来ました。', '子どもは 何人に なりましたか？'];
      if (n === 3) scene.lines = ['赤い紙は ' + a + 'まい です。', '赤い紙は 青い紙より ' + b + 'まい 少ないです。', '青い紙は 何まい？'];
      if (n === 4) scene.lines = ['シールを ' + b + 'まい 使ったので、', 'のこりが ' + a + 'まいに なりました。', 'はじめに 何まい ありましたか？'];
    } else if (type === 'B') {
      if (n === 1) { a = ri_(rand, 35, 80); b = ri_(rand, 11, a - 6); }
      else if (n === 2) { a = ri_(rand, 25, 48); b = ri_(rand, 11, a - 6); }
      else if (n === 3) { a = ri_(rand, 30, 60); b = ri_(rand, 11, a - 6); }
      else { a = ri_(rand, 25, 48); b = ri_(rand, 5, 19); }
      scene.a = a; scene.b = b; scene.x = a; scene.y = b;
      if (n === 1) scene.lines = ['シールが ' + a + 'まい あります。' + b + 'まい 使いました。', 'のこりは 何まい？'];
      if (n === 2) scene.lines = ['赤い花が ' + a + '本、白い花が ' + b + '本 あります。', 'ちがいは 何本？'];
      if (n === 3) scene.lines = ['花が 全部で ' + a + '本 あります。', 'そのうち 赤い花は ' + b + '本です。', '白い花は 何本？'];
      if (n === 4) scene.lines = ['青い紙は ' + a + 'まい です。', '青い紙は 赤い紙より ' + b + 'まい 多いです。', '赤い紙は 何まい？'];
    } else if (type === 'C') {
      m = ri_(rand, 3, 9); k = ri_(rand, 2, m - 1);
      scene.m = m; scene.k = k; scene.x = m; scene.y = k;
      if (n === 1) scene.lines = ['1箱に えんぴつが ' + m + '本ずつ 入っています。', k + '箱では 全部で 何本？'];
      if (n === 2) scene.lines = ['1人に 紙を ' + m + 'まいずつ 配ります。', k + '人に 配ると、何まい いりますか？'];
      if (n === 3) scene.lines = ['えんぴつを 1人に ' + m + '本ずつ 分けたら、', 'ちょうど ' + k + '人に 分けられました。', 'えんぴつは 何本 ありましたか？'];
      if (n === 4) scene.lines = ['あめを ' + k + '人で 同じ数ずつ 分けたら、', '1人分が ' + m + 'こに なりました。', 'あめは 何こ ありましたか？'];
    } else if (type === 'D') {
      q = ri_(rand, 2, 9); d = ri_(rand, 2, 9); total = q * d;
      scene.q = q; scene.d = d; scene.nTotal = total; scene.x = total; scene.y = d;
      if (n === 1) scene.lines = ['えんぴつ ' + total + '本を ' + d + '人に 同じ数ずつ 分けます。', '1人分は 何本？'];
      if (n === 2) scene.lines = ['あめが ' + total + 'こ あります。', d + '人で 同じ数ずつ 分けると、1人 何こ？'];
      if (n === 3) scene.lines = [d + '人に 同じ数ずつ 配ったら、', '全部で ' + total + 'まい いりました。', '1人 何まいずつ 配りましたか？'];
      if (n === 4) scene.lines = ['えんぴつが 全部で ' + total + '本 あります。', d + '箱に 同じ数ずつ 入れると、1箱 何本？'];
    } else {
      m = ri_(rand, 2, 9); q = ri_(rand, 2, 9); total = m * q;
      scene.m = m; scene.q = q; scene.nTotal = total; scene.x = total; scene.y = m;
      if (n === 1) scene.lines = ['えんぴつ ' + total + '本を 1人に ' + m + '本ずつ 分けます。', '何人に 分けられますか？'];
      if (n === 2) scene.lines = ['あめ ' + total + 'こを ' + m + 'こずつ ふくろに 分けます。', 'ふくろは 何まい いりますか？'];
      if (n === 3) scene.lines = ['1箱に ' + m + 'こずつ 入れたら、', '全部で ' + total + 'こ 入りました。', '箱は いくつ ありますか？'];
      if (n === 4) scene.lines = ['1人に ' + m + 'まいずつ 配ったら、', '全部で ' + total + 'まい いりました。', '何人に 配りましたか？'];
    }
    if (ocValidPair_(scene.x, scene.y, scene.op)) return scene;
  }
  throw new Error('50回で数を決められません: ' + id);
}

function ocTapeRect_(x, y, w, h, dash) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" fill="none" stroke="' + OC_LINE + '" stroke-width="3"' +
    (dash ? ' stroke-dasharray="8 6"' : '') + '/>';
}

function ocTapeLine_(x1, y1, x2, y2) {
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
    '" stroke="' + OC_LINE + '" stroke-width="3"/>';
}

function ocBracket_(y0, whole) {
  var y = y0 + 30;
  return ocText_(520, y0 + 14, whole, 28, 'middle') +
    ocTapeLine_(130, y, 910, y) + ocTapeLine_(130, y, 130, y0 + 44) + ocTapeLine_(910, y, 910, y0 + 44);
}

function ocTapeLabel_(x, y, label) {
  return ocText_(x, y, label, 28, 'middle', OC_INK);
}

function ocPw_(y0, whole, parts) {
  var y = y0 + 56, body = ocBracket_(y0, whole) + ocTapeRect_(130, y, 780, 56);
  body += ocTapeLine_(600, y, 600, y + 56);
  body += ocTapeLabel_(365, y + 28, parts[0]) + ocTapeLabel_(755, y + 28, parts[1]);
  return { body: body, bottom: y + 56 };
}

function ocCmp_(y0, top, bottom, diff) {
  var body = ocTapeRect_(130, y0 + 20, 780, 50);
  body += ocTapeLabel_(520, y0 + 45, top);
  body += ocTapeRect_(130, y0 + 96, 470, 50);
  body += ocTapeRect_(600, y0 + 96, 310, 50, true);
  body += ocTapeLabel_(365, y0 + 121, bottom) + ocTapeLabel_(755, y0 + 121, diff);
  return { body: body, bottom: y0 + 146 };
}

function ocEq_(y0, cell, count, whole, divisions) {
  var y = y0 + 56, body = ocBracket_(y0, whole) + ocTapeRect_(130, y, 780, 56);
  var parts = divisions === 'unknown' ? 5 : divisions, width = 780 / parts;
  for (var i = 1; i < parts; i++) body += ocTapeLine_(130 + width * i, y, 130 + width * i, y + 56);
  body += ocTapeLabel_(130 + width / 2, y + 28, cell);
  if (divisions === 'unknown') body += ocText_(130 + width * 3.5, y + 28, '…', 28, 'middle', OC_INK);
  var countY = y0 + 56 + 56 + 30;
  body += ocText_(520, countY, count, 26, 'middle', OC_SUB);
  return { body: body, bottom: countY + 14 };
}

function ocExpressionList_(x, y) {
  var b = Math.max(x, y), s = Math.min(x, y);
  return [b + '+' + s, b + '−' + s, b + '×' + s, b + '÷' + s];
}

function ocDiagram_(scene, y0) {
  var type = scene.type, n = scene.n;
  if (type === 'A' && n === 1) return ocPw_(y0, '？本', ['赤 ' + scene.a + '本', '白 ' + scene.b + '本']);
  if (type === 'A' && n === 2) return ocPw_(y0, '？人', ['はじめ ' + scene.a + '人', '来た ' + scene.b + '人']);
  if (type === 'A' && n === 3) return ocCmp_(y0, '青 ？まい', '赤 ' + scene.a + 'まい', scene.b + 'まい');
  if (type === 'A') return ocPw_(y0, '？まい', ['使った ' + scene.b + 'まい', 'のこり ' + scene.a + 'まい']);
  if (type === 'B' && n === 1) return ocPw_(y0, scene.a + 'まい', ['使った ' + scene.b + 'まい', 'のこり ？まい']);
  if (type === 'B' && n === 2) return ocCmp_(y0, '赤 ' + scene.a + '本', '白 ' + scene.b + '本', '？本');
  if (type === 'B' && n === 3) return ocPw_(y0, scene.a + '本', ['赤 ' + scene.b + '本', '白 ？本']);
  if (type === 'B') return ocCmp_(y0, '青 ' + scene.a + 'まい', '赤 ？まい', scene.b + 'まい');
  if (type === 'C') {
    var cCount = n === 1 ? scene.k + '箱分' : scene.k + '人分';
    return ocEq_(y0, scene.m + (n === 2 ? 'まい' : n === 4 ? 'こ' : '本'),
      cCount,
      '？' + (n === 2 ? 'まい' : n === 4 ? 'こ' : '本'), scene.k);
  }
  if (type === 'D') {
    var dCell = n === 2 ? '？こ' : n === 3 ? '？まい' : '？本';
    var dWhole = scene.nTotal + (n === 2 ? 'こ' : n === 3 ? 'まい' : '本');
    var dCount = scene.d + (n === 4 ? '箱分' : '人分');
    return ocEq_(y0, dCell, dCount, dWhole, scene.d);
  }
  var eCell = scene.m + (n === 2 ? 'こ' : n === 3 ? 'こ' : n === 4 ? 'まい' : '本');
  var eWhole = scene.nTotal + (n === 2 || n === 3 ? 'こ' : n === 4 ? 'まい' : '本');
  var eCount = n === 1 ? '？人分' : n === 2 ? '？ふくろ分' : n === 3 ? '？箱分' : '？人分';
  return ocEq_(y0, eCell, eCount, eWhole, 'unknown');
}

function ocItem_(type, question, answer, tag, body, bottom) {
  return {
    t: type,
    q: [question],
    f: [''],
    ans: { '': answer },
    tag: tag,
    fig: ocSvg_(body, bottom)
  };
}

function ocOp_(rand) {
  var selected = ocTemplate_(rand), scene = ocScene_(rand, selected.type, selected.n);
  var lines = ocLines_(scene.lines, 34), y = lines.lastY + 52;
  return ocItem_(scene.type, 'なに算？', OC_OPS.indexOf(scene.op) + 1, 'op ' + scene.id + scene.cue,
    lines.body + ocOperatorChoices_(y), y + 96);
}

function ocExpr_(rand) {
  var selected = ocTemplate_(rand), scene = ocScene_(rand, selected.type, selected.n);
  var lines = ocLines_(scene.lines, 32), y0 = lines.lastY + 30, diagram = ocDiagram_(scene, y0);
  var choicesY = diagram.bottom + 32, body = lines.body + diagram.body;
  var expressions = ocExpressionList_(scene.x, scene.y);
  return ocItem_(scene.type, 'あう しきは？', OC_OPS.indexOf(scene.op) + 1, 'ex ' + scene.id + scene.cue,
    body + ocExprChoices_(expressions, choicesY), choicesY + 104 + 88);
}

function ocTwoValues_(rand, type) {
  var m, k, r, g, d, q, a, b, n, x1, y1, op1, x2, y2, op2, lines, first;
  for (var attempt = 0; attempt < 50; attempt++) {
    if (type === 'T1' || type === 'T2') {
      m = ri_(rand, 4, 9); k = ri_(rand, 2, m - 1); r = m * k;
      g = type === 'T1' ? ri_(rand, 2, Math.min(9, r - 2)) : ri_(rand, 2, 9);
      x1 = m; y1 = k; op1 = '×'; x2 = r; y2 = g; op2 = type === 'T1' ? '−' : '+';
      lines = type === 'T1'
        ? ['1ふくろに クッキーが ' + m + 'まい 入っています。', k + 'ふくろ 買って、' + g + 'まい 食べました。', 'のこりは 何まい？']
        : ['えんぴつが ' + m + '本ずつ 入った 箱が ' + k + '箱と、', 'ばらの えんぴつが ' + g + '本 あります。', 'えんぴつは 全部で 何本？'];
      first = ocFormula_(m, k, '×');
    } else if (type === 'T3') {
      d = ri_(rand, 2, 9); q = ri_(rand, 2, 9); r = d * q;
      if (r < 6) continue;
      a = ri_(rand, 2, r - 2); b = r - a;
      x1 = a; y1 = b; op1 = '+'; x2 = r; y2 = d; op2 = '÷';
      lines = ['赤い花が ' + a + '本、白い花が ' + b + '本 あります。', '全部の 花を ' + d + '人で 同じ数ずつ 分けると、', '1人 何本？'];
      first = ocFormula_(a, b, '+');
    } else {
      m = ri_(rand, 2, 9); q = ri_(rand, 2, 9); r = m * q;
      g = ri_(rand, 2, 9); n = r + g;
      x1 = n; y1 = g; op1 = '−'; x2 = r; y2 = m; op2 = '÷';
      lines = ['あめが ' + n + 'こ あります。' + g + 'こ 食べて、', 'のこりを ' + m + 'こずつ ふくろに 入れます。', 'ふくろは 何まい いりますか？'];
      first = ocFormula_(n, g, '−');
    }
    if (ocValidPair_(x1, y1, op1) && ocValidPair_(x2, y2, op2)) {
      return { type: type, m: m, k: k, r: r, g: g, d: d, q: q, a: a, b: b, n: n,
        x1: x1, y1: y1, op1: op1, x2: x2, y2: y2, op2: op2, lines: lines, first: first };
    }
  }
  throw new Error('50回で数を決められません: ' + type);
}

function ocTwo_(rand) {
  var type = 'T' + ri_(rand, 1, 4), scene = ocTwoValues_(rand, type);
  var step = rand() < 0.5 ? 1 : 2;
  var x = step === 1 ? scene.x1 : scene.x2;
  var y = step === 1 ? scene.y1 : scene.y2;
  var op = step === 1 ? scene.op1 : scene.op2;
  var lines = ocLines_(scene.lines, 32), body = lines.body;
  var lastY = lines.lastY;
  if (step === 2) {
    body += ocText_(42, lastY + 48, 'はじめの しき　' + scene.first + '＝' + scene.r, 32, 'start', OC_SUB);
    lastY += 48;
  }
  var choicesY = lastY + 40, expressions = ocExpressionList_(x, y);
  return ocItem_('S', step === 1 ? 'はじめの しきは？' : 'つぎの しきは？',
    OC_OPS.indexOf(op) + 1, 'S ' + type + ' s' + step,
    body + ocExprChoices_(expressions, choicesY), choicesY + 104 + 88);
}

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['operation-choice'];

// ===== apps/grade2/tasu/Unit.gs =====
/**
 * たしざん あんざんTA。中身は2けたの筆算で、画面も筆算の形に並べる。
 * 児童には暗算の練習として出す。「頭の中で筆算をすればよい」という意図で、
 * 答えは一の位から打つ（f の順＝打つ順。画面の並びは rows の '_0' '_1' '_2' が決める）。
 * 一の位を先に打てば画面に残るので、頭に持つのはくり上がりの1と十の位だけで済む。
 */
// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['tasu'] = {
  id: 'tasu',
  grade: 2,                 // 学習指導要領 2年 A(2) 2位数の加法。置き場 apps/grade2/ と一致させる
  title: '暗算(たし算) タイムアタック！',
  teacherTitle: '暗算(たし算) 設定・分析',

  /**
   * 教師が調整する設定。最初のメニューの背景に敷く「成長する図形」。このサイトはくり上がりの六角（六角のマスごとに k＋(n−k) の筆算。くり上がるマスが第二の色）。
   * 本番の正答を「標準の分数」に直して積み、無地 → 輪郭 → 学年の色 → 第二の色 と育つ。表示だけで、出題にも採点にも関わらない。
   */
  defaults: { limit_sec: 60, floor_on: 1, floor_per_answer: 0.75 },
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）',
      min: 0.05, max: 10, step: 0.05 }
  ],
  /** 床の図形と第二の色（台帳は design リポジトリの growing-figures/COLORS.md） */
  floorPattern: 'carry',
  floorColor: 'topaz',

  // 筆算の形の答えを、右（一の位）から打つか左から打つか、児童がすうじキーせっていで選べる（index.html の COLDIR）
  colDir: true,
  units: {},
  modes: [
    { id: 1, name: '1けたの くりあがり', desc: '9+7' },
    { id: 2, name: 'くりあがり なし', desc: '34+52（筆算の形）',
      needs: { mode: 1, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 3, name: 'くりあがり', desc: '47+38',
      needs: { mode: 2, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 4, name: '百を こえる', desc: '67+58 ／ 75+30',
      needs: { mode: 3, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 5, name: 'ぜんぶ いり', desc: '1〜4 を同じ割合で',
      needs: { mode: 4, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true }
  ],
  types: { K: '1けた くりあがり', A: 'くりあがりなし', B: 'くりあがり', C: '百をこえる' },

  // 1けたは答えが必ず2けた（10〜18）。2けたは百・十・一の欄が毎回3つあり、各1けた。
  // 欄の数が型の中で変わらないので、確定の早さから答えの大きさは漏れない
  digitCap: { K: { '': 2 }, A: { '一': 1, '十': 1, '百': 1 }, B: { '一': 1, '十': 1, '百': 1 }, C: { '一': 1, '十': 1, '百': 1 } },

  tips: '型Bと型Cの誤答を見てください。「くりあがりを忘れる」（47+38=75）は十の位が1小さく、' +
    '「一の位に2けたを書く」は打てない形なので、十の位の欄の誤りとして出ます。<br>' +
    '型K（1けた）が遅い児童は、2けたの遅さの多くがそこから来ている可能性があります。2けたより先に1けたを練習させてください。<br>' +
    '初打鍵までの時間は「一の位を出すまで」の時間です。',

  // 誤答明細は欄の順（一/十/百）で届く。教師には普通の数で見せる
  fmtAnswer: function (type, vals) {
    if (type === 'K') return vals.join('');
    return String(Number(vals[2] || 0) * 100 + Number(vals[1] || 0) * 10 + Number(vals[0] || 0));
  },

  gen: function (rand, mode) {
    var t = mode === 5 ? pick_(rand, ['K', 'A', 'B', 'C']) : ['', 'K', 'A', 'B', 'C'][mode];
    if (!t) throw new Error('たしざん: モードが不正です');
    if (t === 'K') {
      var x = ri_(rand, 1, 9), y = ri_(rand, 10 - x, 9);
      return { t: 'K', q: [String(x), '+', String(y)], f: [''], ans: { '': x + y }, tag: 'K' + x + '+' + y };
    }
    var a1, a0, b1, b0;
    if (t === 'A') {          // 一の位も十の位も10未満。一の位の0（30+45）も出す
      a0 = ri_(rand, 0, 9); b0 = ri_(rand, 0, 9 - a0);
      a1 = ri_(rand, 1, 8); b1 = ri_(rand, 1, 9 - a1);
    } else if (t === 'B') {   // 一の位でくり上がり、和は99まで
      a0 = ri_(rand, 1, 9); b0 = ri_(rand, 10 - a0, 9);
      a1 = ri_(rand, 1, 7); b1 = ri_(rand, 1, 8 - a1);
    } else if (rand() < 0.5) { // C：十の位だけでくり上がる（75+30）
      a0 = ri_(rand, 0, 9); b0 = ri_(rand, 0, 9 - a0);
      a1 = ri_(rand, 1, 9); b1 = ri_(rand, Math.max(1, 10 - a1), 9);
    } else {                  // C：一の位と十の位の両方でくり上がる（67+58）
      a0 = ri_(rand, 1, 9); b0 = ri_(rand, 10 - a0, 9);
      a1 = ri_(rand, 1, 9); b1 = ri_(rand, Math.max(1, 9 - a1), 9);
    }
    var a = a1 * 10 + a0, b = b1 * 10 + b0, s = a + b;
    return {
      t: t, q: [String(a), '+', String(b)],
      // 左から [演算子, 百, 十, 一]。答えの段は百・十・一の順に見せ、一の位から打つ
      rows: [['', '', String(a1), String(a0)], ['+', '', String(b1), String(b0)], ['', '_2', '_1', '_0']],
      col: true,
      f: ['一', '十', '百'], ans: { '一': s % 10, '十': Math.floor(s / 10) % 10, '百': Math.floor(s / 100) },
      tag: t + a + '+' + b
    };
  }
};

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['tasu'];

// ===== apps/grade5/volume/Unit.gs =====
/**
 * Unit.gs — 体積（5年）
 *
 * モードは前提スキルの依存順。型の混在（ランダム出題）は最後の「ぜんぶ」だけ。
 *
 *   ① つみき      積んだ 1cm³ の立方体の数（図を見て数える）
 *   ② こうしき    直方体・立方体の体積／体積から辺の長さを逆に出す
 *   ③ たんい      m³・cm³・L・mL の関係（4択）
 *   ④ ふくごう    L字・凹字の立体（分けて足す／大きく取って引く）
 *   ⑤ ようせき    板の厚さを引いて内のりから容積（cm³／L）
 *   ⑥ ぜんぶ      ①〜⑤を混ぜる
 *
 * 数値はすべて整数（小数×小数は体積の単元の後で習うため）。
 *
 * 誤答から読める誤概念（mistakes シートの「もんだい」＝tag と「こたえた値」で読む）
 *   M1 見える立方体だけを数える（Battista & Clements 1996）
 *      → A の答えが tag の「みえる」の数と一致する
 *   M2 m³⇄cm³ を長さ・面積の倍率で換える（1m³=100cm³ / 10000cm³）
 *      → ③の4択。誤りの選択肢は誤概念ごとに1つ。並びは tag に残す
 *   M3 体積を縦×横で止める（面積との混同）
 *      → B・C の答えが tag の2辺の積と一致する
 *   M4 複合図形で重なりを2回足す／高さを取り違える → F・G の tag の寸法と照合
 *   M5 容積に外のりを使う → H・I の答えが外のりの積と一致する
 *
 * 答えの桁数は型ごとに固定する（docs/ADD_UNIT.md 3章）。
 *   A 2桁 / B・F・G・H 3桁（cm³） / C 2桁（cm） / 4択 1桁 / I 1桁（L）
 */

var VO_MARK = ['①', '②', '③', '④'];
var VO_LINE = '#8C93AC';    // 立体の辺
var VO_INK = '#FFFFFF';     // 強調する線
var VO_LABEL = '#C9D1E8';   // 長さの字
var VO_DIM = '#D4D454';     // 引き出し線（5年の進みの色）。へこみの内側の辺と長さの字をつなぐ
// 正面・上面・側面。重ね描きで奥の面を隠すので、半透明にせず背景 #101728 と混ぜた不透明色にする
var VO_FACE = ['#282E3E', '#454A57', '#1A2031'];

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['volume'] = {
  id: 'volume',
  grade: 5,
  title: '体積 タイムアタック！',
  teacherTitle: '体積 設定・分析',

  units: { 'cm³': '', cm: '', 'こ': '', L: '' },

  modes: [
    { id: 1, name: 'つみき', desc: '1cm³の立方体は何こ？（見えない所も）' },
    { id: 2, name: 'こうしき', desc: '直方体・立方体の体積／体積から辺', needs: { mode: 1, tries: 3 } },
    { id: 3, name: 'たんい', desc: '1m³=□cm³ などを4つからえらぶ', needs: { mode: 2, tries: 3 } },
    { id: 4, name: 'ふくごう', desc: 'L字・へこんだ形の体積', needs: { mode: 3, tries: 3 } },
    { id: 5, name: 'ようせき', desc: '板の厚さをひいて入れ物の容積', needs: { mode: 4, tries: 3 } },
    { id: 6, name: 'ぜんぶ', desc: '①〜⑤をまぜて出す', needs: { mode: 5, tries: 3 } }
  ],

  types: {
    A: 'つみき',
    B: '直方体', C: '立方体', D: '体積→辺',
    E: 'm³→cm³', J: 'L⇄cm³', K: 'mL→cm³', N: 'm³→L',
    F: 'L字', G: 'へこみ',
    H: '容積 cm³', I: '容積 L'
  },

  digitCap: {
    A: { 'こ': 2 },
    B: { 'cm³': 3 }, C: { 'cm³': 3 }, D: { cm: 2 },
    E: { '': 1 }, J: { '': 1 }, K: { '': 1 }, N: { '': 1 },
    F: { 'cm³': 3 }, G: { 'cm³': 3 },
    H: { 'cm³': 3 }, I: { L: 1 }
  },

  tips: 'つみき（A）で答えが tag の「みえる」の数なら、見えている立方体だけを数えている。' +
        '直方体・立方体（B・C）で答えが2辺の積なら、高さをかけ忘れている（面積との混同）。' +
        'たんい（E・J・K・N）は tag に選択肢の並びが残る。「こたえた値」が3なら③を選んだ、と読む。' +
        '1m³=100cm³ や 10000cm³ を選ぶのは、長さや面積の倍率で換えている。' +
        '容積（H・I）で答えが外のりの積に近いなら、板の厚さを引いていない。',

  gen: function (rand, mode) {
    switch (mode) {
      case 1: return voBlocks_(rand);
      case 2: var k = rand(); return k < 0.45 ? voCuboid_(rand) : k < 0.7 ? voCube_(rand) : voInverse_(rand);
      case 3: return voUnit_(rand);
      case 4: return rand() < 0.5 ? voLshape_(rand) : voNotch_(rand);
      case 5: return rand() < 0.6 ? voCapacity_(rand) : voLiter_(rand);
      case 6: return UNIT_DEFS['volume'].gen(rand, ri_(rand, 1, 5));   // 全単元をまとめた時も自分の gen を呼ぶ
    }
    throw new Error('mode ' + mode);
  }
};

/* ============================================================
 *  図の部品（SVG 文字列）
 *  立体は斜投影：奥行き z を右上へ 0.5 倍・30°で倒す
 * ============================================================ */

function voR_(x) { return Math.round(x); }

/** rand で並べ替える（Math.random を使うとサーバーの再採点と食い違う） */
function voShuffle_(rand, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** 図の座標系。s＝1cm あたりの画素、(ox, oy)＝原点（左下手前）の画面位置 */
function voView_(w, h, d, maxPx, topPad) {
  var kx = 0.5 * Math.cos(Math.PI / 6), ky = 0.5 * Math.sin(Math.PI / 6);
  var s = Math.min(maxPx / (w + d * kx), maxPx * 0.8 / (h + d * ky));
  var pad = 120;
  // topPad：図の上に足す余白。画面の左上（右手用は右上）に「せいかい」の数が重なるので、
  // 図の上の外に字を出す図（へこみ）はその高さぶん下げる
  var W = (w + d * kx) * s + pad * 2, H = (h + d * ky) * s + pad * 2 + (topPad || 0);
  return {
    s: s, kx: kx, ky: ky, W: W, H: H,
    p: function (x, y, z) { return [pad + (x + z * kx) * s, H - pad - (y + z * ky) * s]; }
  };
}

function voSvg_(w, h, body) {
  return '<svg viewBox="0 0 ' + voR_(w) + ' ' + voR_(h) + '" xmlns="http://www.w3.org/2000/svg" ' +
         'font-family="sans-serif" font-weight="800">' + body + '</svg>';
}
function voPts_(pts) { return pts.map(function (p) { return voR_(p[0]) + ',' + voR_(p[1]); }).join(' '); }
function voPoly_(pts, fill, stroke, width) {
  return '<polygon points="' + voPts_(pts) + '" fill="' + fill + '" stroke="' + (stroke || VO_LINE) +
         '" stroke-width="' + (width || 4) + '" stroke-linejoin="round"/>';
}
function voText_(x, y, s, size, cls) {
  return '<text' + (cls ? ' class="' + cls + '"' : '') + ' x="' + voR_(x) + '" y="' + voR_(y) + '" font-size="' + (size || 30) +
         '" fill="' + VO_LABEL + '" text-anchor="middle" dominant-baseline="middle">' + s + '</text>';
}

/**
 * 正面の多角形 poly（[x,y] の列、反時計回り）を奥行き d だけ押し出した立体。
 * 上か右を向く面だけを描き、最後に正面を重ねる。
 * 上向きの面と右向きの面は画面上で重ならない。上向きどうしは高いほうが手前、右向きどうしは右のほうが手前。
 */
function voPrism_(v, poly, d) {
  var faces = [], n = poly.length;
  for (var i = 0; i < n; i++) {
    var a = poly[i], b = poly[(i + 1) % n];
    var nx = b[1] - a[1], ny = a[0] - b[0];   // 反時計回りの外向き法線
    if (nx <= 0 && ny <= 0) continue;
    // 手前ほど x・y が大きい。面の中心の (x·kx + y·ky) が小さい（奥の）面から描く
    faces.push({ up: ny > 0, at: ((a[0] + b[0]) / 2) * v.kx + ((a[1] + b[1]) / 2) * v.ky,
                 pts: [v.p(a[0], a[1], 0), v.p(b[0], b[1], 0), v.p(b[0], b[1], d), v.p(a[0], a[1], d)] });
  }
  // へこんだ形では、へこみの底や壁が手前の柱の奥に隠れる。奥の面から描いて上書きさせる
  faces.sort(function (p, q) { return p.at - q.at; });
  var body = faces.map(function (f) { return voPoly_(f.pts, f.up ? VO_FACE[1] : VO_FACE[2]); }).join('');
  return body + voPoly_(poly.map(function (q) { return v.p(q[0], q[1], 0); }), VO_FACE[0]);
}

/**
 * 長さの字だけを、辺 p→q の中点から図の外向き o（画面の単位ベクトル）へ dist 離して書く。
 * 外周の辺は字の位置だけで対応が分かるので、線は引かない（線を足すと図の辺と混ざる）。
 */
function voDim_(p, q, o, dist, str) {
  // 横へ出す字は字の幅ぶん、斜め（奥行き）はその中間だけ離す
  var k = Math.abs(o[0]) > 0.7 ? 34 : o[0] !== 0 ? 26 : 12;
  return voText_((p[0] + q[0]) / 2 + o[0] * (dist + k), (p[1] + q[1]) / 2 + o[1] * (dist + k), str, 30);
}

function voCurve_(a, c, b) {
  return '<path d="M' + voR_(a[0]) + ' ' + voR_(a[1]) + ' Q' + voR_(c[0]) + ' ' + voR_(c[1]) + ' ' +
         voR_(b[0]) + ' ' + voR_(b[1]) + '" fill="none" stroke="' + VO_DIM +
         '" stroke-width="4" stroke-linecap="round"/>';
}

/**
 * へこみの深さ（縦の内側の辺 p→q）。中点から左上へ斜めに引き出し、図の上の外（y＝topY）に字を書く。
 * 縦に引き出すと、引き出し線そのものが長さ（辺）に見える。
 */
function voLeadUp_(p, q, topY, str) {
  var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  var end = [m[0] - Math.max(60, (m[1] - topY) * 0.45), topY];
  return voCurve_(m, [end[0] + 12, m[1] - (m[1] - topY) * 0.25], end) + voText_(end[0], end[1] - 24, str, 30);
}

/** へこみの幅（横の内側の辺 p→q）。例外として図の中、辺のすぐ下に短い引き出し線つきで書く */
function voLeadDown_(p, q, str) {
  var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], end = [m[0] + 16, m[1] + 34];
  return voCurve_(m, [m[0], m[1] + 28], end) + voText_(end[0] + 42, end[1], str, 30);
}

/** 奥行きの辺（右下）に対する外向き：辺の向き (cos30°, -sin30°) に垂直で下向き */
var VO_OUT_D = [0.5, 0.866];

/** 直方体 w×h×d の図と、たて（奥行き）・よこ・高さの3辺の長さ。labels は {w,h,d} の表示文字（空なら書かない） */
function voBoxFig_(w, h, d, labels, extra) {
  var v = voView_(w, h, d, 380);
  var body = voPrism_(v, [[0, 0], [w, 0], [w, h], [0, h]], d);
  if (labels.w) body += voDim_(v.p(0, 0, 0), v.p(w, 0, 0), [0, 1], 16, labels.w);
  if (labels.h) body += voDim_(v.p(0, 0, 0), v.p(0, h, 0), [-1, 0], 16, labels.h);
  if (labels.d) body += voDim_(v.p(w, 0, 0), v.p(w, 0, d), VO_OUT_D, 16, labels.d);
  return voSvg_(v.W, v.H, body + (extra ? extra(v) : ''));
}

/* ============================================================
 *  ① つみき
 * ============================================================ */

/** a×b×c に積んだ立方体の、見えている数（手前・上・右の3面） */
function voVisible_(a, b, c) { return a * b * c - (a - 1) * (b - 1) * (c - 1); }

function voBlocks_(rand) {
  var a, b, c;
  do { a = ri_(rand, 2, 5); b = ri_(rand, 2, 4); c = ri_(rand, 2, 4); } while (a * b * c < 10 || a * b * c > 99);
  var v = voView_(a, c, b, 360), body = voPrism_(v, [[0, 0], [a, 0], [a, c], [0, c]], b), grid = '';
  function ln(p, q) { grid += 'M' + voR_(p[0]) + ' ' + voR_(p[1]) + 'L' + voR_(q[0]) + ' ' + voR_(q[1]); }
  var i;
  for (i = 1; i < a; i++) { ln(v.p(i, 0, 0), v.p(i, c, 0)); ln(v.p(i, c, 0), v.p(i, c, b)); }
  for (i = 1; i < c; i++) { ln(v.p(0, i, 0), v.p(a, i, 0)); ln(v.p(a, i, 0), v.p(a, i, b)); }
  for (i = 1; i < b; i++) { ln(v.p(0, c, i), v.p(a, c, i)); ln(v.p(a, 0, i), v.p(a, c, i)); }
  body += '<path d="' + grid + '" stroke="' + VO_LINE + '" stroke-width="3" fill="none"/>';
  return {
    t: 'A', q: ['1cm³の つみきは', 'なんこ？'], f: ['こ'], ans: { 'こ': a * b * c },
    tag: 'A:' + a + 'x' + b + 'x' + c + ' みえる' + voVisible_(a, b, c),
    fig: voSvg_(v.W, v.H, body)
  };
}

/* ============================================================
 *  ② こうしき
 * ============================================================ */

function voCuboid_(rand) {
  var w, h, d;
  do { w = ri_(rand, 3, 12); h = ri_(rand, 2, 10); d = ri_(rand, 2, 9); }
  while (w * h * d < 100 || w * h * d > 999 || w === h || h === d || w === d);
  return {
    t: 'B', q: ['たいせきは'], f: ['cm³'], ans: { 'cm³': w * h * d },
    tag: 'B:よこ' + w + ' たて' + d + ' たかさ' + h,
    fig: voBoxFig_(w, h, d, { w: w + 'cm', h: h + 'cm', d: d + 'cm' })
  };
}

function voCube_(rand) {
  var e = ri_(rand, 5, 9);
  return {
    t: 'C', q: ['りっぽうたいの', 'たいせきは'], f: ['cm³'], ans: { 'cm³': e * e * e },
    tag: 'C:1ぺん' + e,
    fig: voBoxFig_(e, e, e, { w: e + 'cm' })
  };
}

/** 体積と2辺から残りの1辺。答えは 10〜30cm の2桁 */
function voInverse_(rand) {
  var x = ri_(rand, 10, 30), a = ri_(rand, 2, 9), b = ri_(rand, 2, 9), which = ri_(rand, 0, 2);
  // よこ・たて・たかさ の順。which の位置が求める辺
  var dims = which === 0 ? [x, a, b] : which === 1 ? [a, x, b] : [a, b, x];
  var V = a * b * x, lab = { w: dims[0] + 'cm', d: dims[1] + 'cm', h: dims[2] + 'cm' };
  var key = ['w', 'd', 'h'][which];
  lab[key] = '？';
  return {
    t: 'D', q: ['たいせき ' + V + 'cm³', '？は'], f: ['cm'], ans: { cm: x },
    tag: 'D:' + V + ' ' + a + 'x' + b,
    fig: voBoxFig_(dims[0], dims[2], dims[1], lab)
  };
}

/* ============================================================
 *  ③ たんい（4択）
 *  誤りの選択肢は誤概念ごとに1つ。並びは tag に残す
 * ============================================================ */

function voUnit_(rand) {
  var n = ri_(rand, 2, 9), k = ri_(rand, 0, 6), t, ask, right, wrong;
  switch (k) {
    case 0: t = 'E'; ask = ['1m³は', 'なんcm³？']; right = 1000000; wrong = [100, 10000, 1000]; break;
    case 1: t = 'E'; ask = [n + 'm³は', 'なんcm³？']; right = n * 1000000; wrong = [n * 100, n * 10000, n * 1000]; break;
    case 2: t = 'J'; ask = ['1Lは', 'なんcm³？']; right = 1000; wrong = [10, 100, 10000]; break;
    case 3: t = 'J'; ask = [n * 1000 + 'cm³は', 'なんL？']; right = n; wrong = [n * 10, n * 100, n * 1000]; break;
    case 4: t = 'K'; ask = ['1mLは', 'なんcm³？']; right = 1; wrong = [10, 100, 1000]; break;
    case 5: t = 'K'; ask = [n * 100 + 'mLは', 'なんcm³？']; right = n * 100; wrong = [n, n * 10, n * 1000]; break;
    default: t = 'N'; ask = ['1m³は', 'なんL？']; right = 1000; wrong = [10, 100, 1000000]; break;
  }
  var order = voShuffle_(rand, [right].concat(wrong));
  // 2×2 に並べる。横1列だと図が横長になり、数字が小さく縮む
  var W = 360, H = 140, body = '';
  order.forEach(function (val, i) {
    var x = (i % 2) * W, y = Math.floor(i / 2) * H;
    body += '<g data-pick="' + (i + 1) + '">' +
            '<rect class="pkb" x="' + (x + 20) + '" y="' + (y + 20) + '" width="' + (W - 40) + '" height="' + (H - 40) +
            '" rx="6" fill="#000" fill-opacity="0" stroke="' + VO_LINE + '" stroke-width="3"/>' +
            voText_(x + 64, y + H / 2, VO_MARK[i], 40) +
            voText_(x + W / 2 + 24, y + H / 2, String(val), 48, 'pkv') + '</g>';
  });
  return {
    t: t, q: ask, f: [''], ans: { '': order.indexOf(right) + 1 },
    tag: t + ':' + ask[0] + ' ' + order.join('-'),
    fig: voSvg_(W * 2, H * 2, body)
  };
}

/* ============================================================
 *  ④ ふくごう
 * ============================================================ */

/** L字：左が高い。分けて足す／大きく取って引く、の2通りで出せる */
function voLshape_(rand) {
  var W, H, w2, h1, d, V;
  do {
    W = ri_(rand, 6, 12); H = ri_(rand, 5, 10); w2 = ri_(rand, 2, W - 3); h1 = ri_(rand, 2, H - 3); d = ri_(rand, 2, 6);
    V = d * (w2 * H + (W - w2) * h1);
  } while (V < 100 || V > 999);
  var poly = [[0, 0], [W, 0], [W, h1], [w2, h1], [w2, H], [0, H]];
  var v = voView_(W, H, d, 380), body = voPrism_(v, poly, d);
  var top = d * v.ky * v.s;   // 上面が正面より上へはみ出す高さ
  body += voDim_(v.p(0, 0, 0), v.p(W, 0, 0), [0, 1], 16, W + 'cm') +
          voDim_(v.p(0, 0, 0), v.p(0, H, 0), [-1, 0], 16, H + 'cm') +
          voDim_(v.p(0, H, 0), v.p(w2, H, 0), [0, -1], top + 16, w2 + 'cm') +
          voDim_(v.p(W, 0, d), v.p(W, h1, d), [1, 0], 16, h1 + 'cm') +
          voDim_(v.p(W, 0, 0), v.p(W, 0, d), VO_OUT_D, 16, d + 'cm');
  return {
    t: 'F', q: ['たいせきは'], f: ['cm³'], ans: { 'cm³': V },
    tag: 'F:よこ' + W + ' たかさ' + H + ' うえ' + w2 + ' だん' + h1 + ' おく' + d,
    fig: voSvg_(v.W, v.H, body)
  };
}

/** 凹字：上のまん中をへこませた形。大きく取って引くのが近道 */
function voNotch_(rand) {
  var W, H, n, m, x0, d, V;
  do {
    W = ri_(rand, 7, 12); H = ri_(rand, 4, 9); n = ri_(rand, 2, W - 4); m = ri_(rand, 2, H - 2);
    x0 = ri_(rand, 2, W - n - 2); d = ri_(rand, 2, 6);
    V = d * (W * H - n * m);
  } while (V < 100 || V > 999);
  var poly = [[0, 0], [W, 0], [W, H], [x0 + n, H], [x0 + n, H - m], [x0, H - m], [x0, H], [0, H]];
  var v = voView_(W, H, d, 380, 90), body = voPrism_(v, poly, d);
  // へこみの幅と深さは図の内側の辺なので、引き出し線（学年の色）で示す。
  // 深さは左の壁の中点から左上へ斜めに図の外へ、幅は底の辺のすぐ下（図の中）へ
  var topY = v.p(0, H, d)[1] - 16;
  body += voDim_(v.p(0, 0, 0), v.p(W, 0, 0), [0, 1], 16, W + 'cm') +
          voDim_(v.p(0, 0, 0), v.p(0, H, 0), [-1, 0], 16, H + 'cm') +
          voLeadDown_(v.p(x0, H - m, 0), v.p(x0 + n, H - m, 0), n + 'cm') +
          voLeadUp_(v.p(x0, H - m, 0), v.p(x0, H, 0), topY, m + 'cm') +
          voDim_(v.p(W, 0, 0), v.p(W, 0, d), VO_OUT_D, 16, d + 'cm');
  return {
    t: 'G', q: ['たいせきは'], f: ['cm³'], ans: { 'cm³': V },
    tag: 'G:よこ' + W + ' たかさ' + H + ' へこみ' + n + 'x' + m + ' おく' + d,
    fig: voSvg_(v.W, v.H, body)
  };
}

/* ============================================================
 *  ⑤ ようせき（厚さ1cmの板で作った、ふたの無い入れ物）
 * ============================================================ */

/** 外のり w×h×d の箱。上の口に内のりの縁を描き、「あつさ1cm」と書く */
function voTubFig_(w, h, d) {
  return voBoxFig_(w, h, d, { w: w + 'cm', h: h + 'cm', d: d + 'cm' }, function (v) {
    var rim = [v.p(1, h, 1), v.p(w - 1, h, 1), v.p(w - 1, h, d - 1), v.p(1, h, d - 1)];
    return voPoly_(rim, 'rgba(0,0,0,.35)', VO_INK, 3) +
           voText_(v.W / 2, 28, 'いたの あつさ 1cm', 28);
  });
}

function voCapacity_(rand) {
  var a, b, c;   // 内のり（よこ・たて・深さ）
  do { a = ri_(rand, 4, 12); b = ri_(rand, 3, 10); c = ri_(rand, 3, 10); } while (a * b * c < 100 || a * b * c > 999);
  var w = a + 2, d = b + 2, h = c + 1;
  return {
    t: 'H', q: ['ようせきは'], f: ['cm³'], ans: { 'cm³': a * b * c },
    tag: 'H:そと' + w + 'x' + d + 'x' + h + ' そとのせき' + w * d * h,
    fig: voTubFig_(w, h, d)
  };
}

/** 内のりの積が 1000 の倍数（1〜9L）になる組 */
var VO_LITER_ = (function () {
  var s = [5, 10, 15, 20, 25, 30, 40], out = [];
  s.forEach(function (a) { s.forEach(function (b) { s.forEach(function (c) {
    var p = a * b * c;
    if (p % 1000 === 0 && p / 1000 >= 1 && p / 1000 <= 9) out.push([a, b, c]);
  }); }); });
  return out;
})();

function voLiter_(rand) {
  var t = pick_(rand, VO_LITER_), a = t[0], b = t[1], c = t[2];
  var w = a + 2, d = b + 2, h = c + 1;
  return {
    t: 'I', q: ['ようせきは', 'なんL？'], f: ['L'], ans: { L: a * b * c / 1000 },
    tag: 'I:そと' + w + 'x' + d + 'x' + h,
    fig: voTubFig_(w, h, d)
  };
}

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['volume'];

// ===== apps/grade3/weight/Unit.gs =====
/**
 * Unit.gs — おもさ（g・kg の換算、たし算・ひき算）
 * 3年「重さ」に対応する。
 */

// 単元の登録。1つの GAS に全単元をまとめても名前がぶつからないよう、UNIT_DEFS['<id>'] に置く。
// 下の行（ファイルの最後）で、単元が1つだけのプロジェクトでは UNIT にもなる（今までの設置と同じに動く）。
var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['weight'] = {
  id: 'weight',
  grade: 3,                 // 学年（1〜6）。置き場 apps/grade3/ と一致させる（tests/contract が照合する）
  title: 'おもさ タイムアタック！',
  teacherTitle: 'おもさ 設定・分析',

  defaults: {
    dial_size: 64,      // はかりの文字盤・拡大窓の大きさの上限（画面の高さに対する%）
    // 最初のメニューの背景に敷く「成長する図形」（九九と同じ仕組み。docs/ARCHITECTURE.md「背景の床」）
    floor_on: 1,
    floor_per_answer: 0.75
  },

  /** 表示だけの設定。出題（dial の max / step / at）には触れない */
  settings: [
    { key: 'dial_size', label: 'はかりの大きさ',
      note: '画面の高さに対する%の上限。20〜70。既定では画面の空き高さのほうが先に効くので、'
          + '小さくしたいときだけ下げる。既存の設定が44のままだと図が縮むので64に上げる',
      min: 20, max: 70, step: 2 },
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）。0.75 なら、1分20問の速さでおよそ6,600問で全部そろう',
      min: 0.05, max: 10, step: 0.05 }
  ],

  /**
   * 床の図形と第二の色。このサイトは円弧の曼荼羅（正方形のマスに四分円の弧、4回対称）。
   * 台帳は design リポジトリの growing-figures/COLORS.md
   */
  floorPattern: 'mandala',
  floorColor: 'amethyst',

  /** 出題に出る単位と、その表示色（空文字は既定のグレー） */
  units: { kg: '#F1B1E4', g: '' },

  modes: [
    { id: 1, name: 'かんさん きほん',   desc: '3kg=□g ／ 5000g=□kg' },
    { id: 2, name: 'かんさん ぜんぶ',   desc: '1200g=□kg□g もあり' },
    { id: 3, name: 'けいさん たしざん', desc: '1kg300g + 500g' },
    { id: 4, name: 'けいさん ひきざん', desc: '2kg100g − 1kg700g' },
    { id: 5, name: 'めもり きほん', wide: true,     desc: '1kgのはかり（1目もり5g）' },
    { id: 6, name: 'めもり ぜんぶ', wide: true,     desc: '2kgのはかり（1目もり10g）' }
  ],

  types: {
    C: 'kg→g', D: 'g→kg', A: 'g→kg g', B: 'kg g→g',
    E: 'たしざん', F: 'ひきざん',
    G: 'めもり 1kg', H: 'めもり 2kg'
  },

  /**
   * 自動確定に使う桁数（宣言のみ。この問題の答え(ans)は参照しない）。
   * 問題型ごとに宣言する。モードキーにすると「かんさん ぜんぶ」で
   * A の g（kg g の下位、3桁）と B・C の g（合計、4桁）が同じ g キーで衝突し、
   * どちらかが必ず壊れる。型キーならこの衝突は起きない。
   * 値は gen の値域設計から一意に決まる（下の item を参照）。
   */
  digitCap: {
    C: { g: 4 },            // k*1000（k=1〜9） → 1000〜9000 で常に4桁
    D: { kg: 1 },           // k（1〜9） → 常に1桁
    A: { kg: 1, g: 3 },     // kg=1〜9、g=100〜900（100の倍数）
    B: { g: 4 },            // k*1000+m（m=100〜900） → 1100〜9900 で常に4桁
    E: { kg: 1, g: 3 },     // 繰り上がり後も kg=1〜9、g部は0を避けた100〜900
    F: { kg: 1, g: 3 },     // kg=0〜4（0も1桁）、g部は100〜900
    G: { g: 3 },            // 1kgのはかり：100〜980g に限るので常に3桁
    H: { kg: 1, g: 3 }      // 2kgのはかり：kg=1、g部は110〜990
  },

  tips:
    '<b>weak_child</b>：児童ごと・問題型ごとの平均想起時間(秒)＝出題から<b>最初のキーを押すまで</b>。<br>' +
    '打鍵の時間を含まないので、答えの桁数が違う型どうしを並べて比べてよい' +
    '（kg→g は4桁、g→kg は1桁なので、送信までの時間で比べると桁数の差がそのまま乗る）。<br>' +
    '・kg→g と g→kg だけ遅い → 1000倍の関係そのものが未定着<br>' +
    '・g→kg g が遅い → 位取りで分ける操作につまずいている<br>' +
    '・たしざんよりひきざんが極端に遅い → 繰り下がりが課題<br>' +
    '・平均は基準内なのに<b>ゆらぎ</b>が大きい → 覚えている時と数えている時が混ざっている。' +
    '平均だけを見ていると素通りする層で、必要なのは手続きの練習ではなく想起の練習<br><br>' +
    '<b>weak_class</b> の下段が<b>よくある誤答の一覧</b>。' +
    '1200g を「12kg 0g」とする<b>1000倍のずれ</b>や、' +
    '3kg50g を「350」とする<b>位取りの崩れ</b>が、実際の答えとして見える。',

  /** めもりは合計で判定する（1kg500g も 1500 も正解にする） */
  byTotal: function (item) { return item.t === 'G' || item.t === 'H'; },
  /** 合計判定に使う換算率（g 換算）。児童画面にもそのまま渡る */
  scale: { kg: 1000, g: 1 },

  /** weak_class / mistakes で「1/200」を「1kg200g」のように単位つきで表示するための単位マップ */
  fieldsByType: {
    C: ['g'], D: ['kg'], A: ['kg', 'g'], B: ['g'],
    E: ['kg', 'g'], F: ['kg', 'g'],
    G: ['g'], H: ['kg', 'g']
  },

  gen: function (rand, mode) {
    var pool;
    if (mode === 1) pool = ['C', 'D'];
    else if (mode === 2) pool = ['A', 'B', 'C', 'D'];
    else if (mode === 3) pool = ['E'];
    else if (mode === 4) pool = ['F'];
    else if (mode === 5) pool = ['G'];
    else pool = ['H'];
    return this.item(rand, pick_(rand, pool));
  },

  item: function (rand, type) {
    var k, m, m2, sum, a, b, res;

    if (type === 'C') {                        // 3kg = □g
      k = ri_(rand, 1, 9);
      return { t: 'C', q: [String(k), 'kg'], f: ['g'], ans: { g: k * 1000 }, tag: k + 'kg' };
    }
    if (type === 'D') {                        // 5000g = □kg
      k = ri_(rand, 1, 9);
      return { t: 'D', q: [String(k * 1000), 'g'], f: ['kg'], ans: { kg: k }, tag: (k * 1000) + 'g' };
    }
    if (type === 'A') {                        // 1200g = □kg□g（g部は3桁固定＝桁数が漏れない）
      k = ri_(rand, 1, 9); m = ri_(rand, 1, 9) * 100;
      return { t: 'A', q: [String(k * 1000 + m), 'g'], f: ['kg', 'g'],
               ans: { kg: k, g: m }, tag: (k * 1000 + m) + 'g' };
    }
    if (type === 'B') {                        // 1kg500g = □g（答えは常に4桁）
      k = ri_(rand, 1, 9);
      m = pick_(rand, [100, 200, 300, 400, 500, 600, 700, 800, 900]);
      return { t: 'B', q: [String(k), 'kg', String(m), 'g'], f: ['g'],
               ans: { g: k * 1000 + m }, tag: k + 'kg' + m + 'g' };
    }
    if (type === 'G') {                        // 1kgのはかり。1目もり5g、100gごとに数字
      // 100〜980g に限るのは、1〜2桁の答えを混ぜると桁数が定まらず自動確定できないため。
      // 教科書のはかりに合わせて、1目もりは5g（0gと100gの間に20目もり）。
      var g1 = ri_(rand, 20, 196) * 5;
      return { t: 'G',
               dial: { max: 1000, step: 5, label: 100, at: g1,
                       unit: 'g', big: 1000, bigUnit: 'kg' },
               q: [], f: ['g'], ans: { g: g1 }, tag: g1 + 'g' };
    }
    if (type === 'H') {                        // 2kgのはかり。1目もり10g、200gごとに数字
      // 1kgを超えた位置だけを出し「何kg何g」で答えさせる。kg欄は常に1になるが、
      // 2kgのはかりで1kg超を読めば必ずそうなる（教科書の問題も 1kg200g / 1kg500g）。
      // 答えの桁数を揃えるため g部は110〜990に限る。
      var g2 = ri_(rand, 11, 99) * 10;
      return { t: 'H',
               dial: { max: 2000, step: 10, label: 200, at: 1000 + g2,
                       unit: 'g', big: 1000, bigUnit: 'kg' },
               q: [], f: ['kg', 'g'], ans: { kg: 1, g: g2 }, tag: (1000 + g2) + 'g' };
    }
    if (type === 'E') {                        // 1kg300g + 500g = □kg□g
      k = ri_(rand, 1, 8); m = ri_(rand, 1, 9) * 100; m2 = ri_(rand, 1, 9) * 100;
      sum = k * 1000 + m + m2;
      if (sum % 1000 === 0) { m2 += 100; sum += 100; }      // g部が0になるのを避ける
      return { t: 'E', q: [String(k), 'kg', String(m), 'g', '+', String(m2), 'g'],
               f: ['kg', 'g'], ans: { kg: Math.floor(sum / 1000), g: sum % 1000 },
               tag: k + 'kg' + m + 'g+' + m2 + 'g' };
    }

    // F: ひきざん。答えを先に決めてから引く数を作る。
    // 引かれる数を先に決めると、答えの kg 部が 0〜1 に偏る。
    // res(答えのg部)は100〜4900、b(引く数)は1100〜4900なので a=res+bは常に1200〜9800。
    // 桁あふれ・繰り上がりは値域の設計自体で構造的に起きない（到達しない補正は置かない）。
    res = ri_(rand, 0, 4) * 1000 + ri_(rand, 1, 9) * 100;
    b = ri_(rand, 1, 4) * 1000 + ri_(rand, 1, 9) * 100;
    a = res + b;

    var qa = (a % 1000 === 0) ? [String(a / 1000), 'kg']
           : [String(Math.floor(a / 1000)), 'kg', String(a % 1000), 'g'];
    var qb = (b % 1000 === 0) ? [String(b / 1000), 'kg']
           : [String(Math.floor(b / 1000)), 'kg', String(b % 1000), 'g'];
    return { t: 'F', q: qa.concat(['-'], qb), f: ['kg', 'g'],
             ans: { kg: Math.floor((a - b) / 1000), g: (a - b) % 1000 },
             tag: a + '-' + b };
  }
};

// 単元が1つだけのプロジェクト・テスト・プレビューでは、この単元が UNIT になる。
// 全単元をまとめたプロジェクトでは、呼び出しごとに Core が UNIT を差し替える。
var UNIT = UNIT || UNIT_DEFS['weight'];
