/**
 * たしざん あんざんTA。中身は2けたの筆算で、画面も筆算の形に並べる。
 * 児童には暗算の練習として出す。「頭の中で筆算をすればよい」という意図で、
 * 答えは一の位から打つ（f の順＝打つ順。画面の並びは rows の '_0' '_1' '_2' が決める）。
 * 一の位を先に打てば画面に残るので、頭に持つのはくり上がりの1と十の位だけで済む。
 */
var UNIT = {
  id: 'tasu',
  grade: 2,                 // 学習指導要領 2年 A(2) 2位数の加法。置き場 apps/grade2/ と一致させる
  title: '暗算(たし算)',
  teacherTitle: '暗算(たし算) 設定・分析',

  /**
   * 教師が調整する設定。最初のメニューの背景に敷く「成長する図形」。このサイトはくり上がりの六角（六角のマスごとに k＋(n−k) の筆算。くり上がるマスが第二の色）。
   * 本番の正答を「標準の分数」に直して積み、無地 → 輪郭 → 学年の色 → 第二の色 と育つ。表示だけで、出題にも採点にも関わらない。
   */
  defaults: { limit_sec: 60, floor_on: 1, floor_per_answer: 0.75 },
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）',
      min: 0.05, max: 10, step: 0.05 }
  ],
  /** 床の図形と第二の色（台帳は design リポジトリの growing-figures/COLORS.md） */
  floorPattern: 'carry',
  floorColor: 'topaz',

  units: {},
  modes: [
    { id: 1, name: '1けたの くりあがり', desc: '9+7' },
    { id: 2, name: 'くりあがり なし', desc: '34+52（筆算の形）',
      needs: { mode: 1, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 3, name: 'くりあがり', desc: '47+38',
      needs: { mode: 2, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 4, name: '百を こえる', desc: '67+58 ／ 75+30',
      needs: { mode: 3, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 5, name: 'ぜんぶ いり', desc: '1〜4 を同じ割合で',
      needs: { mode: 4, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true }
  ],
  types: { K: '1けた くりあがり', A: 'くりあがりなし', B: 'くりあがり', C: '百をこえる' },

  // 1けたは答えが必ず2けた（10〜18）。2けたは百・十・一の欄が毎回3つあり、各1けた。
  // 欄の数が型の中で変わらないので、確定の早さから答えの大きさは漏れない
  digitCap: { K: { '': 2 }, A: { '一': 1, '十': 1, '百': 1 }, B: { '一': 1, '十': 1, '百': 1 }, C: { '一': 1, '十': 1, '百': 1 } },

  tips: '型Bと型Cの誤答を見てください。「くりあがりを忘れる」（47+38=75）は十の位が1小さく、' +
    '「一の位に2けたを書く」は打てない形なので、十の位の欄の誤りとして出ます。<br>' +
    '型K（1けた）が遅い児童は、2けたの遅さの多くがそこから来ている可能性があります。2けたより先に1けたを練習させてください。<br>' +
    '初打鍵までの時間は「一の位を出すまで」の時間です。',

  // 誤答明細は欄の順（一/十/百）で届く。教師には普通の数で見せる
  fmtAnswer: function (type, vals) {
    if (type === 'K') return vals.join('');
    return String(Number(vals[2] || 0) * 100 + Number(vals[1] || 0) * 10 + Number(vals[0] || 0));
  },

  gen: function (rand, mode) {
    var t = mode === 5 ? pick_(rand, ['K', 'A', 'B', 'C']) : ['', 'K', 'A', 'B', 'C'][mode];
    if (!t) throw new Error('たしざん: モードが不正です');
    if (t === 'K') {
      var x = ri_(rand, 1, 9), y = ri_(rand, 10 - x, 9);
      return { t: 'K', q: [String(x), '+', String(y)], f: [''], ans: { '': x + y }, tag: 'K' + x + '+' + y };
    }
    var a1, a0, b1, b0;
    if (t === 'A') {          // 一の位も十の位も10未満。一の位の0（30+45）も出す
      a0 = ri_(rand, 0, 9); b0 = ri_(rand, 0, 9 - a0);
      a1 = ri_(rand, 1, 8); b1 = ri_(rand, 1, 9 - a1);
    } else if (t === 'B') {   // 一の位でくり上がり、和は99まで
      a0 = ri_(rand, 1, 9); b0 = ri_(rand, 10 - a0, 9);
      a1 = ri_(rand, 1, 7); b1 = ri_(rand, 1, 8 - a1);
    } else if (rand() < 0.5) { // C：十の位だけでくり上がる（75+30）
      a0 = ri_(rand, 0, 9); b0 = ri_(rand, 0, 9 - a0);
      a1 = ri_(rand, 1, 9); b1 = ri_(rand, Math.max(1, 10 - a1), 9);
    } else {                  // C：一の位と十の位の両方でくり上がる（67+58）
      a0 = ri_(rand, 1, 9); b0 = ri_(rand, 10 - a0, 9);
      a1 = ri_(rand, 1, 9); b1 = ri_(rand, Math.max(1, 9 - a1), 9);
    }
    var a = a1 * 10 + a0, b = b1 * 10 + b0, s = a + b;
    return {
      t: t, q: [String(a), '+', String(b)],
      // 左から [演算子, 百, 十, 一]。答えの段は百・十・一の順に見せ、一の位から打つ
      rows: [['', '', String(a1), String(a0)], ['+', '', String(b1), String(b0)], ['', '_2', '_1', '_0']],
      col: true,
      f: ['一', '十', '百'], ans: { '一': s % 10, '十': Math.floor(s / 10) % 10, '百': Math.floor(s / 100) },
      tag: t + a + '+' + b
    };
  }
};
