'use strict';
// 学習BASE（learning-base の読み込み係）の中で動く時の検査。
// 読み込み係は dist/multi の Core.gs ＋ AllUnits.gs を関数の中に包んで実行する（tools/bundle と同じ包み方をここで再現する）。
const assert = require('node:assert/strict');
const vm = require('vm'), fs = require('fs'), path = require('path');
const d = f => fs.readFileSync(path.join(__dirname, '..', 'dist', 'multi', f), 'utf8');

function platform() {
  const props = { 'u:kuku:ready_schema': '7' }, made = [], ctx = {
    console,
    LB_FILES: { 'tamath/index': d('index.html'), 'tamath/teacher': d('teacher.html'), 'tamath/coop_shared': d('coop_shared.html') },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    LB_APP_QUERY: 'app=tamath', LB_PLATFORM_TRIGGERS: true, LB_MODULES: {},
    Session: { getActiveUser: () => ({ getEmail: () => 'owner@edu.nishi.or.jp' }), getEffectiveUser: () => ({ getEmail: () => 'owner@edu.nishi.or.jp' }), getScriptTimeZone: () => 'Asia/Tokyo' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, getAll: () => ({}), putAll() {}, removeAll() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://x/exec' }), getProjectTriggers: () => [], newTrigger: n => { made.push(n); return { timeBased: () => ({ atHour: () => ({ everyDays: () => ({ create() {} }) }) }) }; } },
    HtmlService: {
      // 本物の GAS と同じく、<?!= ?> の中で見えるのはテンプレートに渡した名前と組み込みだけ（包んだ中の名前は見えない）
      createTemplate: src => { const t = { evaluate() {
        const names = Object.keys(t).filter(k => k !== 'evaluate'), vals = names.map(k => t[k]);
        const html = src.replace(/<\?!=([\s\S]*?)\?>/g, (m, expr) => String(new Function(...names, 'return (' + expr + ');')(...vals)));
        return { src: html, html, setTitle() { return this; }, addMetaTag() { return this; } }; } }; return t; },
      createTemplateFromFile: () => { throw new Error('学習BASE の中で GAS のファイルを読んだ'); },
      createHtmlOutputFromFile: () => { throw new Error('学習BASE の中で GAS のファイルを読んだ'); },
      createHtmlOutput: h => ({ html: h, setTitle() { return this; } })
    }
  };
  vm.createContext(ctx);
  const wrapped = "LB_MODULES['tamath'] = (function () {\nvar LB_RESOLVE_ = function (n) { return /^[A-Za-z][A-Za-z0-9]*$/.test(n) ? eval('typeof ' + n + \" === 'function' ? \" + n + ' : undefined') : undefined; };\n" +
    d('Core.gs') + '\n' + d('AllUnits.gs') + "\nreturn { doGet: doGet, apiCall: apiCall, setup: setup, ensureTriggers: ensureTriggers_, include: include, unitUrl: function () { return unitUrl_(''); }, useUnit: useUnit_ };\n})();";
  vm.runInContext(wrapped, ctx);
  return { ctx, made, M: ctx.LB_MODULES.tamath };
}

const { ctx, made, M } = platform();
// 包んだので、算数TA の関数は大域に出ない（読み込み係の doGet・apiCall を上書きしない）
assert.equal(typeof ctx.doGet, 'undefined'); assert.equal(typeof ctx.apiCall, 'undefined'); assert.equal(typeof ctx.UNIT_DEFS, 'undefined');
// 画面のファイルは LB_FILES から
assert.equal(M.include('coop_shared'), d('coop_shared.html'));
M.useUnit('kuku');
// URL に app=tamath
assert.equal(M.unitUrl(), 'https://x/exec?app=tamath&unit=kuku');
// 単元の一覧のリンクにも app=tamath
assert.match(M.doGet({ parameter: { app: 'tamath' } }).html, /exec\?app=tamath&unit=kuku/);
// 自動実行は置かない（読み込み係が置く）
M.ensureTriggers(); assert.equal(made.length, 0);
// apiCall は包んだ中の関数を名前で探す。組み込みの関数・_ で終わる関数・知らない関数ははねる
vm.runInContext("LB_MODULES.tamath.probe = 1", ctx);
assert.throws(() => M.apiCall('kuku', 'eval', ['1']), /呼べない関数/);
assert.throws(() => M.apiCall('kuku', 'ss_', []), /呼べない関数/);
assert.throws(() => M.apiCall('kuku', 'noSuchFn', []), /呼べない関数/);
assert.throws(() => M.apiCall('kuku', 'registerUnitSheet', ['x', 'y']), /呼べない関数/);
assert.equal(typeof M.apiCall('kuku', 'unitIdsForTest', []), 'object', 'テスト用の関数が見つからない');
// 児童画面・教師画面をテンプレートとして評価できる（包んだ中の名前を渡している）。差し替え（apiCall につなぐ）が入っている
const page = M.doGet({ parameter: { app: 'tamath', unit: 'kuku' } });
assert.match(page.src, /var APP_ID = "kuku";/);
assert.match(page.src, /r\.apiCall\(KEY/, '画面の差し替えが入っていない（サーバーを呼べない）');
const tpage = M.doGet({ parameter: { app: 'tamath', unit: 'kuku', page: 'teacher' } });
assert.match(tpage.src, /r\.apiCall\(KEY/);
console.log('platform ok');
