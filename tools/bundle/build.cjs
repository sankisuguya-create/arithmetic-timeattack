'use strict';
// 全単元をまとめた GAS に貼るファイル一式を dist/multi/ に作る。
//   node tools/bundle/build.cjs          作る
//   node tools/bundle/build.cjs --check  作り直さずに、dist/multi/ が今のソースと一致するかだけ見る（tests/bundle.test.cjs が使う）
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'dist', 'multi');
const { unitNames, unitDir } = require(path.join(ROOT, 'tests', 'lib', 'kit.cjs'));

/**
 * 学習BASE の中で、児童の画面のプログラムを jsDelivr から読む形（dist/multi/web/index.js）。
 * GAS は小さな枠（Core.gs の webShell_）だけを返し、端末は2回目からブラウザに保存した分を使う（約39万字を毎回送らない）。
 * index.html の <style>・<body> の中身・<script> を1つの JS にする。中身は index.html と同じ（テンプレートの2か所だけ置き換える）
 */
function webIndex(html, coop) {
  const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
  const bodyStart = html.indexOf('<body>') + 6, scriptStart = html.indexOf('<script>', bodyStart);
  const body = html.slice(bodyStart, scriptStart);
  let js = html.slice(scriptStart + 8, html.lastIndexOf('</script>'));
  const appId = "var APP_ID = <?!= JSON.stringify(String(UNIT.id)) ?>;";
  if (!js.includes(appId) || !js.includes("<?!= include('coop_shared') ?>")) throw new Error('index.html のテンプレートの箇所が見つからない（web/index.js を作れない）');
  js = js.replace(appId, 'var APP_ID = String(window.LB_APP_ID || "");');
  if (/<\?/.test(js.replace("<?!= include('coop_shared') ?>", '') + body + css)) throw new Error('index.html に置き換えていないテンプレートが残っている');
  js = js.replace("<?!= include('coop_shared') ?>", () => coop);   // coop_shared の説明の注記の中の <?!= は、そのまま（JS の注記）
  const strict = /^\s*'use strict';/.test(js);
  if (strict) js = js.replace(/^\s*'use strict';/, '');
  return '// 生成物：common/index.html から tools/bundle/build.cjs が作る（直接直さない）。学習BASE の中の児童の画面\n' +
    (strict ? "'use strict';\n" : '') +
    '(function () { var st = document.createElement("style"); st.textContent = ' + JSON.stringify(css) + '; document.head.appendChild(st);\n' +
    '  document.body.insertAdjacentHTML("afterbegin", ' + JSON.stringify(body) + ');\n' +
    '  var bm = document.getElementById("lbBootMsg"); if (bm) bm.remove(); })();\n' + js;
}

function files() {
  const units = unitNames().slice().sort();
  const all = ['// AllUnits.gs — 全単元の Unit.gs をつないだもの（tools/bundle/build.cjs が作る。直接直さない）',
    '// 単元: ' + units.join(', '), ''].concat(units.map(n => {
      const rel = `${unitDir(n)}/Unit.gs`;
      return `// ===== ${rel} =====\n` + fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s*$/, '\n');
    })).join('\n');
  const copy = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  return {
    'Base.gs': copy('common/Base.gs'),
    'Core.gs': copy('common/Core.gs'),
    'AllUnits.gs': all,
    'index.html': copy('common/index.html'),
    'teacher.html': copy('common/teacher.html'),
    'coop_shared.html': copy('common/coop_shared.html'),
    'web/index.js': webIndex(copy('common/index.html'), copy('common/coop_shared.html'))
  };
}

const want = files();
if (process.argv.includes('--check')) {
  const bad = Object.keys(want).filter(f => !fs.existsSync(path.join(OUT, f)) || fs.readFileSync(path.join(OUT, f), 'utf8') !== want[f]);
  if (bad.length) { console.error('dist/multi/ が古い: ' + bad.join(', ') + '（node tools/bundle/build.cjs で作り直す）'); process.exit(1); }
  console.log('dist/multi/ は最新');
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f in want) { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.writeFileSync(path.join(OUT, f), want[f]); }
  console.log('dist/multi/ を作った: ' + Object.keys(want).join(', '));
}
