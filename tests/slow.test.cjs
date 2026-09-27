'use strict';
// 「遅い」の判定（Core の slowNorm_ / slowBand_ / gradeNorms_ / markSelfSlow_ / typeStat_）。
// 根拠は docs/ARCHITECTURE.md「遅いの判定」。
const assert = require('node:assert/strict');
const { loadUnit, unitNames } = require('./lib/kit.cjs');
const ctx = loadUnit('kuku');
const ln = Math.log;

// 分布は対数時間の中央値と MAD×1.4826
const ms = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900];
const nm = ctx.slowNorm_(ms);
assert.equal(nm.n, 10);
assert.ok(Math.abs(nm.med - (ln(1400) + ln(1500)) / 2) < 1e-9);
assert.ok(nm.s > 0);

// 外れ値に強い：1人を極端に遅くしても中心と広がりがほとんど動かない（平均・SDなら大きく動く）
const nm2 = ctx.slowNorm_(ms.slice(0, 9).concat([60000]));
assert.ok(Math.abs(nm2.med - nm.med) < 0.08 && Math.abs(nm2.s - nm.s) / nm.s < 0.35, JSON.stringify([nm, nm2]));

// 段階：0 中央以下／1 +1σ以内／2 +1σ超／3 +2σ超
const at = z => Math.exp(nm.med + z * nm.s);
assert.equal(ctx.slowBand_(at(-0.5), nm), 0);
assert.equal(ctx.slowBand_(at(0.5), nm), 1);
assert.equal(ctx.slowBand_(at(1.5), nm), 2);
assert.equal(ctx.slowBand_(at(2.5), nm), 3);
// 比べる児童が少ない・ばらつきが無い・分布が無いときは判定しない
assert.equal(ctx.slowBand_(9000, ctx.slowNorm_(ms.slice(0, 9))), -1);
assert.equal(ctx.slowBand_(9000, ctx.slowNorm_(Array(12).fill(2000))), -1);
assert.equal(ctx.slowBand_(9000, undefined), -1);

// 学年×型ごとに分かれ、回数の少ない児童は分布に入らない
const kids = [];
for (let i = 0; i < 12; i++) kids.push({ grade: 3, t: { A: { n: 6, ms: 1000 + i * 50 }, B: { n: 6, ms: 5000 + i * 300 } } });
kids.push({ grade: 3, t: { A: { n: 4, ms: 99999 } } });            // 4回だけ：分布を動かさない
kids.push({ grade: 5, t: { A: { n: 6, ms: 9000 } } });
const g = ctx.gradeNorms_(kids);
assert.equal(g[3].A.n, 12); assert.equal(g[5].A.n, 1);
// 同じ 3000ms でも、速い型 A では遅く、遅い型 B では速い（秒の固定閾値ではこうならない）
assert.ok(ctx.slowBand_(3000, g[3].A) >= 2);
assert.equal(ctx.slowBand_(3000, g[3].B), 0);

// ◆：本人の偏差値の中央より10以上低く、かつ標準誤差の2倍を超える型だけ
const t1 = { A: { dv: 30, se: 2 }, B: { dv: 32, se: 2 }, C: { dv: 31, se: 2 }, D: { dv: 15, se: 2 } };
ctx.markSelfSlow_(t1);
assert.ok(t1.D.self && !t1.A.self && !t1.B.self && !t1.C.self);
const t2 = { A: { dv: 30, se: 2 }, B: { dv: 31, se: 2 }, C: { dv: 29, se: 2 } };   // 一様に遅い子には付かない
ctx.markSelfSlow_(t2);
assert.ok(!t2.A.self && !t2.B.self && !t2.C.self);
const t3 = { A: { dv: 60, se: 1 }, B: { dv: 30, se: 1 } };                          // 型が3つ未満は判定しない
ctx.markSelfSlow_(t3);
assert.ok(!t3.B.self);
const t4 = { A: { dv: 50, se: 8 }, B: { dv: 50, se: 8 }, C: { dv: 38, se: 8 } };   // 差12でも揺れ(2×8)以内なら付けない
ctx.markSelfSlow_(t4);
assert.ok(!t4.C.self);

// type_stats：新形式（対数の和あり）と、対数の和が無い旧形式の両方を読む
const nw = ctx.typeStat_('A:3:9000:3:6000:12500000:' + (ln(1000) + ln(2000) + ln(3000)) + ':0');
assert.equal(nw.ntk, 3); assert.ok(Math.abs(nw.ln - ln(6e9)) < 1e-9);
const old = ctx.typeStat_('A:3:9000:3:6000:12500000');
assert.ok(Math.abs(old.ln - 3 * ln(2000)) < 1e-9);
assert.equal(ctx.typeStat_('A:3:9000'), null);
// 代表値は幾何平均
const ro = ctx.recallOut_({ ntk: 2, tk: 5000, tk2: 1000 * 1000 + 4000 * 4000, ln: ln(1000) + ln(4000), ln2: ln(1000) ** 2 + ln(4000) ** 2 });
assert.equal(ro.ms, 2000);

// 単元に秒の閾値を残していないこと
for (const name of unitNames()) {
  const u = loadUnit(name).UNIT;
  assert.ok(!('slow_ms' in (u.defaults || {})), name + ': slow_ms は使わない（Core が分布で判定する）');
}
assert.ok(!('slow_ms' in ctx.BASE_DEFAULTS) && !('slow_tk_ms' in ctx.BASE_DEFAULTS));
console.log('slow judgement: log scale, median/MAD, guards, self-profile and legacy rows passed.');
