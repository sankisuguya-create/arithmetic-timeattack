'use strict';
// 単元テストの共有キット。
// 新しい単元を増やしたとき、tests/<unit>.test.cjs は loadUnit() から始める。
// 契約の検査（宣言の形・gen の返り値）は contract.test.cjs が全単元に自動で掛けるので、
// 単元ごとのテストは「その単元固有」の性質だけを書けばよい。

const fs = require('fs'), vm = require('vm'), path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

/**
 * 単元の置き場は apps/grade<学年>/<id>/。id から置き場を引く（id は学年をまたいで一意）。
 * 返り値は ROOT からの相対パス（例 'apps/grade3/kuku'）。
 */
function unitDir(id) {
  const apps = path.join(ROOT, 'apps');
  const hits = fs.readdirSync(apps).filter(g => /^(grade[1-6]|special)$/.test(g))
    .filter(g => fs.existsSync(path.join(apps, g, id, 'Unit.gs')));
  if (hits.length !== 1) throw new Error(`単元 ${id} の置き場が ${hits.length} 件あります（apps/grade*/${id}）`);
  return `apps/${hits[0]}/${id}`;
}

/**
 * Core.gs と <置き場>/Unit.gs を1つの vm コンテキストに読み込んで返す。
 * ctx.UNIT で宣言を、ctx.genQueue_ / ctx.typesInMode_ / ctx.match_ 等で
 * エンジン側の関数をそのまま叩ける。
 */
function loadUnit(name) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(read('common/Core.gs') + '\n' + read(`${unitDir(name)}/Unit.gs`), ctx);
  return ctx;
}

/** apps/grade<学年>/ の下で Unit.gs を持つ単元 id の一覧（hub のような非単元アプリは含まない） */
function unitNames() {
  const apps = path.join(ROOT, 'apps');
  const out = [];
  fs.readdirSync(apps).filter(g => /^(grade[1-6]|special)$/.test(g)).forEach(g => {
    fs.readdirSync(path.join(apps, g))
      .filter(d => fs.existsSync(path.join(apps, g, d, 'Unit.gs')))
      .forEach(d => out.push(d));
  });
  return out;
}

/**
 * 共通画面（index.html）のキー処理関数群を抽出して新しいコンテキストへ入れる。
 * input.handleInput('3') のように叩き、submit への到達を見る。
 * extraNames で単元固有の依存関数を足せる（divmod の veil 判定など）。
 */
function uiContext(unit, extraNames) {
  const src = read('common/index.html');
  const ctx = vm.createContext({
    DIGITCAP: unit.digitCap || {}, SCALE: unit.scale || {},
    performance: { now: () => 100 },
    paintSlots() {}, locked: false, ready: true, practice: false, firstKeyAt: 0
  });
  const names = ['digitCap_', 'valOf', 'currentAns', 'isRight', 'handleInput', 'moveField', 'capField_']
    .concat(extraNames || []);
  for (const name of names) {
    const m = src.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
    if (!m) throw new Error(name + ' が index.html に見つかりません');
    vm.runInContext(m[0], ctx);
  }
  return ctx;
}

module.exports = { ROOT, read, unitDir, loadUnit, unitNames, uiContext };
