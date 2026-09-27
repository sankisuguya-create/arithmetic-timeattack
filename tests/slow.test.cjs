'use strict';
// 「遅い」の判定（Core の slowNorm_ / slowBand_ / gradeNorms_）。
// 秒の固定閾値ではなく、同じ学年・同じ型の児童の分布と比べることを確かめる。
const assert = require('node:assert/strict');
const { loadUnit, unitNames } = require('./lib/kit.cjs');
const ctx = loadUnit('kuku');

// 分布：平均と標準偏差（母標準偏差）
const nm = ctx.slowNorm_([1000, 2000, 3000, 4000, 5000]);
assert.equal(nm.n, 5); assert.equal(nm.mean, 3000); assert.equal(nm.sd, 1414);

// 段階：0 平均以下／1 +1SD以内／2 +1SD超／3 +2SD超
assert.equal(ctx.slowBand_(3000, nm), 0);
assert.equal(ctx.slowBand_(4000, nm), 1);
assert.equal(ctx.slowBand_(4500, nm), 2);
assert.equal(ctx.slowBand_(6000, nm), 3);
// 比べる児童が少ない・ばらつきが無い・分布が無いときは判定しない
assert.equal(ctx.slowBand_(9000, ctx.slowNorm_([1000, 2000, 3000, 4000])), -1);
assert.equal(ctx.slowBand_(9000, ctx.slowNorm_([2000, 2000, 2000, 2000, 2000])), -1);
assert.equal(ctx.slowBand_(9000, undefined), -1);

// 学年×型ごとに分かれ、試行の少ない児童は分布に入らない
const kids = [];
for (let i = 0; i < 6; i++) kids.push({ grade: 3, t: { A: { n: 5, ms: 1000 + i * 100 }, B: { n: 5, ms: 5000 + i * 500 } } });
kids.push({ grade: 3, t: { A: { n: 2, ms: 99999 } } });            // 2回だけ：外れ値でも分布を動かさない
kids.push({ grade: 5, t: { A: { n: 5, ms: 9000 } } });
const g = ctx.gradeNorms_(kids);
assert.equal(g[3].A.n, 6); assert.equal(g[3].A.mean, 1250);
assert.equal(g[3].B.mean, 6250);
assert.equal(g[5].A.n, 1);
// 同じ 3000ms でも、速い型 A では遅く、遅い型 B では速い（秒の固定閾値ではこうならない）
assert.ok(ctx.slowBand_(3000, g[3].A) >= 2);
assert.equal(ctx.slowBand_(3000, g[3].B), 0);

// 本人の中で遅い型（◆）：全体に遅い子でも、他の型より偏差値が10以上低い型だけに付く
const t1 = { A: { dv: 30 }, B: { dv: 32 }, C: { dv: 31 }, D: { dv: 15 } };
ctx.markSelfSlow_(t1);
assert.ok(t1.D.self && !t1.A.self && !t1.B.self && !t1.C.self);
const t2 = { A: { dv: 30 }, B: { dv: 31 }, C: { dv: 29 } };    // 一様に遅い子には付かない
ctx.markSelfSlow_(t2);
assert.ok(!t2.A.self && !t2.B.self && !t2.C.self);
const t3 = { A: { dv: 60 }, B: { dv: 30 } };                    // 型が3つ未満は判定しない
ctx.markSelfSlow_(t3);
assert.ok(!t3.B.self);

// 単元に秒の閾値を残していないこと
for (const name of unitNames()) {
  const u = loadUnit(name).UNIT;
  assert.ok(!('slow_ms' in (u.defaults || {})), name + ': slow_ms は使わない（Core が分布で判定する）');
}
assert.ok(!('slow_ms' in ctx.BASE_DEFAULTS) && !('slow_tk_ms' in ctx.BASE_DEFAULTS));
console.log('slow judgement: per grade x type distribution, bands and guards passed.');
