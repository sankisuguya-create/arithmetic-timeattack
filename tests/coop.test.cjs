'use strict';
// 協力モードのサーバー側（Core.gs coop*）のテスト。
// GAS のサービスは小さな写しに置き換えて、開始→提出→集計→停止→保存→読込の往復を見る。
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { unitDir } = require('./lib/kit.cjs');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---- GAS サービスの写し（テストが触る分だけ） ---- */
function Sheet(name, head) { this.name = name; this.values = head ? [head.slice()] : []; }
Sheet.prototype.getLastRow = function () { return this.values.length; };
Sheet.prototype.getLastColumn = function () { return Math.max(1, (this.values[0] || []).length || 1); };
Sheet.prototype.getDataRange = function () {
  const v = this.values; return { getValues: () => v.map(r => r.slice()) };
};
Sheet.prototype.appendRow = function (r) { this.values.push(r.slice()); };
Sheet.prototype.getRange = function (r, c, nr, nc) {
  const self = this; nr = nr || 1; nc = nc || 1;
  return {
    setValue(v) { self.values[r - 1] = self.values[r - 1] || []; self.values[r - 1][c - 1] = v; return this; },
    setValues(vv) {
      vv.forEach((row, i) => {
        self.values[r - 1 + i] = self.values[r - 1 + i] || [];
        row.forEach((v, j) => { self.values[r - 1 + i][c - 1 + j] = v; });
      });
      return this;
    },
    getValues() {
      const out = [];
      for (let i = 0; i < nr; i++) out.push((self.values[r - 1 + i] || []).slice(c - 1, c - 1 + nc));
      return out;
    },
    setFontWeight() { return this; }, setNote() { return this; }, setNumberFormat() { return this; }
  };
};
Sheet.prototype.clear = function () { this.values = []; };
Sheet.prototype.setFrozenRows = function () {};
Sheet.prototype.setTabColor = function () {};
Sheet.prototype.insertColumnAfter = function () {};

const store = {};
const sheets = {};
const ctx = {
  console,
  CacheService: { getScriptCache: () => ({
    get: k => (k in store ? store[k] : null),
    put: (k, v) => { store[k] = String(v); },
    remove: k => { delete store[k]; }
  }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: {
    getActiveUser: () => ({ getEmail: () => 'sensei@edu.nishi.or.jp' }),
    getScriptTimeZone: () => 'Asia/Tokyo'
  },
  Utilities: {
    getUuid: () => 'xxxxxxxx-xxxx-4000-8000-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)),
    formatDate: (d, tz, f) => {
      const pad = (n, w) => String(n).padStart(w, '0');
      return f.replace(/yyyy/g, d.getFullYear()).replace(/MM/g, pad(d.getMonth() + 1, 2))
        .replace(/dd/g, pad(d.getDate(), 2)).replace(/HH/g, pad(d.getHours(), 2))
        .replace(/mm/g, pad(d.getMinutes(), 2))
        .replace(/M/g, d.getMonth() + 1).replace(/d/g, d.getDate()).replace(/H/g, d.getHours());
    }
  },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: n => sheets[n] || null,
      insertSheet: n => (sheets[n] = new Sheet(n)),
      getOwner: () => ({ getEmail: () => 'sensei@edu.nishi.or.jp' }),
      getName: () => 'test', getId: () => 'id', getUrl: () => ''
    })
  },
  ScriptApp: { getProjectTriggers: () => [], getService: () => ({ getUrl: () => '' }) }
};

sheets.roster = new Sheet('roster', ['email', '学年', '組', '番号', '氏名']);
for (let i = 1; i <= 8; i++) {
  sheets.roster.values.push([`k${String(i).padStart(2, '0')}@kyoiku.edu.nishi.or.jp`, 3, '1', i, `児童${i}`]);
}
sheets.roster.values.push(['other@kyoiku.edu.nishi.or.jp', 4, '2', 1, '他クラス']);
sheets.coop = new Sheet('coop', ['id', 'class', 'pattern', 'seed', 'mode', 'gn', 'groups', 'names', 'nos', 'start', 'end', 'status', 'total']);
sheets.coop_log = new Sheet('coop_log', ['session', 't', 'email', 'correct', 'mode']);
sheets.coop_save = new Sheet('coop_save', ['save_id', 'name', 'saved', 'session', 'payload']);

vm.createContext(ctx);
vm.runInContext(read('common/Core.gs') + '\n' + read(`${unitDir('kuku')}/Unit.gs`), ctx);

/* ---- 開始 ---- */
const st = ctx.coopStart({ cls: '3-1', pat: 'sunflower', minutes: 10, mode: 'child', gn: 6 });
assert.ok(st.ok, JSON.stringify(st));
const s0 = st.session;
assert.equal(s0.cls, '3-1'); assert.equal(s0.pat, 'sunflower'); assert.equal(s0.status, 'run');
assert.equal(s0.names.length, 8);           // 3-1 は8人（他クラスは入らない）
assert.equal(s0.ev.length, 0);
assert.ok(s0.end - s0.start === 600000);

// 進行中は2重に始められない。reset 付きなら別セッションとして切り直せる
assert.ok(!ctx.coopStart({ cls: '3-1' }).ok);
const st2 = ctx.coopStart({ reset: true });
assert.ok(st2.ok && st2.session.id !== s0.id && st2.session.pat === 'sunflower');
const s = st2.session;

/* ---- 提出（coopNote_ は submitSession からロック内で呼ばれる。練習は呼ぶ側が弾く） ---- */
const kids = {};
for (let i = 1; i <= 8; i++) kids[`k${String(i).padStart(2, '0')}`] = i - 1;
const c1 = ctx.child_('k01@kyoiku.edu.nishi.or.jp');
const c3 = ctx.child_('k03@kyoiku.edu.nishi.or.jp');
const cx = ctx.child_('other@kyoiku.edu.nishi.or.jp');
ctx.coopNote_(c1, 1, 18);                    // 児童1：18問
ctx.coopNote_(c3, 2, 22);                    // 児童3：22問
ctx.coopNote_(cx, 1, 30);                    // 別クラス：数えない
ctx.coopNote_(ctx.child_('nosuch@kyoiku.edu.nishi.or.jp'), 1, 9);  // 名簿なし：数えない

let r = ctx.coopState(0);
assert.equal(r.ev.length, 2);                // 3-1 の2件だけ
assert.equal(r.total, 40);
assert.equal(r.ev[0][1], 0);                 // 児童1は index 0（番号順）
assert.equal(r.ev[1][1], 2);
assert.equal(ctx.coopState(2).ev.length, 0);   // since 以降はなし
ctx.coopNote_(c1, 1, 7);
assert.equal(ctx.coopState(2).ev.length, 1); // 差分で1件

// coop_log にも同じ2+1件（session, t, email, correct, mode）
assert.equal(sheets.coop_log.values.length - 1, 3);
assert.equal(sheets.coop_log.values[1][2], 'k01@kyoiku.edu.nishi.or.jp');

/* ---- 打ち切り：終了時刻を超えた提出は数えない。coopState が時刻を見て自動で閉じる ---- */
const live = ctx.coopLive_();
live.end = Date.now() - 1;
ctx.coopPutLive_(live);
ctx.coopNote_(c1, 1, 50);
assert.equal(ctx.coopState(0).ev.length, 3); // 増えない
assert.equal(ctx.coopState(0).total, 47);
assert.equal(ctx.coopLive_().status, 'done'); // 押し忘れでも時刻で閉じている

/* ---- 続きは新しいセッションで見る（前の分は履歴に残る） ---- */
const st3 = ctx.coopStart({ reset: true });
assert.ok(st3.ok && st3.session.id !== s.id && st3.session.status === 'run');
ctx.coopNote_(c1, 1, 18);
ctx.coopNote_(c3, 2, 22);
ctx.coopNote_(c1, 1, 7);
assert.equal(ctx.coopState(0).ev.length, 3);
assert.equal(ctx.coopState(0).total, 47);

/* ---- 児童側：自分の色に必要な分だけ届く ---- */
const mine = ctx.coopForChild_(c1);
assert.equal(mine.active, true); assert.equal(mine.i, 0); assert.equal(mine.n, 8);
assert.equal(mine.seed, st3.session.seed); assert.equal(mine.pat, 'sunflower');
assert.equal(mine.g, undefined);             // 児童ごとなら組は出さない
assert.equal(ctx.coopForChild_(cx).active, false);
assert.equal(ctx.coopForChild_(null).active, false);

/* ---- 組（グループ色） ---- */
ctx.coopSetGroups([0, 0, 1, 1, 2, 2, 0, 1]);
assert.equal(JSON.stringify(ctx.coopLive_().gi), '[0,0,1,1,2,2,0,1]');
assert.ok(!ctx.coopSetGroups([0, 1]).ok);    // 名簿と数が合わないものは通さない

/* ---- 停止 → 保存 → 読込 ---- */
const done = ctx.coopStop();
assert.ok(done.ok); assert.equal(done.session.status, 'done');
const sv = ctx.coopSave('3-1 テスト');
assert.ok(sv.ok); assert.equal(sv.name, '3-1 テスト');
const li = ctx.coopList();
assert.equal(li.saves[0].id, sv.id);
const ld = ctx.coopLoad(sv.id);
assert.ok(ld.ok);
const p = ld.payload;
assert.equal(p.cls, '3-1'); assert.equal(p.ev.length, 3); assert.equal(p.total, 47);
assert.equal(JSON.stringify(p.gi), '[0,0,1,1,2,2,0,1]');
assert.equal(p.names.length, 8);
assert.ok(!ctx.coopLoad('no_such').ok);

/* ---- キャッシュが消えても、進行中のセッションを失わない（coop シートの最後の行と coop_log から組み直す） ---- */
const st4 = ctx.coopStart({ cls: '3-1' });
assert.ok(st4.ok);
ctx.coopNote_(c1, 1, 10);
ctx.coopState(0);                            // 教師画面の問い合わせで、まとめてシートへ書かれる
Object.keys(store).filter(k => k === 'coop_live' || k.startsWith('coop_ev_') || k.startsWith('coop_fl_')).forEach(k => { delete store[k]; });
const re = ctx.coopLive_();
assert.equal(re.id, st4.session.id); assert.equal(re.status, 'run'); assert.equal(re.total, 10);
assert.equal(re.kids['k03@kyoiku.edu.nishi.or.jp'], 2);
assert.equal(re.names.length, 8);
ctx.coopNote_(c3, 2, 4);                    // 組み直した後も数え続ける
assert.equal(ctx.coopState(0).ev.length, 2);
assert.equal(ctx.coopState(0).total, 14);

/* ---- 時間を過ぎたら、教師画面が打ち切りを呼ばなくても児童の印は消える ---- */
const L = ctx.coopLive_(); L.end = Date.now() - 1; ctx.coopPutLive_(L);
assert.equal(ctx.coopForChild_(c1).active, false);

/* ---- 教師の操作は提出と同じロックの内側。取れないときは例外にせず知らせる ---- */
const realLock = ctx.LockService;
ctx.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock() {} }) };
const busyG = ctx.coopSetGroups([0, 0, 0, 0, 0, 0, 0, 0]);
assert.equal(busyG.ok, false); assert.ok(/混んで/.test(busyG.msg));
assert.equal(ctx.coopStop().ok, false);
assert.equal(ctx.coopState(0).status, 'run');   // 打ち切りも次の呼び出しに回す（落ちない）
ctx.LockService = realLock;
assert.equal(ctx.coopState(0).status, 'done');

/* ---- セッションが1つも無いときは null を置き、起動のたびに coop シートを読みに行かない ---- */
const realCoop = sheets.coop;
sheets.coop = new Sheet('coop', realCoop.values[0]);
delete store.coop_live;
assert.equal(ctx.coopLive_(), null);
assert.equal(store.coop_live, 'null');
sheets.coop = realCoop; delete store.coop_live;

/* ---- 協力モードの失敗で、採点の記録を失敗扱いにしない（submitSession の中で try に包む） ---- */
assert.ok(/try \{ coopNote_\(c, s\.mode, correct, s\); \} catch/.test(read('common/Core.gs')));

/* ---- 児童の画面：れんしゅうでは協力の印を出さない（数えないので） ---- */
const ui = read('common/index.html');
assert.ok(/function beginPractice\(timed\)\{\n  practice = true; pTimed = !!timed;\n  coopBadge_\(true\);/.test(ui));
assert.ok(/var on = !practice && !!\(COOP\.active/.test(ui));

/* ---- 混雑対策 A：提出はシートに書かず、教師画面の問い合わせでまとめて書く（二重に書かれても1件と数える） ---- */
const st5 = ctx.coopStart({ reset: true });
const logRows = () => sheets.coop_log.values.filter(r => r[0] === st5.session.id).length;
ctx.coopNote_(c1, 1, 3); ctx.coopNote_(c3, 1, 4);
assert.equal(logRows(), 0);                  // 提出の時点ではまだ書かない（ロックの時間を延ばさない）
ctx.coopState(0);
assert.equal(logRows(), 2);                  // 問い合わせでまとめて書く
ctx.coopState(0);
assert.equal(logRows(), 2);                  // 書いた分は2度書かない
const dupRow = sheets.coop_log.values.find(r => r[0] === st5.session.id);
sheets.coop_log.values.push(dupRow.slice());  // 2人の教師のまとめ書きが重なった場合
Object.keys(store).filter(k => k.startsWith('coop_ev_' + st5.session.id) || k.startsWith('coop_fl_')).forEach(k => { delete store[k]; });
assert.equal(ctx.coopState(0).ev.length, 2); // 読み直しで重複を除く

/* ---- 混雑対策 B：締め切りは届いた時刻ではなく遊び終えた時刻（開始＋制限時間）で見る ---- */
const st6 = ctx.coopStart({ reset: true });
const L6 = ctx.coopLive_(); const T0 = L6.start;
L6.end = Date.now() - 120000; L6.start = L6.end - 600000; ctx.coopPutLive_(L6);   // 2分前に終わった協力
const before = ctx.coopState(0).total;
ctx.coopNote_(c1, 1, 11, { t: L6.end - 70000, lim: 60 });   // 終了前に遊び終えた回が、混雑で2分遅れて届いた：数える
assert.equal(ctx.coopState(0).total, before + 11);
const lateEv = ctx.coopState(0).ev.slice(-1)[0];
assert.equal(lateEv[0], L6.end - L6.start);  // 画面の時間軸では終了の時点に置く（再生の順が崩れない）
ctx.coopNote_(c1, 1, 13, { t: L6.end - 30000, lim: 60 });   // 終了の後に遊び終えた回（余裕10秒を超える）：数えない
ctx.coopNote_(c1, 1, 17, { t: L6.start - 90000, lim: 60 }); // 始まる前に遊び終えた回：数えない
assert.equal(ctx.coopState(0).total, before + 11);
const L7 = ctx.coopLive_(); L7.end = Date.now() - 11 * 60000; ctx.coopPutLive_(L7);
ctx.coopNote_(c1, 1, 19, { t: L7.end - 70000, lim: 60 });   // 終了から10分を過ぎて届いた：数えない
assert.equal(ctx.coopState(0).total, before + 11);
assert.ok(/coopNote_\(c, s\.mode, correct, s\)/.test(read('common/Core.gs')));   // 提出は回の記録を渡す

console.log('coop.test.cjs: all assertions passed.');
