const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('common/Core.gs') + '\n' + read('apps/divmod/Unit.gs'), ctx);
const unit = ctx.UNIT;
const MODES = unit.modes.map(m => m.id);
const seen = new Set();

// 型ごとの打鍵数。モードの中では揃っていなければならない（所要msに打鍵差を乗せない）。
const STROKES = { K: 1, P: 2, D: 1, Jo: 2, Jx: 2, R: 2 };

function check(item, mode) {
  assert.ok(unit.types[item.t], 'unknown type ' + item.t); seen.add(item.t);
  assert.ok(item.tag && item.q.length && item.f.length);
  assert.deepEqual(item.f, unit.fieldsByType[item.t]);

  let strokes = 0;
  for (const f of item.f) {
    const a = item.ans[f];
    assert.ok(Number.isSafeInteger(a) && a >= 1 && a <= 81, JSON.stringify(item));
    const cap = (unit.digitCap[item.t] || unit.digitCap[mode])[f];
    // 宣言した桁数と実際の答えの桁数が一致すること。食い違うと、確定が早い／遅いが
    // そのままヒントになり、主指標の所要msにも打鍵差が乗る。
    assert.equal(cap, String(a).length, JSON.stringify(item));
    strokes += cap;
  }
  assert.equal(strokes, STROKES[item.t], JSON.stringify(item));

  if (item.t === 'K') {
    // 「4のだん　32」→ だん × 答え が示された積になる
    const a = Number(item.q[0]), p = Number(item.q[2]);
    assert.equal(a * item.ans[''], p);
    assert.ok(p >= 10 && p <= 81);
  } else if (item.t === 'P') {
    // 「6のだん　29まで」→ こえない最大の倍数。基準数は倍数そのものにしない
    const a = Number(item.q[0]), n = Number(item.q[2]), ans = item.ans[''];
    assert.equal(ans % a, 0);
    assert.ok(ans <= n && n - ans < a && n % a !== 0);
    assert.ok(ans >= 10 && ans <= 81);
  } else if (item.t === 'D') {
    // 「73−72」→ 差は 1〜8。④⑤に実際に出る組であること（引く数はその段の倍数）
    const n = Number(item.q[0]), m = Number(item.q[2]);
    assert.equal(item.q[1], '-');
    assert.equal(n - m, item.ans['']);
    assert.ok(item.ans[''] >= 1 && item.ans[''] <= 8);
    // 引く数は1桁になりうる（11−9=2 は 11÷3 の実際の引き算）。答えは常に1桁
    assert.ok(n >= 10 && n <= 89 && m >= 4 && m <= 81);
  } else {
    // ④⑤：(わる数)×(商)+(あまり)=(わられる数) と あまり<わる数
    const n = Number(item.q[0]), a = Number(item.q[2]);
    const b = item.ans['あまり'], r = item.ans[''];
    assert.equal(a * b + r, n);
    assert.ok(r >= 1 && r < a, JSON.stringify(item));
    assert.ok(b >= 2 && b <= 9 && n >= 10 && n <= 89);
    if (item.t !== 'R') {
      // ④の示された式。Jo は正しく、Jx は「商が1小さく、あまりがわる数だけ大きい」
      const sb = Number(item.q[4]), sr = Number(item.q[6]);
      assert.equal(a * sb + sr, n);
      if (item.t === 'Jo') { assert.equal(sb, b); assert.equal(sr, r); }
      else { assert.equal(sb, b - 1); assert.equal(sr, r + a); assert.ok(sr >= a); }
    }
  }

  const answer = item.f.map(f => item.ans[f]);
  assert.equal(ctx.match_(answer, item, false), true);
  answer[0]++;
  assert.equal(ctx.match_(answer, item, false), false);
}

let count = 0;
for (const mode of MODES) {
  const rand = ctx.rng_(20260921 + mode);
  for (let i = 0; i < 10000; i++) { check(unit.gen(rand, mode), mode); count++; }
  for (const edge of [0, 0.999999999]) check(unit.gen(() => edge, mode), mode);
  // 同じシードなら同じ問題列。ここが崩れるとサーバーの再採点と食い違い、全員のスコアが0になる
  assert.equal(JSON.stringify(ctx.genQueue_(12345, mode, 200)), JSON.stringify(ctx.genQueue_(12345, mode, 200)));
  assert.ok(ctx.typesInMode_(mode).length > 0);
}
assert.equal(seen.size, Object.keys(unit.types).length);
assert.throws(() => unit.gen(() => 0, 4));   // 外した「ぜんぶまぜ」のid
assert.throws(() => unit.gen(() => 0, 7));

// モードの枠は6つ（児童の数字キー1〜6）。超えると最後のモードがキーで始められない
assert.ok(unit.modes.length <= 6);
// 順次開放は学習順に1本の鎖であること。閉じた輪や、存在しないモードへの参照を弾く
const order = MODES.map(String);
unit.modes.forEach((m, i) => {
  if (i === 0) { assert.equal(m.needs, undefined); return; }
  assert.equal(m.needs.mode, unit.modes[i - 1].id, 'needs chain at ' + m.id);
  assert.ok(order.includes(String(m.needs.mode)));
});

// 共通画面のキー処理を実際に通す。digitCap の宣言だけで自動確定するか（Enter不要）を見る。
const ui = read('common/ui.html');
const input = vm.createContext({
  DIGITCAP: unit.digitCap, SCALE: {}, performance: { now: () => 100 },
  paintSlots() {}, locked: false, ready: true, practice: false, firstKeyAt: 0
});
for (const name of ['digitCap_', 'valOf', 'currentAns', 'isRight', 'handleInput', 'moveField']) {
  const match = ui.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert.ok(match, name); vm.runInContext(match[0], input);
}
let accepted = 0, keys = 0;
input.submit = () => { assert.equal(input.isRight(), true); accepted++; };
for (const mode of MODES) {
  const rand = ctx.rng_(770 + mode);
  for (let i = 0; i < 300; i++) {
    const item = unit.gen(rand, mode);
    input.mode = mode; input.queue = [item]; input.qi = 0; input.fi = 0;
    input.typed = Object.fromEntries(item.f.map(f => [f, '']));
    const before = accepted, keysBefore = keys;
    for (const f of item.f) for (const key of String(item.ans[f])) { input.handleInput(key); keys++; }
    assert.equal(accepted, before + 1, JSON.stringify(item));
    // Enter なしで、宣言した打鍵数ちょうどで確定すること
    assert.equal(keys - keysBefore, STROKES[item.t], JSON.stringify(item));
  }
}
console.log(`${count} generated questions: arithmetic, digit caps, types, mode gating and server scoring passed.`);
console.log(`${accepted} answers passed through the shared UI key handler in ${keys} keystrokes; seeded replay and boundaries passed.`);
