const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('common/Core.gs') + '\n' + read('apps/circle/Unit.gs'), ctx);
const unit = ctx.UNIT;
const seen = new Set();

// 番号で答える型の正答（tag の並びの中で、この種類の位置＋1が答え）
const RIGHT = { A: 'center', B: 'rad', C: 'dia', F: 'mid' };
// モードごとに出てよい型
const ALLOWED = { 1: 'AB', 2: 'C', 3: 'DE', 4: 'FGH', 5: 'IJK', 6: 'ABCDEFGHIJK' };

function check(item, mode) {
  assert.ok(unit.types[item.t], 'unknown type ' + item.t); seen.add(item.t);
  assert.ok(ALLOWED[mode].includes(item.t), mode + ' ' + item.t);
  assert.ok(item.tag && item.q.length && item.f.length === 1);
  assert.ok(!/,/.test(item.tag), 'tag に , があると記録の区切りと衝突する: ' + item.tag);
  assert.ok(typeof item.fig === 'string' && item.fig.startsWith('<svg') && item.fig.endsWith('</svg>'));
  assert.ok(!/NaN|undefined/.test(item.fig), item.fig);
  assert.ok(item.fig.length < 4000, 'fig too large: ' + item.fig.length);
  const f = item.f[0], a = item.ans[f];
  const cap = unit.digitCap[item.t][f];
  if (RIGHT[item.t]) {
    assert.equal(f, ''); assert.equal(cap, 1);
    const order = item.tag.split(':')[1].split('-');
    assert.equal(order.length, 4); assert.equal(new Set(order).size, 4);
    assert.equal(order[a - 1], RIGHT[item.t]);
  } else {
    assert.equal(f, 'cm'); assert.equal(cap, 2);
    // 答えは常に2桁（確定タイミングを揃える）
    assert.ok(Number.isInteger(a) && a >= 10 && a <= 99, item.tag + ' ' + a);
    const nums = item.tag.match(/\d+/g).map(Number);
    if (item.t === 'D' || item.t === 'G') assert.equal(a, nums[0] * 2);
    if (item.t === 'E' || item.t === 'H') assert.equal(a, nums[0] / 2);
    if (item.t === 'I') assert.equal(a, nums[0] * (item.tag.includes('はんけい') ? nums[1] * 2 : nums[1]));
    if (item.t === 'J') assert.equal(a, (nums[1] / nums[0]) / (item.tag.includes('はんけい') ? 2 : 1));
    if (item.t === 'K') assert.equal(a, nums[2] * (item.tag.endsWith('よこ') ? nums[1] : nums[0]));
  }
  assert.equal(ctx.match_([a], item, false), true);
  assert.equal(ctx.match_([a + 1], item, false), false);
}

let count = 0;
for (let mode = 1; mode <= 6; mode++) {
  const rand = ctx.rng_(20260926 + mode);
  for (let i = 0; i < 5000; i++) { check(unit.gen(rand, mode), mode); count++; }
  for (const edge of [0, 0.999999999]) check(unit.gen(() => edge, mode), mode);
  assert.equal(JSON.stringify(ctx.genQueue_(12345, mode, 100)), JSON.stringify(ctx.genQueue_(12345, mode, 100)));
  assert.ok(ctx.typesInMode_(mode).length > 0);
}
assert.equal(seen.size, Object.keys(unit.types).length);
assert.throws(() => unit.gen(() => 0, 7));

// 正答の番号が①〜④に偏っていないこと（位置が手がかりにならない）
const pos = [0, 0, 0, 0], r2 = ctx.rng_(7);
for (let i = 0; i < 4000; i++) pos[unit.gen(r2, 2).ans[''] - 1]++;
for (const p of pos) assert.ok(p > 800 && p < 1200, JSON.stringify(pos));

// 図が packQueue_ を通ってクライアントへ届くこと（9番目＝図）
const packed = ctx.packQueue_([unit.gen(ctx.rng_(1), 3)]);
assert.ok(String(packed[0][8]).startsWith('<svg'));

// 共通画面の打鍵処理を通す
const ui = read('common/index.html');
const input = vm.createContext({
  DIGITCAP: unit.digitCap, SCALE: {}, performance: { now: () => 100 },
  paintSlots() {}, locked: false, ready: true, practice: false, firstKeyAt: 0
});
for (const name of ['digitCap_', 'valOf', 'currentAns', 'isRight', 'handleInput', 'moveField']) {
  const match = ui.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert.ok(match, name); vm.runInContext(match[0], input);
}
let accepted = 0, rejected = 0;
input.submit = () => { input.isRight() ? accepted++ : rejected++; };
for (let mode = 1; mode <= 6; mode++) {
  const rand = ctx.rng_(98 + mode);
  for (let i = 0; i < 300; i++) {
    const item = unit.gen(rand, mode);
    const f = item.f[0];
    input.mode = mode; input.queue = [item]; input.qi = 0; input.fi = 0;
    // 正答は打ち切りで通る
    input.typed = { [f]: '' };
    const before = accepted;
    for (const key of String(item.ans[f])) input.handleInput(key);
    assert.equal(accepted, before + 1, JSON.stringify(item.tag));
    // 誤答は宣言した桁数で確定して落ちる（桁数が漏れない）
    input.typed = { [f]: '' };
    const wrong = f === '' ? String(item.ans[f] % 4 + 1) : String(item.ans[f] === 99 ? 98 : item.ans[f] + 1);
    const rb = rejected;
    for (const key of wrong) input.handleInput(key);
    assert.equal(rejected, rb + 1, JSON.stringify(item.tag));
  }
}
console.log(`${count} generated questions: answers, figures, digit caps and server scoring passed.`);
console.log(`${accepted} right / ${rejected} wrong answers passed through the shared UI key handler.`);
