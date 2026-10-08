/** 素因数分解。学年に属さない特殊枠。出題・再採点の正本。 */
var UNIT = {
  id: 'factor', category: 'special', grade: null,
  title: '素因数分解タイムアタック！', teacherTitle: '素因数分解 設定・分析',
  units: {}, answerOrder: 'unordered',
  interaction: { kind: 'prime-division', keys: factorPrimes_(179) },
  modes: [
    { id: 1, name: '16まで', desc: '4〜16の合成数・図あり', diagram: true },
    { id: 2, name: '九九まで', desc: '九九に現れる合成数・図あり', diagram: true },
    { id: 3, name: '45まで', desc: '4〜45の合成数・図あり', diagram: true },
    { id: 4, name: '360まで', desc: '4〜360の合成数・図あり', diagram: true },
    { id: 5, name: '九九まで（図なし）', desc: 'モード2と同じ出題範囲', diagram: false },
    { id: 6, name: '360まで（図なし）', desc: 'モード4と同じ出題範囲', diagram: false }
  ],
  types: factorTypes_(),
  digitCap: factorCaps_(),
  // メニューの背景の床は使わない（menuFigure の「正答回数の図」に置き換え）。床の表示・育ちの設定欄は置かない
  defaults: {},
  settings: [],
  floorPattern: 'factor720', floorColor: 'amethyst',
  /** メニューの背景の図形の代わりに、モードの左へ「正答回数の数の図」（素因数で入れ子にした円）を出す。
   *  正答回数＝モードごとの本番の正答 × 育ちの倍率（小数点以下切り捨て）の合計。10000で止める */
  menuFigure: 'factor',
  tips: '図あり・図なしは別モードで記録します。初打鍵は最初の素数を選ぶまでの時間で、分解全体の想起時間ではありません。完成時間には素数キーの選択・縦スクロール・複数回の入力が含まれます。型は素因数の個数（重複を含む）です。',
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
  var max = {1:16, 2:81, 3:45, 4:360, 5:81, 6:360}[mode];
  if (!max) throw new Error('不正なモード');
  var out = [], kuku = mode === 2 || mode === 5;
  for (var n = 4; n <= max; n++) {
    if (factorParts_(n).length < 2) continue;
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
  for (var m = 1; m <= 6; m++) { out[m] = {}; for (var i = 0; i < 8; i++) out[m]['p' + i] = 3; }
  return out;
}

function factorTypes_() {
  var out = {}, names = ['16まで', '九九まで', '45まで', '360まで', '九九まで（図なし）', '360まで（図なし）'];
  // 実際に出題される型だけを宣言する（出ない型を宣言すると教師画面に「宣言だけ残っている」注意が出る）
  for (var m=1;m<=6;m++) factorPool_(m).forEach(function(n){ var p=Math.min(6,factorParts_(n).length); out['m'+m+'p'+p]=names[m-1]+'・'+p+(p===6?'個以上':'個')+'の素因数'; });
  return out;
}
