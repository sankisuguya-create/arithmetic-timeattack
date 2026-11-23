/**
 * Unit.gs — 分数（3年：単位分数のいくつ分、1と分数、数直線、大小、同分母の加減）
 *
 *   ① いくつ分        1/5 が 3こで □/□ ／ 4/7 は 1/7 が □こ
 *   ② 1は いくつ分    1/9 が □こで 1 ／ 7/7 = □ ／ 1 = □/6
 *   ③ 数直線          0〜1 の数直線で、やじるしの分数（図）
 *   ④ どっちが大きい  7/9 □ 3/9 に >・=・< をタップ（同分母／単位分数／分数と1）
 *   ⑤ たし算          同分母、和は1未満
 *   ⑥ ひき算          同分母、1−□/□ をふくむ
 *
 * 【分数の答えは分母→分子の順に打つ】分母も打たせるのは、分母どうしも足す誤り
 * （2/5+1/5=3/10。M1）を誤答の記録に残すため。分子だけを打たせるとこの誤りは測れない。
 * 分母は2〜9で、答えはどの欄も1桁にそろう（digitCap はすべて1）。
 * M1 の 2/5+1/5 では分母に「10」を打とうとして最初の「1」で確定する。
 * したがって**正しい分母が5以上なのに分母の欄が1**なら、M1 の可能性が高い。
 *
 * 【④は単位分数の比較を半分の重さで混ぜる】分母が大きいほど大きいとみる誤り（1/8>1/3。M2）
 * は同分母の比較だけでは出ない。
 *
 * 【⑤の和は1未満】和が1の答え（6/8+2/8）は「1」と「8/8」の両方が正しいが、
 * 採点は欄ごとの一致なので片方しか受けられない。1と分数の関係は②で測る。
 */

var BU_INK = '#FFFFFF';
var BU_SUB = '#C9D1E8';
var BU_LINE = '#8C93AC';

var UNIT_DEFS = UNIT_DEFS || {};
UNIT_DEFS['bunsu'] = {
  id: 'bunsu',
  grade: 3,
  title: '分数 タイムアタック！',
  teacherTitle: '分数 設定・分析',

  units: { 'こ': '' },

  modes: [
    { id: 1, name: 'いくつ分', desc: '1/5 が 3こで □/□ ／ 4/7 は 1/7 が □こ' },
    { id: 2, name: '1は いくつ分', desc: '1/9 が □こで 1 ／ 7/7 = □ ／ 1 = □/6' },
    { id: 3, name: '数直線', desc: '0〜1 の数直線の やじるしの 分数' },
    { id: 4, name: 'どっちが 大きい', desc: '7/9 □ 3/9 に >・=・< をタップ' },
    { id: 5, name: 'たし算', desc: '2/5 + 1/5（和は1より小さい）' },
    { id: 6, name: 'ひき算', desc: '5/7 − 2/7 ／ 1 − 1/6' }
  ],

  types: {
    A: 'いくつ分→分数', B: '分数→いくつ分',
    C: '1は単位分数が何こ', D: '○/○ は いくつ', E: '1 = □/○',
    F: '数直線',
    G: '大小 同分母', H: '大小 単位分数', I: '大小 分数と1',
    J: 'たし算',
    K: 'ひき算', L: '1 − 分数'
  },

  digitCap: {
    A: { '分母': 1, '分子': 1 }, B: { 'こ': 1 },
    C: { 'こ': 1 }, D: { '': 1 }, E: { '分子': 1 },
    F: { '分母': 1, '分子': 1 },
    G: { '': 1 }, H: { '': 1 }, I: { '': 1 },
    J: { '分母': 1, '分子': 1 },
    K: { '分母': 1, '分子': 1 }, L: { '分母': 1, '分子': 1 }
  },

  /** 誤答の表示。分母→分子の順に打つので、読める形「分子/分母」に直す */
  fmtAnswer: function (type, vals) {
    if (vals.length === 2) return vals[1] + '/' + vals[0];
    if (type === 'G' || type === 'H' || type === 'I') return ['', '>', '=', '<'][+vals[0]] || String(vals[0]);
    return String(vals[0]);
  },

  tips: '分数の答えは分母→分子の順に打つ。たし算・ひき算（J・K）で、正しい分母が5以上なのに' +
        '分母を「1」と打った誤答は、分母どうしも足して10以上にした（2/5+1/5=3/10）可能性が高い。<br>' +
        '単位分数の大小（H）だけで誤る児童は、分母が大きいほど大きいとみている可能性がある。<br>' +
        '1と分数（C・D・E・L）で誤る児童は、分数を「1をつくる数」として見られていない可能性がある。',

  gen: function (rand, mode) {
    var d, a, b, k, r;
    if (mode === 1) {
      d = ri_(rand, 3, 9);
      if (rand() < 0.5) {
        a = ri_(rand, 2, d - 1);
        return { t: 'A', q: ['1/' + d, 'が', String(a), 'こで'],
          rows: [['1/' + d, 'が', String(a), 'こで', '_1/_0']],
          f: ['分母', '分子'], ans: { '分母': d, '分子': a }, tag: 'A' + a + '/' + d };
      }
      a = ri_(rand, 2, d - 1);
      return { t: 'B', q: [a + '/' + d, 'は', '1/' + d, 'が'],
        rows: [[a + '/' + d, 'は', '1/' + d, 'が', '_', 'こ']],
        f: ['こ'], ans: { 'こ': a }, tag: 'B' + a + '/' + d };
    }
    if (mode === 2) {
      d = ri_(rand, 2, 9);
      r = ri_(rand, 0, 2);
      if (r === 0) return { t: 'C', q: ['1/' + d, 'が', '□こで', '1'],
        rows: [['1/' + d, 'が', '_', 'こで', '1']],
        f: ['こ'], ans: { 'こ': d }, tag: 'C' + d };
      if (r === 1) return { t: 'D', q: [d + '/' + d],
        f: [''], ans: { '': 1 }, tag: 'D' + d };
      return { t: 'E', q: ['1', '=', '□/' + d],
        rows: [['1', '=', '_0/' + d]],
        f: ['分子'], ans: { '分子': d }, tag: 'E' + d };
    }
    if (mode === 3) {
      d = ri_(rand, 2, 9);
      k = ri_(rand, 1, d - 1);
      return { t: 'F', q: ['やじるしの 分数は'],
        rows: [['やじるしの 分数は', '_1/_0']],
        f: ['分母', '分子'], ans: { '分母': d, '分子': k }, tag: 'F' + k + '/' + d,
        fig: buLine_(d, k) };
    }
    if (mode === 4) {
      r = rand();
      var L, R, t;
      if (r < 0.5) {
        d = ri_(rand, 3, 9); a = ri_(rand, 1, d);
        do { b = ri_(rand, 1, d); } while (b === a && rand() < 0.7);   // 等しい組も時々出す（4/4 と 4/4 は出ない程度に）
        L = [a, d]; R = [b, d]; t = 'G';
      } else if (r < 0.8) {
        a = ri_(rand, 2, 9);
        do { b = ri_(rand, 2, 9); } while (b === a);
        L = [1, a]; R = [1, b]; t = 'H';
      } else {
        d = ri_(rand, 2, 9); a = ri_(rand, d - 1, d);
        L = [a, d]; R = null; t = 'I';
      }
      if (rand() < 0.5) { var tmp = L; L = R; R = tmp; }   // 1 や大きい方が左右どちらにも来るように
      var lv = L ? L[0] / L[1] : 1, rv = R ? R[0] / R[1] : 1;
      var ans = lv > rv + 1e-9 ? 1 : (Math.abs(lv - rv) < 1e-9 ? 2 : 3);
      var side = function (s) { return s ? s[0] + '/' + s[1] : '1'; };
      return { t: t, q: ['あてはまる きごうは'], f: [''], ans: { '': ans },
        tag: t + side(L) + 'v' + side(R), fig: buCmp_(L, R) };
    }
    if (mode === 5) {
      d = ri_(rand, 3, 9);
      a = ri_(rand, 1, d - 2);
      b = ri_(rand, 1, d - 1 - a);
      return { t: 'J', q: [a + '/' + d, '+', b + '/' + d, '='],
        rows: [[a + '/' + d, '+', b + '/' + d, '=', '_1/_0']],
        f: ['分母', '分子'], ans: { '分母': d, '分子': a + b }, tag: 'J' + a + '+' + b + '/' + d };
    }
    if (mode === 6) {
      d = ri_(rand, 3, 9);
      if (rand() < 0.3) {
        b = ri_(rand, 1, d - 1);
        return { t: 'L', q: ['1', '-', b + '/' + d, '='],
          rows: [['1', '-', b + '/' + d, '=', '_1/_0']],
          f: ['分母', '分子'], ans: { '分母': d, '分子': d - b }, tag: 'L' + b + '/' + d };
      }
      a = ri_(rand, 2, d - 1);
      b = ri_(rand, 1, a - 1);
      return { t: 'K', q: [a + '/' + d, '-', b + '/' + d, '='],
        rows: [[a + '/' + d, '-', b + '/' + d, '=', '_1/_0']],
        f: ['分母', '分子'], ans: { '分母': d, '分子': a - b }, tag: 'K' + a + '-' + b + '/' + d };
    }
    throw new Error('分数: モードが不正です');
  }
};

/* ---- 図 ---- */
function buR_(v) { return Math.round(v * 10) / 10; }
function buText_(x, y, s, size, color, anchor, cls) {
  return '<text x="' + buR_(x) + '" y="' + buR_(y) + '" font-size="' + size + '" fill="' + (color || BU_INK) +
    '" text-anchor="' + (anchor || 'middle') + '" dominant-baseline="central" font-weight="700"' +
    (cls ? ' class="' + cls + '"' : '') + '>' + s + '</text>';
}
/** SVG の分数（中心 x、横線の y） */
function buFrac_(x, y, n, d, size, color) {
  var w = size * 0.75;
  return buText_(x, y - size * 0.58, String(n), size, color) +
    '<line x1="' + buR_(x - w / 2) + '" y1="' + buR_(y) + '" x2="' + buR_(x + w / 2) + '" y2="' + buR_(y) +
    '" stroke="' + (color || BU_INK) + '" stroke-width="' + buR_(size / 14) + '"/>' +
    buText_(x, y + size * 0.6, String(d), size, color);
}

/**
 * 0〜1 の数直線を d 等分し、k 番目の目もりを矢印で指す。
 * 目もりに分数は書かない（書くと読むだけになる）。0 と 1 だけ書く。
 */
function buLine_(d, k) {
  var W = 960, x0 = 90, x1 = 870, y = 150, body = '';
  body += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="' + BU_INK + '" stroke-width="5"/>';
  for (var i = 0; i <= d; i++) {
    var x = x0 + (x1 - x0) * i / d, big = (i === 0 || i === d);
    body += '<line x1="' + buR_(x) + '" y1="' + (y - (big ? 34 : 22)) + '" x2="' + buR_(x) + '" y2="' + (y + (big ? 34 : 22)) +
      '" stroke="' + BU_INK + '" stroke-width="' + (big ? 5 : 4) + '"/>';
  }
  body += buText_(x0, y + 72, '0', 48) + buText_(x1, y + 72, '1', 48);
  var ax = x0 + (x1 - x0) * k / d, qc = questionColor_();
  body += '<line x1="' + buR_(ax) + '" y1="40" x2="' + buR_(ax) + '" y2="' + (y - 40) + '" stroke="' + qc + '" stroke-width="6"/>' +
    '<path d="M' + buR_(ax - 16) + ' ' + (y - 58) + ' L' + buR_(ax + 16) + ' ' + (y - 58) + ' L' + buR_(ax) + ' ' + (y - 32) +
    ' Z" fill="' + qc + '"/>';
  return '<svg viewBox="0 0 ' + W + ' 260" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
}

/** 大小の図。上に「左 □ 右」、下に ① > ② = ③ < の選択肢 */
function buCmp_(L, R) {
  var W = 960, body = '', y = 110, qc = questionColor_();
  var side = function (s, x) { return s ? buFrac_(x, y, s[0], s[1], 64) : buText_(x, y, '1', 72); };
  body += side(L, 330) + side(R, 630);
  body += '<rect x="440" y="' + (y - 50) + '" width="80" height="100" rx="6" fill="none" stroke="' + qc + '" stroke-width="5"/>';
  var marks = ['①', '②', '③'], syms = ['&gt;', '=', '&lt;'];
  var boxW = 220, boxH = 110, gap = 60, x = (W - (3 * boxW + 2 * gap)) / 2, by = 230;
  for (var i = 0; i < 3; i++) {
    body += '<g data-pick="' + (i + 1) + '">' +
      '<rect class="pkb" x="' + x + '" y="' + by + '" width="' + boxW + '" height="' + boxH +
      '" rx="6" fill="#000" fill-opacity="0" stroke="' + BU_LINE + '" stroke-width="3"/>' +
      buText_(x + 30, by + boxH / 2, marks[i], 40, BU_SUB) +
      buText_(x + boxW / 2 + 20, by + boxH / 2, syms[i], 72, BU_SUB, 'middle', 'pkv') +
      '</g>';
    x += boxW + gap;
  }
  return '<svg viewBox="0 0 ' + W + ' 360" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
}

var UNIT = UNIT || UNIT_DEFS['bunsu'];
