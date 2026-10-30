'use strict';
// 送信の検査（Core の itemsValid_）と、未送信の置き場（index.html の pend*）。
const assert = require('node:assert/strict');
const vm = require('vm');
const { loadUnit, read } = require('./lib/kit.cjs');
const ctx = loadUnit('kuku');
const ok = it => ctx.itemsValid_(it);
const one = (i, ms) => ({ i, a: [[1]], ms: ms == null ? 1000 : ms, tk: 300 });

assert.equal(ok([one(0), one(1), one(2)]), true);
assert.equal(ok([one(0), one(0)]), false, '同じ問題の二重送信で水増しできる');
assert.equal(ok([one(0, -50000)]), false, '負の ms で時間の検査をすり抜ける');
assert.equal(ok([one(ctx.QN)]), false);
assert.equal(ok([one(1.5)]), false);
assert.equal(ok([one('0')]), false);
assert.equal(ok([{ i: 0, a: [1], ms: 10 }]), false, '履歴は配列の配列');
assert.equal(ok([]), false);
assert.equal(ok([{ i: 0, a: [[1]], ms: 10 }]), true, 'tk 無しは通す');

// 未送信の置き場：2回続けて送れなくても、両方残る
const src = read('common/index.html');
const store = {};
const ui = vm.createContext({ PEND_KEY: 'km_pending_x', JSON,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } });
for (const name of ['pendLoad', 'pendWrite', 'pendSave', 'pendClear']) {
  vm.runInContext(src.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'))[0], ui);
}
store.km_pending = JSON.stringify({ token: 'old', items: [] });   // 以前の1件の形
ui.pendSave({ token: 'a', items: [] });
ui.pendSave({ token: 'b', items: [] });
ui.pendSave({ token: 'a', items: [1] });                        // 同じ token は差し替え
assert.deepEqual(ui.pendLoad().map(x => x.token), ['old', 'b', 'a']);
assert.ok(!('km_pending' in store));
ui.pendClear('b'); ui.pendClear('old');
assert.deepEqual(ui.pendLoad().map(x => x.token), ['a']);
ui.pendClear('a');
assert.ok(!('km_pending_x' in store));
console.log('submit ok');

// summary の行の覚え書き：覚えた行がキーと違えば全体を探し直す（並べ替えで位置が変わっても、ずれた行に書かない）
{
  const c2 = loadUnit('kuku');
  const rows = [['email', 'mode', 'n', 'limit_sec', 'kind', 'tries', 'tc', 'ta', 'best', 'count']];
  let fullReads = 0;
  const range = (r, col, nr, nc) => ({
    getValues: () => rows.slice(r - 1, r - 1 + nr).map(x => x.slice(col - 1, col - 1 + nc)),
    setValues: v => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) rows[r - 1 + i][col - 1 + j] = v[i][j]; }
  });
  const sheet = { getLastRow: () => rows.length, getRange: range, appendRow: a => rows.push(a.slice()),
    getDataRange: () => { fullReads++; return { getValues: () => rows.map(x => x.slice()) }; } };
  const mem = {};
  c2.sh_ = () => sheet;
  c2.cache_ = () => ({ get: k => (k in mem ? mem[k] : null), put: (k, v) => { mem[k] = v; }, remove: k => { delete mem[k]; } });
  c2.modeName_ = () => 'm';
  const u = (mail, mode, sc) => c2.updateSummary_(mail, mode, 60, 'r', sc, sc);
  u('a@x', 1, 5); u('b@x', 1, 7);
  fullReads = 0;
  assert.equal(u('a@x', 1, 9).best, 9);
  assert.equal(fullReads, 0, '覚えた行があれば全体を読まない');
  rows.splice(1, 2, rows[2], rows[1]);                       // 並べ替えで位置が入れ替わる
  assert.equal(u('a@x', 1, 3).best, 9);
  assert.equal(fullReads, 1, 'ずれていたら全体を探し直す');
  assert.equal(JSON.stringify(rows.find(r => r[0] === 'b@x').slice(5)), '[1,7,7,7,1]', '他の児童の行は書き換えない');
  assert.equal(rows.find(r => r[0] === 'a@x')[5], 3);
}
console.log('summary row cache ok');
