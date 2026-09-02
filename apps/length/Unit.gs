/**
 * Unit.gs — 長さのたんい（km と m、まきじゃく）
 * 3年「長さ」第1〜3時に対応する。
 */

var UNIT = {
  id: 'length',
  title: '長さのたんい タイムアタック！',
  teacherTitle: '長さのたんい 設定・分析',

  defaults: {
    slow_ms: 5000,       // 換算は九九より時間がかかる

    // まきじゃくの見た目。表示だけで、出題（span・at の値域）には触らない。
    // 教室のプロジェクタや端末の画面サイズに合わせて担任が調整するための値。
    ruler_width:  100,   // 画面幅に対する横幅(%)
    ruler_tape:   128,   // テープの太さ(px)
    ruler_font:    44,   // 目盛りの数字の大きさ(px)
    ruler_offset:   0    // 上下位置の調整(px)。+で下がる
  },

  /**
   * 教師画面に出す単元固有の設定欄。Core も teacher.html もキーの意味を知らず、
   * ここでの宣言だけを見て欄を描く（九九の教師画面にこの欄は出ない）。
   * 表示範囲(span)を入れていないのは、span が出題側の at の値域と結合していて、
   * 教師が変えると矢印が窓の外に出るため。変えるなら gen の作り直しが要る。
   */
  settings: [
    { key: 'ruler_width',  label: 'まきじゃくの横幅',
      note: '画面幅に対する%。50〜100', min: 50, max: 100, step: 1 },
    { key: 'ruler_tape',   label: 'テープの太さ',
      note: 'px。60〜200。太いほど目盛りが読みやすい', min: 60, max: 200, step: 4 },
    { key: 'ruler_font',   label: '目盛りの数字の大きさ',
      note: 'px。24〜72', min: 24, max: 72, step: 2 },
    { key: 'ruler_offset', label: '上下の位置',
      note: 'px。+で下、−で上に動く。−60〜120', min: -60, max: 120, step: 4 }
  ],

  /** 出題に出る単位と、その表示色（空文字は既定のグレー） */
  units: { km: '#FFC53D', m: '', cm: '#6FA8FF' },

  flags: [
    { key: 'calc', label: '計算モード', gradeKey: 'calc_min_grade', defaultGrade: 3 }
  ],

  modes: [
    { id: 1, name: 'かんさん きほん',   desc: '3km=□m ／ 7000m=□km',  flag: null   },
    { id: 2, name: 'かんさん ぜんぶ',   desc: '1200m=□km□m もあり',   flag: null   },
    { id: 3, name: 'けいさん たしざん', desc: '1km700m + 600m',        flag: 'calc' },
    { id: 4, name: 'けいさん ひきざん', desc: '2km100m − 1km700m',     flag: 'calc' },
    { id: 5, name: 'めもり きほん',     desc: 'まきじゃく 1mまで',      flag: null   },
    { id: 6, name: 'めもり ぜんぶ',     desc: 'まきじゃく 1mより長い',  flag: null,
      help: 'Enter で こたえあわせ' }   // 答えの桁数が 1〜3 と変わり自動確定できない
  ],

  types: {
    C: 'km→m', D: 'm→km', A: 'm→km m', B: 'km m→m',
    E: 'たしざん', F: 'ひきざん', G: 'めもり(1m以内)', H: 'めもり(1m超)'
  },

  /**
   * 自動確定に使う桁数（宣言のみ。この問題の答え(ans)は参照しない）。
   * 問題型ごとに宣言する。モードキーだと「かんさん ぜんぶ」で
   * A の m（km m の下位、3桁）と B・C の m（合計、4桁）が同じ m キーで衝突する。
   * A〜F は以前は未宣言で、実際の答えの桁数で確定していた（＝桁数がヒントとして漏れ、
   * 打鍵数の差が所要msに乗っていた）。値は gen の値域設計から一意に決まる。
   */
  digitCap: {
    C: { m: 4 },            // k*1000（k=1〜9） → 1000〜9000
    D: { km: 1 },           // k（1〜9）
    A: { km: 1, m: 3 },     // km=1〜9、m=100〜900（100の倍数）
    B: { m: 4 },            // k*1000+m（m=50〜900） → 1050〜9900
    E: { km: 1, m: 3 },     // 繰り上がり後も km=1〜9、m部は0を避けた100〜900
    F: { km: 1, m: 3 },     // km=0〜4（0も1桁）、m部は100〜900
    G: { cm: 2 },           // めもり：10〜78cm の範囲内なので常に2桁
    H: { cm: 3 }            // めもり：cm欄だけで「187」と答える書き方も認めるため3桁固定
  },

  tips:
    '<b>weak_child</b>：児童ごと・問題型ごとの平均想起時間(秒)。<code>slow_ms</code> 超で赤。<br>' +
    '・km→m と m→km だけ遅い → 1000倍の関係そのものが未定着<br>' +
    '・m→km m が遅い → 位取りで分ける操作につまずいている<br>' +
    '・たしざんよりひきざんが極端に遅い → 繰り下がりが課題<br><br>' +
    '<b>weak_class</b> の下段が<b>よくある誤答の一覧</b>。' +
    '1200m を「12km 0m」とする<b>1000倍のずれ</b>や、' +
    '3km50m を「350」とする<b>位取りの崩れ</b>が、実際の答えとして見える。',

  /** めもりは合計で判定する（1m87cm も 187 も正解にする） */
  byTotal: function (item) { return item.t === 'G' || item.t === 'H'; },
  unitScale: function (u) { return u === 'm' ? 100 : 1; },   // 合計判定は cm 換算

  /** weak_class / mistakes で「1/200」を「1km200m」のように表示するための単位マップ */
  fieldsByType: {
    C: ['m'], D: ['km'], A: ['km', 'm'], B: ['m'],
    E: ['km', 'm'], F: ['km', 'm'], G: ['cm'], H: ['m', 'cm']
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
      // at は 101cm 以上に限る。モード名が「1mより長い」である以上、
      // 1m未満（40〜99cm）が出るのはモードの説明と出題内容が食い違う不具合。
      var span = 90;
      var at = ri_(rand, 101, 260);
      var lo = Math.max(0, at - (span - 10)), hi = Math.max(0, at - 10);
      var from = Math.round(ri_(rand, lo, hi) / 10) * 10;
      if (from > at - 6) from = Math.max(0, from - 10);
      return { t: 'H', ruler: { from: from, span: span, at: at },
               q: [], f: ['m', 'cm'],
               ans: { m: Math.floor(at / 100), cm: at % 100 }, tag: at + 'cm' };
    }

    // F: ひきざん。答えを先に決めてから引く数を作る。
    // 引かれる数を先に決めると、答えの km 部が 0〜1 に偏る。
    // res(答えのm部)は100〜4900、b(引く数)は1100〜4900なので a=res+bは常に1200〜9800。
    // 桁あふれ・繰り上がりは値域の設計自体で構造的に起きない（到達しない補正は置かない）。
    res = ri_(rand, 0, 4) * 1000 + ri_(rand, 1, 9) * 100;
    b = ri_(rand, 1, 4) * 1000 + ri_(rand, 1, 9) * 100;
    a = res + b;

    var qa = (a % 1000 === 0) ? [String(a / 1000), 'km']
           : [String(Math.floor(a / 1000)), 'km', String(a % 1000), 'm'];
    var qb = (b % 1000 === 0) ? [String(b / 1000), 'km']
           : [String(Math.floor(b / 1000)), 'km', String(b % 1000), 'm'];
    return { t: 'F', q: qa.concat(['-'], qb), f: ['km', 'm'],
             ans: { km: Math.floor((a - b) / 1000), m: (a - b) % 1000 },
             tag: a + '-' + b };
  }
};
