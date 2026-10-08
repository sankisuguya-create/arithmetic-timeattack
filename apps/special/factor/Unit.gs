/** 素因数分解。学年に属さない特殊枠。出題・再採点の正本。 */
var UNIT = {
  id: 'factor', category: 'special', grade: null,
  title: '素因数分解タイムアタック！',
  // 児童メニューのタイトルのふりがな。[漢字, 読み] か、読みの要らない文字列を並べる（つなぐと title と同じ文字列になる）
  titleRuby: [['素','そ'],['因','いん'],['数','すう'],['分','ぶん'],['解','かい'],'タイムアタック！'], teacherTitle: '素因数分解 設定・分析',
  units: {}, answerOrder: 'unordered',
  interaction: { kind: 'prime-division', keys: factorPrimes_(179) },   // モードが keys を持つ時はそちらを使う（今は使うモードなし）
  modes: [
    { id: 1, name: '16まで', desc: '4〜16の合成数', diagram: true },
    { id: 2, name: '九九まで', desc: '九九に現れる合成数', diagram: true },
    { id: 3, name: '360まで(素数〜13)', desc: '360までの合成数で、素因数が2・3・5・7・11・13だけのもの', diagram: true },
    { id: 4, name: '360まで(素数〜97)', desc: '360までの合成数で、最大の素因数が97以下のもの', diagram: true },
    // 画面では5・6番目。id 5・6 は旧「図なし」の記録をそのまま引き継ぐために図なし側へ回したので、7・8にする。
    // 1024＝2の10乗は、このモードで最も長い分解（因数10個）
    { id: 7, name: '1024まで(素数〜13)', desc: '1024までの合成数で、素因数が2・3・5・7・11・13だけのもの', diagram: true },
    { id: 8, name: '1024まで(素数〜97)', desc: '1024までの合成数で、最大の素因数が97以下のもの', diagram: true },
    // 図なし。pair のモードと同じ出題範囲・同じ公開設定で、記録だけ分ける。メニューでは左下の切り替えで出す。
    // 5・6 は旧モード5「九九まで（図なし）」・旧モード6「360まで（図なし）」の id。既存の記録をそのまま使う
    { id: 11, name: '16まで（図なし）', desc: 'モード1と同じ出題範囲', diagram: false, pair: 1 },
    { id: 5, name: '九九まで（図なし）', desc: 'モード2と同じ出題範囲', diagram: false, pair: 2 },
    { id: 13, name: '360まで(素数〜13)（図なし）', desc: 'モード3と同じ出題範囲', diagram: false, pair: 3 },
    { id: 6, name: '360まで(素数〜97)（図なし）', desc: 'モード4と同じ出題範囲', diagram: false, pair: 4 },
    { id: 17, name: '1024まで(素数〜13)（図なし）', desc: 'モード7と同じ出題範囲', diagram: false, pair: 7 },
    { id: 18, name: '1024まで(素数〜97)（図なし）', desc: 'モード8と同じ出題範囲', diagram: false, pair: 8 }
  ],
  // 図なしは図形の育ちを3倍にする（倍率の上限。教師画面の全般設定で変えられる）
  growWeights: { 11: 3, 5: 3, 13: 3, 6: 3, 17: 3, 18: 3 },
  types: factorTypes_(),
  digitCap: factorCaps_(),
  // メニューの背景の床は使わない（menuFigure の「正答回数の図」に置き換え）。床の表示・育ちの設定欄は置かない
  defaults: {},
  settings: [],
  floorPattern: 'factor720', floorColor: 'amethyst',
  /** メニューの背景の図形の代わりに、モードの左へ「正答回数の数の図」（素因数で入れ子にした円）を出す。
   *  正答回数＝モードごとの本番の正答 × 育ちの倍率（小数点以下切り捨て）の合計。10000で止める */
  menuFigure: 'factor',
  tips: '図あり・図なしは別モード（5・6・11・13・17・18が図なし。5・6は旧「図なし」の記録を引き継ぐ）で記録します。公開は図ありのモードの設定に従います。初打鍵は最初の素数を選ぶまでの時間で、分解全体の想起時間ではありません。完成時間には素数キーの選択・縦スクロール・複数回の入力が含まれます。型は素因数の個数（重複を含む）です。',
  fmtAnswer: function (type, vals) { return vals.filter(function(v){ return Number(v) > 0; }).join(' × '); },
  gen: function (rand, mode) {
    var pool = factorPool_(mode);
    return factorItem_(pool[Math.floor(rand() * pool.length)], mode);
  },
  // 同じ問題は一巡するまで再出題しない。rand は署名されたシード由来。
  queue: function (rand, mode, count) {
    var out = [], last = 0;
    while (out.length < count) {
      var bag = factorPool_(mode).slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1)), v = bag[i]; bag[i] = bag[j]; bag[j] = v;
      }
      if (bag[0] === last) { var t = bag[0]; bag[0] = bag[1]; bag[1] = t; }
      for (var k = 0; k < bag.length && out.length < count; k++) out.push(factorItem_(bag[k], mode));
      last = bag[bag.length - 1];
    }
    return out;
  }
};
// UNIT の宣言より前に評価されるよう、変数ではなく関数で持つ
function factorModes_() { return [1, 2, 3, 4, 7, 8, 11, 5, 13, 6, 17, 18]; }
/** 図なしのモードを、出題範囲の元になる図ありのモードに写す */
function factorBase_(mode) { return { 11: 1, 5: 2, 13: 3, 6: 4, 17: 7, 18: 8 }[mode] || Number(mode); }
function factorPrimes_(max) {
  var out = [];
  for (var n = 2; n <= max; n++) {
    var ok = true;
    for (var d = 2; d * d <= n; d++) if (n % d === 0) { ok = false; break; }
    if (ok) out.push(n);
  }
  return out;
}
function factorParts_(n) {
  var out = [];
  for (var p = 2; p * p <= n; p++) while (n % p === 0) { out.push(p); n /= p; }
  if (n > 1) out.push(n);
  return out;
}
function factorPool_(mode) {
  var base = factorBase_(mode);
  var max = {1:16, 2:81, 3:360, 4:360, 7:1024, 8:1024}[base], maxP = {3:13, 4:97, 7:13, 8:97}[base] || 0;
  if (!max) throw new Error('不正なモード');
  var out = [], kuku = base === 2;
  for (var n = 4; n <= max; n++) {
    var parts = factorParts_(n);
    if (parts.length < 2) continue;
    if (maxP && parts[parts.length - 1] > maxP) continue;   // 大きな素数を因数に持つ数は出さない
    if (kuku) {
      var inTable = false;
      for (var a = 1; a <= 9; a++) if (n % a === 0 && n / a <= 9) { inTable = true; break; }
      if (!inTable) continue;
    }
    out.push(n);
  }
  return out;
}
function factorItem_(n, mode) {
  var parts = factorParts_(n), f = [], ans = {};
  parts.forEach(function(p, i){ var key = 'p' + i; f.push(key); ans[key] = p; });
  return { t: 'm' + mode + 'p' + Math.min(6, parts.length), q: [String(n)], f: f, ans: ans, tag: String(n) };
}
function factorCaps_() {
  var out = {};
  factorModes_().forEach(function (m) { out[m] = {}; for (var i = 0; i < 10; i++) out[m]['p' + i] = 3; });
  return out;
}

function factorTypes_() {
  var out = {}, names = { 1: '16まで', 2: '九九まで', 3: '360まで(素数〜13)', 4: '360まで(素数〜97)', 7: '1024まで(素数〜13)', 8: '1024まで(素数〜97)' };
  // 実際に出題される型だけを宣言する（出ない型を宣言すると教師画面に「宣言だけ残っている」注意が出る）
  factorModes_().forEach(function (m) { factorPool_(m).forEach(function(n){ var p=Math.min(6,factorParts_(n).length); var b=factorBase_(m); out['m'+m+'p'+p]=names[b]+(b!==m?'（図なし）':'')+'・'+p+(p===6?'個以上':'個')+'の素因数'; }); });
  return out;
}
