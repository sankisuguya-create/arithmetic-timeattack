/**
 * ひきざん あんざんTA。中身は2けたの筆算で、画面も筆算の形に並べる。
 * 児童には暗算の練習として出す。答えは一の位から打つ（f の順＝打つ順。画面の並びは rows の '_0' '_1'）。
 *
 * 頭の中で位ごとに引くやり方は、くり下がりで「大きい数から小さい数を引く」誤り（52−37=25）を
 * 生みやすいと報告されている（Beishuizen 1993, JRME 24(4)）。誤答明細でこの形が出ていないかを見る。
 */
var UNIT = {
  id: 'hiku',
  grade: 2,                 // 学習指導要領 2年 A(2) 2位数の加法の逆の減法。置き場 apps/grade2/ と一致させる
  title: 'ひきざん あんざん タイムアタック！',
  teacherTitle: 'ひきざん（2けたの筆算） 設定・分析',

  defaults: { limit_sec: 90 },   // 根拠なし。記録を見て直す

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
