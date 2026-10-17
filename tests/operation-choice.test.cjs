'use strict';
const assert = require('assert');
const { loadUnit } = require('./lib/kit.cjs');

const ctx = loadUnit('operation-choice');
const unit = ctx.UNIT;

assert.equal(unit.id, 'operation-choice');
assert.deepEqual(Array.from(unit.modes, m => m.id), [1, 2, 3]);

for (const mode of unit.modes) {
  for (let seed = 1; seed <= 300; seed++) {
    const rand = ctx.rng_(seed * 31 + mode.id);
    const item = unit.gen(rand, mode.id);
    assert.ok(item.fig.includes('data-pick="1"'), '選択肢1がない');
    assert.ok(item.fig.includes('data-pick="4"'), '選択肢4がない');
    assert.equal(item.f.length, 1);
    assert.ok(item.ans[''] >= 1 && item.ans[''] <= 4);
    assert.ok(item.types === undefined, '問題データに余計な型情報がある');
    assert.ok(ctx.match_(item.f.map(f => item.ans[f]), item, false), '正解がサーバー採点を通らない');
    assert.ok(!ctx.match_([item.ans[''] % 4 + 1], item, false), '別の選択肢番号が正解になってしまう');
  }
}
for (const mode of unit.modes) {
  assert.ok(ctx.typesInMode_(mode.id).length > 0, 'モードの問題型が空');
}
const same1 = ctx.genQueue_(1234, 1, 30);
const same2 = ctx.genQueue_(1234, 1, 30);
assert.deepEqual(same1, same2, '同じシードで問題列が再現されない');

console.log('operation-choice tests passed.');
