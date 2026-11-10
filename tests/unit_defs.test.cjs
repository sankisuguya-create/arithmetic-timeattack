'use strict';
// 全単元を1つの GAS にまとめる準備（UNIT_DEFS）の検査。
//   - 各 Unit.gs が UNIT_DEFS['<id>'] に登録し、id が置き場の名前と一致する
//   - 全単元を1つのコンテキストに読み込んでも、単元どうしで大域の名前がぶつからない
//   - まとめた時、UNIT が別の単元を指していても、各単元の gen が自分の定義で問題を作る
//   - 単元が1つだけの時は、今までどおり UNIT がその単元になる
const assert = require('assert'), vm = require('vm');
const { read, unitDir, unitNames } = require('./lib/kit.cjs');

const names = unitNames();
assert.ok(names.length >= 14, '単元が見つからない');

// 大域に置く名前（行頭の var / function）を単元ごとに集め、2単元以上にある名前を探す
const owners = {};
for (const n of names) {
  const src = read(`${unitDir(n)}/Unit.gs`);
  const decl = new Set([...src.matchAll(/^(?:var|function)\s+([A-Za-z_$][\w$]*)/mg)].map(m => m[1]));
  for (const d of decl) (owners[d] = owners[d] || []).push(n);
}
const clash = Object.entries(owners).filter(([k, v]) => v.length > 1 && !['UNIT_DEFS', 'UNIT'].includes(k));
assert.deepStrictEqual(clash, [], '単元どうしで大域の名前がぶつかる: ' + JSON.stringify(clash));
console.log('ok 大域の名前がぶつからない（UNIT_DEFS・UNIT を除く）');

// 1単元だけ：UNIT がその単元
for (const n of names) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(read('common/Core.gs') + '\n' + read(`${unitDir(n)}/Unit.gs`), ctx);
  assert.strictEqual(ctx.UNIT.id, n);
  assert.strictEqual(ctx.UNIT, ctx.UNIT_DEFS[n]);
  assert.deepStrictEqual(Object.keys(ctx.UNIT_DEFS), [n]);
}
console.log('ok 1単元だけの時は UNIT がその単元（' + names.length + ' 単元）');

// 全単元をまとめる
const all = {}; vm.createContext(all);
vm.runInContext(read('common/Core.gs') + '\n' + names.map(n => read(`${unitDir(n)}/Unit.gs`)).join('\n'), all);
assert.deepStrictEqual(Object.keys(all.UNIT_DEFS).sort(), names.slice().sort());
for (const n of names) assert.strictEqual(all.UNIT_DEFS[n].id, n);
console.log('ok まとめると UNIT_DEFS に全単元がそろう');

// UNIT を別の単元にしたまま、各単元の gen を全モードで呼び、1単元だけの時と同じ問題が出るかを比べる
const mk = () => { let seed = 1; return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; };
let calls = 0;
for (const n of names) {
  const solo = {}; vm.createContext(solo);
  vm.runInContext(read('common/Core.gs') + '\n' + read(`${unitDir(n)}/Unit.gs`), solo);
  const def = all.UNIT_DEFS[n];
  all.UNIT = all.UNIT_DEFS[names.find(x => x !== n)];   // わざと別の単元
  for (const m of def.modes || []) {
    const mode = m.id != null ? m.id : m.mode;
    const r1 = mk(), r2 = mk();
    for (let i = 0; i < 20; i++) {
      const a = JSON.stringify(solo.UNIT.gen(r1, mode)), b = JSON.stringify(def.gen(r2, mode));
      assert.strictEqual(b, a, `${n} モード${mode}：まとめた時に別の問題が出る`);
      calls++;
    }
  }
}
console.log('ok UNIT が別の単元でも、各単元の gen は1単元だけの時と同じ問題を出す（' + calls + ' 回）');
