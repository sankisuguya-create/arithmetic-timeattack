/**
 * Unit.gs — 長さのたんい（km と m、まきじゃく）
 * 3年「長さ」第1〜3時に対応する。
 */

var UNIT = {
  id: 'length',
  title: '長さのたんい タイムアタック！',
  teacherTitle: '長さのたんい 設定・分析',

  defaults: {
    slow_ms: 5000        // 換算は九九より時間がかかる
  },

  flags: [
    { key: 'calc', label: '計算モード', gradeKey: 'calc_min_grade', defaultGrade: 3 }
  ],

  modes: [
    { id: 1, name: 'かんさん きほん',   desc: '3km=□m ／ 7000m=□km',  flag: null   },
    { id: 2, name: 'かんさん ぜんぶ',   desc: '1200m=□km□m もあり',   flag: null   },
    { id: 3, name: 'けいさん たしざん', desc: '1km700m + 600m',        flag: 'calc' },
    { id: 4, name: 'けいさん ひきざん', desc: '2km100m − 1km700m',     flag: 'calc' },
    { id: 5, name: 'めもり きほん',     desc: 'まきじゃく 1mまで',      flag: null   },
    { id: 6, name: 'めもり ぜんぶ',     desc: 'まきじゃく 1mより長い',  flag: null   }
  ],

  types: {
    C: 'km→m', D: 'm→km', A: 'm→km m', B: 'km m→m',
    E: 'たしざん', F: 'ひきざん', G: 'めもり(1m以内)', H: 'めもり(1m超)'
  },

  tips:
    '<b>weak_child</b>：児童ごと・問題型ごとの平均想起時間(ms)。<code>slow_ms</code> 超で赤。<br>' +
    '・km→m と m→km だけ遅い → 1000倍の関係そのものが未定着<br>' +
    '・m→km m が遅い → 位取りで分ける操作につまずいている<br>' +
    '・たしざんよりひきざんが極端に遅い → 繰り下がりが課題<br><br>' +
    '<b>weak_class</b> の下段が<b>よくある誤答の一覧</b>。' +
    '1200m を「12km 0m」とする<b>1000倍のずれ</b>や、' +
    '3km50m を「350」とする<b>位取りの崩れ</b>が、実際の答えとして見える。',

  /** めもりは合計で判定する（1m87cm も 187 も正解にする） */
  byTotal: function (item) { return item.t === 'G' || item.t === 'H'; },
  unitScale: function (u) { return u === 'm' ? 100 : 1; },   // 合計判定は cm 換算

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

    if (type === 'C') {                        // 3km = □m
      k = ri_(rand, 1, 9);
      return { t: 'C', q: [String(k), 'km'], f: ['m'], ans: { m: k * 1000 }, tag: k + 'km' };
    }
    if (type === 'D') {                        // 7000m = □km
      k = ri_(rand, 1, 9);
      return { t: 'D', q: [String(k * 1000), 'm'], f: ['km'], ans: { km: k }, tag: (k * 1000) + 'm' };
    }
    if (type === 'A') {                        // 1200m = □km□m（m部は3桁固定＝桁数が漏れない）
      k = ri_(rand, 1, 9); m = ri_(rand, 1, 9) * 100;
      return { t: 'A', q: [String(k * 1000 + m), 'm'], f: ['km', 'm'],
               ans: { km: k, m: m }, tag: (k * 1000 + m) + 'm' };
    }
    if (type === 'B') {                        // 1km500m = □m（答えは常に4桁）
      k = ri_(rand, 1, 9);
      m = pick_(rand, [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
      return { t: 'B', q: [String(k), 'km', String(m), 'm'], f: ['m'],
               ans: { m: k * 1000 + m }, tag: k + 'km' + m + 'm' };
    }
    if (type === 'E') {                        // 1km700m + 600m = □km□m
      k = ri_(rand, 1, 8); m = ri_(rand, 1, 9) * 100; m2 = ri_(rand, 1, 9) * 100;
      sum = k * 1000 + m + m2;
      if (sum % 1000 === 0) { m2 += 100; sum += 100; }      // m部が0になるのを避ける
      return { t: 'E', q: [String(k), 'km', String(m), 'm', '+', String(m2), 'm'],
               f: ['km', 'm'], ans: { km: Math.floor(sum / 1000), m: sum % 1000 },
               tag: k + 'km' + m + 'm+' + m2 + 'm' };
    }
    if (type === 'G') {                        // まきじゃく 1m以内
      // 窓を 85cm に狭めて1cmあたりの表示幅を稼ぐ（読みやすさを範囲より優先）。
      // 10〜78cm に限るのは、1桁の答えを混ぜると桁数が定まらず自動確定できなくなるため。
      var g = ri_(rand, 10, 78);
      return { t: 'G', ruler: { from: 0, span: 85, at: g },
               q: [], f: ['cm'], ans: { cm: g }, tag: g + 'cm' };
    }
    if (type === 'H') {                        // まきじゃく 1m超
      // 答えを先に決めてから窓を合わせる。窓を先に決めると答えが1m台に偏る。
      var span = 90;
      var at = ri_(rand, 40, 260);
      var lo = Math.max(0, at - (span - 10)), hi = Math.max(0, at - 10);
      var from = Math.round(ri_(rand, lo, hi) / 10) * 10;
      if (from > at - 6) from = Math.max(0, from - 10);
      return { t: 'H', ruler: { from: from, span: span, at: at },
               q: [], f: ['m', 'cm'],
               ans: { m: Math.floor(at / 100), cm: at % 100 }, tag: at + 'cm' };
    }

    // F: ひきざん。答えを先に決めてから引く数を作る。
    // 引かれる数を先に決めると、答えの km 部が 0〜1 に偏る。
    res = ri_(rand, 0, 4) * 1000 + ri_(rand, 1, 9) * 100;
    b = ri_(rand, 1, 4) * 1000 + ri_(rand, 1, 9) * 100;
    a = res + b;
    if (a > 9900) { a -= 1000; b -= 1000; }
    if (b < 100) { b += 1000; a += 1000; }

    var qa = (a % 1000 === 0) ? [String(a / 1000), 'km']
           : [String(Math.floor(a / 1000)), 'km', String(a % 1000), 'm'];
    var qb = (b % 1000 === 0) ? [String(b / 1000), 'km']
           : [String(Math.floor(b / 1000)), 'km', String(b % 1000), 'm'];
    return { t: 'F', q: qa.concat(['-'], qb), f: ['km', 'm'],
             ans: { km: Math.floor((a - b) / 1000), m: (a - b) % 1000 },
             tag: a + '-' + b };
  }
};
