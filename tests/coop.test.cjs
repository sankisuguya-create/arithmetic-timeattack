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
    setFontWeight() { return this; }, setNote() { return this; }, setNumberFormat() { return this; },
    clearContent() { for (let i = 0; i < nr; i++) { const row = self.values[r - 1 + i]; if (row) for (let j = 0; j < nc; j++) row[c - 1 + j] = ''; } return this; }
  };
};
Sheet.prototype.clear = function () { this.values = []; };
Sheet.prototype.getSheetId = function () { return 123; };
Sheet.prototype.setFrozenRows = function () {};
Sheet.prototype.setTabColor = function () {};
Sheet.prototype.insertColumnAfter = function () {};

const store = {};
const props = {};
const sheets = {};
const ctx = {
  console,
  CacheService: { getScriptCache: () => ({
    get: k => (k in store ? store[k] : null),
    put: (k, v) => { store[k] = String(v); },
    remove: k => { delete store[k]; }
  }) },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => (k in props ? props[k] : null),
    setProperty: (k, v) => { props[k] = String(v); },
    deleteProperty: k => { delete props[k]; }
  }) },
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
sheets.roster.values.push(['noname@kyoiku.edu.nishi.or.jp', 3, '1', 9, '']);   // 氏名のない行（数えない。人数だけ出す）
sheets.config = new Sheet('config', ['key', 'value']);
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

/* ---- coopPeek：児童側の軽い問い合わせ。呼んだ本人の分だけ返る ---- */
const teacherSession = ctx.Session;
ctx.Session = { getActiveUser: () => ({ getEmail: () => 'k01@kyoiku.edu.nishi.or.jp' }),
                getScriptTimeZone: () => 'Asia/Tokyo' };
let peek = ctx.coopPeek(60);
assert.equal(peek.active, true); assert.equal(peek.i, 0); assert.equal(peek.seed, st3.session.seed);
assert.equal(peek.counts, true);              // いま始めれば終わりまでに遊び終わる
ctx.Session = { getActiveUser: () => ({ getEmail: () => 'other@kyoiku.edu.nishi.or.jp' }),
                getScriptTimeZone: () => 'Asia/Tokyo' };
assert.equal(ctx.coopPeek(60).active, false);  // 別クラスには出ない
ctx.Session = teacherSession;

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
// 再生でも「1正答の枚数」を開始時と同じに自動計算できるよう、速さ・予定の分・1回の秒・数えない人数を残す
assert.ok(p.pace >= 1 && p.minutes === 10 && p.lim === 60 && typeof p.skip === 'number', JSON.stringify([p.pace, p.minutes, p.lim, p.skip]));

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

/* ---- エラーに見える構造 1：次を始めても、直前の協力の送り直しは直前の方に数える ---- */
const stA = ctx.coopStart({ reset: true });
const LA = ctx.coopLive_(); LA.end = Date.now() - 30000; LA.start = LA.end - 600000; ctx.coopPutLive_(LA);
ctx.coopState(0);                                                   // 時刻で閉じる
const stB = ctx.coopStart({ cls: '3-1' });                           // 締め切り直後に次を始めた
assert.ok(stB.ok);
ctx.coopNote_(c3, 1, 8, { t: LA.end - 65000, lim: 60 });            // 前の協力の中で遊び終えた回が、次の開始の後に届いた
assert.equal(ctx.coopState(0).total, 0);                             // 新しい方には数えない
assert.equal(JSON.parse(store.coop_prev).total, 8);                   // 直前の方に数える
const rowA = () => sheets.coop.values.find(r => r[0] === stA.session.id);
assert.equal(rowA()[12], 8);                                         // 教師画面の問い合わせで、行の合計も追いつく
assert.equal(sheets.coop_log.values.filter(r => r[0] === stA.session.id).length, 1);
ctx.coopNote_(c3, 1, 5, { t: Date.now() - 55000, lim: 60 });         // 新しい方の中で遊び終えた回は新しい方へ
assert.equal(ctx.coopState(0).total, 5);

/* ---- リセットで途中から切り直すと、前の協力の終わりはその時点になる（遊び終える回は新しい方へ） ---- */
const stC = ctx.coopStart({ reset: true });
const prevB = JSON.parse(store.coop_prev);
assert.equal(prevB.id, stB.session.id); assert.equal(prevB.status, 'done');
assert.ok(prevB.end <= stC.session.start);
assert.ok(sheets.coop.values.find(r => r[0] === stB.session.id)[10].getTime() <= stC.session.start);

/* ---- エラーに見える構造 2：残り1分を切ってから始めた本番は、児童に「数えません」と出す ---- */
const LC = ctx.coopLive_(); LC.end = Date.now() + 30000; ctx.coopPutLive_(LC);
assert.equal(ctx.coopForChild_(c1, 60).counts, false);
LC.end = Date.now() + 55000; ctx.coopPutLive_(LC);                   // 余裕（10秒）の内側なら数える
assert.equal(ctx.coopForChild_(c1, 60).counts, true);
LC.end = Date.now() + 300000; ctx.coopPutLive_(LC);
assert.equal(ctx.coopForChild_(c1, 60).counts, true);
assert.equal(ctx.coopForChild_(c1).counts, undefined);              // lim を渡さない呼び出し（boot）は出さない
assert.ok(/coop: coopForChild_\(c, Number\(cfg\.limit_sec\) \|\| 60\)/.test(read('common/Core.gs')));

/* ---- 教師画面の案内に使う値：1回の秒数・送り直しの締め切り・氏名のない児童の数 ---- */
const pub = ctx.coopState(0);
assert.equal(pub.lim, 60); assert.equal(pub.skip, 1); assert.equal(pub.lateUntil, pub.end + 600000);

/* ---- 教師画面が閉じていても、溜まりすぎたら提出の側でまとめ書きする（キャッシュが消えても失う分を限る） ---- */
const stD = ctx.coopStart({ reset: true });
const rowsD = () => sheets.coop_log.values.filter(r => r[0] === stD.session.id).length;
for (let k = 0; k < 39; k++) ctx.coopNote_(c1, 1, 1);
assert.equal(rowsD(), 0);
ctx.coopNote_(c1, 1, 1);
assert.equal(rowsD(), 40);

/* ---- 「1正答の枚数」の自動計算に使う速さ：サイト全体の本番の1分あたりの正答（下駄つき） ---- */
{
  const m0 = ctx.modeIds_()[0];
  sheets.summary = new Sheet('summary', ['email', 'mode', 'name', 'limit_sec', 'kind', 'tries', 'total_correct', 'total_attempts', 'best', 'best_count']);
  sheets.summary.appendRow(['k01@x', m0, '', 60, 'r', 10, 300, 320, 35, 1]);   // 本番 10分で300問＝1分30問
  sheets.summary.appendRow(['k02@x', m0, '', 60, 'p', 10, 900, 900, 90, 1]);   // 練習は入れない
  Object.keys(store).filter(k => /^sumidx_/.test(k)).forEach(k => delete store[k]);
  assert.equal(ctx.coopPace_(), 25);                                       // （300 ＋ 20×10）÷（10 ＋ 10）
  const stP = ctx.coopStart({ reset: true });
  assert.equal(stP.session.pace, 25); assert.equal(stP.session.minutes, 10);
  delete sheets.summary; Object.keys(store).filter(k => /^sumidx_/.test(k)).forEach(k => delete store[k]);
}

/* ---- 開始のカウントダウン：始まりをサーバーが5秒後に置く（教師画面はこの start に合わせて 5→1→スタート を出す） ---- */
const t0 = Date.now();
const stE = ctx.coopReset({ countdown: true });
assert.ok(stE.ok && typeof stE.now === 'number', JSON.stringify(stE));    // 画面が時計のずれを差し引けるように now を返す
const sE = stE.session;
assert.ok(sE.start - t0 >= 5000 && sE.start - t0 < 6000, String(sE.start - t0));
assert.equal(sE.end - sE.start, 600000);                               // 制限時間はスタートから数える
assert.ok(sheets.coop.values.find(r => r[0] === sE.id)[9].getTime() === sE.start);
assert.ok(JSON.parse(store.coop_prev).end < sE.start);                  // 前の協力はリセットを押した時点で終わる
ctx.coopNote_(c1, 1, 7, { t: Date.now() - 58000, lim: 60 });            // カウントダウン中に遊び終えた回：新しい方には数えない
assert.equal(ctx.coopState(0).total, 0);
assert.equal(ctx.coopForChild_(c1, 60).counts, true);                   // カウントダウン中に始めた本番は数える
const t1 = Date.now(), stF = ctx.coopReset();                           // countdown なし（古い画面から）は今すぐ始まる
assert.ok(stF.session.start - t1 < 1000);

/* ---- 画面側：数えない回・締め切り後・列の縮みを、エラーに見せない ---- */
assert.ok(/var off = COOP\.counts === false;/.test(ui));                 // 児童：残り1分からの本番は「数えません」
const tui = read('common/teacher.html');
assert.ok(/function coopGuideText\(\)/.test(tui));                    // 教師：理由の案内
// 開始ボタンは図形の画面（ステージ）の中の1つだけ。開始・リセットはどちらも数えてから始める。全画面はブラウザごと
assert.equal(tui.split('id="coopStart"').length - 1, 1);
assert.ok(tui.indexOf('id="coopStart"') > tui.indexOf('<div id="coopStage"'));
assert.ok(tui.includes('run.coopReset({ countdown: true })') && tui.includes("var opts = { countdown: true };"));
assert.ok(/requestFullscreen/.test(tui) && /fullscreenchange/.test(tui));
// 進行中の時計は実際の時刻で出す（再生位置で出すと3秒ごとの問い合わせで 10:00 に戻って見えた）
assert.ok(/liveRun \? coopLiveRemain\(\)/.test(tui));
// 名前（名札）の表示切り替え
assert.ok(tui.includes('id="coopNames"') && tui.includes('#coopStage.nonames #coopRoster{display:none}'));
// 自動の枚数：九九（1分20問）・29人・10分・1回60秒・完成34,669枚（1920×1080 のペンローズ）で約8枚
{
  const src = tui.match(/var CAIM = [^\n]*\n/)[0] + tui.match(/function coopAutoRateOf\(p\)\{[\s\S]*?\n\}/)[0];
  const f = vm.runInNewContext(src + ';coopAutoRateOf');
  assert.equal(f({ tfin: 34669, n: 29, minutes: 10, lim: 60, pace: 20 }), 8);
  assert.equal(f({ tfin: 21465, n: 29, minutes: 10, lim: 60, pace: 20 }), 5);
  assert.equal(f({ tfin: 34669, n: 29, minutes: 5, lim: 60, pace: 20 }), 16);   // 時間が半分なら倍
  assert.equal(f({ tfin: 10, n: 29, minutes: 10, lim: 60, pace: 20 }), 0.5);    // 下限
}
assert.ok(/&& !CP\.endSeen\)\{/.test(tui));                           // 終わりの位置送りは最初の1回だけ（シークが飛ばない）
assert.ok(/r\.evN !== CP\.ev\.length \+ \(r\.ev \|\| \[\]\)\.length/.test(tui));   // 列が縮んだら取り直す

/* ---- 開始前の組分け（予定） ---- */
{
  const J = x => JSON.stringify(Array.from(x));
  ctx.coopStop();
  const pl = ctx.coopPlan('3-1', 3);
  assert.ok(pl.ok); assert.equal(pl.names.length, 8);
  assert.equal(J(pl.gi), '[0,0,0,1,1,1,2,2]');                        // 予定が無ければ番号順の等分
  assert.ok(ctx.coopSavePlan('3-1', 3, [2, 2, 1, 1, 0, 0, 2, 1]).ok);
  assert.ok(!ctx.coopSavePlan('3-1', 3, [0, 1]).ok);                   // 名簿と数が合わないものは通さない
  assert.ok(ctx.coopStart({ cls: '3-1', mode: 'group', gn: 3, minutes: 5 }).ok);
  assert.equal(J(ctx.coopLive_().gi), '[2,2,1,1,0,0,2,1]');           // 開始すると予定の組で始まる
  assert.equal(J(ctx.coopPlan('3-1', 4).gi), '[0,0,1,1,2,2,3,3]');     // 組数ごとに別に持つ
  ctx.coopSetGroups([0, 1, 2, 0, 1, 2, 0, 1]);                         // 遊んでいる途中の編集も予定に残る
  ctx.coopStop();
  assert.equal(J(ctx.coopPlan('3-1', 3).gi), '[0,1,2,0,1,2,0,1]');
  assert.ok(ctx.coopStart({ cls: '3-1', mode: 'group', gn: 3, minutes: 5 }).ok);
  assert.equal(J(ctx.coopLive_().gi), '[0,1,2,0,1,2,0,1]');           // 次の開始に引き継ぐ
  ctx.coopStop();
  // 名簿の並びが変わっても、組はメールで引き継ぐ（転入の児童だけ等分の位置に入る）
  sheets.roster.values.push(['k00@kyoiku.edu.nishi.or.jp', 3, '1', 0, '転入']);
  const p2 = ctx.coopPlan('3-1', 3);
  assert.equal(p2.names[0], '転入'); assert.equal(p2.gi[0], 0);
  assert.equal(J(Array.from(p2.gi).slice(1)), '[0,1,2,0,1,2,0,1]');
  // 分け直すと予定を消して番号順の等分へ
  const p3 = ctx.coopSavePlan('3-1', 3, null, true);
  assert.ok(p3.ok); assert.equal(J(p3.gi), '[0,0,0,1,1,1,2,2,2]');
  sheets.roster.values.pop();
  // 画面：組の編集はステージと別のポップアップ。開始前は予定（シート）へ、映している回はその回へ「保存」で書く
  assert.ok(tui.includes('id="coopPlanModal" class="cmodal" hidden') && tui.includes('id="coopPlan" class="cdlg" role="dialog"'));
  assert.ok(tui.includes('if(live) run.coopSetGroups(gi); else run.coopSavePlan(PLAN.cls, PLAN.gn, gi);'));
  assert.ok(!tui.includes('id="coopGedit"'), '名札のタップで組を変える古いボタンは無い（ポップアップに一本化）');
  assert.ok(tui.indexOf('id="coopPlan"') < tui.indexOf('<div id="coopStage"'));
  // 正本は単元の「組分け」シート。保存するとクラス×組数の塊が書かれる
  ctx.coopSavePlan('3-1', 3, [2, 2, 1, 1, 0, 0, 2, 1]);
  const gs = sheets['組分け'];
  assert.ok(gs, '組分けシートができる');
  assert.equal(J(gs.values[0]), J(['クラス', '組数', '番号', '氏名', '組', 'email']));
  const live = gs.values.slice(1).filter(r => r[0] === '3-1' && r[1] === 3);
  assert.equal(live.length, 8);
  assert.equal(J(live.map(r => r[4])), J(['C', 'C', 'B', 'B', 'A', 'A', 'C', 'B']));
  assert.equal(live[0][3], '児童1');
  assert.ok(ctx.coopPlan('3-1', 3).sheetUrl.includes('#gid=123'));
  // 教師がシートを直接直す：組は「A組」「1」も読み、クラスは「3年1組」も読む。メールが空なら番号で照らす
  live[0][4] = 'A組'; live[1][4] = '2'; live[2][0] = '3年1組'; live[3][5] = ''; live[3][4] = 'a';
  assert.equal(J(ctx.coopPlan('3-1', 3).gi), '[0,1,1,0,0,0,2,1]');
  // 読めない値の行は等分の位置に戻す
  live[7][4] = 'Z';
  assert.equal(ctx.coopPlan('3-1', 3).gi[7], 2);
  // 他の組数の塊は別に残る
  ctx.coopSavePlan('3-1', 4, [3, 3, 2, 2, 1, 1, 0, 0]);
  assert.equal(gs.values.slice(1).filter(r => r[0] && Number(r[1]) === 4).length, 8);
  assert.equal(ctx.coopPlan('3-1', 3).gi[0], 0);
  // 以前の版（スクリプトプロパティ）の予定は、シートに塊が無い時だけ読み、保存するとシートへ移して消す
  props['coop_plan_3-1_5'] = JSON.stringify({ order: ['k01@kyoiku.edu.nishi.or.jp', 'k02@kyoiku.edu.nishi.or.jp'], gi: [4, 4] });
  const legacy = ctx.coopPlan('3-1', 5);
  assert.ok(legacy.saved); assert.equal(legacy.gi[0], 4); assert.equal(legacy.gi[1], 4);
  ctx.coopSavePlan('3-1', 5, Array.from(legacy.gi));
  assert.ok(!('coop_plan_3-1_5' in props));
  assert.equal(gs.values.slice(1).filter(r => Number(r[1]) === 5).length, 8);
  // 画面：保存ボタンを押すまで書かない（チップを動かしただけでは保存しない）
  assert.ok(tui.includes('id="coopPlanSave"') && /function planMove\(i, g\)\{[\s\S]*?planSetDirty\(true\)/.test(tui));
  assert.ok(!/planMove[\s\S]{0,300}coopSavePlan/.test(tui.match(/function planMove\(i, g\)\{[\s\S]*?\n\}/)[0]));
  assert.ok(tui.includes("addEventListener('pointerdown'") && tui.includes('#coopPlan .pk{touch-action:none'));
  // クラスは大きなボタン。隠したプルダウンが正本で、選んだクラスは端末ごとに覚える
  assert.ok(tui.includes('id="coopClsPick"') && /<select id="coopCls" style="display:none"/.test(tui));
  assert.ok(tui.includes("localStorage.setItem('coopCls', sel.value)") && tui.includes("localStorage.getItem('coopCls')"));
}

/* ---- 時間は1分刻み・続きから ---- */
{
  const J = x => JSON.stringify(Array.from(x));
  const live0 = ctx.coopLive_(); if (live0 && live0.status === 'run') ctx.coopStop();
  // 時間：1分刻み、1〜30分に丸める
  [[7, 7], [0.4, 1], [45, 30], [12.6, 13]].forEach(([inp, want]) => {
    const r = ctx.coopStart({ cls: '3-1', pat: 'sunflower', minutes: inp, mode: 'child' });
    assert.ok(r.ok); assert.equal(ctx.coopLive_().minutes, want, 'minutes ' + inp); ctx.coopStop();
  });
  // 1回目：7分、児童1と3が正答
  assert.ok(ctx.coopStart({ cls: '3-1', pat: 'sunflower', minutes: 7, mode: 'child' }).ok);
  const a1 = ctx.coopLive_();
  a1.start -= 60000; ctx.coopPutLive_(a1);                    // 1分たったことにする
  ctx.coopNote_(ctx.child_('k01@kyoiku.edu.nishi.or.jp'), 1, 10);
  ctx.coopNote_(ctx.child_('k03@kyoiku.edu.nishi.or.jp'), 1, 6);
  // 進行中は続きからにできない
  assert.ok(!ctx.coopStart({ cont: 'live', minutes: 5 }).ok);
  ctx.coopStop();
  const d1 = ctx.coopLive_(), dur1 = d1.end - d1.start;
  // 2回目：続きから（図形・色・クラスは前の回のまま、時間は新しく）
  const c2 = ctx.coopStart({ cont: 'live', minutes: 5, pat: 'penrose', cls: '4-2' });
  assert.ok(c2.ok, JSON.stringify(c2));
  const b2 = ctx.coopLive_();
  assert.equal(b2.pat, 'sunflower'); assert.equal(b2.seed, d1.seed); assert.equal(b2.cls, '3-1'); assert.equal(b2.minutes, 5);
  assert.equal(b2.prior.dur, dur1);
  assert.equal(b2.prior.ev.length, 2);
  assert.equal(J(b2.prior.ev.map(e => e[1])), '[0,2]');      // 児童1・児童3
  assert.equal(b2.prior.segs.length, 1); assert.equal(b2.prior.segs[0].total, 16); assert.equal(b2.prior.segs[0].minutes, 7);
  assert.ok(c2.session.prior && c2.session.prior.ev.length === 2, '開始の応答に前の回までの分が入る');
  assert.ok(ctx.coopState(0).prior, '全件の問い合わせには入る');
  assert.equal(ctx.coopState(1).prior, undefined, '差分の問い合わせには入れない');
  assert.equal(b2.total, 0, 'この回の合計は新しく数える');
  // キャッシュが消えても続きの部分はシートから戻る
  const keep = store.coop_live; delete store.coop_live;
  const back = ctx.coopLive_();
  assert.ok(back && back.prior && back.prior.ev.length === 2, 'coop シートから prior を戻す');
  store.coop_live = keep;
  // 2回目の正答 → 保存 → その保存データから3回目を続ける（前の回の prior も引き継ぐ）
  ctx.coopNote_(ctx.child_('k02@kyoiku.edu.nishi.or.jp'), 1, 9);
  ctx.coopStop();
  const sv2 = ctx.coopSave('続きテスト');
  assert.ok(sv2.ok);
  ctx.coopStart({ cls: '3-1', pat: 'penrose', minutes: 3, mode: 'child' }); ctx.coopStop();   // 間に別の回を挟む
  // 児童8が転出した（名簿から外れた）ことにする。その児童の分は落とし、他の児童はメールで照らす
  const k8 = sheets.roster.values.findIndex(r => r[0] === 'k08@kyoiku.edu.nishi.or.jp');
  const k8row = sheets.roster.values.splice(k8, 1)[0];
  const c3 = ctx.coopStart({ cont: 'save:' + sv2.id, minutes: 4 });
  assert.ok(c3.ok, JSON.stringify(c3));
  const b3 = ctx.coopLive_();
  assert.equal(b3.pat, 'sunflower'); assert.equal(b3.seed, d1.seed);
  assert.equal(b3.prior.segs.length, 2, '1回目と2回目の2つ');
  assert.equal(b3.prior.ev.length, 3);
  assert.ok(b3.prior.ev[2][0] >= dur1, '2回目の正答は1回目の後ろへずれる');
  assert.equal(J(b3.prior.ev.map(e => e[1])), '[0,2,1]');
  assert.equal(b3.prior.segs[1].total, 9);
  ctx.coopStop();
  sheets.roster.values.splice(k8, 0, k8row);
  // 保存データには order（メール）と prior が入る
  const pl = ctx.coopLoadRaw_(sv2.id).payload;
  assert.equal(pl.order.length, 8); assert.equal(pl.prior.ev.length, 2);
  assert.equal(ctx.coopLoad(sv2.id).payload.order, undefined, '画面にはメールを渡さない');
  assert.ok(!JSON.stringify(ctx.coopState(0)).includes('@'), 'coopState の応答にもメールが無い');
  // 存在しない保存データからは続けない
  assert.ok(!ctx.coopStart({ cont: 'save:nosuch', minutes: 3 }).ok);
  // 画面：時間は1分刻みの入力、ステージに「続きから」
  assert.ok(/<input id="coopMin" type="number" min="1" max="30" step="1"/.test(tui));
  assert.ok(tui.includes('id="coopCont"') && tui.indexOf('id="coopCont"') > tui.indexOf('<div id="coopStage"'));
  assert.ok(/function coopRateAt\(t\)/.test(tui) && tui.includes('coopRateAt(e[0])'));
  // 続きの回の枚数は残りの余白で決める（使った枚数が多いほど少ない。下限0.5）
  const src = tui.match(/var CAIM = [^\n]*\n/)[0] + tui.match(/function coopAutoRateOf\(p\)\{[\s\S]*?\n\}/)[0];
  const f = vm.runInNewContext(src + ';coopAutoRateOf');
  const base = { tfin: 34669, n: 29, minutes: 10, lim: 60, pace: 20 };
  assert.equal(f(base), 8);
  assert.ok(f(Object.assign({ used: 15000 }, base)) < f(base));
  assert.equal(f(Object.assign({ used: 40000 }, base)), 0.5);
}

console.log('coop.test.cjs: all assertions passed.');
