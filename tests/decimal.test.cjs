const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('common/Core.gs') + '\n' + read('apps/decimal/Unit.gs'), ctx);
const unit = ctx.UNIT;
const seen = new Set();

function hundredths(text) {
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
}

function check(item, mode) {
  assert.ok(unit.types[item.t], item.t);
  seen.add(item.t);
  assert.ok(item.tag && item.q.length && item.f.length);
  for (const field of item.f) {
    const answer = item.ans[field];
    const cap = (unit.digitCap[item.t] || unit.digitCap[mode])[field];
    assert.ok(Number.isSafeInteger(answer) && answer >= 0);
    assert.ok(cap >= String(answer).length && cap <= 4);
  }

  if (mode === 1) {
    assert.equal(hundredths(item.q[0]), item.ans['こ'] * 10);
  } else if (mode === 2) {
    assert.equal(hundredths(item.q[0]), item.ans['こ']);
  } else if (mode === 3) {
    const n = hundredths(item.q[0]);
    const expected = item.t === 'digitOnes' ? Math.floor(n / 100)
      : item.t === 'digitTenth' ? Math.floor(n / 10) % 10 : n % 10;
    assert.equal(item.ans[''], expected);
  } else {
    const factor = Number(item.q[2]);
    assert.ok(factor === 10 || factor === 100);
    const result = mode === 4
      ? hundredths(item.q[0]) * factor
      : Number(item.q[0]) * 100 / factor;
    const byPlace = {
      '十の位': Math.floor(result / 1000) % 10,
      '一の位': Math.floor(result / 100) % 10,
      '十分の一の位': Math.floor(result / 10) % 10,
      '百分の一の位': result % 10
    };
    assert.equal(item.ans[''], byPlace[item.q[4]]);
  }

  const answer = item.f.map(field => item.ans[field]);
  assert.equal(ctx.match_(answer, item, false), true);
  answer[0]++;
  assert.equal(ctx.match_(answer, item, false), false);
}

let generated = 0;
for (let mode = 1; mode <= 5; mode++) {
  const rand = ctx.rng_(20260911 + mode);
  for (let i = 0; i < 10000; i++) {
    check(unit.gen(rand, mode), mode);
    generated++;
  }
  for (const edge of [0, 0.999999999]) check(unit.gen(() => edge, mode), mode);
  assert.deepEqual(ctx.genQueue_(12345, mode, 200), ctx.genQueue_(12345, mode, 200));
  assert.ok(ctx.typesInMode_(mode).length > 0);
}
assert.equal(seen.size, Object.keys(unit.types).length);
assert.throws(() => unit.gen(() => 0, 6));

// 共通UIの数字入力で、各問題が宣言桁数どおりに確定することも通す。
const ui = read('common/ui.html');
const input = vm.createContext({
  DIGITCAP: unit.digitCap, SCALE: {}, performance: { now: () => 100 },
  paintSlots() {}, locked: false, ready: true, practice: false, firstKeyAt: 0
});
for (const name of ['digitCap_', 'valOf', 'currentAns', 'isRight', 'handleInput', 'moveField']) {
  const match = ui.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert.ok(match, name);
  vm.runInContext(match[0], input);
}
let accepted = 0;
input.submit = () => { assert.equal(input.isRight(), true); accepted++; };
for (let mode = 1; mode <= 5; mode++) {
  const rand = ctx.rng_(980 + mode);
  for (let i = 0; i < 300; i++) {
    const item = unit.gen(rand, mode);
    input.mode = mode;
    input.queue = [item];
    input.qi = 0;
    input.fi = 0;
    input.typed = Object.fromEntries(item.f.map(field => [field, '']));
    const before = accepted;
    for (const field of item.f) {
      for (const key of String(item.ans[field])) input.handleInput(key);
    }
    assert.equal(accepted, before + 1, JSON.stringify(item));
  }
}

console.log(`${generated} decimal questions: arithmetic, types, boundaries and replay passed.`);
console.log(`${accepted} decimal answers passed through the shared UI key handler.`);
