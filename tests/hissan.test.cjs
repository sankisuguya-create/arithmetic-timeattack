'use strict';
// 2年 たしざん・ひきざん（中身は2けたの筆算）。出題の条件、筆算の並べ方、一の位から打つ入力の経路。
const assert = require('node:assert/strict');
const vm = require('vm');
const { loadUnit, read, uiContext } = require('./lib/kit.cjs');

const digits = n => [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100)];

/* ---- たしざん ---- */
{
  const ctx = loadUnit('tasu'), U = ctx.UNIT;
  const seen = {};
  for (const m of [1, 2, 3, 4, 5]) {
    const rand = ctx.rng_(100 + m);
    for (let i = 0; i < 3000; i++) {
      const it = U.gen(rand, m); seen[it.t] = (seen[it.t] || 0) + 1;
      const [x, , y] = it.q.map(Number);
      if (it.t === 'K') {
        assert.ok(x >= 1 && x <= 9 && y >= 1 && y <= 9 && x + y >= 10, it.tag);
        assert.equal(it.ans[''], x + y); assert.equal(it.rows, undefined);
        continue;
      }
      assert.ok(x >= 10 && x <= 99 && y >= 10 && y <= 99, it.tag);
      const s = x + y, c0 = x % 10 + y % 10 >= 10;
      if (it.t === 'A') assert.ok(!c0 && s < 100, it.tag);
      if (it.t === 'B') assert.ok(c0 && s < 100, it.tag);
      if (it.t === 'C') assert.ok(s >= 100, it.tag);
      assert.equal(it.f.join(), '一,十,百');
      assert.equal(it.f.map(u => it.ans[u]).join(), digits(s).join());
      assert.ok(it.col && it.rows[2].join() === ',_2,_1,_0', '答えの段は百・十・一の順に並べる');
      assert.equal(it.rows[0].join(''), String(x)); assert.equal(it.rows[1].slice(1).join(''), String(y));
      if (m !== 5) assert.equal(it.t, ['', 'K', 'A', 'B', 'C'][m]);
    }
  }
  ['K', 'A', 'B', 'C'].forEach(t => assert.ok(seen[t] > 1000, t));
  assert.equal(U.fmtAnswer('B', ['5', '8', '0']), '85');
  assert.equal(U.fmtAnswer('C', ['5', '2', '1']), '125');
  assert.equal(ctx.fmtByType_('B', '5/7/0'), '75', '誤答明細は普通の数で読む');
}

/* ---- ひきざん ---- */
{
  const ctx = loadUnit('hiku'), U = ctx.UNIT;
  const seen = {}, fKind = { one: 0, zero: 0 };
  for (const m of [1, 2, 3, 4, 5]) {
    const rand = ctx.rng_(200 + m);
    for (let i = 0; i < 3000; i++) {
      const it = U.gen(rand, m); seen[it.t] = (seen[it.t] || 0) + 1;
      const [x, , y] = it.q.map(Number), d = x - y;
      assert.ok(d >= 1, it.tag);
      if (it.t === 'K') {
        assert.ok(x >= 10 && x <= 18 && y >= 1 && y <= 9 && x % 10 < y && d <= 9, it.tag);
        assert.equal(it.ans[''], d); continue;
      }
      assert.ok(x >= 10 && x <= 99 && y >= 10 && y <= 99, it.tag);
      const borrow = x % 10 < y % 10;
      if (it.t === 'D') assert.ok(!borrow && d >= 10, it.tag);
      if (it.t === 'E') assert.ok(borrow && d >= 10 && x % 10 !== 0, it.tag);
      if (it.t === 'F') {
        assert.ok(d < 10 || (x % 10 === 0 && borrow), it.tag);
        fKind[d < 10 ? 'one' : 'zero']++;
      }
      assert.equal(it.f.map(u => it.ans[u]).join(), digits(d).slice(0, 2).join());
      assert.ok(it.col && it.rows[2].join() === ',_1,_0');
    }
  }
  ['K', 'D', 'E', 'F'].forEach(t => assert.ok(seen[t] > 1000, t));
  assert.ok(fKind.one > 500 && fKind.zero > 500, JSON.stringify(fKind));
  assert.equal(U.fmtAnswer('E', ['4', '2']), '24');
}

/* ---- 共通画面：一の位から打ち、画面は百・十・一の並び ---- */
{
  const U = loadUnit('tasu').UNIT;
  const src = read('common/index.html');
  const ui = uiContext(U, ['isSlotTok_', 'slotIdx_', 'colOrder_', 'colNum_']);
  const q = { t: 'C', q: ['67', '+', '58'], f: ['一', '十', '百'], ans: { '一': 5, '十': 2, '百': 1 }, col: true,
              rows: [['', '', '6', '7'], ['+', '', '5', '8'], ['', '_2', '_1', '_0']] };
  assert.deepEqual(Array.from(ui.colOrder_(q)), [2, 1, 0]);
  assert.equal(ui.colNum_(q, q.ans), '125');
  assert.equal(ui.colNum_(q, { '一': 5, '十': 8, '百': 0 }), '85', '上の位の0は書かない');
  assert.equal(ui.colNum_(q, { '一': 0, '十': 0, '百': 0 }), '0');

  // 入力：5 → 2 → 1 の順に打つと、一・十・百の欄に入り、そろった時点で確定する
  let sent = 0;
  vm.runInContext('var queue, qi = 0, fi = 0, typed = {}, mode = 4, pMode = 4;', ui);
  ui.queue = [q]; ui.typed = { '一': '', '十': '', '百': '' };
  ui.submit = () => { sent++; };
  ui.handleInput('5'); assert.equal(ui.fi, 1); assert.equal(sent, 0);
  ui.handleInput('2'); assert.equal(ui.fi, 2); assert.equal(sent, 0);
  ui.handleInput('1'); assert.equal(sent, 1);
  assert.equal(JSON.stringify(ui.typed), JSON.stringify({ '一': '5', '十': '2', '百': '1' }));

  // 和が2けたなら百の欄は空のまま確定する（空欄＝0）
  sent = 0;
  const q2 = { ...q, ans: { '一': 5, '十': 8, '百': 0 } };
  ui.queue = [q2]; ui.fi = 0; ui.typed = { '一': '', '十': '', '百': '' };
  ui.handleInput('5'); ui.handleInput('8'); assert.equal(sent, 1);

  // 描画：筆算の段は升目に並び、答えの段の上に線が入る
  assert.ok(/\.eq\.col \.line[^{]*\{display:grid/.test(src));
  assert.ok(src.includes("(ri === ruleRow ? ' rule' : '')"));
}

/* ---- 配信の形：col が届く ---- */
{
  const ctx = loadUnit('tasu');
  ctx.packQueue_(ctx.genQueue_(3, 2, 5)).forEach(x => { assert.equal(x[ctx.QI_.COL], 1); assert.ok(x[ctx.QI_.ROWS]); });
  ctx.packQueue_(ctx.genQueue_(3, 1, 5)).forEach(x => assert.equal(x[ctx.QI_.COL], 0));
}
console.log('hissan ok');

/* ---- 画面の切り替えはモードの宣言で決める（番号で決め打ちしない） ---- */
{
  const src = read('common/index.html');
  const nw = src.match(/function needsWide\(\)\{[\s\S]*?^\}/m)[0];
  assert.ok(!/=== *[0-9]/.test(nw), 'needsWide がモード番号を決め打ちしている');
  for (const u of ['length', 'weight']) {
    const ms = loadUnit(u).UNIT.modes.filter(m => m.wide).map(m => m.id);
    assert.equal(ms.join(), '5,6', u + ' のめもりモードに wide が無い');
  }
  for (const u of ['tasu', 'hiku']) {
    const U = loadUnit(u).UNIT;
    assert.equal(U.modes.filter(m => m.enterKey).map(m => m.id).join(), '2,3,4,5');
    assert.ok(!U.modes.some(m => m.wide));
  }
  assert.ok(src.includes('data-key="Enter"'), 'こたえあわせのキー');
}
console.log('hissan layout ok');
