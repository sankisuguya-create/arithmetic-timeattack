'use strict';
// 起動の控え・未送信の記録が単元ごとに分かれていること（docs/ARCHITECTURE.md「起動の速さ」）。
// GAS のウェブアプリはどの単元も iframe の同じパスで動くので、パスで分けると単元どうしで混ざる
// （あまりのあるわり算を開くと九九の控えが描かれていた）。
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'common', 'index.html'), 'utf8');

// サーバーのテンプレートが埋め込む箇所は3つだけ（単元の id、Core.gs の版の番号、協力プレイの共有層）
const SCRIPTLETS = ['<?!= JSON.stringify(String(UNIT.id)) ?>', '<?!= ENGINE_VER ?>', "<?!= include('coop_shared') ?>"];
for (const s of SCRIPTLETS) assert.equal(src.split(s).length - 1, 1, s + ' は1つだけ');
// index.html には、ほかにテンプレートの記号が無い（あると GAS の評価で壊れる）
assert.equal(src.split('<?').length - 1, SCRIPTLETS.length);
// 版は Core.gs の ENGINE_VER が唯一の宣言 — teacher.html もスクリプレットで受け取る
{
  const t = fs.readFileSync(path.join(__dirname, '..', 'common', 'teacher.html'), 'utf8');
  assert.equal(t.split('var WANT_VER = <?!= ENGINE_VER ?>;').length - 1, 1, 'teacher.html の WANT_VER も scriptlet');
  assert.equal(t.split("<?!= include('coop_shared') ?>").length - 1, 1, 'teacher.html にも共有層の挿入は1つだけ');
  const core = fs.readFileSync(path.join(__dirname, '..', 'common', 'Core.gs'), 'utf8');
  assert.equal(core.split('var ENGINE_VER = ').length - 1, 1, 'ENGINE_VER の宣言は Core.gs に1つだけ');
  assert.ok(!/var WANT_VER = \d/.test(src) && !/var WANT_VER = \d/.test(t), 'WANT_VER の手書き数値が残っている');
}

function pick(name) {
  const m = src.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert.ok(m, name + ' が見つからない'); return m[0];
}
function line(re) { const m = src.match(re); assert.ok(m, String(re)); return m[0]; }

function ctxFor(unitId, store) {
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const c = vm.createContext({ localStorage: ls, location: { pathname: '/userCodeAppPanel' }, JSON });
  vm.runInContext('var APP_ID = ' + JSON.stringify(unitId) + ';\n' +
    line(/var BOOT_KEY = .*;/) + '\n' + pick('bootCacheSave') + '\n' + pick('bootCacheLoad') + '\n' +
    line(/var PEND_KEY = .*;/) + '\n' + pick('pendSave') + '\n' + pick('pendWrite') + '\n' + pick('pendLoad') + '\n' + pick('pendClear'), c);
  return c;
}

const store = {};
const kuku = ctxFor('kuku', store), divmod = ctxFor('divmod', store);
kuku.bootCacheSave({ ok: true, unit: { id: 'kuku', modes: [{ id: 1 }] } });
assert.ok(kuku.bootCacheLoad(), '九九は自分の控えを読める');
assert.equal(divmod.bootCacheLoad(), null, 'あまりのあるわり算は九九の控えを読まない');

// 同じキーに別の単元の中身が入っていても使わない
store[vm.runInContext('BOOT_KEY', divmod)] = JSON.stringify({ ok: true, unit: { id: 'kuku', modes: [{ id: 1 }] } });
assert.equal(divmod.bootCacheLoad(), null);

// 未送信の記録も単元ごと
kuku.pendSave({ token: 't1' });
assert.equal(divmod.pendLoad().length, 0);
assert.equal(kuku.pendLoad()[0].token, 't1');
kuku.pendClear('t1');
assert.equal(kuku.pendLoad().length, 0);

console.log('cache: ok');
