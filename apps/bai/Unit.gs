/**
 * Unit.gs — 何倍でしょう（3年：倍の第1〜第3用法、a×b×c）
 *
 * モードは前提スキルの依存順。型の混在は最後の「ぜんぶ」だけ。
 *
 *   ① もとにする大きさ  「赤は 青の 4倍」→ もとにする大きさは どちら？（番号）
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

var UNIT = {
  id: 'bai',
  title: '何倍でしょう タイムアタック！',
  teacherTitle: '何倍でしょう 設定・分析',

  // 文を読む時間が乗るので長め。値に根拠は無い（実測して調整する）
  defaults: { slow_ms: 8000 },

  units: { cm: '', '倍': '' },

  modes: [
    { id: 1, name: 'もとにする大きさ', desc: '赤は 青の 4倍 → もとにする大きさは？（番号）' },
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
      case 6: return UNIT.gen(rand, ri_(rand, 1, 5));
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
function baText1_(x, y, s, size, fill, anchor) {
  return '<text x="' + baR_(x) + '" y="' + baR_(y) + '" font-size="' + (size || 44) +
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
    var x = 40;
    choices.forEach(function (c, i) {
      body += baText1_(x, y, BA_MARK[i] + ' ' + c, 48, BA_SUB);
      x += 300;
    });
    y += 60;
  }
  return baSvg_(W, y, body);
}

/**
 * テープ図。上＝もとにする量（1つ分）、下＝くらべる量（k つ分に区切る）。
 * 数の欄は vals（'ア' '？' や数）で受け、図は数の大きさに比例させない
 * （比例させると長さの比から答えが読めてしまう）。倍は下のテープの右に書く。
 */
function baTape_(s, vals, y0) {
  var x0 = 170, full = 620, one = full / s.k, h = 50, body = '';
  var yS = y0, yB = y0 + 90;
  body += baText1_(40, yS + h / 2, s.small, 40, BA_SUB) + baText1_(40, yB + h / 2, s.big, 40, BA_SUB);
  body += baRect_(x0, yS, one, h, 'rgba(255,255,255,.12)');
  body += baRect_(x0, yB, full, h, 'rgba(255,255,255,.12)');
  for (var i = 1; i < s.k; i++) body += baLine_(x0 + one * i, yB, x0 + one * i, yB + h, BA_LINE, 3);
  body += baText1_(x0 + one + 16, yS + h / 2, vals.m + 'cm', 40);
  body += baText1_(x0 + full + 16, yB + h / 2, vals.c + 'cm', 40);
  body += baText1_(x0 + full / 2, yB + h + 40, '（' + vals.k + '倍）', 40, BA_INK, 'middle');
  return { svg: body, y: yB + h + 80 };
}

/** 関係図。[もとにする量] —×倍→ [くらべる量]。矢印の向きは常に もと→くらべる */
function baRel_(s, vals, y0) {
  var bw = 240, bh = 80, xL = 60, xR = 660, y = y0, body = '';
  body += baRect_(xL, y, bw, bh) + baRect_(xR, y, bw, bh);
  body += baText1_(xL + bw / 2, y + bh / 2, vals.m + 'cm', 44, BA_INK, 'middle');
  body += baText1_(xR + bw / 2, y + bh / 2, vals.c + 'cm', 44, BA_INK, 'middle');
  body += baText1_(xL + bw / 2, y + bh + 34, s.small, 36, BA_SUB, 'middle');
  body += baText1_(xR + bw / 2, y + bh + 34, s.big, 36, BA_SUB, 'middle');
  var ay = y + bh / 2;
  body += baLine_(xL + bw + 10, ay, xR - 20, ay, BA_INK, 5) +
          '<path d="M' + (xR - 10) + ' ' + ay + ' L' + (xR - 34) + ' ' + (ay - 14) + ' L' + (xR - 34) + ' ' + (ay + 14) + ' Z" fill="' + BA_INK + '"/>';
  body += baText1_((xL + bw + xR) / 2, ay - 36, '×' + vals.k, 44, BA_INK, 'middle');
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
