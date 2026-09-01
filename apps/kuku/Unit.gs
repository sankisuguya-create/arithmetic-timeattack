/**
 * Unit.gs — 九九・わり算
 *
 * Core.gs が期待する形に合わせるだけ。共通の仕組みには触れない。
 */

var UNIT = {
  id: 'kuku',
  title: '九九表タイムアタック！',
  teacherTitle: '九九トレーニング 設定・分析',

  /** 共通の既定値を上書きする */
  defaults: {
    slow_ms: 3000        // 九九は想起が速いので閾値を短く取る
  },

  /** 答えが整数1つなので単位は出ない */
  units: {},

  /** モードの解禁フラグ。クラスごとに上書きできる */
  flags: [
    { key: 'div', label: 'わり算',      gradeKey: 'div_min_grade', defaultGrade: 3 },
    { key: 'ext', label: '拡張(9×16)', gradeKey: 'ext_min_grade', defaultGrade: 4 }
  ],

  modes: [
    { id: 1, name: 'かけ算', desc: '9×9 まで',  flag: null  },
    { id: 2, name: 'かけ算', desc: '9×16 まで', flag: 'ext' },
    { id: 3, name: 'わり算', desc: '9×9 まで',  flag: 'div' },
    { id: 4, name: 'わり算', desc: '9×16 まで', flag: 'ext' }
  ],

  /** 分析の軸。段ごとに見る */
  types: {
    x1: '1の段', x2: '2の段', x3: '3の段', x4: '4の段', x5: '5の段',
    x6: '6の段', x7: '7の段', x8: '8の段', x9: '9の段'
  },

  tips:
    '<b>weak_child</b>：児童ごと・段ごとの平均想起時間(ms)。<code>slow_ms</code> を超えると赤。<br>' +
    '九九は既習なので正答率では差が出ない。差が出るのは想起の速さ。<br><br>' +
    '・同じ段がかけ算・わり算の両方で赤 → 想起そのものが未定着<br>' +
    '・わり算だけ赤 → 逆算への変換が課題<br>' +
    '・全段が均等に赤 → 打鍵速度か閾値設定を疑う<br>' +
    '・誤答計だけ突出 → 当てずっぽう連打を疑い、log の ms を確認',

  /** 1問作る。答えは整数1つなので欄は1つ、単位ラベルは空 */
  gen: function (rand, mode) {
    var maxB = (mode === 2 || mode === 4) ? 16 : 9;
    var div  = (mode >= 3);
    var a = ri_(rand, 1, 9);
    var b = ri_(rand, 1, maxB);
    if (div) {
      return { t: 'x' + a, q: [String(a * b), '÷', String(a)],
               f: [''], ans: { '': b }, tag: (a * b) + '/' + a };
    }
    return { t: 'x' + a, q: [String(a), '×', String(b)],
             f: [''], ans: { '': a * b }, tag: a + 'x' + b };
  }
};
