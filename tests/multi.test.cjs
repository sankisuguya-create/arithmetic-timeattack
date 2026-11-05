'use strict';
// 全単元を1つの GAS にまとめた時（UNIT_DEFS に2単元以上）の検査。
// 単元が1つのプロジェクトの動きは、他のテスト（loadUnit）が今までどおり確かめる。
const assert = require('node:assert/strict');
const vm = require('vm');
const { read, unitDir } = require('./lib/kit.cjs');

function gasEnv({ user = 'owner@edu.nishi.or.jp', props = {} } = {}) {
  const cacheStore = {}, sheets = {}, created = [], triggers = [], opened = [];
  let nextId = 1;
  const mkSS = (id, name) => {
    const tabs = {};
    return sheets[id] = { id, name, tabs,
      getId: () => id, getName: () => name, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
      getSheetByName: n => tabs[n] || null,
      getOwner: () => ({ getEmail: () => 'owner@edu.nishi.or.jp' }) };
  };
  const cache = {
    get: k => (k in cacheStore ? cacheStore[k] : null), put: (k, v) => { cacheStore[k] = String(v); }, remove: k => { delete cacheStore[k]; },
    getAll: ks => { const o = {}; ks.forEach(k => { if (k in cacheStore) o[k] = cacheStore[k]; }); return o; },
    putAll: m => { for (const k in m) cacheStore[k] = String(m[k]); }, removeAll: ks => ks.forEach(k => delete cacheStore[k]) };
  const ctx = {
    console,
    Session: { getActiveUser: () => ({ getEmail: () => user }), getEffectiveUser: () => ({ getEmail: () => 'owner@edu.nishi.or.jp' }), getScriptTimeZone: () => 'Asia/Tokyo' },
    Utilities: { formatDate: (d, tz, f) => { const s = new Date(d.getTime() + 9 * 3600e3);
      return f === 'yyyy' ? String(s.getUTCFullYear()) : f === 'M' ? String(s.getUTCMonth() + 1) : f === 'MMdd' ? String(s.getUTCMonth() + 1).padStart(2, '0') + String(s.getUTCDate()).padStart(2, '0') : ''; },
      getUuid: () => 'uuid-' + Math.random() },
    CacheService: { getScriptCache: () => cache },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => { throw new Error('まとめたプロジェクトで付属のスプレッドシートを開いた'); },
      openById: id => { opened.push(id); if (!sheets[id]) throw new Error('開けません ' + id); return sheets[id]; },
      create: name => { const s = mkSS('NEW' + (nextId++) + 'xxxxxxxxxxxxxxxxxxxx', name); created.push(s); return s; } },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/a/macros/edu.nishi.or.jp/s/AAA/exec' }),
      getProjectTriggers: () => triggers.map(fn => ({ getHandlerFunction: () => fn })),
      newTrigger: fn => ({ timeBased: () => ({ atHour: () => ({ everyDays: () => ({ create: () => triggers.push(fn) }) }),
        after: () => ({ create: () => triggers.push(fn) }) }) }),
      deleteTrigger: tr => { const i = triggers.indexOf(tr.getHandlerFunction()); if (i >= 0) triggers.splice(i, 1); } },
    HtmlService: { createHtmlOutput: h => ({ html: h, setTitle() { return this; } }) }
  };
  vm.createContext(ctx);
  const files = [read('common/Base.gs'), read('common/Core.gs')].concat(['kuku', 'weight', 'bai'].map(n => read(`${unitDir(n)}/Unit.gs`)));
  vm.runInContext(files.join('\n'), ctx);
  return { ctx, props, cacheStore, sheets, created, triggers, opened, mkSS };
}

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('まとめたプロジェクトだと分かる', () => {
  const { ctx } = gasEnv();
  assert.equal(ctx.isMulti_(), true);
  assert.equal(JSON.stringify(ctx.unitIds_().sort()), JSON.stringify(['bai', 'kuku', 'weight']));
});

t('単元ごとのスプレッドシート：登録したものを開く・未登録は1回だけ作る・付属のものは開かない', () => {
  const env = gasEnv();
  env.mkSS('KUKUxxxxxxxxxxxxxxxxxxxxxx', '九九（今までの）');
  env.ctx.registerUnitSheet('kuku', 'https://docs.google.com/spreadsheets/d/KUKUxxxxxxxxxxxxxxxxxxxxxx/edit#gid=0');
  env.ctx.useUnit_('kuku');
  assert.equal(env.ctx.ss_().getName(), '九九（今までの）');
  env.ctx.useUnit_('weight');
  const w = env.ctx.ss_();
  assert.equal(env.created.length, 1);
  assert.match(w.getName(), /weight/);
  env.ctx.useUnit_('weight'); env.ctx.ss_(); env.ctx.ss_();
  assert.equal(env.created.length, 1, '2回目からは作らない');
  assert.throws(() => env.ctx.registerUnitSheet('kuku', 'abc'), /URLかID/);
  assert.throws(() => env.ctx.useUnit_('nope'), /単元がありません/);
});

t('単元の登録は所有者だけ（児童が画面から直接呼んでも記録の置き場を付け替えられない）', () => {
  const env = gasEnv({ user: '12345678@kyoiku.edu.nishi.or.jp' });
  env.mkSS('EVILxxxxxxxxxxxxxxxxxxxxxx', 'x');
  assert.throws(() => env.ctx.registerUnitSheet('kuku', 'EVILxxxxxxxxxxxxxxxxxxxxxx'), /所有者/);
  assert.throws(() => env.ctx.listUnitSheets(), /所有者/);
  assert.equal(env.props['unit_sheet:kuku'], undefined);
  assert.throws(() => env.ctx.apiCall('kuku', 'baseSetHub', ['EVILxxxxxxxxxxxxxxxxxxxxxx']), /所有者|呼べない関数/);
  assert.throws(() => env.ctx.baseSetHub('EVILxxxxxxxxxxxxxxxxxxxxxx'), /所有者/);   // 画面から直接呼ばれても
});

t('一時保存とプロパティは単元ごとに分かれる', () => {
  const env = gasEnv(); const c = env.ctx;
  c.useUnit_('kuku'); c.cache_().put('config', 'K'); c.props_().setProperty('sign_key', 'k1');
  c.useUnit_('weight');
  assert.equal(c.cache_().get('config'), null);
  assert.equal(c.props_().getProperty('sign_key'), null);
  c.cache_().putAll({ a: '1', b: '2' });
  assert.equal(JSON.stringify(c.cache_().getAll(['a', 'b', 'z'])), '{"a":"1","b":"2"}');
  c.cache_().removeAll(['a']); assert.equal(c.cache_().get('a'), null);
  c.useUnit_('kuku');
  assert.equal(c.cache_().get('config'), 'K');
  assert.equal(c.signKey_(), 'k1');
  assert.ok(Object.keys(env.cacheStore).every(k => /^u:(kuku|weight):/.test(k)), '頭に単元の id が付く');
});

t('apiCall：呼ぶ前に単元を差し替え、呼べない関数ははねる', () => {
  const { ctx } = gasEnv();
  vm.runInContext("function probeApi(x) { return UNIT.id + ':' + x; }", ctx);
  assert.equal(ctx.apiCall('weight', 'probeApi', ['a']), 'weight:a');
  assert.equal(ctx.apiCall('kuku', 'probeApi', ['b']), 'kuku:b');
  for (const bad of ['ss_', 'doGet', 'apiCall', 'setup', 'nightlyAggregateAll', 'registerUnitSheet', 'no_such', 'eval', 'Function', 'parseInt', 'setTimeout', 'globalThis.x'])
    assert.throws(() => ctx.apiCall('kuku', bad, []), /呼べない関数|単元がありません/, bad);
  assert.throws(() => ctx.apiCall('nope', 'probeApi', []), /単元がありません/);
});

t('doGet：単元を選ばずに開くと一覧、?unit= でその単元', () => {
  const { ctx } = gasEnv();
  const page = ctx.doGet({ parameter: {} });
  assert.match(page.html, /\?unit=kuku/); assert.match(page.html, /\?unit=weight/);
  assert.match(ctx.doGet({ parameter: { unit: 'zzz' } }).html, /\?unit=bai/);
  let seen = null;
  ctx.ensureReady_ = () => { seen = ctx.UNIT.id; };
  ctx.HtmlService.createTemplateFromFile = () => ({ evaluate: () => ({ setTitle() { return this; }, addMetaTag() { return this; } }) });
  ctx.doGet({ parameter: { unit: 'weight' } });
  assert.equal(seen, 'weight');
});

t('URL：教師画面・児童に配る URL に unit= が付く', () => {
  const { ctx } = gasEnv(); ctx.useUnit_('bai');
  assert.equal(ctx.teacherUrl_(), 'https://script.google.com/a/macros/edu.nishi.or.jp/s/AAA/exec?unit=bai&page=teacher');
  assert.equal(ctx.unitUrl_(''), 'https://script.google.com/a/macros/edu.nishi.or.jp/s/AAA/exec?unit=bai');
});

t('自動実行：全単元を回す *All だけを置き、1単元の失敗で止まらない', () => {
  const env = gasEnv(); const c = env.ctx; c.useUnit_('kuku');
  c.ensureTriggers_(); c.ensureTriggers_();
  assert.equal(JSON.stringify(env.triggers.sort()), JSON.stringify(['nightlyAggregateAll', 'resetDailyAll', 'rolloverRosterAll']));
  const seen = [];
  c.nightlyAggregate = () => { seen.push(c.UNIT.id); if (c.UNIT.id === 'weight') throw new Error('壊れた'); };
  for (const id of ['bai', 'kuku', 'weight']) env.props['unit_sheet:' + id] = 'X' + id;
  const errs = c.nightlyAggregateAll();
  assert.equal(JSON.stringify(seen.sort()), JSON.stringify(['bai', 'kuku', 'weight']));
  assert.equal(errs.length, 1); assert.match(errs[0], /weight/);
});

t('自動実行：時間切れなら残りを continueAll に回し、続きで全単元が終わる', () => {
  const env = gasEnv(); const c = env.ctx;
  const seen = [];
  c.nightlyAggregate = () => seen.push(c.UNIT.id);
  for (const id of ['bai', 'kuku', 'weight']) env.props['unit_sheet:' + id] = 'X' + id;
  vm.runInContext('ALL_BUDGET_MS_ = -1;', c);              // 最初の単元の前に時間切れにする
  c.nightlyAggregateAll();
  assert.equal(seen.length, 0);
  assert.equal(JSON.stringify(env.triggers), JSON.stringify(['continueAll']));
  assert.equal(JSON.stringify(JSON.parse(env.props.all_todo).nightlyAggregate.sort()), JSON.stringify(['bai', 'kuku', 'weight']));
  vm.runInContext('ALL_BUDGET_MS_ = 270000;', c);
  c.continueAll();
  assert.equal(JSON.stringify(seen.sort()), JSON.stringify(['bai', 'kuku', 'weight']));
  assert.equal(env.triggers.length, 0, '続きの自動実行は消える');
  assert.equal(env.props.all_todo, undefined);
});

t('自動実行：スプレッドシートが未登録の単元は飛ばし、新しく作らない', () => {
  const env = gasEnv(); const c = env.ctx; const seen = [];
  c.nightlyAggregate = () => { seen.push(c.UNIT.id); c.ss_(); };
  env.mkSS('KUKUxxxxxxxxxxxxxxxxxxxxxx', '九九'); env.props['unit_sheet:kuku'] = 'KUKUxxxxxxxxxxxxxxxxxxxxxx';
  c.nightlyAggregateAll();
  assert.equal(JSON.stringify(seen), JSON.stringify(['kuku']));
  assert.equal(env.created.length, 0);
});

t('setup：まとめたプロジェクトでは全単元を準備し、所有者だけが実行できる', () => {
  const env = gasEnv(); const c = env.ctx; const seen = [];
  c.setupOne_ = () => { seen.push(c.UNIT.id); c.ss_(); return 'ok'; };
  env.mkSS('KUKUxxxxxxxxxxxxxxxxxxxxxx', '九九'); env.props['unit_sheet:kuku'] = 'KUKUxxxxxxxxxxxxxxxxxxxxxx';
  const r = c.setup();
  assert.match(r, /【kuku】ok/); assert.match(r, /【bai】未登録のため飛ばした/);
  assert.equal(JSON.stringify(seen), JSON.stringify(['kuku']));
  assert.equal(env.created.length, 0, 'setup は未登録の単元のスプレッドシートを作らない');
  const kid = gasEnv({ user: '1@kyoiku.edu.nishi.or.jp' });
  assert.throws(() => kid.ctx.setup(), /所有者/);
});

t('名簿：ハブが設定されていれば Base.gs でハブから読み、4/1 の単元ごとの名簿の退避はしない', () => {
  const env = gasEnv({ props: { HUB_ID: 'HUBxxxxxxxxxxxxxxxxxxxxxx' } });
  const hub = env.mkSS('HUBxxxxxxxxxxxxxxxxxxxxxx', 'ハブ');
  hub.tabs.roster = { getDataRange: () => ({ getValues: () => [['email', '学年', '組', '番号', '氏名'], ['1@kyoiku.edu.nishi.or.jp', 3, '1組', 4, '田中 はなこ']] }) };
  const c = env.ctx; c.useUnit_('kuku');
  assert.equal(JSON.stringify(c.rosterRows_()), JSON.stringify([{ mail: '1@kyoiku.edu.nishi.or.jp', grade: 3, cls: '1', no: 4, name: '田中 はなこ' }]));
  assert.equal(c.child_('1@kyoiku.edu.nishi.or.jp').name, '田中 はなこ');
  const before = env.opened.length + env.created.length;
  c.rolloverRoster(vm.runInContext("new Date('2027-04-01T03:00:00+09:00')", c));   // 模擬環境の中の Date で渡す（外の Date は instanceof で弾かれる）
  assert.equal(env.opened.length + env.created.length, before, 'ハブの名簿を使う時は単元のスプレッドシートを開かない（作らない）');
});

t('移行：ハブの links から単元のスプレッドシートを登録し、url を切り替え、戻せる', () => {
  const env = gasEnv({ props: { HUB_ID: 'HUBxxxxxxxxxxxxxxxxxxxxxx' } });
  const hub = env.mkSS('HUBxxxxxxxxxxxxxxxxxxxxxx', 'ハブ');
  env.mkSS('KUKUxxxxxxxxxxxxxxxxxxxxxx', '九九');
  const rows = [['id', 'title', 'subtitle', 'url', 'grades', 'color', 'visible', 'order', 'sheet'],
    ['kuku', '九九', '', 'OLD-kuku', '3', 'mint', true, 1, 'https://docs.google.com/spreadsheets/d/KUKUxxxxxxxxxxxxxxxxxxxxxx/edit'],
    ['weight', 'おもさ', '', 'OLD-weight', '3', 'mint', true, 2, ''],
    ['memo', '資料', '', 'OLD-memo', '', 'mint', true, 3, '']];
  const tab = vals => ({ getDataRange: () => ({ getValues: () => vals.map(r => r.slice()) }),
    getRange: (r, c, nr, nc) => ({ setValue: v => { vals[r - 1][c - 1] = v; }, setValues: v => { for (let i = 0; i < v.length; i++) vals[r - 1 + i] = v[i].slice(); } }) });
  hub.tabs.links = tab(rows);
  hub.insertSheet = name => { const v = []; hub.tabs[name] = tab(v); return hub.tabs[name]; };
  const c = env.ctx;
  const rep = c.importUnitSheetsFromHub();
  assert.match(rep, /kuku\t○/); assert.match(rep, /weight\t× links の sheet 列が空/); assert.match(rep, /bai\t- links に行が無い/);
  assert.equal(env.props['unit_sheet:kuku'], 'KUKUxxxxxxxxxxxxxxxxxxxxxx');
  c.switchHubLinks();
  assert.equal(rows[1][3], 'https://script.google.com/a/macros/edu.nishi.or.jp/s/AAA/exec?unit=kuku');
  assert.equal(rows[2][3], 'https://script.google.com/a/macros/edu.nishi.or.jp/s/AAA/exec?unit=weight');
  assert.equal(rows[3][3], 'OLD-memo', '単元でない行は触らない');
  assert.throws(() => c.switchHubLinks(), /links_backup が既に/);
  c.restoreHubLinks();
  env.props['unit_sheet:bai'] = 'JUNKxxxxxxxxxxxxxxxxxxxxxx';     // setup が作ってしまった登録
  assert.match(c.forgetCreatedUnitSheets(), /bai\t登録を外した/);
  assert.equal(env.props['unit_sheet:bai'], undefined);
  assert.equal(env.props['unit_sheet:kuku'], 'KUKUxxxxxxxxxxxxxxxxxxxxxx', '今までのスプレッドシートの登録は残す');
  assert.equal(JSON.stringify(rows.slice(1).map(r => r[3])), JSON.stringify(['OLD-kuku', 'OLD-weight', 'OLD-memo']));
  const kid = gasEnv({ user: '1@kyoiku.edu.nishi.or.jp', props: { HUB_ID: 'HUBxxxxxxxxxxxxxxxxxxxxxx' } });
  for (const f of ['importUnitSheetsFromHub', 'switchHubLinks', 'restoreHubLinks', 'forgetCreatedUnitSheets']) assert.throws(() => kid.ctx[f](), /所有者/, f);
});

t('画面の差し替え：google.script.run.xxx(…) が apiCall(単元, xxx, 引数) になり、つなぎ方はそのまま', () => {
  const { ctx } = gasEnv(); ctx.useUnit_('weight');
  const html = ctx.multiShim_();
  const js = html.replace(/^<script>/, '').replace(/<\/script>$/, '');
  const log = [];
  const runner = h => ({
    withSuccessHandler: f => runner(Object.assign({}, h, { s: f })),
    withFailureHandler: f => runner(Object.assign({}, h, { f })),
    withUserObject: o => runner(Object.assign({}, h, { u: o })),
    apiCall: (k, name, args) => { log.push([k, name, args]); if (h.s) h.s('ret:' + name, h.u); }
  });
  const page = { google: { script: { run: runner({}) } } };
  vm.createContext(page); vm.runInContext(js, page);
  let got = null, uo = null;
  page.google.script.run.withFailureHandler(() => {}).withSuccessHandler((r, u) => { got = r; uo = u; }).withUserObject({ q: 1 }).boot('x', 2);
  page.google.script.run.coopPeek();
  assert.equal(JSON.stringify(log), JSON.stringify([['weight', 'boot', ['x', 2]], ['weight', 'coopPeek', []]]));
  assert.equal(got, 'ret:boot'); assert.equal(JSON.stringify(uo), '{"q":1}');
});

t('単元が1つのプロジェクトでは差し替えは空・ss_ は付属のスプレッドシート', () => {
  const ctx = {}; vm.createContext(ctx);
  ctx.SpreadsheetApp = { getActiveSpreadsheet: () => 'ACTIVE' };
  vm.runInContext(read('common/Core.gs') + '\n' + read(`${unitDir('kuku')}/Unit.gs`), ctx);
  assert.equal(ctx.isMulti_(), false);
  assert.equal(ctx.multiShim_(), '');
  assert.equal(ctx.ss_(), 'ACTIVE');
});

console.log(`multi ${n} 件 ok`);
