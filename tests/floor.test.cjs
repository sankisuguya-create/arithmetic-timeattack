'use strict';
// 背景の床の育ちやすさ（Core の floorPace_ / bests_ の floor）。
// 根拠は docs/ARCHITECTURE.md「背景の床」と Core.gs の floorPace_ の説明。
const assert = require('node:assert/strict');
const { loadUnit } = require('./lib/kit.cjs');
const ctx = loadUnit('kuku');

// 記録が無いときは事前値（1分20問）
const p0 = ctx.floorPace_(null);
[1, 2, 3, 4].forEach(m => assert.equal(p0[m], 20));

// 記録が増えるほど実際の速さに寄る。モード1＝1分30問を100分、モード2＝1分10問を100分
const st = { '*': { tc: { 1: 3000, 2: 1000 }, sec: { 1: 6000, 2: 6000 } } };
const p = ctx.floorPace_(st);
assert.ok(Math.abs(p[1] - (3000 + 200) / 110) < 0.01, JSON.stringify(p));
assert.ok(Math.abs(p[2] - (1000 + 200) / 110) < 0.01, JSON.stringify(p));
assert.equal(p[3], 20);                     // 記録の無いモードは事前値のまま

// 解きにくいモードほど1問の重みが大きい：同じ正答30問でも、モード2の方が標準の分数が大きい
ctx.summaryIndex_ = () => Object.assign({
  a: { best: {}, prac: {}, stars: {}, tries: {}, tcm: { 1: 30 } },
  b: { best: {}, prac: {}, stars: {}, tries: {}, tcm: { 2: 30 } }
}, st);
const fa = ctx.bests_('a', 60).floor, fb = ctx.bests_('b', 60).floor;
assert.ok(fb.min > fa.min * 2.5, JSON.stringify([fa, fb]));
// 平均的な速さで1分解いた児童は、どのモードでもおよそ1分ぶん育つ
ctx.summaryIndex_ = () => Object.assign({
  c: { best: {}, prac: {}, stars: {}, tries: {}, tcm: { 1: p[1], 2: p[2] } }
}, st);
assert.ok(Math.abs(ctx.bests_('c', 60).floor.min - 2) < 0.02);

// 床の第二の色：宣言した宝石の色が返る。一覧に無い名前は validateUnit_ が落とす
assert.equal(ctx.floorColor_(), '#8A6CE5');
ctx.UNIT.floorColor = 'ruby';
assert.ok(ctx.validateUnit_().some(x => /floorColor/.test(x)));
ctx.UNIT.floorColor = 'amethyst';

// 床の図形：宣言できるのは一覧の id だけ。九九は八角の星・すみれ、あまりのあるわり算はペンローズ・サファイア
assert.equal(ctx.UNIT.floorPattern, 'octagon');
const dm = loadUnit('divmod');
assert.equal(dm.UNIT.floorPattern, 'penrose');
assert.equal(dm.floorColor_(), '#3D6FD6');
assert.ok(!dm.validateUnit_().some(x => /floor/.test(x)), JSON.stringify(dm.validateUnit_()));
dm.UNIT.floorPattern = 'pinwheel';
assert.ok(dm.validateUnit_().some(x => /floorPattern/.test(x)));

// 「1正答あたりの育ち」の基準の速さは、サーバーと画面で同じ値（どちらかだけ変えると、教師画面の説明と実際の育ちがずれる）
const fs = require('fs'), path = require('path');
const ui = fs.readFileSync(path.join(__dirname, '..', 'common', 'index.html'), 'utf8');
assert.equal(Number((/var FLOOR_REF = (\d+);/.exec(ui) || [])[1]), ctx.FLOOR_REF_PER_MIN_);
// 床を出す単元は 1正答あたりの設定を持つ（1分あたりの旧設定は残さない。保存済みの値が別の意味で読まれるのを防ぐ）
[ctx, dm].forEach(c => {
  const keys = (c.UNIT.settings || []).map(s => s.key);
  assert.ok(keys.includes('floor_per_answer') && !keys.includes('floor_per_min'), keys.join(','));
});

// 長さのたんい＝巻き尺の渦、おもさ＝円弧の曼荼羅。既存の表示設定（まきじゃく・はかり）はそのまま残る
[['length', 'tape', 'ruler_tape'], ['weight', 'mandala', 'dial_size']].forEach(([u, pat, keep]) => {
  const c = loadUnit(u);
  assert.equal(c.UNIT.floorPattern, pat);
  assert.equal(c.floorColor_(), '#8A6CE5');
  const keys = (c.UNIT.settings || []).map(s => s.key);
  assert.ok(keys.includes(keep) && keys.includes('floor_on') && keys.includes('floor_per_answer'), u + ': ' + keys.join(','));
  assert.ok(!c.validateUnit_().some(x => /floor|settings/.test(x)), u + ': ' + JSON.stringify(c.validateUnit_()));
});
// 宣言できる図形の一覧は、画面に写した生成器と一致する（片方だけ増やすと、宣言しても画面でペンローズに落ちる）
const genIds = [...ui.matchAll(/^    (\w+):\s+\{ name: '/gm)].map(m => m[1]);
assert.deepEqual([...ctx.FLOOR_PATTERNS_].sort(), [...genIds].sort());

// 教師画面の床のプレビュー：児童の画面と同じ生成器を、index.html の印の間から切り出して埋め込む（写しを2つにしない）
const vm = require('vm');
// GAS の include（HtmlService の getContent）は JS のコメントを消して返す。サーバーが実際に見る形で切り出す
const stripComments = h => h.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const src = ctx.floorGenSource_(stripComments(ui));
assert.ok(src.length > 1000, '印（FLOOR_GEN_BEGIN / FLOOR_GEN_END）の間が見つからない');
const win = {}, genBox = { window: win }; vm.runInNewContext(src, genBox);
assert.deepEqual(Object.keys(win.GrowingFigures.GENERATORS).sort(), [...ctx.FLOOR_PATTERNS_].sort());
assert.equal(ctx.floorGenSource_('印の無い html'), '');
// 印の字面は index.html に1回ずつだけ（コメントに同じ字面があると、生のファイルを読んだときにコメントの中から切り出す）
for (const m of ["'FLOOR_GEN_BEGIN';", "'FLOOR_GEN_END';"]) assert.equal(ui.split(m).length - 1, 1, m + ' が複数ある');
// 写しのピン：コメントが指すコミットの原本（tests/fixtures/generators.<sha>.js）と、印の間は一字一句一致する。
// ずらせるのは末尾の受け取り側だけ（写し元の (this) → strict な画面の (window)）。コミットを進めるときはピンと原本を一緒に進める
const pin = ui.match(/写し元: sankisuguya-create\/design growing-figures\/generators\.js @ ([0-9a-f]+)/);
assert.ok(pin, 'index.html に写し元ピンが無い');
const fxDir = path.join(__dirname, 'fixtures');
assert.deepEqual(fs.readdirSync(fxDir).filter(f => /^generators\.[0-9a-f]+\.js$/.test(f)), ['generators.' + pin[1] + '.js'],
  '原本はピンのコミットのもの1つだけ置く（古い原本は捨てる）');
const orig = fs.readFileSync(path.join(fxDir, 'generators.' + pin[1] + '.js'), 'utf8').replace(/\s+$/, '').split('\n');
assert.equal(orig[orig.length - 1], '})(this);', '原本の末尾は (this)');
const seg = ui.split("'FLOOR_GEN_BEGIN';")[1].split("'FLOOR_GEN_END';")[0].replace(/^[^\n]*\n/, '').replace(/\s+$/, '').split('\n');
assert.equal(seg[seg.length - 1], '})(window);   // 写し元は (this)。この画面は strict なので window を渡す', '写しの末尾は (window) を受け取る');
seg[seg.length - 1] = '})(this);';
assert.deepEqual(seg, orig, 'FLOOR_GEN の写しがピンの原本と食い違う（先頭の印の行と末尾の受け取り以外は一字一句同じ）');
// コメントが消えない経路（生のファイル）でも同じ生成器を切り出せる
const winRaw = {}; vm.runInNewContext(ctx.floorGenSource_(ui), { window: winRaw });
assert.deepEqual(Object.keys(winRaw.GrowingFigures.GENERATORS).sort(), [...ctx.FLOOR_PATTERNS_].sort());
const th = fs.readFileSync(path.join(__dirname, '..', 'common', 'teacher.html'), 'utf8');
assert.ok(th.includes('<?!= floorGenForTeacher_() ?>') && th.includes('floorPreviewInit(u.floor)'));
assert.ok(/floor: \{ pattern: UNIT\.floorPattern/.test(fs.readFileSync(path.join(__dirname, '..', 'common', 'Core.gs'), 'utf8')));

// 床の共有部品（色の系統・3層の進み・描画の定数・菱形のパス）は FLOOR_UI 区画に1か所だけ。
// 教師画面は同じものを埋め込み側が受け取るので、自分の実装を持たない
for (const m of ["'FLOOR_UI_BEGIN';", "'FLOOR_UI_END';"]) assert.equal(ui.split(m).length - 1, 1, m + ' が複数ある');
['floorFam_', 'floorProg_', 'floorPoly_', 'FLOOR_Q', 'FLOOR_LINE', 'FLOOR_A'].forEach(name => {
  assert.ok(src.includes(name), 'FLOOR_UI 区画に ' + name + ' が無い');
  assert.ok(genBox[name] !== undefined, name + ' が共有区画から見えない');
});
assert.deepEqual(JSON.parse(JSON.stringify(genBox.floorProg_(45, 30, 10, 5))), { line: 30, thick: 10, thin: 5 }, '3層の進み');
assert.deepEqual(JSON.parse(JSON.stringify(genBox.floorProg_(20, 30, 10, 5))), { line: 20, thick: 0, thin: 0 }, '輪郭の途中');
assert.equal(genBox.floorFam_('#35D0A5').length, 5, '色の系統は5段');
assert.equal(genBox.FLOOR_A.line, 0.18);
// 教師画面のプレビューは共有部品を呼ぶだけ（写しの実装を持たない。旧 .22 の枠線逸脱は FLOOR_A.line に収束）
assert.ok(!th.includes('function fpFam') && !th.includes('function fpPoly'), 'teacher.html に写しの実装が残っている');
assert.ok(!th.includes('16,23,40,.22'), '枠線の .22 逸脱が残っている');
assert.ok(th.includes('floorProg_(Math.floor(tc * fpPer())'), 'teacher 側も floorProg_ を呼ぶ');
// 児童側も同じ正本を呼ぶ（標準の分数 → 枚数の変換だけ画面側で持つ）
assert.ok(ui.includes('function floorProgMin_') && ui.includes('floorProg_(Math.floor(min * floorRate_())'), 'index 側の floorProgMin_ が正本を呼んでいない');

// 児童の見返しボタン：左下に1つ。模様はその際で薄める（ボタンの上に模様が濃く重ならない）
assert.ok(ui.includes('id="floorReplay"') && /FLOOR_MASK_SEL = '[^']*#floorReplay/.test(ui));
// 円と球＝起点2つ（円＝鱗のピルの渦、球＝フィボナッチ球）。どのタイルも育つ順の値 o（0〜1）を持ち、共通エンジンはその順に並べる
const ci = loadUnit('circle');
assert.equal(ci.UNIT.floorPattern, 'circlesphere');
assert.equal(ci.floorColor_(), '#8A6CE5');
assert.ok(!ci.validateUnit_().some(x => /floor|settings/.test(x)), JSON.stringify(ci.validateUnit_()));
const cs = win.GrowingFigures.GENERATORS.circlesphere.make({ W: 1366, H: 768, ox: 191, oy: 599, edge: 25.6, margin: 51 });
assert.ok(cs.length > 1200 && cs.every(t => t.o >= 0 && t.o <= 1), 'circlesphere の o');
assert.ok(/F\.byO \? function\(a, b\)\{ return a\.o - b\.o; \}/.test(ui), '児童の画面が o の順に並べる');
assert.ok(/byO \? function\(a, b\)\{ return a\.o - b\.o; \}/.test(th), '教師画面のプレビューが o の順に並べる');

console.log('floor: ok');
