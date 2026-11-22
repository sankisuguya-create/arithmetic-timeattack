/** 分数TA：出題の算術・桁・型の網羅、大小の正答、分数の欄の並び（分母→分子）を検査する */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('common/Core.gs') + '\n' + read(require('./lib/kit.cjs').unitDir('bunsu') + '/Unit.gs'), ctx);
const unit = ctx.UNIT;
const seen = new Set();
const fr = s => { if (s === '1') return 1; const [n, d] = s.split('/').map(Number); return n / d; };

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

for (let mode = 1; mode <= 6; mode++) {
  for (let i = 0; i < 3000; i++) {
    const it = unit.gen(rand, mode);
    seen.add(it.t);
    assert.ok(unit.types[it.t], it.t);
    for (const f of it.f) {
      const cap = unit.digitCap[it.t][f];
      assert.equal(cap, 1);
      assert.ok(Number.isInteger(it.ans[f]) && it.ans[f] >= 1 && it.ans[f] <= 9, JSON.stringify(it));
    }
    if (it.f.length === 2) {
      assert.equal(it.f.join(','), '分母,分子');                 // 分母から打つ
      assert.ok(it.ans['分子'] < it.ans['分母'], JSON.stringify(it));   // 答えは1未満の真分数
      assert.ok(it.rows[0].includes('_1/_0'));
    }
    const a = it.ans;
    if (it.t === 'J') assert.ok(Math.abs(fr(it.q[0]) + fr(it.q[2]) - a['分子'] / a['分母']) < 1e-9);
    if (it.t === 'K' || it.t === 'L') assert.ok(Math.abs(fr(it.q[0]) - fr(it.q[2]) - a['分子'] / a['分母']) < 1e-9);
    if (it.t === 'J' || it.t === 'K' || it.t === 'L') assert.equal(a['分母'], Number(it.q[2].split('/')[1]));
    if ('GHI'.includes(it.t)) {
      const [ls, rs] = it.tag.slice(1).split('v'); const l = fr(ls), r = fr(rs);
      assert.equal(a[''], l > r ? 1 : l === r ? 2 : 3, JSON.stringify(it));
      assert.ok(it.fig.includes('data-pick="' + a[''] + '"'));
    }
    if (it.t === 'D') assert.equal(a[''], 1);
    if (it.t === 'C' || it.t === 'E') assert.ok(it.ans[it.f[0]] >= 2);
  }
}
assert.equal([...seen].sort().join(), Object.keys(unit.types).sort().join());
assert.equal(unit.fmtAnswer('J', ['10', '3']), '3/10');
assert.equal(unit.fmtAnswer('G', ['3']), '<');

// 共通画面：分数の残像は「分子/分母」の上下で出る
const ui = read('common/index.html');
const c = vm.createContext({ UNITS: {}, OPS: {} });
for (const name of ['fracSlots_', 'fracHtml_', 'ghostHtml_']) {
  const m = ui.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
  assert.ok(m, name); vm.runInContext(m[0], c);
}
const j = unit.gen(rand, 5);
assert.equal(c.ghostHtml_(j), '<span class="frac"><span>' + j.ans['分子'] + '</span><span>' + j.ans['分母'] + '</span></span>');
console.log('bunsu: 18000 questions, types, digit caps, comparisons and fraction ghost passed.');
