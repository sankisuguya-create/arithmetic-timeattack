/**
 * かけ算の筆算(1けた) タイムアタック。3年「1けたをかけるかけ算の筆算」（11時間）。
 * (何十・何百)×(1位数)、(2位数)×(1位数)、(3位数)×(1位数) を筆算の形に並べて出す。
 *
 * 答えは筆算と同じく一の位から打つ（f の順＝打つ順。画面の並びは rows の '_0' '_1' … が決める）。
 * colDir: true なので、児童が「すうじキーせってい」で左から打つ（ふつうの数の順）にも切り替えられる。
 *
 * 欄の数は型で固定する（2けた×1けた は百・十・一の3欄、3けた×1けた と 何百×1けた は千・百・十・一の4欄）。
 * 実際の答えの桁数で欄を減らすと、欄の数が答えの大きさのヒントになる（docs/ADD_UNIT.md 3章）。
 * 上の位が 0 の欄は空けたまま「こたえあわせ」でよい（空欄は 0 とみなす。Core の match_）。
 */
var UNIT = {
  id: 'kakehissan',
  grade: 3,                 // 学習指導要領 3年 A(3) 2位数や3位数に1位数をかける乗法。置き場 apps/grade3/ と一致させる
  title: 'かけ算の筆算(1けた) タイムアタック！',
  teacherTitle: 'かけ算の筆算(1けた) 設定・分析',

  defaults: { limit_sec: 60, floor_on: 1, floor_per_answer: 0.75 },
  settings: [
    { key: 'floor_on', label: 'メニューの背景の図形', type: 'onoff',
      note: '正答を重ねるほど育つ模様。表示しないと無地になる' },
    { key: 'floor_per_answer', label: '1正答あたりの図形の育ち',
      note: '1分に20問解ける速さの問題を1問正解したときに増えるタイルの枚数。解きにくい問題（1分で解ける数が少ない）ほど1問で多く育つ（速さはこのサイトの記録から自動で出す）',
      min: 0.05, max: 10, step: 0.05 }
  ],
  /** 床の図形と第二の色（台帳は design リポジトリの growing-figures/COLORS.md。3年の他サイトと図形を変える） */
  floorPattern: 'kake1',   // かけ算の渦（1けた・腕1本）。2けたをかけるサイトは kake2（腕2本）で一組
  floorColor: 'amethyst',

  // 筆算の形の答えを、右（一の位）から打つか左から打つか、児童がすうじキーせっていで選べる（index.html の COLDIR）
  colDir: true,
  units: {},
  modes: [
    { id: 1, name: 'なんじゅう・なんびゃく', desc: '20×3 ／ 300×4（第1時。筆算でなく ふつうの式）',
      help: 'うったら こたえあわせ', enterKey: true },
    { id: 2, name: '2けた くりあがり なし', desc: '12×4（第2・3時）',
      needs: { mode: 1, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 3, name: '2けた くりあがり', desc: '24×3 ／ 32×4 ／ 43×6（第4〜6時）',
      needs: { mode: 2, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 4, name: '3けた', desc: '212×3 ／ 387×4 ／ 406×7（第8・9時）',
      needs: { mode: 3, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true },
    { id: 5, name: 'ぜんぶ いり', desc: '1〜4 を同じ割合で',
      needs: { mode: 4, tries: 3 }, help: 'いちの くらいから うとう', enterKey: true }
  ],
  types: {
    N: '何十×1けた', M: '何百×1けた',
    A: '2けた くりあがりなし', B: '一の位から くりあがり', C: '百の位へ くりあがり', D: 'くりあがり2回',
    E: '3けた くりあがりなし', F: '3けた くりあがり', G: '3けた 空位（十の位が0）'
  },

  // 欄は各1けた。欄の数は型で決まり、答えの大きさでは変わらない
  digitCap: {
    N: { '': 3 },                     // 何十×1けた はふつうの式。答えは最大 90×9=810 の3けた
    A: { '一': 1, '十': 1, '百': 1 }, B: { '一': 1, '十': 1, '百': 1 },
    C: { '一': 1, '十': 1, '百': 1 }, D: { '一': 1, '十': 1, '百': 1 },
    M: { '': 4 },                     // 何百×1けた。最大 900×9=8100 の4けた
    E: { '一': 1, '十': 1, '百': 1, '千': 1 }, F: { '一': 1, '十': 1, '百': 1, '千': 1 },
    G: { '一': 1, '十': 1, '百': 1, '千': 1 }
  },

  tips: '型B〜D・F・Gの誤答を見てください。24×3 なら、「くりあがりを たし忘れる」は 62、' +
    '「くりあがりの数を先に たしてから かける」（(2+1)×3）は 92 になります（正しくは 72）。<br>' +
    '406×7 で 322 は「空位の0を飛ばして 46×7 と計算した」誤りです（指導書は 282 も誤答例に挙げています）。<br>' +
    '型N・Mが遅い児童は九九の想起から遅い可能性があります。九九TAの記録と合わせて見てください。<br>' +
    '初打鍵までの時間は、右から打つ設定では「一の位を出すまで」、左から打つ設定では「いちばん上の位を出すまで」の時間です（同じ児童でも設定で意味が変わります）。',

  // 誤答明細は欄の順（一/十/百/千）で届く。教師には普通の数で見せる
  fmtAnswer: function (type, vals) {
    if (type === 'N' || type === 'M') return vals.join('');
    var s = 0;
    for (var i = vals.length - 1; i >= 0; i--) s = s * 10 + Number(vals[i] || 0);
    return String(s);
  },

  gen: function (rand, mode) {
    var pools = { 1: ['N', 'M'], 2: ['A'], 3: ['B', 'C', 'D'], 4: ['E', 'F', 'G'] };
    var t;
    if (mode === 5) {
      // モード1〜4を同じ割合で選び、その中で型を選ぶ
      t = pick_(rand, pools[pick_(rand, [1, 2, 3, 4])]);
    } else if (pools[mode]) {
      t = pick_(rand, pools[mode]);
    } else {
      throw new Error('かけ算の筆算: モードが不正です');
    }

    var b = ri_(rand, 2, 9), d;   // d：かけられる数の位（d[0]=一の位）
    if (t === 'N') d = [0, ri_(rand, 1, 9)];
    else if (t === 'M') d = [0, 0, ri_(rand, 1, 9)];
    else {
      // 条件を満たすまで引き直す（どの型も満たす組が多く、数回で当たる）
      for (var guard = 0; guard < 500; guard++) {
        b = ri_(rand, 2, 9);
        if (t === 'A' || t === 'B' || t === 'C' || t === 'D') d = [ri_(rand, 1, 9), ri_(rand, 1, 9)];
        else if (t === 'G') d = [ri_(rand, 1, 9), 0, ri_(rand, 1, 9)];
        else d = [ri_(rand, 1, 9), ri_(rand, 1, 9), ri_(rand, 1, 9)];
        if (kakeKind_(d, b) === t) break;
      }
      if (kakeKind_(d, b) !== t) throw new Error('かけ算の筆算: 型 ' + t + ' の問題が作れません');
    }

    if (t === 'N' || t === 'M') {
      // 第1時は「10や100のいくつ分」で九九に帰着させる。筆算の形にせず、ふつうの式で出す
      var a0 = d[d.length - 1] * Math.pow(10, d.length - 1);
      return { t: t, q: [String(a0), '×', String(b)], f: [''], ans: { '': a0 * b }, tag: t + a0 + 'x' + b };
    }
    var a = 0;
    for (var i = d.length - 1; i >= 0; i--) a = a * 10 + d[i];
    var p = a * b;
    var n = (t === 'N' || t === 'A' || t === 'B' || t === 'C' || t === 'D') ? 3 : 4;   // 答えの欄の数
    var keys = ['一', '十', '百', '千'].slice(0, n), ans = {};
    keys.forEach(function (k, j) { ans[k] = Math.floor(p / Math.pow(10, j)) % 10; });

    // 升目は左から [演算子, (千,) 百, 十, 一]。かけられる数・かける数・答えを位でそろえる
    var row1 = [''], row2 = ['×'], row3 = [''];
    for (var c = n - 1; c >= 0; c--) {
      row1.push(c < d.length ? String(d[c]) : '');
      row2.push(c === 0 ? String(b) : '');
      row3.push('_' + c);
    }
    return {
      t: t, q: [String(a), '×', String(b)],
      rows: [row1, row2, row3],
      col: true,
      f: keys, ans: ans,
      tag: t + a + 'x' + b
    };
  }
};

/** かけられる数の位 d（一の位から）とかける数 b から、型を決める（gen の棄却法と検査で使う） */
function kakeKind_(d, b) {
  var c = 0, carries = [];
  for (var i = 0; i < d.length; i++) {
    var v = d[i] * b + c;
    carries.push(v >= 10);
    c = Math.floor(v / 10);
  }
  var any = carries.some(function (x) { return x; });
  if (d.length === 2) {
    if (!carries[0] && !carries[1]) return 'A';
    if (carries[0] && !carries[1]) return 'B';
    if (!carries[0] && carries[1]) return 'C';
    return 'D';
  }
  if (d[1] === 0) return any ? 'G' : 'E0';   // 空位でくりあがり無しは出さない
  return any ? 'F' : 'E';
}
