'use strict';
// 全単元共通の契約テスト。apps/ に Unit.gs を置いた単元はすべて自動で検査される。
// 新しい単元を足したとき、ここに何も書かなくてもこの検査が掛かる。
// 見つけるもの:
//   - Unit.gs の宣言の欠落（validateUnit_。Core.gs 側と同じ検査）
//   - gen の出題がサーバー採点（match_）で正答になること、ずらした答えが弾かれること
//   - genQueue_ がシードに対して決定的であること（同じシードで同じ並び）
//   - typesInMode_ がモードごとに型を返すこと（練習の選択肢が空にならない）
// 「注意：」で始まる指摘は設計上許容されるもの（digitCap の未宣言欄など）なので
// 表示だけして落とさない。直すべきものは注意にしない。

const assert = require('assert');
const { loadUnit, unitNames } = require('./lib/kit.cjs');

let totalWarns = 0;
for (const name of unitNames()) {
  const ctx = loadUnit(name);
  const unit = ctx.UNIT;

  // 1) Core.gs と同じ契約検査。「注意：」以外はすべて落とす
  const probs = ctx.validateUnit_();
  const errors = probs.filter(p => p.indexOf('注意：') !== 0);
  const warns = probs.filter(p => p.indexOf('注意：') === 0);
  warns.forEach(w => console.log(`  ${name}: ${w}`));
  totalWarns += warns.length;
  assert.deepEqual(errors, [], `${name}: Unit.gs の契約違反`);

  // 2) 出題 → サーバー採点の往復。正しい答えは通り、1つずらした答えは弾かれる
  unit.modes.forEach(m => {
    const rand = ctx.rng_(41 + Number(m.id));
    for (let i = 0; i < 120; i++) {
      const item = unit.gen(rand, Number(m.id));
      const byTotal = !!(unit.byTotal && unit.byTotal(item));
      const right = item.f.map(f => item.ans[f]);
      assert.ok(ctx.match_(right, item, byTotal),
        `${name}: 正答が通らない ${JSON.stringify(item)}`);
      const shifted = right.slice();
      shifted[0] = Number(shifted[0]) + 1;
      assert.ok(!ctx.match_(shifted, item, byTotal),
        `${name}: ずらした答えが通ってしまう ${JSON.stringify(item)}`);
    }
  });

  // 3) シード決定性とモードの型（練習の選択肢のもと）
  const m0 = Number(unit.modes[0].id);
  assert.deepEqual(ctx.genQueue_(12345, m0, 200), ctx.genQueue_(12345, m0, 200),
    `${name}: genQueue_ がシードに対して決定的ではない`);
  unit.modes.forEach(m => {
    assert.ok(ctx.typesInMode_(m.id).length > 0,
      `${name}: モード ${m.id} から型が1つも出ない`);
  });
}
console.log(`${unitNames().length} units passed the contract checks (warns: ${totalWarns}).`);
