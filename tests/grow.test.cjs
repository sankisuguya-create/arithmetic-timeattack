'use strict';
// モードごとの育ちの倍率（背景の床と協力プレイの図形）。Core の growWeights_ / floorPace_ / coopStart_ / coopReview。
const assert = require('node:assert/strict');
const { read, loadUnit } = require('./lib/kit.cjs');

/* ---- 倍率の決まり方：単元の既定 → 教師の設定（grow_w）。0.5〜3倍に丸める ---- */
{
  const ctx = loadUnit('divmod');
  let cfg = { grow_w: '' };
  ctx.config_ = () => cfg;
  const w0 = ctx.growWeights_();
  assert.equal(w0[3], 2, 'あまりのあるわり算は単元の既定で2倍');
  ctx.modeIds_().filter(m => m !== 3).forEach(m => assert.equal(w0[m], 1));
  cfg = { grow_w: '3:1.5,1:9,6:0.1,99:2,x' };
  const w1 = ctx.growWeights_();
  assert.equal(w1[3], 1.5, '教師の設定が単元の既定より優先');
  assert.equal(w1[1], 3, '上限で切る'); assert.equal(w1[6], 0.5, '下限で切る');
  assert.equal(w1[99], undefined, '無いモードは無視');
  assert.equal(ctx.validateUnit_().filter(x => /growWeights/.test(x)).length, 0);
  ctx.UNIT.growWeights = { 99: 2, 3: 5 };
  assert.equal(ctx.validateUnit_().filter(x => /growWeights/.test(x)).length, 2, '単元の宣言の誤りを知らせる');
  ctx.UNIT.growWeights = { 3: 2 };
  // 設定が読めない時も止まらない（単元の既定で続ける）
  ctx.config_ = () => { throw new Error('x'); };
  assert.equal(ctx.growWeights_()[3], 2);
}

/* ---- 床：速さで揃えた上に倍率を掛ける（標準の分数を倍率ぶん大きく＝pace を倍率で割る） ---- */
{
  const ctx = loadUnit('divmod');
  ctx.config_ = () => ({ grow_w: '' });
  const p = ctx.floorPace_(null);
  assert.equal(p[3], 10, '1分20問の事前値 ÷ 倍率2');
  assert.equal(p[1], 20);
  // 同じ30問でも、倍率2のモードは標準の分数が2倍
  ctx.summaryIndex_ = () => ({ a: { tcm: { 1: 30 } }, b: { tcm: { 3: 30 } } });
  const fa = ctx.bests_('a', 60).floor.min, fb = ctx.bests_('b', 60).floor.min;
  assert.ok(Math.abs(fb - fa * 2) < 0.01, JSON.stringify([fa, fb]));
}

/* ---- 画面 ---- */
{
  const tui = read('common/teacher.html'), ui = read('common/index.html'), core = read('common/Core.gs');
  // 協力プレイ：回に写した倍率で、正答のモードごとに枚数を掛ける。自動の枚数は倍率の平均で見込む
  assert.ok(tui.includes('var n = Math.round(e[2] * coopRateAt(e[0]) * coopGwOf_(e[3]))'));
  assert.ok(tui.includes('* (p.wm || 1);') && ui.includes('* (p.wm || 1);'));
  assert.ok(tui.includes("CP.GW = s.gw || {};"));
  assert.ok(ui.includes('var m = Math.round(e[2] * (e[4] || 1) * rateAt(e[0]))'), '児童の見返しは各正答の倍率で');
  // 全般設定：モードごとの欄。保存で grow_w に入れる
  assert.ok(tui.includes('<div id="growRows"></div>') && tui.includes('obj.grow_w = gw.str;'));
  assert.ok(core.includes('growW: growWeights_(),'));
}

console.log('grow.test.cjs: all assertions passed.');
