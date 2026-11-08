'use strict';
// 用語モード（TERMS_ / termDeck_）と抜け一覧（gapsOf_）、円と球の誤概念の読み取り（wrongLabel）
const assert = require('node:assert/strict');
const { loadUnit, unitNames } = require('./lib/kit.cjs');

const c = loadUnit('circle');

/* ---------- 台帳 ---------- */
const ids = c.TERMS_.map(x => x.id);
assert.equal(new Set(ids).size, ids.length, 'TERMS_ の id が重複');
for (const x of c.TERMS_) {
  assert.ok(x.name && x.yomi && x.grade >= 1 && x.grade <= 6, x.id + ' の宣言');
  const svg = x.fig(c.rng_(1), '#35D0A5');
  assert.match(svg, /^<svg [^>]*viewBox="0 0 400 300"/, x.id + ' の図');
  assert.ok(!/NaN|undefined/.test(svg), x.id + ' の図に NaN');
}
// 宣言した用語は台帳にある（全単元）
for (const u of unitNames()) {
  const ctx = loadUnit(u);
  (ctx.UNIT.terms || []).forEach(id => assert.ok(ctx.termById_(id), u + ' の用語 ' + id));
}

/* ---------- 今日の束 ---------- */
const d0 = c.termDeck_(c.UNIT.terms, {}, 3, c.rng_(7));
assert.deepEqual(d0.map(x => x.id), c.UNIT.terms, 'この単元の用語が先・既習はまだ無い（円と球が台帳の先頭）');
assert.ok(d0.every(x => x.figs.length === c.TERM_FIGS_), '図の向きの数');
const d1 = c.termDeck_(c.UNIT.terms, { radius: { n: 5, at: 1 } }, 3, c.rng_(7));
assert.equal(d1.find(x => x.id === 'radius').n, 5);
// 後ろの単元から見ると、台帳で前にある用語が既習。しばらく出していない順に TERM_PAST_N_ 個
c.TERMS_.push({ id: 'zz', grade: 3, unit: 'zz', name: 'ぜっと', yomi: 'ぜっと', fig: () => '<svg viewBox="0 0 400 300"></svg>' });
const seen = { circle: { n: 3, at: 50 }, center: { n: 3, at: 10 }, radius: { n: 3, at: 30 }, diameter: { n: 3, at: 20 }, sphere: { n: 3, at: 40 } };
const d2 = c.termDeck_(['zz'], seen, 3, c.rng_(1));
assert.deepEqual(d2.map(x => x.id), ['zz', 'center', 'diameter']);
assert.deepEqual(d2.map(x => x.cur), [true, false, false]);
// 用語の無い単元：下の学年の用語だけ（3年の用語は4年から既習、2年からは出ない）
assert.deepEqual(c.termDeck_([], {}, 2, c.rng_(1)).map(x => x.id), []);
assert.equal(c.termDeck_([], {}, 4, c.rng_(1)).length, c.TERM_PAST_N_);
c.TERMS_.pop();

/* ---------- 誤概念の読み取り ---------- */
const wl = c.UNIT.wrongLabel;
assert.equal(wl('B', 'B:rad-short-chord-off', '1', '3'), '半分の長さの線（弦）を半径とみる');
assert.equal(wl('C', 'C:hchord-dia-rad-part', '2', '1'), '横の端から端（中心を通らない）を直径とみる');
assert.equal(wl('A', 'A:center-near-mid-edge', '1', '4'), '中心からずれた点を中心とみる');
assert.equal(wl('D', 'D:12cm', '24', '12'), '半径と直径を取りちがえる');
assert.equal(wl('D', 'D:12cm', '24', '25'), '');
assert.equal(wl('I', 'I:3こ ちょっけい10', '30', '15'), 'ボール1こ分を半径で数える');
// gen が返すタップの問いのすべての誤答の選択肢に誤概念が付く
const rand = c.rng_(3);
for (let i = 0; i < 300; i++) {
  const it = c.UNIT.gen(rand, 1 + (i % 4));
  if (!/^[ABCF]$/.test(it.t)) continue;
  for (let g = 1; g <= 4; g++) {
    if (g === it.ans['']) continue;
    assert.ok(wl(it.t, it.tag, String(it.ans['']), String(g)), it.tag + ' の ' + g);
  }
}

/* ---------- 抜け一覧 ---------- */
const order = Object.keys(c.UNIT.types);
const J = o => JSON.parse(JSON.stringify(o));
// 判定できる型が無い
assert.equal(c.gapsOf_({ A: 3 }, { A: 1 }, {}, {}, order).st, 'few');
// 本人の中で B だけ誤答が多い
let g = J(c.gapsOf_({ A: 18, B: 8, C: 17, D: 18 }, { A: 2, B: 12, C: 3, D: 2 }, {}, {}, order));
assert.equal(g.st, 'ok');
assert.deepEqual(g.items.map(x => [x.t, x.k]), [['B', 'miss']]);
// 誤概念を2回以上 → 先頭に。1回は出さない
g = J(c.gapsOf_({ A: 18, B: 8, C: 17 }, { A: 2, B: 12, C: 3 }, { 'B|弦を半径とみる': 3, 'C|半径を直径とみる': 1 }, {}, order));
assert.deepEqual(g.items.map(x => x.k), ['wrong', 'miss']);
assert.equal(g.items[0].txt, '弦を半径とみる');
// どの型も誤答が多い → flat（型の差は無いので miss は出ない）
g = J(c.gapsOf_({ A: 6, B: 6, C: 6 }, { A: 6, B: 6, C: 6 }, {}, {}, order));
assert.equal(g.st, 'flat'); assert.equal(g.items.length, 0);
// ◆（遅い）を拾う・最大3件
g = J(c.gapsOf_({ A: 20 }, { A: 0 }, { 'A|a': 2, 'B|b': 3, 'C|c': 4 }, { D: { self: true, n: 9 } }, order));
assert.equal(g.items.length, c.GAP_MAX_);
assert.deepEqual(g.items.map(x => x.txt), ['c', 'b', 'a']);

console.log('terms / gaps OK');
