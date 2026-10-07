'use strict';
// 全単元共通の契約テスト。apps/grade<学年>/ に Unit.gs を置いた単元はすべて自動で検査される。
// 新しい単元を足したとき、ここに何も書かなくてもこの検査が掛かる。
// 見つけるもの:
//   - Unit.gs の宣言の欠落（validateUnit_。Core.gs 側と同じ検査）
//   - gen の出題がサーバー採点（match_）で正答になること、ずらした答えが弾かれること
//   - genQueue_ がシードに対して決定的であること（同じシードで同じ並び）
//   - typesInMode_ がモードごとに型を返すこと（練習の選択肢が空にならない）
// 「注意：」で始まる指摘は設計上許容されるもの（digitCap の未宣言欄など）なので
// 表示だけして落とさない。直すべきものは注意にしない。

const assert = require('assert');
const { loadUnit, unitNames, unitDir } = require('./lib/kit.cjs');

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

  // 置き場の学年と宣言の学年が一致すること（プレビューのメニューはこの宣言で分ける）
  assert.equal(unitDir(name).split('/')[1], unit.category === 'special' ? 'special' : 'grade' + unit.grade,
    `${name}: UNIT.grade=${unit.grade} と置き場 ${unitDir(name)} が合わない`);

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

// キュー項目の位置づけ。書き込み（Core.gs の QI_）と読み取り（index.html の QI）が
// 同じ表で結ばれていること。ずれると miss_items / wrong_items / stat が静かに壊れる
{
  const vm = require('vm');
  const src = require('./lib/kit.cjs').read('common/index.html');
  const m = src.match(/var QI = (\{[^}]*\});/);
  assert.ok(m, 'index.html に var QI が見つからない');
  const qiClient = vm.runInContext('(' + m[1] + ')', vm.createContext({}));
  assert.deepEqual(qiClient, loadUnit(unitNames()[0]).QI_,
    'index.html の QI が Core.gs の QI_ と違う');
}
console.log('queue item schema (QI) shared.');

// 単元が足す色は、別学年の色のうち使ってよいもの（GRADE_EXTRA_）に限る。
// 3年にからし（5年）を足すと、ミントと1型の見え方で色差16になり弾かれること
{
  const ctx = loadUnit('weight');
  ctx.UNIT.units.kg = '#D4D454';
  const probs = ctx.validateUnit_();
  assert.ok(probs.some(p => p.indexOf('units.kg の色 #D4D454 は 3年で使えません') === 0), JSON.stringify(probs));
  // 全学年の色は背景・赤と組にして定義されている
  assert.deepEqual(Object.keys(ctx.GRADE_ACCENT_), ['1', '2', '3', '4', '5', '6']);
  Object.keys(ctx.GRADE_EXTRA_).forEach(g => {
    assert.ok(!ctx.GRADE_EXTRA_[g].includes(ctx.GRADE_ACCENT_[g]), g + '年の追加色に自分の色が入っている');
    ctx.GRADE_EXTRA_[g].forEach(c => assert.ok(Object.values(ctx.GRADE_ACCENT_).includes(c), c + ' は学年の色ではない'));
  });
}
console.log('palette rules passed.');

// プレビューの単元メニュー（tools/preview/preview.html の KNOWN_UNITS）に、全単元が載っていること。
// serve.ps1 はディレクトリの一覧を返さないので、メニューは自動で集められない。
// 単元を足して KNOWN_UNITS を忘れると、ここで落ちる（足し忘れがプレビューに出ないまま残らない）。
{
  const src = require('./lib/kit.cjs').read('tools/preview/preview.html');
  const block = src.match(/var KNOWN_UNITS = \[([\s\S]*?)\];/);
  assert.ok(block, 'preview.html に KNOWN_UNITS が見つからない');
  const listed = (block[1].match(/'[^']+'/g) || []).map(s => s.slice(1, -1)).sort();
  const actual = unitNames().map(n => unitDir(n).replace(/^apps\//, '')).sort();
  assert.deepEqual(listed, actual,
    `preview.html の KNOWN_UNITS が apps/grade*/ の単元と合わない。足りない: ${actual.filter(x => !listed.includes(x))} 余分: ${listed.filter(x => !actual.includes(x))}`);
}
console.log('preview menu lists every unit.');
