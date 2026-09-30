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
const win = {}; vm.runInNewContext(src, { window: win });
assert.deepEqual(Object.keys(win.GrowingFigures.GENERATORS).sort(), [...ctx.FLOOR_PATTERNS_].sort());
assert.equal(ctx.floorGenSource_('印の無い html'), '');
const th = fs.readFileSync(path.join(__dirname, '..', 'common', 'teacher.html'), 'utf8');
assert.ok(th.includes('<?!= floorGenForTeacher_() ?>') && th.includes('floorPreviewInit(u.floor)'));
assert.ok(/floor: \{ pattern: UNIT\.floorPattern/.test(fs.readFileSync(path.join(__dirname, '..', 'common', 'Core.gs'), 'utf8')));

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
