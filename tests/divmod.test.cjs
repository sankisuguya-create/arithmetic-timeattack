const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(read('common/Core.gs') + '\n' + read('apps/divmod/Unit.gs'), ctx);
const unit = ctx.UNIT;
const MODES = unit.modes.map(m => m.id);
const seen = new Set();

/** vm の外と中では配列の prototype が違うので、中身だけをくらべる */
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

// 型ごとの打鍵数。モードの中では揃っていなければならない（所要msに打鍵差を乗せない）。
const STROKES = { K: 1, P: 2, D: 1, C: 4, Jo: 2, Jx: 2, R: 2 };

function check(item, mode) {
  assert.ok(unit.types[item.t], 'unknown type ' + item.t); seen.add(item.t);
  assert.ok(item.tag && item.q.length && item.f.length);
  same(item.f, unit.fieldsByType[item.t]);
  assert.equal(new Set(item.f).size, item.f.length, '欄キーが重複: ' + JSON.stringify(item));

  let strokes = 0;
  for (const f of item.f) {
    const a = item.ans[f];
    assert.ok(Number.isSafeInteger(a) && a >= 1 && a <= 81, JSON.stringify(item));
    const cap = (unit.digitCap[item.t] || unit.digitCap[mode])[f];
    // 宣言した桁数と実際の答えの桁数が一致すること。食い違うと、確定が早い／遅いが
    // そのままヒントになり、主指標の所要msにも打鍵差が乗る。
    assert.equal(cap, String(a).length, JSON.stringify(item));
    strokes += cap;
  }
  assert.equal(strokes, STROKES[item.t], JSON.stringify(item));

  if (item.t === 'K') {
    // 「4のだん　32」→ だん × 答え が示された積になる
    const a = Number(item.q[0]), p = Number(item.q[2]);
    assert.equal(a * item.ans[''], p);
    assert.ok(p >= 10 && p <= 81);
  } else if (item.t === 'P') {
    // 「6のだん　29まで」→ こえない最大の倍数。基準数は倍数そのものにしない
    const a = Number(item.q[0]), n = Number(item.q[2]), ans = item.ans[''];
    assert.equal(ans % a, 0);
    assert.ok(ans <= n && n - ans < a && n % a !== 0);
    assert.ok(ans >= 10 && ans <= 81);
  } else if (item.t === 'D') {
    // 「73−72」→ 差は 1〜8。④⑤に実際に出る組であること（引く数はその段の倍数）
    const n = Number(item.q[0]), m = Number(item.q[2]);
    assert.equal(item.q[1], '-');
    assert.equal(n - m, item.ans['']);
    assert.ok(item.ans[''] >= 1 && item.ans[''] <= 8);
    // 引く数は1桁になりうる（11−9=2 は 11÷3 の実際の引き算）。答えは常に1桁
    assert.ok(n >= 10 && n <= 89 && m >= 4 && m <= 81);
  } else if (item.t === 'C') {
    checkChain(item);
  } else {
    // ⑤⑥：(わる数)×(商)+(あまり)=(わられる数) と あまり<わる数
    const n = Number(item.q[0]), a = Number(item.q[2]);
    const b = item.ans['あまり'], r = item.ans[''];
    assert.equal(a * b + r, n);
    assert.ok(r >= 1 && r < a, JSON.stringify(item));
    assert.ok(b >= 2 && b <= 9 && n >= 10 && n <= 89);
    if (item.t !== 'R') {
      // ⑤の示された式。Jo は正しく、Jx は「商が1小さく、あまりがわる数だけ大きい」
      const sb = Number(item.q[4]), sr = Number(item.q[6]);
      assert.equal(a * sb + sr, n);
      if (item.t === 'Jo') { assert.equal(sb, b); assert.equal(sr, r); }
      else { assert.equal(sb, b - 1); assert.equal(sr, r + a); assert.ok(sr >= a); }
    }
  }

  const answer = item.f.map(f => item.ans[f]);
  assert.equal(ctx.match_(answer, item, false), true);
  answer[0]++;
  assert.equal(ctx.match_(answer, item, false), false);
}

/** ④ひとつなぎ。2段組みと覆いの宣言が、式としても手続きとしても筋が通っているか */
function checkChain(item) {
  const n = Number(item.q[0]), a = Number(item.q[2]);
  const b = item.ans['しょう'], p = item.ans['つみ'], r = item.ans['あまり'];
  assert.equal(a * b, p);
  assert.equal(p + r, n);
  assert.ok(r >= 1 && r < a);
  assert.ok(p >= 10 && p <= 81, '積は2桁（つみ欄の宣言が2桁のため）');
  assert.ok(b >= 2 && b <= 9);

  // 1段目：わる数（漢数字）＋ 商の欄 ＋ 積の欄
  same(item.rows[0], [ctx.DM_KANJI[a], '_', '_']);
  // 2段目：わられる数 − 積 ＝ あまりの欄
  same(item.rows[1], [String(n), '-', String(p), '=', '_']);
  assert.equal(item.rows.length, 2);

  // 覆いは「2番目以降の欄」＝2段目にかかる。1段目にはかからない
  assert.equal(item.veil, 2);
  const slots = [];
  item.rows.forEach((row, ri) => row.forEach(t => { if (t === '_') slots.push(ri); }));
  same(slots, [0, 0, 1], '欄は1段目に2つ、2段目に1つ');
  // 覆いの向こうにあるのは、1段目の答えを使って書いた式であること。
  // ここが緩むと、1段目を飛ばしても答えが出る問題になる
  assert.equal(Number(item.rows[1][2]), item.ans['つみ']);
}

let count = 0;
for (const mode of MODES) {
  const rand = ctx.rng_(20260921 + mode);
  for (let i = 0; i < 10000; i++) { check(unit.gen(rand, mode), mode); count++; }
  for (const edge of [0, 0.999999999]) check(unit.gen(() => edge, mode), mode);
  // 同じシードなら同じ問題列。ここが崩れるとサーバーの再採点と食い違い、全員のスコアが0になる
  assert.equal(JSON.stringify(ctx.genQueue_(12345, mode, 200)), JSON.stringify(ctx.genQueue_(12345, mode, 200)));
  assert.ok(ctx.typesInMode_(mode).length > 0);
}
assert.equal(seen.size, Object.keys(unit.types).length);
assert.throws(() => unit.gen(() => 0, 4));   // 外した「ぜんぶまぜ」のid
assert.throws(() => unit.gen(() => 0, 8));

// モードの枠は6つ（児童の数字キー1〜6）。超えると最後のモードがキーで始められない
assert.ok(unit.modes.length <= 6);
// 順次開放は学習順に1本の鎖であること。閉じた輪や、存在しないモードへの参照を弾く
const order = MODES.map(String);
unit.modes.forEach((m, i) => {
  if (i === 0) { assert.equal(m.needs, undefined); return; }
  assert.equal(m.needs.mode, unit.modes[i - 1].id, 'needs chain at ' + m.id);
  assert.ok(order.includes(String(m.needs.mode)));
});

// 字形の宣言。数字を引き当てるだけの表で、答えは含まない
same(unit.glyph['しょう'], ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']);

// 配信の形。rows と veil が7・8番目に載り、載せない単元では null のまま
const packed = ctx.packQueue_(ctx.genQueue_(7, 7, 3));
packed.forEach(x => { assert.equal(x.length, 8); assert.ok(x[6]); assert.equal(x[7], 2); });
ctx.packQueue_(ctx.genQueue_(7, 3, 3)).forEach(x => {
  assert.equal(x[6], null); assert.equal(x[7], null);
});

/* ============================================================
 *  共通画面のキー処理を実際に通す
 * ============================================================ */
const ui = read('common/ui.html');
function loadUi(extra) {
  const c = vm.createContext(Object.assign({
    DIGITCAP: unit.digitCap, SCALE: {}, GLYPH: unit.glyph || {}, UNITS: unit.units || {},
    SLOT: '_', performance: { now: () => 100 },
    paintSlots() {}, locked: false, ready: true, practice: false, firstKeyAt: 0
  }, extra));
  for (const name of ['digitCap_', 'valOf', 'currentAns', 'isRight', 'handleInput',
                      'moveField', 'capField_', 'glyph_']) {
    const m = ui.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?^\\}', 'm'));
    assert.ok(m, name); vm.runInContext(m[0], c);
  }
  return c;
}

// 1) 正しく打てば、宣言した打鍵数ちょうどで、Enter なしに1回だけ通る
const input = loadUi();
let accepted = 0, keys = 0;
input.submit = () => { assert.equal(input.isRight(), true); accepted++; };
for (const mode of MODES) {
  const rand = ctx.rng_(770 + mode);
  for (let i = 0; i < 300; i++) {
    const item = unit.gen(rand, mode);
    input.mode = mode; input.queue = [item]; input.qi = 0; input.fi = 0;
    input.typed = Object.fromEntries(item.f.map(f => [f, '']));
    const before = accepted, keysBefore = keys;
    for (const f of item.f) for (const key of String(item.ans[f])) { input.handleInput(key); keys++; }
    assert.equal(accepted, before + 1, JSON.stringify(item));
    assert.equal(keys - keysBefore, STROKES[item.t], JSON.stringify(item));
  }
}

// 2) 覆いの手前でまちがえたら、先へ進まずに1回のまちがいとして落ちる。
//    ここが緩むと、誤った値のまま2段目が開き、画面の中で式と食い違う。
const gate = loadUi();
let submits = [];
gate.submit = () => { submits.push(gate.isRight()); };
{
  const rand = ctx.rng_(4242);
  for (let i = 0; i < 300; i++) {
    const item = unit.gen(rand, 7);
    for (const wrongAt of [0, 1]) {
      gate.mode = 7; gate.queue = [item]; gate.qi = 0; gate.fi = 0;
      gate.typed = Object.fromEntries(item.f.map(f => [f, '']));
      submits = [];
      // 覆いの手前の欄を、正解と違う値で宣言桁まで打ち切る
      for (let k = 0; k < wrongAt; k++) {
        for (const key of String(item.ans[item.f[k]])) gate.handleInput(key);
      }
      const unitKey = item.f[wrongAt];
      const capw = unit.digitCap.C[unitKey];
      const wrong = String(item.ans[unitKey] + 1).padStart(capw, '1').slice(-capw);
      assert.notEqual(Number(wrong), item.ans[unitKey]);
      for (const key of wrong) gate.handleInput(key);
      assert.equal(gate.fi, wrongAt, 'まちがえた欄に留まること');
      assert.deepEqual(submits, [false], 'まちがいとして1回落ちること');
    }
  }
}

// 3) 覆いの向こうへは、タップでも矢印でも行けない
{
  const c = loadUi();
  const item = unit.gen(ctx.rng_(99), 7);
  c.queue = [item]; c.qi = 0; c.fi = 0;
  c.typed = Object.fromEntries(item.f.map(f => [f, '']));
  c.moveField(2); assert.equal(c.fi, 1, '矢印で覆いを越えない');
  assert.equal(c.capField_(item, 2), 1, 'タップでも覆いを越えない');
  c.fi = 2;
  assert.equal(c.capField_(item, 2), 2, '覆いが外れたあとは通す');
}

// 4) 字形。宣言した欄だけ漢数字になり、他の欄と他の単元は素の数字のまま
{
  const c = loadUi();
  assert.equal(c.glyph_('しょう', '9'), '九');
  assert.equal(c.glyph_('つみ', '72'), '72');
  assert.equal(c.glyph_('', '8'), '8');
  assert.equal(c.glyph_('しょう', ''), '');
}

console.log(`${count} generated questions: arithmetic, digit caps, types, rows/veil, mode gating and server scoring passed.`);
console.log(`${accepted} answers passed through the shared UI key handler in ${keys} keystrokes; the veil gate, field caps and glyphs passed.`);
