'use strict';
// 何倍でしょう 固有の検査。契約（宣言の形・採点の往復）は contract.test.cjs が見る。
const assert = require('assert');
const { loadUnit, uiContext } = require('./lib/kit.cjs');

const ctx = loadUnit('bai');
const unit = ctx.UNIT;
const ALLOWED = { 1: 'A', 2: 'DE', 3: 'S', 4: 'FGH', 5: 'IJ', 6: 'ADESFGHIJ' };
const num = (tag, key) => Number((tag.match(new RegExp(' ' + key + '(\\d+)')) || [])[1]);
const seen = new Set(), ords = { o: 0, r: 0 }, uses = { 1: 0, 2: 0, 3: 0 };

function check(it, mode) {
  assert.ok(ALLOWED[mode].includes(it.t), mode + ' ' + it.t);
  seen.add(it.t);
  assert.ok(!/[,|]/.test(it.tag), it.tag);
  assert.ok(it.fig.startsWith('<svg') && it.fig.length < 4000 && !/NaN|undefined/.test(it.fig), it.tag);
  const f = it.f[0], a = it.ans[f];
  assert.ok(Number.isInteger(a) && a >= 1 && a <= 99, it.tag + ' ' + a);
  const m = num(it.tag, 'm'), k = num(it.tag, 'k');
  const u = Number((it.tag.match(/u(\d)([or])/) || [])[1]);
  const o = (it.tag.match(/u\d([or])/) || [])[1];
  if (u) { uses[u]++; ords[o]++; assert.ok(m >= 2 && m <= 9 && k >= 2 && k <= 9); }
  if (it.t === 'A') {
    const order = it.tag.split(' ')[1].split('-');
    assert.equal(order[a - 1], 'small');
  } else if (it.t === 'S') {
    const order = it.tag.split(' ')[0].slice(2).split('-');
    assert.equal(order[a - 1], u === 2 ? 'mul' : 'div');
    // 正しい式の値が場面の答えと一致すること（文に出る数から式が成り立つ）
  } else if (it.t === 'D' || it.t === 'E') {
    const ask = it.tag.split('ア=')[1];
    assert.equal(a, { m, k, c: m * k }[ask]);
    assert.equal(f, ask === 'k' ? '倍' : 'cm');
    assert.notEqual(ask, ['k', 'c', 'm'][u - 1], 'ア に問う量が未知の量になっている');
  } else if (it.t === 'F') assert.equal(a, k);
  else if (it.t === 'G') assert.equal(a, m * k);
  else if (it.t === 'H') assert.equal(a, m);
  else if (it.t === 'I') assert.equal(a, num(it.tag, 'a') * num(it.tag, 'b'));
  else if (it.t === 'J') assert.equal(a, num(it.tag, 'm') * num(it.tag, 'a') * num(it.tag, 'b'));
  // 文の中の数と答え：第3用法で c と k が文に出ていること（N1 の誤答値 c×k を記録で読むため）
  if (it.t === 'H') assert.ok(it.fig.includes((m * k) + 'cm') && it.fig.includes(k + '倍'));
}

for (let mode = 1; mode <= 6; mode++) {
  const rand = ctx.rng_(20260927 + mode);
  for (let i = 0; i < 5000; i++) check(unit.gen(rand, mode), mode);
  for (const edge of [0, 0.999999999]) check(unit.gen(() => edge, mode), mode);
}
assert.equal(seen.size, Object.keys(unit.types).length);

// 語順は半々、第1〜第3用法は 1:1:1（どれかに偏ると N1・N2 が表に出ない）
const tot = ords.o + ords.r;
assert.ok(Math.abs(ords.o / tot - 0.5) < 0.03, JSON.stringify(ords));
const ut = uses[1] + uses[2] + uses[3];
[1, 2, 3].forEach(u => assert.ok(Math.abs(uses[u] / ut - 1 / 3) < 0.03, JSON.stringify(uses)));

// 正答の番号が偏らないこと
const pos = [0, 0, 0], r3 = ctx.rng_(5);
for (let i = 0; i < 6000; i++) pos[unit.gen(r3, 3).ans[''] - 1]++;
pos.forEach(p => assert.ok(p > 1800 && p < 2200, JSON.stringify(pos)));

// 共通画面の打鍵：正答は打った時点で通る。1桁の誤答は Enter まで待ち、2桁の誤答（かけてしまった値）が打てる
const ui = uiContext(unit);
let ok = 0, ng = 0;
ui.submit = () => { ui.isRight() ? ok++ : ng++; };
const r4 = ctx.rng_(9);
for (let i = 0; i < 2000; i++) {
  const it = unit.gen(r4, 4), f = it.f[0];
  ui.mode = 4; ui.queue = [it]; ui.qi = 0; ui.fi = 0;
  ui.typed = { [f]: '' };
  const b = ok;
  for (const key of String(it.ans[f])) ui.handleInput(key);
  assert.equal(ok, b + 1);
  if (it.t === 'H') {
    // 第3用法でかけてしまった値（2桁）が最後まで打てて、誤答として記録されること
    const wrong = String(it.ans[f] * num(it.tag, 'k'));
    ui.typed = { [f]: '' };
    const nb = ng;
    for (const key of wrong) ui.handleInput(key);
    if (wrong.length < 2) ui.handleInput('Enter');
    assert.equal(ng, nb + 1);
    assert.equal(ui.typed[f], wrong);
  }
}
console.log(`bai: ${6 * 5002} questions, order ${JSON.stringify(ords)}, uses ${JSON.stringify(uses)}, keys ${ok} right / ${ng} wrong.`);
