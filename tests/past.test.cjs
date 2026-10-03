'use strict';
// 過年度タブ（Core.gs の pastStats_）と、ハブの個人情報の消去（apps/hub/Archive.gs の ar*_）。
// - 年度ごとの型の誤答率・時間、問題ごとの誤答・遅かった回数・推定出題数
// - 番号は全単元共通で、学年→組→番号の順。前回の続きは同じ番号
// - その年度の行だけを書き換え、ほかの年度・今の児童の summary は残す
const assert = require('node:assert/strict');
const vm = require('vm');
const { read, loadUnit } = require('./lib/kit.cjs');

const core = loadUnit('kuku');
const ar = vm.createContext({});
vm.runInContext(read('apps/hub/Archive.gs'), ar);

// 年度：4月始まり。テストではタイムゾーンに依らないよう UTC で見る
const fyOf = ts => { const d = new Date(ts); return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
const T = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 3));

/* ---------- pastStats_ ---------- */
{
  const types = Object.keys(core.UNIT.types), A = types[0];
  const head = ['ts', 'email', '学年', '組', '番号', '氏名', 'mode', 'モード名', 'limit_sec', 'correct', 'attempts', 'miss_items', 'slow_items', 'type_stats', 'wrong_items'];
  const ln = Math.log(2000);
  const rows = [head,
    // 2024年度：A を 8 問1回目で正答・2 問誤答。7x8 が2回、遅いのが1回
    [T(2024, 5, 1), 'a@k', 3, '1', 1, '赤', 1, '', 60, 8, 10, `${A}:7x8,${A}:7x8`, `${A}:6x9:4000`, `${A}:8:16000:8:16000:32000000:${8 * ln}:${8 * ln * ln}`, ''],
    // 2025年度（3/31 までは 2024年度）
    [T(2025, 3, 31), 'b@k', 3, '1', 2, '青', 1, '', 60, 5, 5, '', '', `${A}:5:10000:5:10000:20000000:${5 * ln}:${5 * ln * ln}`, ''],
    [T(2025, 4, 1), '2025-児童001', 3, '1', 1, '児童001', 1, '', 60, 4, 5, `${A}:3x4`, '', `${A}:4:8000:4:8000:16000000:${4 * ln}:${4 * ln * ln}`, ''],
  ];
  const freq = { 1: { [A + '|7x8']: 0.5, [A + '|3x4']: 0.5 } };
  const ys = JSON.parse(JSON.stringify(core.pastStats_(rows, fyOf, freq, types)));
  assert.deepEqual(ys.map(y => y.fy), [2025, 2024], '新しい年度から');
  const y24 = ys[1], y25 = ys[0];
  assert.equal(y24.trials, 2); assert.equal(y24.kids, 2); assert.equal(y24.pii, 2, 'メールの残る児童');
  assert.equal(y25.pii, 0, '消去済みの行は数えない');
  assert.equal(y24.types[A].n, 15, '1回目正答 13 + 誤答 2');
  assert.equal(y24.types[A].miss, 2);
  assert.equal(y24.types[A].rate, 13.3);
  assert.equal(y24.types[A].ms, 2000, '幾何平均');
  assert.equal(y24.missTop.length, 0, '推定出題数（解いた数 15 × 出やすさ 0.5 = 8）が少ない問題は誤答率の順位に入れない');
  assert.equal(y24.slowTop[0].tag, '6x9'); assert.equal(y24.slowTop[0].slow, 1);
  // 推定出題数が十分なら誤答率を出す
  const many = [head]; for (let i = 0; i < 10; i++) many.push(rows[1]);
  const m = JSON.parse(JSON.stringify(core.pastStats_(many, fyOf, freq, types)))[0];
  assert.equal(m.missTop[0].tag, '7x8'); assert.equal(m.missTop[0].est, 50); assert.equal(m.missTop[0].rate, 40);
}

/* ---------- 番号の振り方 ---------- */
{
  const e = [
    { mail: 'C@k', grade: 3, cls: '2', no: 1 },
    { mail: 'a@k', grade: 3, cls: '1', no: 2 },
    { mail: 'b@k', grade: 3, cls: '1', no: 1 },
    { mail: 'a@k', grade: 3, cls: '2', no: 9 },   // 同じ児童の2つ目の所属は使わない
    { mail: 'd@k', grade: 4, cls: '1', no: 1 },
    { mail: '2024-児童001', grade: 3, cls: '1', no: 1 }   // 消去済みは数えない
  ];
  const map = JSON.parse(JSON.stringify(ar.arNumber_(e, {})));
  assert.deepEqual(map, { 'b@k': 1, 'a@k': 2, 'c@k': 3, 'd@k': 4 }, '学年→組→番号の順');
  // 前回の続き：既にある番号は変えず、新しい児童は後ろに
  const map2 = JSON.parse(JSON.stringify(ar.arNumber_(e.concat([{ mail: 'e@k', grade: 3, cls: '1', no: 0 }]), map)));
  assert.equal(map2['b@k'], 1); assert.equal(map2['e@k'], 5);
  assert.equal(ar.arToken_(2024, 7), '2024-児童007');
  assert.equal(ar.arToken_(2024, 1234), '2024-児童1234');
}

/* ---------- 行の書き換え ---------- */
{
  const map = { 'a@k': 1, 'b@k': 2 };
  const entries = [{ mail: 'a@k', grade: 3, cls: '1', no: 5 }, { mail: 'b@k', grade: 3, cls: '1', no: 6 }];
  const byKey = JSON.parse(JSON.stringify(ar.arByKey_(entries, map)));
  assert.deepEqual(byKey, { '3-1-5': 1, '3-1-6': 2 });

  const log = [['h'],
    [T(2024, 6, 1), 'a@k', 3, '1', 5, '赤'],
    [T(2025, 6, 1), 'a@k', 4, '1', 5, '赤'],          // 次の年度は残す
    [T(2024, 7, 1), 'z@k', 3, '1', 9, '紫'],          // 対応表に無い
    [T(2024, 7, 2), '2024-児童002', 3, '1', 6, '児童002']];
  const idx = Array.from(ar.arScrubLog_(log, 2024, fyOf, map));
  assert.deepEqual(idx, [1, 3]);
  assert.deepEqual(log[1].slice(1), ['2024-児童001', 3, '1', 5, '児童001']);
  assert.equal(log[2][1], 'a@k'); assert.equal(log[2][5], '赤');
  assert.equal(log[3][1], '2024-児童?'); assert.equal(log[3][5], '児童?');

  const sum = [['h'], ['a@k', 1], ['b@k', 1], ['x@k', 1]];
  assert.deepEqual(Array.from(ar.arScrubSummary_(sum, 2024, map, { 'b@k': true })), [1]);
  assert.equal(sum[1][0], '2024-児童001'); assert.equal(sum[2][0], 'b@k', '今の名簿にいる児童のベストは残す');
  assert.equal(sum[3][0], 'x@k', 'その年度にいない児童は触らない');

  const mis = [['h'], [T(2024, 6, 1), 3, '1', 6, '青', 'm'], [T(2025, 6, 1), 3, '1', 6, '青', 'm']];
  ar.arScrubMistakes_(mis, 2024, fyOf, byKey);
  assert.equal(mis[1][4], '児童002'); assert.equal(mis[2][4], '青');

  const coop = [['h'], ['s1', '3-1', 'p', 1, 1, 2, '[]', JSON.stringify(['赤', '青', '黄']), JSON.stringify([5, 6, 7]), T(2024, 9, 1)]];
  ar.arScrubCoop_(coop, 2024, fyOf, byKey);
  assert.deepEqual(JSON.parse(coop[1][7]), ['児童001', '児童002', '児童?']);

  const clog = [['h'], ['s1', T(2024, 9, 1), 'b@k', 1, 1]];
  ar.arScrubCoopLog_(clog, 2024, fyOf, map);
  assert.equal(clog[1][2], '2024-児童002');

  const save = [['h'], ['x', '3年1組', T(2024, 9, 2), 's1',
    JSON.stringify({ cls: '3-1', names: ['赤', '青'], nos: [5, 6], order: ['a@k', 'b@k'], ev: [[0, 1]] })]];
  ar.arScrubCoopSave_(save, 2024, fyOf, map, byKey);
  const p = JSON.parse(save[1][4]);
  assert.deepEqual(p.names, ['児童001', '児童002']); assert.deepEqual(p.order, ['2024-児童001', '2024-児童002']);
  assert.ok(!/@/.test(save[1][4]), 'メールが残らない');

  const facts = [['a@k', 'kuku', 'A', '2024-06-03', 1], ['a@k', 'kuku', 'A', '2025-06-02', 1]];
  assert.deepEqual(Array.from(ar.arScrubFacts_(facts, 2024, fyOf, map)), [0]);
  assert.equal(facts[0][0], '2024-児童001'); assert.equal(facts[1][0], 'a@k');

  const sup = [['1', T(2024, 5, 1), 't@e', 'child:b@k', 'kuku', '', T(2024, 5, 1)], ['2', T(2024, 5, 1), 't@e', 'class:3-1', 'kuku', '', T(2024, 5, 1)]];
  ar.arScrubSupport_(sup, 2024, fyOf, map);
  assert.equal(sup[0][3], 'child:2024-児童002'); assert.equal(sup[1][3], 'class:3-1');
}

/* ---------- ハブの写しが Core と同じ結果になる（ハブには Core.gs が無いので写しを持つ） ---------- */
{
  const cases = [new Date(Date.UTC(2025, 3, 1)), '2025-04-01', '2025/03/31 23:59', '', null, 'x', 1717200000000];
  for (const c of cases) assert.equal(ar.rowMs_(c), core.rowTime_(c), 'rowMs_: ' + c);
  // 名簿を保存する年度：1〜3月はいまの年度、4〜12月は1つ前（4/1 の自動保存と同じ）
  assert.equal(ar.arRosterFyAt_(2025, 3), 2025);
  assert.equal(ar.arRosterFyAt_(2026, 4), 2025);
  assert.equal(ar.arConfirmWord_(2025), '2025年度を消去');
  // 画面は確認の語を自分で組み立てない（正本は arConfirmWord_）
  const h = read('apps/hub/teacher.html');
  assert.ok(!h.includes("fy + '年度を消去'") && h.includes('var want = y.confirm;'));
}

/* ---------- 画面と Core の取り決め ---------- */
{
  const t = read('common/teacher.html'), h = read('apps/hub/teacher.html');
  assert.ok(t.includes('.getPastYears('), '単元の教師画面が過年度を読む');
  assert.ok(h.includes('.arStatus()') && h.includes('.arAnonymize('), 'ハブの教師画面が消去を呼ぶ');
  // 児童の経路（index.html / links.html）に過年度を載せない
  assert.ok(!read('common/index.html').includes('getPastYears') && !read('apps/hub/links.html').includes('arStatus'));
}
console.log('past years & archive ok.');
