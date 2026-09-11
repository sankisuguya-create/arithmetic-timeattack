/** 小数TA。小数を整数化して生成し、浮動小数の丸め誤差を採点に持ち込まない。 */
var UNIT = {
  id: 'decimal',
  title: '小数 タイムアタック！',
  teacherTitle: '小数 設定・分析',
  defaults: { slow_ms: 5000 },
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
