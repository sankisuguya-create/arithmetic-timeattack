/**
 * Unit.gs — 演算決定TA（小学3年起点）
 *
 * 1: えらぶ      文章から演算子を1つ選ぶ
 * 2: みぬく      図と文章から式を選ぶ
 * 3: くみたてる  2つの演算を使う式を選ぶ
 *
 * 選択肢は既存の data-pick 契約を使い、答えは1〜4の選択肢番号として保存する。
 * 共通画面・記録形式・サーバー採点は変更しない。
 */
var OC_INK = '#FFFFFF';
var OC_SUB = '#C9D1E8';
var OC_LINE = '#8C93AC';
var OC_MARK = ['①', '②', '③', '④'];

var UNIT = {
  id: 'operation-choice',
  grade: 3,
  title: '演算決定TA タイムアタック！',
  teacherTitle: '演算決定TA 設定・分析',
  units: {},
  modes: [
    { id: 1, name: 'えらぶ', desc: '文章を読んで、使う演算を1つ選ぶ' },
    { id: 2, name: 'みぬく', desc: '図と文章を見て、合う式を選ぶ', needs: { mode: 1, tries: 3 } },
    { id: 3, name: 'くみたてる', desc: '2つの演算を使う式を選ぶ', needs: { mode: 2, tries: 3 } }
  ],
  types: {
    A: 'たし算の場面',
    B: 'ひき算の場面',
    C: 'かけ算の場面',
    D: 'わり算の場面',
    E: '2つの演算を組み合わせる'
  },
  digitCap: {
    1: { '': 1 },
    2: { '': 1 },
    3: { '': 1 }
  },
  tips: '正答率だけでなく、A〜Dの場面別の誤答を見ます。特定の言葉だけで判断していないか、数の関係を捉えているかを確認してください。発展のEは2つの演算を組み合わせる問題です。',
  gen: function (rand, mode) {
    if (mode === 1) return ocOperator_(rand);
    if (mode === 2) return ocDiagram_(rand);
    if (mode === 3) return ocCombined_(rand);
    throw new Error('mode ' + mode);
  }
};

/* ---------- 共通のSVG描画 ---------- */
function ocEsc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function ocText_(x, y, text, size, anchor, color) {
  return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 34) +
    '" text-anchor="' + (anchor || 'start') + '" dominant-baseline="middle" fill="' +
    (color || OC_INK) + '">' + ocEsc_(text) + '</text>';
}
function ocSvg_(body, height) {
  return '<svg viewBox="0 0 1040 ' + (height || 620) + '" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-weight="800">' + body + '</svg>';
}
function ocChoiceBox_(x, y, w, h, i, label, size) {
  return '<g data-pick="' + (i + 1) + '">' +
    '<rect class="pkb" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" rx="8" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>' +
    ocText_(x + 24, y + h / 2, OC_MARK[i], 32, 'start', OC_SUB) +
    ocText_(x + w / 2 + 18, y + h / 2, label, size || 36, 'middle', OC_INK) +
    '</g>';
}
function ocChoiceGrid_(choices, y, size) {
  var body = '', w = 430, h = 88, xs = [70, 540], ys = [y, y + 104];
  choices.forEach(function (c, i) {
    body += ocChoiceBox_(xs[i % 2], ys[Math.floor(i / 2)], w, h, i, c, size);
  });
  return body;
}
function ocShuffle_(rand, values) {
  var a = values.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function ocPickItem_(type, question, choices, correct, tag, body, mode) {
  var order = ocShuffle_(mode.rand, choices);
  var ans = order.indexOf(correct) + 1;
  body += mode.layout === 'row'
    ? order.map(function (c, i) { return ocChoiceBox_(38 + i * 250, 390, 220, 92, i, c, 42); }).join('')
    : ocChoiceGrid_(order, mode.choiceY || 390, mode.choiceSize || 34);
  return {
    t: type,
    q: [question],
    f: [''],
    ans: { '': ans },
    tag: tag + ':' + order.join('_'),
    fig: ocSvg_(body, mode.height || 620)
  };
}

/* ---------- 場面生成 ---------- */
function ocScene_(rand) {
  var kind = 1 + Math.floor(rand() * 4);
  if (kind === 1) {
    var a = ri_(rand, 12, 28), b = ri_(rand, 11, 24);
    return { type: 'A', op: '+', a: a, b: b, result: a + b,
      question: '赤い花が ' + a + '本、黄色い花が ' + b + '本あります。花は全部で何本？' };
  }
  if (kind === 2) {
    var total = ri_(rand, 35, 80), used = ri_(rand, 11, Math.min(29, total - 5));
    return { type: 'B', op: '−', a: total, b: used, result: total - used,
      question: 'シールが ' + total + 'まいあります。' + used + 'まい使いました。残りは何まい？' };
  }
  if (kind === 3) {
    var each = ri_(rand, 2, 5), boxes = ri_(rand, 3, 6);
    return { type: 'C', op: '×', a: each, b: boxes, result: each * boxes,
      question: '1箱に鉛筆が ' + each + '本ずつ入っています。' + boxes + '箱では全部で何本？' };
  }
  var people = ri_(rand, 2, 8), perPerson = ri_(rand, 2, 9), pencils = people * perPerson;
  return { type: 'D', op: '÷', a: pencils, b: people, result: perPerson,
    question: '鉛筆 ' + pencils + '本を ' + people + '人に同じ数ずつ分けます。1人分は何本？' };
}
function ocOperatorChoices_(op) {
  return ['+', '−', '×', '÷'];
}
function ocExprChoices_(s) {
  var values = [s.a + '＋' + s.b, s.a + '−' + s.b, s.a + '×' + s.b, s.a + '÷' + s.b];
  var right = s.op === '+' ? 0 : s.op === '−' ? 1 : s.op === '×' ? 2 : 3;
  return { choices: values, correct: values[right] };
}

/* ---------- モード1：文章から演算子を選ぶ ---------- */
function ocOperator_(rand) {
  var s = ocScene_(rand);
  var body = ocText_(42, 82, s.question, 34);
  return ocPickItem_(s.type, '使う演算をえらぶ', ocOperatorChoices_(s.op), s.op,
    'operator-' + s.type + '-' + s.a + '-' + s.b, body,
    { rand: rand, layout: 'row', height: 520 });
}

/* ---------- モード2：図と文章から式を選ぶ ---------- */
function ocDiagram_(rand) {
  var s = ocScene_(rand);
  var body = ocText_(42, 62, s.question, 31);
  if (s.type === 'A') {
    // 2つの量を別々の帯で示す。実際の長さは数の大きさを表さない。
    body += '<rect x="150" y="140" width="300" height="54" rx="5" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>';
    body += '<rect x="490" y="140" width="300" height="54" rx="5" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>';
    body += ocText_(300, 167, '赤 ' + s.a + '本', 30, 'middle') + ocText_(640, 167, '黄 ' + s.b + '本', 30, 'middle');
    body += ocText_(470, 232, '2つの量を合わせる', 28, 'middle', OC_SUB);
  } else if (s.type === 'B') {
    body += '<rect x="130" y="138" width="780" height="58" rx="5" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>';
    body += '<rect x="130" y="138" width="500" height="58" rx="5" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>';
    body += ocText_(380, 167, '使った ' + s.b + 'まい', 30, 'middle') + ocText_(770, 167, '残り？', 30, 'middle');
    body += ocText_(520, 232, 'はじめに ' + s.a + 'まい', 28, 'middle', OC_SUB);
  } else if (s.type === 'C') {
    var count = s.b, each = s.a, x0 = (1040 - count * 142) / 2;
    for (var i = 0; i < count; i++) {
      var x = x0 + i * 142;
      body += '<g><rect x="' + x + '" y="132" width="126" height="86" rx="8" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>';
      body += ocText_(x + 63, 175, new Array(each + 1).join('● '), 26, 'middle', OC_SUB);
      body += '</g>';
    }
    body += ocText_(520, 250, '同じ数のまとまりが ' + count + 'つ', 28, 'middle', OC_SUB);
  } else {
    var groups = s.b, dots = s.result, gx = (1040 - groups * 108) / 2;
    for (var g = 0; g < groups; g++) {
      var cx = gx + g * 108 + 44;
      body += '<circle cx="' + cx + '" cy="172" r="42" fill="#000" fill-opacity="0" stroke="' + OC_LINE + '" stroke-width="3"/>';
      body += ocText_(cx, 172, new Array(s.result + 1).join('●'), 17, 'middle', OC_SUB);
    }
    body += ocText_(520, 250, s.a + '本を ' + groups + 'つのグループに分ける', 28, 'middle', OC_SUB);
  }
  var ex = ocExprChoices_(s);
  var options = ex.choices;
  // 同じ演算を表す式が複数ある曖昧さを避け、数の順は場面文の順に統一する。
  return ocPickItem_(s.type, '図に合う式をえらぶ', options, ex.correct,
    'diagram-' + s.type + '-' + s.a + '-' + s.b, body,
    { rand: rand, layout: 'grid', choiceY: 340, choiceSize: 32, height: 570 });
}

/* ---------- モード3：2つの演算を組み合わせる ---------- */
function ocCombined_(rand) {
  var each = ri_(rand, 3, 6), bags = ri_(rand, 3, 6);
  var total = each * bags, given = ri_(rand, 2, Math.min(8, total - 1));
  var correct = each + '×' + bags + '−' + given;
  var choices = [
    correct,
    each + '×' + bags + '＋' + given,
    each + '＋' + bags + '−' + given,
    each + '×' + bags + '÷' + given
  ];
  var body = ocText_(42, 74, '1袋にクッキーが ' + each + '枚入っています。', 32) +
    ocText_(42, 122, bags + '袋買い、' + given + '枚あげました。残りは何枚？', 32);
  body += ocText_(520, 200, 'まず全部の枚数を求め、そのあとあげた枚数を考える', 27, 'middle', OC_SUB);
  return ocPickItem_('E', '2つの演算を使う式をえらぶ', choices, correct,
    'combined-' + each + '-' + bags + '-' + given, body,
    { rand: rand, layout: 'grid', choiceY: 270, choiceSize: 31, height: 500 });
}
