/**
 * Unit.gs — 円と球（3年）
 *
 * モードは前提スキルの依存順に並べ、土台に近いものを先に置く。
 * 型の混在（ランダム出題）は最後の「ぜんぶ」だけ。
 *
 *   ① ちゅうしん・はんけい  中心はどれ／半径はどれ（番号で答える）
 *   ② ちょっけい            直径はどれ（番号で答える）
 *   ③ はんけい⇄ちょっけい   半径→直径／直径→半径（同じモードに両向きを混ぜる）
 *   ④ きゅう                いちばん大きい切り口はどれ／球の半径⇄直径
 *   ⑤ ならんだ まる          箱に並んだボールの長さ（1列・たてよこ・逆算）
 *   ⑥ ぜんぶ                ①〜⑤を混ぜる
 *
 * 図の向きは①から毎問ランダムに回す。向きを固定して練習すると
 * 「半径は右向きの1本」「直径は横の端から端」という典型図への固着を
 * 練習がかえって強める（推定）。「ランダムは最後」は型の混在のことで、図の向きのことではない。
 *
 * 番号で答える問いの誤答の選択肢は、誤概念ごとに1つずつ置く。
 * 並びは毎問入れ替わるので、打った番号だけでは何を選んだか分からない。
 * tag に並び（例 'B:chord,rad,short,off'）を入れておき、mistakes シートの
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
var CI_LINE = '#8C93AC';    // 円の輪郭（背景の図）
var CI_INK = '#FFFFFF';     // 選ぶ対象の線・点
var CI_LABEL = '#C9D1E8';   // 番号と長さ

var UNIT = {
  id: 'circle',
  title: '円と球 タイムアタック！',
  teacherTitle: '円と球 設定・分析',

  defaults: { slow_ms: 6000 },   // 図を読む時間が乗るので、式だけの単元より長め

  units: { cm: '' },

  modes: [
    { id: 1, name: 'ちゅうしん・はんけい', desc: '中心はどれ？／半径はどれ？（番号）' },
    { id: 2, name: 'ちょっけい', desc: '直径はどれ？（番号）', needs: { mode: 1, tries: 3 } },
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

  tips: '番号の問い（中心・半径・直径・切り口）の誤りは mistakes シートで読む。' +
        '「もんだい」の欄が選択肢の並び（例 B:chord,rad,short,off）で、' +
        '「こたえた値」が3なら3番目の short（円周まで届かない線）を選んだ、と読む。' +
        'ならび（I・J）で答えが正答のちょうど半分なら、ボール1こ分を半径で数えている可能性がある。',

  gen: function (rand, mode) {
    switch (mode) {
      case 1: return rand() < 0.5 ? ciCenter_(rand) : ciRadius_(rand);
      case 2: return ciDiameter_(rand);
      case 3: return ciConvert_(rand);
      case 4: return rand() < 0.4 ? ciCut_(rand) : ciSphere_(rand);
      case 5: return ciRow_(rand);
      case 6: return UNIT.gen(rand, ri_(rand, 1, 5));
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
function ciCircle_(cx, cy, r, stroke, width) {
  return '<circle cx="' + ciR_(cx) + '" cy="' + ciR_(cy) + '" r="' + ciR_(r) +
         '" fill="none" stroke="' + (stroke || CI_LINE) + '" stroke-width="' + (width || 4) + '"/>';
}
function ciDot_(p) {
  return '<circle cx="' + ciR_(p[0]) + '" cy="' + ciR_(p[1]) + '" r="6" fill="' + CI_INK + '"/>';
}
function ciSeg_(p, q, dash) {
  return '<line x1="' + ciR_(p[0]) + '" y1="' + ciR_(p[1]) + '" x2="' + ciR_(q[0]) + '" y2="' + ciR_(q[1]) +
         '" stroke="' + CI_INK + '" stroke-width="6" stroke-linecap="round"' +
         (dash ? ' stroke-dasharray="10 8"' : '') + '/>';
}
function ciText_(x, y, s, size) {
  return '<text x="' + ciR_(x) + '" y="' + ciR_(y) + '" font-size="' + (size || 30) +
         '" fill="' + CI_LABEL + '" text-anchor="middle" dominant-baseline="middle">' + s + '</text>';
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
 * 番号で答える問い。4つの小さな図を横に並べ、左上に①〜④を置く。
 * draw(kind, cx, cy, r) が1枚分の図を返す。
 */
function ciChoice_(rand, t, ask, kinds, right, draw) {
  var order = ciShuffle_(rand, kinds);
  var W = 200, H = 220, r = 78, body = '';
  order.forEach(function (k, i) {
    var cx = i * W + W / 2, cy = H / 2 + 12;
    body += ciText_(i * W + 22, 24, CI_MARK[i], 32) + draw(k, cx, cy, r);
  });
  return {
    t: t, q: ask, f: [''], ans: { '': order.indexOf(right) + 1 },
    tag: t + ':' + order.join(','),
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
      return ciCircle_(cx, cy, r) + ciDot_(ciAt_(cx, cy, r * off[k], ciAngle_(rand)));
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
      return ciCircle_(cx, cy, r) + s + ciDot_(c);
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
      return ciCircle_(cx, cy, r) + s + ciDot_(c);
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
function ciBall_(cx, cy, r, h) {
  var rx = r * Math.sqrt(1 - h * h), ry = Math.max(4, rx * 0.28), y = cy - h * r;
  return ciCircle_(cx, cy, r) +
         '<ellipse cx="' + ciR_(cx) + '" cy="' + ciR_(y) + '" rx="' + ciR_(rx) + '" ry="' + ciR_(ry) +
         '" fill="rgba(255,255,255,.18)" stroke="' + CI_INK + '" stroke-width="5"/>';
}

function ciCut_(rand) {
  var h = { mid: 0, up: 0.5, top: 0.8, down: -0.6 };
  return ciChoice_(rand, 'F', ['いちばん大きい', 'きり口は？'], ['mid', 'up', 'top', 'down'], 'mid',
    function (k, cx, cy, r) { return ciBall_(cx, cy, r, h[k]); });
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
  var u = 120, pad = 70;
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
    body += ciSeg_([x0, y0 - 18], [x0 + bw, y0 - 18], true) + ciText_(x0 + bw / 2, y0 - 44, boxLen + 'cm', 36);
  }
  if (ask === 'w') {
    body += ciSeg_([x0, y0 + bh + 18], [x0 + bw, y0 + bh + 18], true) + ciText_(x0 + bw / 2, y0 + bh + 46, '？', 38);
  } else if (ask === 'h') {
    body += ciSeg_([x0 + bw + 18, y0], [x0 + bw + 18, y0 + bh], true) + ciText_(x0 + bw + 48, y0 + bh / 2, '？', 38);
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
