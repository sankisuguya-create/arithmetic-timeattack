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

console.log('floor: ok');
