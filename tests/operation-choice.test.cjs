'use strict';
const assert = require('assert');
const { loadUnit } = require('./lib/kit.cjs');

const ctx = loadUnit('operation-choice');
const unit = ctx.UNIT;
const OPS = ['+', '−', '×', '÷'];
const OP_NUMBER = { '+': 1, '−': 2, '×': 3, '÷': 4 };
const ALLOWED_KANJI = new Set(Array.from('赤花本白青子人入全部使箱配何来紙少多分同数食買算'));
const LINE_COUNTS = {
  A1: 2, A2: 2, A3: 3, A4: 3,
  B1: 2, B2: 2, B3: 3, B4: 3,
  C1: 2, C2: 2, C3: 3, C4: 3,
  D1: 2, D2: 2, D3: 3, D4: 2,
  E1: 2, E2: 2, E3: 3, E4: 3
};
const TWO_OPS = {
  T1: ['×', '−'],
  T2: ['×', '+'],
  T3: ['+', '÷'],
  T4: ['−', '÷']
};
const seenTemplates = new Set(), cueCounts = { c: 0, i: 0 }, opCounts = { '+': 0, '−': 0, '×': 0, '÷': 0 };
const seenTwo = new Set();

assert.equal(unit.id, 'operation-choice');
assert.deepEqual(Array.from(unit.modes, mode => mode.id), [1, 2, 3]);
assert.equal(unit.title, 'なに算？ タイムアタック！');

function textValues(fig) {
  return [...fig.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(match => match[1]);
}

function pickGroup(fig, k) {
  const match = fig.match(new RegExp('<g data-pick="' + k + '">([\\s\\S]*?)</g>'));
  assert.ok(match, 'data-pick="' + k + '" がない');
  return match[1];
}

function expressionValues(item) {
  const expressions = [];
  for (let k = 1; k <= 4; k++) {
    const labels = textValues(pickGroup(item.fig, k));
    const label = labels[1];
    const match = label.match(/^(\d+)([+−×÷])(\d+)$/);
    assert.ok(match, item.tag + ' 式の形式: ' + label);
    const left = Number(match[1]), op = match[2], right = Number(match[3]);
    assert.ok(left > right, item.tag + ' 大きい数から書く: ' + label);
    if (op === '−') assert.ok(left - right > 0, item.tag + ' ひき算が正: ' + label);
    expressions.push({
      label,
      op,
      value: op === '+' ? left + right : op === '−' ? left - right : op === '×' ? left * right : left / right
    });
  }
  return expressions;
}

function expectedOperation(item, mode) {
  if (mode === 1 || mode === 2) {
    const type = item.tag.split(' ')[1][0];
    return { A: '+', B: '−', C: '×', D: '÷', E: '÷' }[type];
  }
  const parts = item.tag.split(' ');
  const step = Number(parts[2].slice(1)) - 1;
  return TWO_OPS[parts[1]][step];
}

function checkCommon(item, mode) {
  assert.ok(item.fig.includes('data-pick="1"'), item.tag + ' 選択肢1がない');
  assert.ok(item.fig.includes('data-pick="4"'), item.tag + ' 選択肢4がない');
  assert.equal((item.fig.match(/data-pick="/g) || []).length, 4, item.tag + ' 選択肢数');
  assert.equal((item.fig.match(/class="pkb"/g) || []).length, 4, item.tag + ' pkb数');
  assert.equal(item.f.length, 1, item.tag + ' f length');
  assert.ok(Number.isInteger(item.ans['']) && item.ans[''] >= 1 && item.ans[''] <= 4, item.tag + ' ans');
  assert.ok(ctx.match_(item.f.map(f => item.ans[f]), item, false), item.tag + ' 正解が採点を通らない');
  assert.ok(!ctx.match_([item.ans[''] % 4 + 1], item, false), item.tag + ' 別の番号も正解');
  assert.ok(!/[,|\n\r"]/.test(item.tag), item.tag + ' tagに禁止文字');
  assert.ok(!item.fig.includes('＋') && !item.q.join('').includes('＋'), item.tag + ' 全角プラス');
  const expected = expectedOperation(item, mode);
  assert.equal(item.ans[''], OP_NUMBER[expected], item.tag + ' 正解演算');

  for (let k = 1; k <= 4; k++) {
    const group = pickGroup(item.fig, k);
    const number = group.match(/<text\b([^>]*)>([①②③④])<\/text>/);
    assert.ok(number && number[1].includes('fill="#35D0A5"') &&
      number[1].includes('style="fill:var(--acc)"'), item.tag + ' 選択肢番号の色 ' + k);
    const label = textValues(group)[1];
    assert.ok(label.includes(OPS[k - 1]), item.tag + ' 選択肢位置 ' + k + ': ' + label);
  }
  assert.ok(item.fig.startsWith('<svg') && !/NaN|undefined/.test(item.fig), item.tag + ' SVG');
  return expected;
}

function checkAllowedKanji(item) {
  const visible = textValues(item.fig).join('') + item.q.join('') + unit.title +
    unit.modes.map(mode => mode.name).join('');
  for (const char of visible.match(/[\u4e00-\u9fff]/g) || []) {
    assert.ok(ALLOWED_KANJI.has(char), item.tag + ' 未配当漢字: ' + char);
  }
}

function checkSentenceLengths(item, lineCount) {
  const lines = textValues(item.fig).slice(0, lineCount);
  assert.equal(lines.length, lineCount, item.tag + ' 文の行数');
  for (const line of lines) {
    assert.ok(Array.from(line).length <= 26, item.tag + ' 26字超: ' + line + ' (' + Array.from(line).length + ')');
  }
}

function checkExpressions(item, expected) {
  const expressions = expressionValues(item);
  const correct = expressions[item.ans[''] - 1];
  assert.equal(correct.op, expected, item.tag + ' 正解式の演算');
  for (let i = 0; i < expressions.length; i++) {
    if (i !== item.ans[''] - 1) {
      assert.ok(Math.abs(expressions[i].value - correct.value) >= 1e-9,
        item.tag + ' 正解と同じ値: ' + correct.label + ' / ' + expressions[i].label);
    }
  }
}

for (let mode = 1; mode <= 3; mode++) {
  for (let seed = 1; seed <= 600; seed++) {
    const item = unit.gen(ctx.rng_(seed), mode);
    const expected = checkCommon(item, mode);
    checkAllowedKanji(item);
    if (mode === 1 || mode === 2) {
      const id = item.tag.split(' ')[1];
      const template = id.slice(0, 2);
      assert.ok(LINE_COUNTS[template], item.tag + ' テンプレート');
      checkSentenceLengths(item, LINE_COUNTS[template]);
      if (mode === 1) {
        seenTemplates.add(template);
        cueCounts[id[2]]++;
        opCounts[expected]++;
      } else {
        checkExpressions(item, expected);
      }
    } else {
      const [, template, step] = item.tag.split(' ');
      seenTwo.add(template + ' ' + step);
      checkSentenceLengths(item, 3);
      checkExpressions(item, expected);
    }
  }
}

// 網羅・比率は独立した固定 seed 群で確認する。
for (let seed = 1; seed <= 4000; seed++) {
  const item = unit.gen(ctx.rng_(seed), 1);
  const expected = checkCommon(item, 1);
  const id = item.tag.split(' ')[1];
  seenTemplates.add(id.slice(0, 2));
  cueCounts[id[2]]++;
  opCounts[expected]++;
  checkSentenceLengths(item, LINE_COUNTS[id.slice(0, 2)]);
}
for (let seed = 1; seed <= 4000; seed++) {
  const item = unit.gen(ctx.rng_(seed), 3);
  const expected = checkCommon(item, 3);
  const [, template, step] = item.tag.split(' ');
  seenTwo.add(template + ' ' + step);
  checkSentenceLengths(item, 3);
  checkExpressions(item, expected);
}

assert.equal(seenTemplates.size, 20, 'モード1の20テンプレート網羅');
assert.equal(seenTwo.size, 8, 'モード3の8テンプレート網羅');
for (const cue of ['c', 'i']) {
  const ratio = cueCounts[cue] / (cueCounts.c + cueCounts.i);
  assert.ok(ratio >= 0.45 && ratio <= 0.55, cue + ' 比率 ' + ratio);
}
for (const op of OPS) {
  const ratio = opCounts[op] / Object.values(opCounts).reduce((sum, count) => sum + count, 0);
  assert.ok(ratio >= 0.2 && ratio <= 0.3, op + ' 比率 ' + ratio);
}
for (const mode of unit.modes) {
  assert.ok(ctx.typesInMode_(mode.id).length > 0, 'モード' + mode.id + ' の型が空');
}
assert.deepEqual(ctx.genQueue_(1234, 1, 30), ctx.genQueue_(1234, 1, 30), '同じseedで再現されない');

console.log('operation-choice tests passed.');
