'use strict';
// 体積（5年）固有の検査。契約（宣言・採点の往復）は contract.test.cjs が掛ける。
const assert = require('node:assert/strict');
const { loadUnit, uiContext } = require('./lib/kit.cjs');
const ctx = loadUnit('volume');
const unit = ctx.UNIT;
const seen = new Set();

const ALLOWED = { 1: 'A', 2: 'BCD', 3: 'EJKN', 4: 'FG', 5: 'HI', 6: 'ABCDEJKNFGHI' };
const CHOICE = 'EJKN';

function check(item, mode) {
  assert.ok(unit.types[item.t], 'unknown type ' + item.t); seen.add(item.t);
  assert.ok(ALLOWED[mode].includes(item.t), mode + ' ' + item.t);
  assert.ok(!/,/.test(item.tag), 'tag に , があると記録の区切りと衝突する: ' + item.tag);
  assert.ok(item.fig.startsWith('<svg') && item.fig.endsWith('</svg>'));
  assert.ok(!/NaN|undefined/.test(item.fig), item.tag);
  assert.ok(item.fig.length < 6000, 'fig too large: ' + item.fig.length);
  assert.equal(item.f.length, 1);
  const f = item.f[0], a = item.ans[f], cap = unit.digitCap[item.t][f];
  assert.ok(Number.isInteger(a) && a > 0, item.tag);
  // 答えの桁数は型ごとに固定（確定タイミングで大きさが漏れない）
  assert.equal(String(a).length, cap, item.tag + ' ' + a);
  const n = (item.tag.match(/\d+/g) || []).map(Number);
  switch (item.t) {
    case 'A': {
      assert.equal(a, n[0] * n[1] * n[2]);
      assert.ok(n[3] < a, '見える数が全体より少ないこと（M1 と弁別できる）');
      break;
    }
    case 'B': assert.equal(a, n[0] * n[1] * n[2]); break;
    case 'C': assert.equal(a, n[1] ** 3); break;
    case 'D': assert.equal(a * n[1] * n[2], n[0]); break;
    case 'F': assert.equal(a, n[4] * (n[2] * n[1] + (n[0] - n[2]) * n[3])); break;
    case 'G': assert.equal(a, n[4] * (n[0] * n[1] - n[2] * n[3])); break;
    case 'H': assert.equal(a, (n[0] - 2) * (n[1] - 2) * (n[2] - 1)); assert.notEqual(a, n[3]); break;
    case 'I': assert.equal(a * 1000, (n[0] - 2) * (n[1] - 2) * (n[2] - 1)); break;
    default: {
      assert.ok(CHOICE.includes(item.t));
      const order = item.tag.split(' ')[1].split('-').map(Number);
      assert.equal(order.length, 4); assert.equal(new Set(order).size, 4);
      const rightVal = {
        '1m³は': 1000000, '1Lは': 1000, '1mLは': 1
      }[item.q[0]];
      const want = item.t === 'N' ? 1000 : rightVal !== undefined ? rightVal :
        item.q[0].endsWith('cm³は') ? n[0] / 1000 :
        item.q[0].endsWith('m³は') ? n[0] * 1000000 : n[0];
      assert.equal(order[a - 1], want, item.tag);
    }
  }
  assert.equal(ctx.match_([a], item, false), true);
  assert.equal(ctx.match_([a + 1], item, false), false);
}

let count = 0;
for (let mode = 1; mode <= 6; mode++) {
  const rand = ctx.rng_(20260927 + mode);
  for (let i = 0; i < 5000; i++) { check(unit.gen(rand, mode), mode); count++; }
  assert.ok(ctx.typesInMode_(mode).length > 0);
}
assert.equal(seen.size, Object.keys(unit.types).length);
assert.throws(() => unit.gen(ctx.rng_(1), 7));

// 4択の正答位置が偏らない
const pos = [0, 0, 0, 0], r2 = ctx.rng_(7);
for (let i = 0; i < 4000; i++) pos[unit.gen(r2, 3).ans[''] - 1]++;
for (const p of pos) assert.ok(p > 800 && p < 1200, JSON.stringify(pos));

// 共通画面の打鍵処理：正答は宣言桁で通り、誤答も同じ桁で確定して落ちる
const input = uiContext(unit);
let ok = 0, ng = 0;
input.submit = () => { input.isRight() ? ok++ : ng++; };
for (let mode = 1; mode <= 6; mode++) {
  const rand = ctx.rng_(98 + mode);
  for (let i = 0; i < 300; i++) {
    const item = unit.gen(rand, mode), f = item.f[0], a = item.ans[f];
    input.mode = mode; input.queue = [item]; input.qi = 0; input.fi = 0;
    input.typed = { [f]: '' };
    let b = ok; for (const k of String(a)) input.handleInput(k); assert.equal(ok, b + 1, item.tag);
    const cap = unit.digitCap[item.t][f];
    const wrong = String(cap === 1 ? (a % 4) + 1 : a === 10 ** cap - 1 ? a - 1 : a + 1);
    input.typed = { [f]: '' };
    b = ng; for (const k of wrong) input.handleInput(k); assert.equal(ng, b + 1, item.tag);
  }
}
console.log(`${count} volume questions passed; ${ok} right / ${ng} wrong through the UI key handler.`);
