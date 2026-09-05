/**
 * Unit.gs — おもさ（g・kg の換算、たし算・ひき算）
 * 3年「重さ」に対応する。
 */

var UNIT = {
  id: 'weight',
  title: 'おもさ タイムアタック！',
  teacherTitle: 'おもさ 設定・分析',

  defaults: {
    slow_ms: 5000,      // 換算は九九より時間がかかる
    dial_size: 64       // はかりの文字盤・拡大窓の大きさの上限（画面の高さに対する%）
  },

  /** 表示だけの設定。出題（dial の max / step / at）には触れない */
  settings: [
    { key: 'dial_size', label: 'はかりの大きさ',
      note: '画面の高さに対する%の上限。20〜70。既定では画面の空き高さのほうが先に効くので、'
          + '小さくしたいときだけ下げる。既存の設定が44のままだと図が縮むので64に上げる',
      min: 20, max: 70, step: 2 }
  ],

  /** 出題に出る単位と、その表示色（空文字は既定のグレー） */
  units: { kg: '#FFC53D', g: '' },

  modes: [
    { id: 1, name: 'かんさん きほん',   desc: '3kg=□g ／ 5000g=□kg' },
    { id: 2, name: 'かんさん ぜんぶ',   desc: '1200g=□kg□g もあり' },
    { id: 3, name: 'けいさん たしざん', desc: '1kg300g + 500g' },
    { id: 4, name: 'けいさん ひきざん', desc: '2kg100g − 1kg700g' },
    { id: 5, name: 'めもり きほん',     desc: '1kgのはかり（1目もり5g）' },
    { id: 6, name: 'めもり ぜんぶ',     desc: '2kgのはかり（1目もり10g）' }
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
