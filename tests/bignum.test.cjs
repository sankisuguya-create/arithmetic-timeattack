const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('common/Core.gs') + '\n' + read('apps/bignum/Unit.gs'), ctx);
const unit = ctx.UNIT;
const scales = { '': 1n, '万': 10000n, '億': 100000000n, '兆': 1000000000000n };
const seen = new Set();
function check(item, mode) {
  assert.ok(unit.types[item.t]); seen.add(item.t);
  assert.ok(item.tag && item.q.length && item.f.length);
  for (const f of item.f) {
    const a = item.ans[f];
    assert.ok(Number.isSafeInteger(a) && a >= 0 && a <= 9999);
    const cap = (unit.digitCap[item.t] || unit.digitCap[mode])[f];
    assert.ok(cap >= String(a).length && cap <= 4);
  }
  if (mode <= 2) {
    const total = item.f.reduce((s, f) => s + BigInt(item.ans[f]) * scales[f], 0n);
    assert.equal(total.toString(), item.q[0]);
    assert.ok(Number.isSafeInteger(Number(item.q[0])));
  } else if (mode === 3) {
    const labels = ['一万', '十万', '百万', '千万', '一億', '十億', '百億', '千億', '一兆'];
    const pos = labels.indexOf(item.q[2].replace('の位の数字', '')) + 4;
    assert.ok(pos >= 4 && pos <= 12);
    assert.equal(item.ans[''], Number(BigInt(item.q[0]) / (10n ** BigInt(pos)) % 10n));
  } else if (mode === 4) {
    assert.equal(BigInt(item.q[0]), BigInt(item.q[2].replace('が', '')) * BigInt(item.ans['こ']));
  } else {
    const a = BigInt(item.q[0]), factor = BigInt(item.q[3]);
    const expected = mode === 5 ? a * factor : a / factor;
    assert.equal(BigInt(item.ans[item.f[0]]), expected);
    if (mode === 6) assert.equal(a % factor, 0n);
  }
  const answer = item.f.map(f => item.ans[f]);
  assert.equal(ctx.match_(answer, item, false), true);
  answer[0]++;
  assert.equal(ctx.match_(answer, item, false), false);
}
let count = 0;
for (let mode = 1; mode <= 6; mode++) {
  const rand = ctx.rng_(20260909 + mode);
  for (let i = 0; i < 10000; i++) { check(unit.gen(rand, mode), mode); count++; }
  for (const edge of [0, 0.999999999]) check(unit.gen(() => edge, mode), mode);
  assert.equal(JSON.stringify(ctx.genQueue_(12345, mode, 200)), JSON.stringify(ctx.genQueue_(12345, mode, 200)));
  assert.ok(ctx.typesInMode_(mode).length > 0);
}
assert.equal(seen.size, Object.keys(unit.types).length);
assert.throws(() => unit.gen(() => 0, 7));

// Exercise the actual shared numeric-key handler, including automatic field movement.
const ui = read('common/index.html');
const input = vm.createContext({
  DIGITCAP: unit.digitCap, SCALE: {}, performance: { now: () => 100 },
  paintSlots() {}, locked: false, ready: true, practice: false, firstKeyAt: 0
});
for (const name of ['digitCap_', 'valOf', 'currentAns', 'isRight', 'handleInput', 'moveField']) {
  const match = ui.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert.ok(match, name); vm.runInContext(match[0], input);
}
let accepted = 0;
input.submit = () => { assert.equal(input.isRight(), true); accepted++; };
for (let mode = 1; mode <= 6; mode++) {
  const rand = ctx.rng_(98 + mode);
  for (let i = 0; i < 300; i++) {
    const item = unit.gen(rand, mode);
    input.mode = mode; input.queue = [item]; input.qi = 0; input.fi = 0;
    input.typed = Object.fromEntries(item.f.map(f => [f, '']));
    const before = accepted;
    for (const f of item.f) {
      if (accepted > before) break; // Zero remainder may already be accepted as a blank.
      for (const key of String(item.ans[f])) input.handleInput(key);
    }
    assert.equal(accepted, before + 1, JSON.stringify(item));
  }
}
console.log(`${count} generated questions: arithmetic, digit caps, types and server scoring passed.`);
console.log(`${accepted} answers passed through the shared UI key handler; seeded replay and boundaries passed.`);
