'use strict';
// ハブの単元横断分析（apps/hub/Analysis.gs）。docs/ANALYSIS_REQUIREMENTS.md
// - log の読み方が Core.gs と食い違わないこと（写しを置いているため）
// - 下位の帯・持続・伸び・手立ての前後比較の計算
// - 書き出しに個人名が入らないこと
// - 児童の経路に分析が載らないこと
const assert = require('node:assert/strict');
const vm = require('vm');
const { read, loadUnit } = require('./lib/kit.cjs');

const core = loadUnit('circle');   // 円と球：タグに ',' を含む古い行の継ぎ直しがある単元
const an = vm.createContext({});
vm.runInContext(read('apps/hub/Analysis.gs'), an);

/* ---------- log の読み方が Core.gs と同じ ---------- */
// log の列位置・幅の正本は Core.gs の LOG_DEF_。ハブ側は写し（AN_LOG_COL_ / AN_LOG_WIDTH_）を持つ
assert.deepEqual(JSON.parse(JSON.stringify(an.AN_LOG_COL_)), JSON.parse(JSON.stringify(core.LOG_COL_)), 'Analysis.gs の列位置が Core.gs と違う');
assert.equal(an.AN_LOG_WIDTH_, core.LOG_WIDTH_, 'Analysis.gs の log 列数が Core.gs と違う');
const statCases = [
  'A:3:4500:3:3000:3100000:20.1:135.2',   // 対数の和あり
  'B:2:3000:2:2000:2100000',               // 対数の和の無い古い行
  'C:1:900:0:0:0',                         // 初打鍵の無い行
  'bad', ''
];
for (const e of statCases) {
  assert.deepEqual(JSON.parse(JSON.stringify(an.anTypeStat_(e))), JSON.parse(JSON.stringify(core.typeStat_(e))), 'typeStat: ' + e);
}
const typeSet = {};
Object.keys(core.UNIT.types).forEach(t => { typeSet[t] = true; });
const t0 = Object.keys(core.UNIT.types)[0], t1 = Object.keys(core.UNIT.types)[1];
const cells = [
  `${t0}:x1,${t1}:y2`,
  `${t0}:chord,rad,short,off,${t1}:z`,     // 初版のタグの ',' を継ぎ直す
  `junk,${t0}:a`, ''
];
for (const c of cells) {
  assert.deepEqual(Array.from(an.anSplitItems_(c, typeSet)), Array.from(core.splitCellItems_(c, typeSet)), 'split: ' + c);
}

/* ---------- log の1行 → 型ごとの寄与 ---------- */
{
  const row = [];
  row[core.LOG_COL_.MISS] = `${t0}:a,${t0}:b,${t1}:c`;
  row[core.LOG_COL_.TSTAT] = `${t0}:5:9000:5:6000:7300000:30.5:186.1,${t1}:2:3000:2:2000:2100000`;
  const by = an.anRowFacts_(row, typeSet);
  assert.equal(by[t0].ok, 5); assert.equal(by[t0].miss, 2); assert.equal(by[t0].ntk, 5);
  assert.equal(by[t1].ok, 2); assert.equal(by[t1].miss, 1);
  assert.ok(Math.abs(by[t1].ln - 2 * Math.log(1000)) < 1e-9, '古い行は平均の対数で代用');
}

/* ---------- 日付 ---------- */
assert.equal(an.anMondayOf_('2026-09-30'), '2026-09-28');   // 水 → 月
assert.equal(an.anMondayOf_('2026-09-28'), '2026-09-28');
assert.equal(an.anMondayOf_('2026-10-04'), '2026-09-28');   // 日 → 前の月
assert.equal(an.anFyStart_('2026-03-31'), '2025-04-01');
assert.equal(an.anFyStart_('2026-04-01'), '2026-04-01');

/* ---------- 権限の書式 ---------- */
{
  const p = an.anParseAnalysts_(' A@x.jp:3-1|3-2 , b@y.jp:*, c@z.jp ');
  assert.deepEqual(JSON.parse(JSON.stringify(p)), { 'a@x.jp': { '3-1': true, '3-2': true }, 'b@y.jp': '*', 'c@z.jp': '*' });
}

/* ---------- 合成データで分析 ---------- */
const cfg = JSON.parse(JSON.stringify(an.AN_DEFAULTS));
const units = { kuku: { title: '九九', types: { d7: '7の段', d8: '8の段' } }, bignum: { title: '大きな数', types: { p: '位取り' } } };
const roster = [];
for (let i = 0; i < 60; i++) roster.push({ mail: `k${i}@kyoiku.edu.nishi.or.jp`, grade: 3, cls: i < 30 ? '1' : '2', no: (i % 30) + 1, name: `なまえ${i}` });
roster.push({ mail: 'other@kyoiku.edu.nishi.or.jp', grade: 4, cls: '1', no: 1, name: '4年' });

// 週ごとの行。ms=想起時間の代表値、n=試行、miss=誤答
function fact(mail, unit, type, week, n, miss, ms) {
  const ntk = n - miss;
  return [mail, unit, type, week, n - miss, miss, ntk, ntk * Math.log(ms), ntk * Math.log(ms) ** 2, 0];
}
const weeks = ['2026-05-04', '2026-05-11', '2026-06-01', '2026-06-08', '2026-07-06', '2026-07-13',
               '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14'];
const facts = [];
roster.filter(r => r.grade === 3).forEach((r, i) => {
  weeks.forEach(w => {
    const wi = weeks.indexOf(w);
    let ms = (1500 + (i * 37) % 700) * (1 - 0.02 * wi * (1 + (i % 5) / 5));   // ふつうの児童はばらつき、少しずつ速くなる
    let miss = i % 3;
    if (i === 0) ms = 4000;                   // k0：全期間遅い → 強い低さが続く
    if (i === 1 && w.startsWith('2026-06')) ms = 4000;   // k1：6月だけ遅い → 続かない
    if (i === 2) ms = 3000 - wi * 150;     // k2：遅いが伸びている
    if (i === 3) ms = 3000;                              // k3：遅く、伸びない
    facts.push(fact(r.mail, 'kuku', 'd7', w, 12, miss, ms));
    facts.push(fact(r.mail, 'kuku', 'd8', w, 12, miss, ms * 1.05));
    facts.push([r.mail, 'kuku', '*', w, 0, 0, 0, 0, 0, 1]);
    if (i === 5) return;                                  // k5：大きな数をやっていない
    facts.push(fact(r.mail, 'bignum', 'p', w, 12, i === 0 ? 8 : miss, 2000));
  });
});
// 4年の児童と、年度の前の記録は比較に入らない
facts.push(fact('other@kyoiku.edu.nishi.or.jp', 'kuku', 'd7', '2026-05-04', 30, 0, 100));
facts.push(fact('k10@kyoiku.edu.nishi.or.jp', 'kuku', 'd7', '2026-03-02', 30, 0, 100));

const res = an.anCompute_(facts, roster, units, cfg, { grade: 3, cls: '1', today: '2026-09-30' });
const byMail = {};
res.children.forEach(c => { byMail[c.email.split('@')[0]] = c; });

assert.equal(res.children.length, 30, '返すのは学級の児童だけ');
assert.equal(res.classView.find(u => u.unit === 'kuku').normN, 60, '比較は学年全体');
assert.equal(res.classView.find(u => u.unit === 'kuku').normWarn, false);

const k0 = byMail.k0.units.kuku;
assert.equal(k0.speedBand, 2, 'k0 は強い低さ');
assert.ok(k0.speedPersist.on && k0.speedPersist.strong >= 2, 'k0 は下位が続く');
assert.ok(byMail.k0.units.bignum.accPersist.on, 'k0 は大きな数で誤答が多いのが続く');

const k1 = byMail.k1.units.kuku;
assert.equal(k1.speedPersist.months, 1, 'k1 は6月の1か月だけ帯に入る');
assert.equal(k1.speedPersist.on, false, '1か月だけでは下位としない');

assert.ok(byMail.k2.units.kuku.growth.pct > 50, 'k2 は伸びている');
assert.equal(byMail.k3.units.kuku.dual, true, 'k3 は水準も伸びも低い（二重の乖離）');
assert.equal(byMail.k2.units.kuku.dual, false, '遅くても伸びていれば二重の乖離にしない');
assert.equal(byMail.k0.units.kuku.sessions, weeks.length, '本番の回数');
assert.equal(byMail.k5.units.bignum, undefined, 'やっていない単元は出さない');

// 試行が足りない型×月は比較に入らない
{
  const few = facts.filter(f => !(f[0] === 'k7@kyoiku.edu.nishi.or.jp')).concat([fact('k7@kyoiku.edu.nishi.or.jp', 'kuku', 'd7', '2026-09-07', 5, 0, 9000)]);
  const r2 = an.anCompute_(few, roster, units, cfg, { grade: 3, cls: '1', today: '2026-09-30' });
  const k7 = r2.children.find(c => c.email.startsWith('k7@')).units.kuku;
  assert.equal(k7.speedPct, null, '5試行の9秒は判定しない');
  assert.equal(k7.speedBand, 0);
}

// 重なり：偶然の期待人数と並べる
const ov = res.overlaps.find(o => o.u1 === 'bignum' && o.u2 === 'kuku');
assert.ok(ov && ov.k >= 1 && ov.expected >= 0, '重なりを数える');
assert.equal(ov.n, 29, '両方の単元に記録がある児童だけ（k5 を除く）');

// 期間が短いと伸びは出さない
{
  const short = facts.filter(f => f[3] >= '2026-08-24');
  const r3 = an.anCompute_(short, roster, units, cfg, { grade: 3, cls: '1', today: '2026-09-30' });
  const g = r3.children[0].units.kuku.growth;
  assert.equal(g.short, true, '12週に満たない');
  assert.equal(g.pct, null);
}

/* ---------- 経験ベイズの縮め ---------- */
{
  const items = [{ email: 'a', n: 20, miss: 10 }, { email: 'b', n: 200, miss: 20 }, { email: 'c', n: 200, miss: 22 }, { email: 'd', n: 200, miss: 18 }];
  const s = an.anShrinkErr_(items);
  assert.ok(s.a < 0.5 && s.a > 0.1, '試行の少ない児童の極端な率は平均側へ寄る');
  assert.ok(Math.abs(s.b - 0.1) < 0.02, '試行の多い児童はほぼそのまま');
}

/* ---------- 手立ての前後比較 ---------- */
{
  const f2 = facts.filter(x => x[1] === 'kuku' && x[0] !== 'k4@kyoiku.edu.nishi.or.jp');
  ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'].forEach(w => f2.push(fact('k4@kyoiku.edu.nishi.or.jp', 'kuku', 'd7', w, 12, 2, 3000)));
  ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].forEach(w => f2.push(fact('k4@kyoiku.edu.nishi.or.jp', 'kuku', 'd7', w, 12, 0, 2000)));
  const s = { target: 'child:k4@kyoiku.edu.nishi.or.jp', unit: 'kuku', types: ['d7'], start: '2026-09-09', end: '' };
  const e = an.anSupportEffect_(f2, roster, s, cfg, '2026-09-30');
  assert.equal(e.window.start, '2026-09-07');
  assert.ok(e.target.rtRatio < 0.7, '対象は速くなった');
  assert.ok(e.rtRel < 0.8, '比較群を引いても速くなった');
  assert.ok(e.errRel < 0, '誤答率も比較群より減った');
  assert.equal(e.ongoing, true, '4週たっていないので途中');

  const sc = { target: 'class:3-1', unit: 'kuku', types: [], start: '2026-09-07', end: '' };
  const ec = an.anSupportEffect_(facts, roster, sc, cfg, '2026-09-30');
  assert.ok(ec.compare, '学級全体の手立ては他の学級と比べる');

  const lone = roster.filter(r => r.cls === '1');
  const el = an.anSupportEffect_(facts, lone, sc, cfg, '2026-09-30');
  assert.equal(el.compare, null, '比べる学級が無ければ比較なし');
  assert.equal(el.rtRel, null);
}

/* ---------- 書き出しに個人名・メールを入れない ---------- */
{
  const sup = [{ target: 'child:k0@kyoiku.edu.nishi.or.jp', unit: 'kuku', content: '7の段カード', start: '2026-09-07', end: '', effect: { rtRel: 0.9, errRel: -0.02, ongoing: true } }];
  const txt = an.anExportText_(res, sup, 2);
  assert.ok(!/なまえ/.test(txt), "氏名を含まない");
  assert.ok(!/@/.test(txt), 'メールを含まない');
  assert.ok(txt.includes('児童1名'), '対象は人数で書く');
  assert.ok(txt.includes('九九') && txt.includes('期待'));
}

/* ---------- 児童の経路に分析が載らない ---------- */
{
  const code = read('apps/hub/Code.gs');
  const boot = code.match(/function boot\(\)\{?[\s\S]*?\n\}/)[0];
  assert.ok(!/sheet/.test(boot), 'boot は記録シートの場所を児童へ渡さない');
  assert.ok(!/an[A-Z]\w*\(/.test(boot), 'boot から分析の関数を呼ばない');
  const route = code.match(/if \(page === 'analysis'\) \{[\s\S]*?\n  \}/)[0];
  assert.ok(/canAnalyze_\(email_\(\)\)/.test(route), '分析ページは canAnalyze_ で守る');
  assert.ok(!/isTeacher_/.test(route), '教師ドメインの一致では開かない');

  const c = read('common/Core.gs');
  const cboot = c.match(/function boot\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(!/writeMeta_/.test(cboot), '児童の起動で meta を書かない');
  assert.ok(/function getConfigForUI\(\) \{[\s\S]*?writeMeta_\(\)/.test(c), '教師画面を開くと meta を書く');
}

console.log('analysis ok');
