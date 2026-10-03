'use strict';
// ハブの教師向け画面（apps/hub/teacher.html・analysis.html）の作り。
// - 見出しは1段（題名｜タブ｜…｜行き先）で、タブは単元の教師画面と同じ型
// - ボタンの役割（選ぶ／実行する／小さく変える／映し方を変える）は単元の教師画面と同じクラス
// - 固定の書式は style 属性に書かない（残すのは JS が出し入れする display と、値で決まる色だけ）
const assert = require('node:assert/strict');
const { read } = require('./lib/kit.cjs');

const ROLE_CSS = ['.bkey{', '.bkey.go{', '.bstep{', '.bview{', '.pick{', '.pick.on{', '.topbar{', '.tab.on{'];
const fixedStyles = src => (src.match(/style="[^"]*"/g) || []).filter(x => x !== 'style="display:none"' && !/\+/.test(x));

/* ---- ハブ設定 ---- */
{
  const t = read('apps/hub/teacher.html');
  ROLE_CSS.forEach(k => assert.ok(t.includes(k), 'teacher: ' + k));
  const top = t.slice(t.indexOf('<div class="topbar">'), t.indexOf('<!-- ============ 単元リンク'));
  ['<h1>ハブ設定</h1>', 'id="maintabs"', 'class="tab on" data-p="links"', 'id="where"', 'id="golinks"'].forEach(k => assert.ok(top.includes(k), k));
  ['id="save" class="bkey go"', 'id="saveTabs" class="bkey go"', 'id="saveCfg" class="bkey go"', 'id="add" class="bstep"',
   'class="pick\'+(l.visible', 'class="bstep sm" data-mv="up"', 'class="bstep sm" data-del="1"'].forEach(k => assert.ok(t.includes(k), k));
  assert.ok(!/class="[^"]*\b(ghost|tiny|pill)\b/.test(t), '古い ghost／tiny／pill は使わない');
  assert.deepEqual(fixedStyles(t), [], '固定の書式が style 属性に残っている');
  // 未保存の印と保存ボタンは共通の型
  assert.ok(t.includes('function markDirty_(boxId, btnId, v){') && (t.match(/markDirty_\(/g) || []).length === 4);
  assert.ok(t.includes('function saveWith_(btn, statId, call, done){') && (t.match(/saveWith_\(/g) || []).length === 4);
  assert.ok(t.includes("b.setAttribute('aria-current', 'page')"));
}

/* ---- 単元横断分析 ---- */
{
  const a = read('apps/hub/analysis.html');
  ROLE_CSS.forEach(k => assert.ok(a.includes(k), 'analysis: ' + k));
  const top = a.slice(a.indexOf('<div class="topbar">'), a.indexOf('<!-- ============ 児童別'));
  ['<h1>単元横断分析</h1>', 'id="tabs"', 'class="tab on" data-p="kids"', 'id="cls"', 'id="srcs"', 'class="guide"', 'id="ingest"'].forEach(k => assert.ok(top.includes(k), k));
  ['id="sSave" class="bkey go"', 'id="decSave" class="bkey go"', 'class="bkey" id="ingest"', 'id="copy" class="bstep"',
   'class="bview" data-sup=', 'class="bkey sm" data-end='].forEach(k => assert.ok(a.includes(k), k));
  assert.ok(!/class="[^"]*\b(ghost|tiny)\b/.test(a), '古い ghost／tiny は使わない');
  assert.deepEqual(fixedStyles(a), [], '固定の書式が style 属性に残っている');
  assert.ok(a.includes("b.setAttribute('aria-current', 'page')"));
}

/* ---- 狭い画面：見出しは折り返し、列は画面より広がらない ---- */
['apps/hub/teacher.html', 'apps/hub/analysis.html'].forEach(p => {
  const s = read(p);
  assert.ok(s.includes('.topbar{flex-wrap:wrap;'), p);
  assert.ok(s.includes('.split > .box{min-height:0;min-width:0;'), p);
});

/* ---- 単元の教師画面：未保存の印と保存ボタンはハブと同じ型（esc は5画面すべて同一実装） ---- */
{
  const t = read('common/teacher.html');
  // 未保存の印は markDirty_、保存ボタンは saveWith_ に寄せる（ハブと同じ型）
  assert.ok(t.includes('function markDirty_(boxId, btnId, base, v){'), 'common/teacher.html に markDirty_ がない');
  assert.equal((t.match(/markDirty_\(/g) || []).length, 3, 'markDirty_ は定義+2箇所（全般設定・公開モード）');
  assert.ok(t.includes('function saveWith_(btn, statId, call, done, opts){'), 'common/teacher.html に saveWith_ がない');
  assert.equal((t.match(/saveWith_\(/g) || []).length, 8,
    'saveWith_ は定義+7箇所（設定・公開モード・グループ分け・終了・じぶん出題・回の保存・見返す回）。agg は集計なので対象外');
}
{
  // esc は5画面すべて同じ実装（コメントは違ってよいが、関数の中身は一字一句同じ）
  const ESC = "function esc(s){\n" +
    "  return String(s==null?'':s).replace(/[&<>\"]/g, function(c){\n" +
    "    return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];\n" +
    "  });\n" +
    "}";
  ['common/index.html', 'common/teacher.html', 'apps/hub/teacher.html', 'apps/hub/analysis.html', 'apps/hub/links.html']
    .forEach(p => assert.ok(read(p).includes(ESC), p + ' の esc が共通実装と違う'));
}

console.log('hub_ui.test.cjs: all assertions passed.');
