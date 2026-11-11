'use strict';
// 学習BASE の新しい形の記録（1問ぶんの形・技能の目録）と、代わりに取り組む（本人の切り替え）の検査
const assert = require('node:assert/strict');
const vm = require('vm');
const { read, unitDir, unitNames } = require('./lib/kit.cjs');

const ctx = { console, Session: { getActiveUser: () => ({ getEmail: () => 'na@edu.nishi.or.jp' }) } };
vm.createContext(ctx);
vm.runInContext(read('common/Core.gs') + '\n' + unitNames().map(n => read(`${unitDir(n)}/Unit.gs`)).join('\n'), ctx);
ctx.useUnit_('kuku');

// 1問ぶん：ok は一度で正答した時だけ。時間（first）も一度で正答した時だけ
const qq = { t: 'A', tag: '7x8' };
let o = ctx.lbItem_({ i: 3, tk: 1200, ms: 1500 }, qq, [[56]], true, true);
assert.equal(JSON.stringify(o), JSON.stringify({ i: 3, q: '7x8', t: 'A', a: '56', tries: 1, hit: true, ok: true, skill: 'math/kuku/A', first: 1200 }));
o = ctx.lbItem_({ i: 4, tk: 900, ms: 3000 }, qq, [[54], [56]], true, false);
assert.equal(o.ok, false, 'やり直して当たったものは正答に数えない');
assert.equal(o.hit, true); assert.equal(o.tries, 2); assert.equal(o.first, undefined, '時間は一度で正答した問題だけ');
o = ctx.lbItem_({ i: 5, tk: 0 }, qq, [], false, false);
assert.equal(o.a, ''); assert.equal(o.ok, false);
console.log('ok 1問ぶんの形');

// 技能の目録：全単元の型・キーが重ならない・到達の基準
const cat = ctx.tamathCatalog_();
assert.equal(cat.app, 'tamath');
const keys = cat.skills.map(s => s.key);
assert.equal(new Set(keys).size, keys.length);
const nTypes = unitNames().reduce((n, u) => { ctx.useUnit_(u); return n + Object.keys(ctx.UNIT.types || {}).length; }, 0);
assert.equal(keys.length, nTypes);
assert.ok(keys.some(k => k.startsWith('math/kuku/')));
assert.ok(cat.skills.every(s => s.label && !/タイムアタック/.test(s.label)), '名前にタイムアタックを入れない');
assert.equal(cat.mastery.acc, 0.9); assert.equal(cat.mastery.minN, 20);
console.log('ok 技能の目録（' + keys.length + ' 技能）');

// 単元の欄に載せた学習者ID
assert.equal(JSON.stringify(ctx.parseUnitKey_('kuku|as=Labc')), JSON.stringify({ unit: 'kuku', as: 'Labc' }));
assert.equal(JSON.stringify(ctx.parseUnitKey_('kuku')), JSON.stringify({ unit: 'kuku', as: '' }));
console.log('ok 単元の欄の分け方');

// 代わりに取り組む：学習BASE が無い（単体の GAS）なら使えない
assert.throws(() => ctx.setActAs_('Labc'), /学習BASE の中でだけ/);
// 学習BASE の中：Base.actAs が通れば児童として振る舞う（メールの無い転入生は lid:…）
ctx.Base = { hubId: () => 'HUB', actAs: lid => { if (lid === 'Lbad') throw new Error('担当していない学級の児童です'); return { learner: { lid, mail: lid === 'Ltennyu' ? '' : '9@kyoiku.edu.nishi.or.jp', grade: 3, cls: '1', no: 30, name: '転入 太郎' }, by: 'na@edu.nishi.or.jp' }; } };
ctx.setActAs_('Ltennyu');
assert.equal(ctx.email_(), 'lid:Ltennyu');
ctx.useUnit_("kuku");
assert.match(ctx.multiShim_(), /KEY="kuku\|as=Ltennyu"/, '画面の呼び出しにも学習者IDが載る');
ctx.setActAs_('Lmail');
assert.equal(ctx.email_(), '9@kyoiku.edu.nishi.or.jp');
assert.throws(() => ctx.setActAs_('Lbad'), /担当していない/);
console.log('ok 代わりに取り組む');
// 過去の記録（log）→ 集計の形：一度で正答した数・件数（＋一度で正答しなかった問題）・時間の統計。名簿にない人・境目より後は取り込まない
{
  ctx.ACT_ = { lid: '', learner: null, by: '' };
  vm.runInContext("ACT_ = { lid: '', learner: null, by: '' };", ctx);
  const head = ctx.LOG_DEF_.map(d => d[1]);
  const row = (ts, mail, tstat, miss) => { const r = new Array(head.length).fill(''); r[0] = new Date(ts); r[1] = mail; r[2] = 3; r[3] = '1'; r[4] = 5; r[ctx.LOG_COL_.TSTAT] = tstat; r[ctx.LOG_COL_.MISS] = miss; return r; };
  const rows = [head,
    row('2026-10-01T10:00:00+09:00', 'a@kyoiku.edu.nishi.or.jp', 'x7:3:4500:3:3600:4400000:20.7:142.9,x8:2:3000:2:2400:2900000:13.8:95.3', 'x7:7x6,x9:9x3'),
    row('2026-10-02T10:00:00+09:00', 'nobody@kyoiku.edu.nishi.or.jp', 'x7:1:1:1:1:1:0:0', ''),
    row('2026-11-20T10:00:00+09:00', 'a@kyoiku.edu.nishi.or.jp', 'x7:1:1:1:1:1:0:0', '')];
  const sheet = { getLastRow: () => rows.length, getRange: (r, c, nr, nc) => ({ getValues: () => rows.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)) }) };
  ctx.ss_ = () => ({ getSheetByName: n => (n === 'log' ? sheet : null) });
  ctx.Base = { hubId: () => 'HUB', roster: () => [{ lid: 'La', mail: 'a@kyoiku.edu.nishi.or.jp' }, { lid: 'Lt', mail: '' }] };
  const out = ctx.lbLegacySessions_('kuku', '2026-11-10T00:00:00+09:00');
  assert.equal(out.length, 1, '名簿にない人・境目より後は取り込まない');
  const sk = out[0].skills;
  assert.equal(out[0].lid, 'La'); assert.equal(out[0].app, 'tamath'); assert.equal(out[0].context, 'live');
  assert.equal(JSON.stringify(sk['math/kuku/x7']), JSON.stringify({ n: 4, ok: 3, tn: 3, sl: 20.7, sl2: 142.9, mis: {} }));
  assert.equal(sk['math/kuku/x8'].n, 2); assert.equal(sk['math/kuku/x9'].n, 1); assert.equal(sk['math/kuku/x9'].ok, 0);
  console.log('ok 過去の記録を集計の形に');
}
// 学習BASE の指示：練習の「ぜんぶ」で指示した型を半分出す。見せる指示の型だけ画面に渡す。単体の GAS・読めない時は何もしない
{
  vm.runInContext("ACT_ = { lid: '', learner: null, by: '' };", ctx);
  ctx.useUnit_('kuku');
  const mode = ctx.modeIds_()[0], types = ctx.typesInMode_(mode), target = types[types.length - 1];
  assert.equal(JSON.stringify(ctx.lbDirectives_('a@kyoiku.edu.nishi.or.jp')), '[]', '学習BASE が無ければ指示は無い');
  Object.assign(ctx, { email_: () => 'a@kyoiku.edu.nishi.or.jp', child_: () => ({ email: 'a@kyoiku.edu.nishi.or.jp', grade: 3, cls: '1', name: 'あ' }),
    modeAllowed_: () => true, openFor_: () => ({}), seqOffFor_: () => ({}), triesForGate_: () => ({}), nGateFor_: () => 0, typesByMode_: () => ({ [mode]: types }) });
  let dirs = [{ id: 'D1', skill: 'math/kuku/' + target, show: false }, { id: 'D2', skill: 'math/divmod/x', show: true }];
  ctx.Base = { hub: () => 'HUB', child: () => ({ lid: 'La' }) };
  ctx.LbDirectives = { WEIGHT_SHARE: 0.5, forLearner: (hub, lid, app) => { assert.equal(lid, 'La'); assert.equal(app, 'tamath'); return dirs; } };
  assert.equal(JSON.stringify(ctx.lbDirectives_('x')), JSON.stringify([{ id: 'D1', t: target, show: false }]), 'いまの単元の型だけ');
  const share = () => { let hit = 0; for (let i = 0; i < 400; i++) if (ctx.nextPracticeItem(mode, '').t === target) hit++; return hit / 400; };
  const base = (() => { const d = dirs; dirs = []; const r = share(); dirs = d; return r; })();
  const withDir = share();
  assert.ok(withDir > base + 0.3, '指示した型が増える（指示なし ' + base.toFixed(2) + ' → 指示あり ' + withDir.toFixed(2) + '）');
  assert.ok(withDir < 0.8, 'ほかの型も出る（半分まぜる）：' + withDir.toFixed(2));
  // 型を選んだ練習は、選んだ型のまま
  const other = types[0];
  for (let i = 0; i < 50; i++) assert.equal(ctx.nextPracticeItem(mode, other).t, other);
  // 読めない時も練習は止めない
  ctx.LbDirectives.forLearner = () => { throw new Error('ハブが開けない'); };
  assert.ok(ctx.nextPracticeItem(mode, '').ok);
  console.log('ok 指示：練習の「ぜんぶ」で指示した型を半分出す（' + base.toFixed(2) + ' → ' + withDir.toFixed(2) + '）');
  // 画面に渡す「★ おすすめ」：見せると選んだ指示の型だけ
  ctx.LbDirectives.forLearner = () => [{ id: 'D1', skill: 'math/kuku/' + target, show: false }, { id: 'D3', skill: 'math/kuku/' + other, show: true }];
  Object.assign(ctx, { config_: () => ({ limit_sec: 60, miss_limit: 3 }), isTeacher_: () => false, bests_: () => ({ best: {}, practiceBest: {}, stars: {}, tries: {}, floor: { tcm: {} } }),
    nUnlockFor_: () => 0, lockNotes_: () => ({}), medals_: () => ({}), coopForChild_: () => ({ active: false }), classKey_: () => '3-1', figCount_: () => 0 });
  const b = ctx.boot();
  assert.equal(JSON.stringify(b.reco), JSON.stringify([other]), '見せない指示の型は画面に渡さない');
  console.log('ok 指示：おすすめは見せる指示の型だけ');
  delete ctx.LbDirectives; delete ctx.Base;
}
console.log('lbsession ok');
