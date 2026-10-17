/**
 * 文の手がかりと演算を分けて見られるよう、c/i を半数ずつ混ぜる。
 * 式は演算だけを選ばせ、数の計算は求めない。
 */
var OC_INK = '#FFFFFF';
var OC_SUB = '#C9D1E8';
var OC_LINE = '#8C93AC';
var OC_MARK = ['①', '②', '③', '④'];
var OC_OPS = ['+', '−', '×', '÷'];

var UNIT = {
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

function ocText_(x, y, text, size, anchor, color) {
  return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" text-anchor="' + (anchor || 'start') +
    '" dominant-baseline="middle" fill="' + (color || OC_INK) + '">' + ocEsc_(text) + '</text>';
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
    ocText_(x + 24, y + h / 2, OC_MARK[i], 32, 'start', OC_SUB) +
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
