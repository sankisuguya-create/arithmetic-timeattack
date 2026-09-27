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

var UNIT = {
  id: 'volume',
  grade: 5,
  title: '体積 タイムアタック！',
  teacherTitle: '体積 設定・分析',

  defaults: { slow_ms: 8000 },   // 図を読み、3数をかける時間が乗る

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
        'たんい（E・J・K・N）は tag に選択肢の並びが残る。「こたえた値」が3なら3番目を選んだ、と読む。' +
        '1m³=100cm³ や 10000cm³ を選ぶのは、長さや面積の倍率で換えている。' +
        '容積（H・I）で答えが外のりの積に近いなら、板の厚さを引いていない。',

  gen: function (rand, mode) {
    switch (mode) {
      case 1: return voBlocks_(rand);
      case 2: var k = rand(); return k < 0.45 ? voCuboid_(rand) : k < 0.7 ? voCube_(rand) : voInverse_(rand);
      case 3: return voUnit_(rand);
      case 4: return rand() < 0.5 ? voLshape_(rand) : voNotch_(rand);
      case 5: return rand() < 0.6 ? voCapacity_(rand) : voLiter_(rand);
      case 6: return UNIT.gen(rand, ri_(rand, 1, 5));
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
function voText_(x, y, s, size) {
  return '<text x="' + voR_(x) + '" y="' + voR_(y) + '" font-size="' + (size || 30) +
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
  var W = 330, H = 130, body = '';
  order.forEach(function (val, i) {
    var x = (i % 2) * W, y = Math.floor(i / 2) * H;
    body += '<rect x="' + (x + 8) + '" y="' + (y + 8) + '" width="' + (W - 16) + '" height="' + (H - 16) + '" rx="16" ' +
            'fill="' + VO_FACE[0] + '" stroke="' + VO_LINE + '" stroke-width="3"/>' +
            voText_(x + 44, y + H / 2, VO_MARK[i], 40) + voText_(x + W / 2 + 24, y + H / 2, String(val), 48);
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
