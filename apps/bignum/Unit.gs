/**
 * 大きな数TA。万・億の位取りを、各欄4桁以内で練習する。
 * 数字で書き下す出題は9桁（一億の位）までに揃えてある。10桁を超えると
 * 区切りを入れても児童が位を数えきれず、測っているのが位取りではなく
 * 「桁を数える根気」になるため。単位つきの表記（999億 など）は4桁以内。
 */
var UNIT = {
  id: 'bignum',
  title: '大きな数 タイムアタック！',
  teacherTitle: '大きな数 設定・分析',
  defaults: { slow_ms: 5000 },
  units: { '万': '#FFC53D', '億': '#6FA8FF', 'こ': '' },
  modes: [
    { id: 1, name: '万に わける', desc: '34560789 → 3456万789（万の位は1〜9999）', help: 'つぎの欄は →、こたえあわせは Enter' },
    { id: 2, name: '億に わける', desc: '300040000 → 3億4万', help: 'つぎの欄は →、こたえあわせは Enter' },
    { id: 3, name: '位の 数字', desc: '大きな数の、指定された位の数字（0も出題）' },
    { id: 4, name: 'いくつ分', desc: '3500000 は 1万が 350こ', help: 'Enter で こたえあわせ' },
    { id: 5, name: '10倍・100倍', desc: '35万 × 10 = 350万', help: 'Enter で こたえあわせ' },
    { id: 6, name: '10分の1・100分の1', desc: '350万 ÷ 10 = 35万', help: 'Enter で こたえあわせ' }
  ],
  types: {
    splitMan: '万と残り', splitOku: '億と万',
    digitMan: '万のまとまりの位', digitOku: '一億の位',
    countSen: '千がいくつ', countMan: '一万がいくつ', countOku: '一億がいくつ',
    times10: '10倍', times100: '100倍', divide10: '10分の1', divide100: '100分の1'
  },
  digitCap: {
    splitMan: { '万': 4, '': 4 }, splitOku: { '億': 1, '万': 4 },
    3: { '': 1 }, 4: { 'こ': 4 }, 5: { '万': 4, '億': 4 }, 6: { '万': 4, '億': 4 }
  },
  fieldsByType: {
    splitMan: ['万', ''], splitOku: ['億', '万'],
    countSen: ['こ'], countMan: ['こ'], countOku: ['こ']
  },
  tips: '万・億は4桁ずつのまとまり。0のある問題の誤答も確認してください。<br>' +
    '位の数字、いくつ分、10倍と10分の1を分けて見ると、指導する内容を選べます。<br>' +
    '一億の位（digitOku）は9桁の先頭になるため答えに0が出ません。0の読み取りは万のまとまりの位で見てください。<br>' +
    '初打鍵までの時間には読む時間や操作への慣れも含まれます。遅さだけで未定着とは判断せず、誤答や授業中の様子と合わせてください。<br>' +
    'slow_ms=5000は暫定値です。クラスの記録を見て調整してください。',

  gen: function (rand, mode) {
    var high, low, names, ans, q, t, n, unit, factor;
    if (mode === 1 || mode === 2) {
      // 下位は0や途中の0を含む4桁のまとまり。
      // 下位を1000以上に絞ると、位を埋める0の練習ができない。
      low = ri_(rand, 0, 9999);
      if (mode === 1) {
        // 万の位は4桁まで。数は5〜8桁になり、桁数から手続きが決まらない。
        high = ri_(rand, 1, 9999);
        n = high * 10000 + low;
        names = ['万', ''];
        t = 'splitMan';
      } else {
        // 億の位は1桁。10億は10桁になり、9桁の上限を超えるため出さない。
        high = ri_(rand, 1, 9);
        n = (high * 10000 + low) * 10000;
        names = ['億', '万'];
        t = 'splitOku';
      }
      ans = {}; ans[names[0]] = high; ans[names[1]] = low;
      return { t: t, q: [String(n)], f: names, ans: ans, tag: t + ':' + n };
    }
    if (mode === 3) {
      // 各位を同じ頻度で選ぶ。文字列で作って途中の0も保持する。
      var pos = ri_(rand, 4, 8);
      var places = ['一万', '十万', '百万', '千万', '一億'];
      // 桁数は問う位と独立に引く。連動させると答えが常に「左から○番目」に来て、
      // 位取りを読まずに解けてしまう（数の長さは pos+1〜9 の範囲で自由に動かす）。
      var width = ri_(rand, pos + 1, 9);
      var digits = [String(ri_(rand, 1, 9))];
      for (var i = 1; i < width; i++) digits.push(String(ri_(rand, 0, 9)));
      n = digits.join('');
      t = pos < 8 ? 'digitMan' : 'digitOku';
      return { t: t, q: [n, 'の', places[pos - 4] + 'の位の数字'], f: [''],
        ans: { '': Number(digits[width - pos - 1]) }, tag: n + ':place' + pos };
    }
    if (mode === 4) {
      var ix = ri_(rand, 0, 2);
      unit = [1000, 10000, 100000000][ix];
      // 出題の数字は9桁まで。一億のときだけ、いくつ分を1〜9に絞る。
      n = ri_(rand, 1, [9999, 9999, 9][ix]);
      // まとまりは数字の羅列（100000000）ではなく単位で見せる。
      // 桁を数えないと何のまとまりか分からない書き方は、問いの本体より重い。
      return { t: ['countSen', 'countMan', 'countOku'][ix],
        q: [String(n * unit), 'は', ['1000', '1万', '1億'][ix] + 'が'], f: ['こ'],
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
