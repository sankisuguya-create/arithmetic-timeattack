'use strict';
// 全単元をまとめた GAS に貼るファイル一式を dist/multi/ に作る。
//   node tools/bundle/build.cjs          作る
//   node tools/bundle/build.cjs --check  作り直さずに、dist/multi/ が今のソースと一致するかだけ見る（tests/bundle.test.cjs が使う）
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'dist', 'multi');
const { unitNames, unitDir } = require(path.join(ROOT, 'tests', 'lib', 'kit.cjs'));

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
    'coop_shared.html': copy('common/coop_shared.html')
  };
}

const want = files();
if (process.argv.includes('--check')) {
  const bad = Object.keys(want).filter(f => !fs.existsSync(path.join(OUT, f)) || fs.readFileSync(path.join(OUT, f), 'utf8') !== want[f]);
  if (bad.length) { console.error('dist/multi/ が古い: ' + bad.join(', ') + '（node tools/bundle/build.cjs で作り直す）'); process.exit(1); }
  console.log('dist/multi/ は最新');
} else {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f in want) fs.writeFileSync(path.join(OUT, f), want[f]);
  console.log('dist/multi/ を作った: ' + Object.keys(want).join(', '));
}
