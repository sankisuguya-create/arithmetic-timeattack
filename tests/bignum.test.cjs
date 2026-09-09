const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('common/Core.gs') + '\n' + read('apps/bignum/Unit.gs'), ctx);
const unit = ctx.UNIT;
const scales = { '': 1n, '万': 10000n, '億': 100000000n };
const PLACES = ['一万', '十万', '百万', '千万', '一億'];
const GROUPS = { '1000が': 1000n, '1万が': 10000n, '1億が': 100000000n };
const seen = new Set();
// 分布そのものを見る。桁数や位置が問題文と連動していると、位取りを読まずに
// 「左から○番目」で解けてしまうが、1問ずつの照合ではそれを検出できない。
const offsets = new Set();      // 問う位が数の左から何番目に来たか
const zeros = {};               // 型ごとに、答えが0になる問題が出るか
const widest = {};              // モードごとの、書き下した数字の最大桁数
function check(item, mode) {
  assert.ok(unit.types[item.t]); seen.add(item.t);
  assert.ok(item.tag && item.q.length && item.f.length);
  for (const f of item.f) {
    const a = item.ans[f];
    assert.ok(Number.isSafeInteger(a) && a >= 0 && a <= 9999);
    const cap = (unit.digitCap[item.t] || unit.digitCap[mode])[f];
    assert.ok(cap >= String(a).length && cap <= 4);
  }
  if (mode <= 4) {
    // 数字で書き下す出題は9桁まで（apps/bignum/README.md「読みの上限」）
    widest[mode] = Math.max(widest[mode] || 0, item.q[0].length);
    assert.ok(/^[1-9]\d*$/.test(item.q[0]) && item.q[0].length <= 9, item.q[0]);
  }
  if (mode <= 2) {
    const total = item.f.reduce((s, f) => s + BigInt(item.ans[f]) * scales[f], 0n);
    assert.equal(total.toString(), item.q[0]);
    assert.ok(Number.isSafeInteger(Number(item.q[0])));
  } else if (mode === 3) {
    const pos = PLACES.indexOf(item.q[2].replace('の位の数字', '')) + 4;
    assert.ok(pos >= 4 && pos <= 8);
    assert.equal(item.ans[''], Number(BigInt(item.q[0]) / (10n ** BigInt(pos)) % 10n));
    offsets.add(item.q[0].length - pos - 1);
    (zeros[item.t] = zeros[item.t] || new Set()).add(item.ans[''] === 0);
  } else if (mode === 4) {
    assert.equal(BigInt(item.q[0]), GROUPS[item.q[2]] * BigInt(item.ans['こ']));
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

// 問う位の左からの位置が散っていること。1通りしか出ないなら、
// 児童は位を読まずに「左から○番目」を取るだけで全問正解できる。
assert.ok(offsets.size >= 4, `mode3 offsets: ${[...offsets]}`);
// 万のまとまりの位は0も0以外も出る。一億の位は9桁の先頭になるため0は出ない
// （0を出すには10桁が要る）。この非対称は仕様なので、そのまま固定する。
assert.deepEqual([...zeros.digitMan].sort(), [false, true]);
assert.deepEqual([...zeros.digitOku], [false]);
// モード1は桁数が動く（5〜8桁）。固定だと桁数だけで手続きが決まる。
assert.equal(widest[1], 8); assert.equal(widest[2], 9);
assert.equal(widest[3], 9); assert.equal(widest[4], 9);

// Exercise the actual shared numeric-key handler, including automatic field movement.
const ui = read('common/ui.html');
const input = vm.createContext({
  DIGITCAP: unit.digitCap, SCALE: {}, performance: { now: () => 100 },
  paintSlots() {}, locked: false, ready: true, practice: false, firstKeyAt: 0
});
for (const name of ['digitCap_', 'valOf', 'currentAns', 'isRight', 'handleInput', 'moveField', 'numTok']) {
  const match = ui.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert.ok(match, name); vm.runInContext(match[0], input);
}
// 4桁ごとの区切りは共通UI側の表示処理。数字だけのトークンにしか効かない。
const groupsOf = s => (input.numTok(s).match(/class="g">(\d+)</g) || []).map(m => m.slice(10, -1));
assert.deepEqual(groupsOf('300040000'), ['3', '0004', '0000']);
assert.deepEqual(groupsOf('34560789'), ['3456', '0789']);
assert.deepEqual(groupsOf('99999'), ['9', '9999']);
assert.deepEqual(groupsOf('9999'), []);             // 4桁以下は区切らない
assert.deepEqual(groupsOf('の'), []);               // 数字以外は素通し
assert.equal(input.numTok('9999'), '<span>9999</span>');

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
console.log(`${count} generated questions: arithmetic, digit caps, 9-digit ceiling, types and server scoring passed.`);
console.log(`mode3 offsets from the left: ${[...offsets].sort((a, b) => a - b).join(',')} (fixed offset would mean the place value is never read).`);
console.log(`${accepted} answers passed through the shared UI key handler; digit grouping, seeded replay and boundaries passed.`);
