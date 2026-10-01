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
// 始まりの前に始めておき、始まった直後に正答をまとめて数えさせる抜け道：始まりの5秒より前に始めた回は数えない
ctx.coopNote_(c3, 1, 9, { t: Date.now() - 55000, lim: 60 });         // 始まりの55秒前に始めた
assert.equal(ctx.coopState(0).total, 0);
const LB = ctx.coopLive_(); LB.start -= 58000; ctx.coopPutLive_(LB);   // 始まりを58秒前にずらして確かめる
ctx.coopNote_(c3, 1, 5, { t: Date.now() - 55000, lim: 60 });         // 始まりの3秒後に始めた：新しい方へ
assert.equal(ctx.coopState(0).total, 5);
ctx.coopNote_(c3, 1, 2, { t: LB.start - 4000, lim: 60 });            // 「よーい…」の間（始まりの4秒前）に始めた：数える
assert.equal(ctx.coopState(0).total, 7);
ctx.coopNote_(c3, 1, 3, { t: LB.start - 6000, lim: 60 });            // 始まりの6秒前に始めた：数えない
assert.equal(ctx.coopState(0).total, 7);
ctx.coopNote_(c3, 1, 4, { t: LB.start - 2000, lim: 30 });            // 制限秒が違っても「始まり＋(制限秒−5秒)」で見る
assert.equal(ctx.coopState(0).total, 11);

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

/* ---- 開始のカウントダウン：始まりをサーバーが4秒後に置く（教師画面はこの start に合わせて よーい…→3→2→1→スタート を出す） ---- */
const t0 = Date.now();
const stE = ctx.coopReset({ countdown: true });
assert.ok(stE.ok && typeof stE.now === 'number', JSON.stringify(stE));    // 画面が時計のずれを差し引けるように now を返す
const sE = stE.session;
assert.ok(sE.start - t0 >= 4000 && sE.start - t0 < 5000, String(sE.start - t0));
assert.equal(sE.end - sE.start, 600000);                               // 制限時間はスタートから数える
assert.ok(sheets.coop.values.find(r => r[0] === sE.id)[9].getTime() === sE.start);
assert.ok(JSON.parse(store.coop_prev).end < sE.start);                  // 前の協力はリセットを押した時点で終わる
ctx.coopNote_(c1, 1, 7, { t: Date.now() - 58000, lim: 60 });            // カウントダウン中に遊び終えた回：新しい方には数えない
assert.equal(ctx.coopState(0).total, 0);
assert.equal(ctx.coopForChild_(c1, 60).counts, true);                   // カウントダウン中に始めた本番は数える
{ // 画面：送信中と残り3秒より前は「よーい…」（長さが往復でばらつく間に数字を出さない）。数字は3から
  const tq = read('common/teacher.html');
  assert.ok(tq.includes("if(CP.begin){ txt = 'よーい…'; cls = 'word'; }"));
  assert.ok(/if\(rem > 3000\)\{ txt = 'よーい…'; cls = 'word'; \}\n\s*else if\(rem > 0\) txt = String\(Math\.ceil\(rem \/ 1000\)\);/.test(tq));
  assert.ok(!/txt = '5'/.test(tq));
}
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
  assert.ok(ctx.coopStart({ cls: '3-1', pat: 'sunflower', minutes: 7, mode: 'child', org: 5 }).ok);
  const a1 = ctx.coopLive_();
  assert.equal(a1.org, 5);
  a1.start -= 60000; ctx.coopPutLive_(a1);                    // 1分たったことにする
  ctx.coopNote_(ctx.child_('k01@kyoiku.edu.nishi.or.jp'), 1, 10);
  ctx.coopNote_(ctx.child_('k03@kyoiku.edu.nishi.or.jp'), 1, 6);
  // 進行中は続きからにできない
  assert.ok(!ctx.coopStart({ cont: 'live', minutes: 5 }).ok);
  ctx.coopStop();
  const d1 = ctx.coopLive_(), dur1 = d1.end - d1.start;
  // 2回目：続きから（図形・色・クラスは前の回のまま、時間は新しく）
  const c2 = ctx.coopStart({ cont: 'live', minutes: 5, pat: 'penrose', cls: '4-2', org: 2 });
  assert.ok(c2.ok, JSON.stringify(c2));
  const b2 = ctx.coopLive_();
  assert.equal(b2.pat, 'sunflower'); assert.equal(b2.seed, d1.seed); assert.equal(b2.cls, '3-1'); assert.equal(b2.minutes, 5);
  assert.equal(b2.prior.dur, dur1);
  assert.equal(b2.org, 5, '起点の数も前の回のまま'); assert.equal(c2.session.org, 5);
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
  assert.equal(back.org, 5, 'coop シートの15列目から起点の数を戻す');
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
  assert.equal(b3.pat, 'sunflower'); assert.equal(b3.seed, d1.seed); assert.equal(b3.org, 5, '保存データからも起点の数を引き継ぐ');
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

/* ---- 児童の見返し（終わった回の図形。自分の色を目立たせるだけ） ---- */
{
  const asKid = m => { ctx.Session = { getActiveUser: () => ({ getEmail: () => m }), getScriptTimeZone: () => 'Asia/Tokyo' }; };
  const live0 = ctx.coopLive_(); if (live0 && live0.status === 'run') ctx.coopStop();
  assert.ok(ctx.coopStart({ cls: '3-1', pat: 'sunflower', minutes: 5, mode: 'child' }).ok);
  const r1 = ctx.coopLive_(); r1.start -= 60000; ctx.coopPutLive_(r1);
  ['k01', 'k02', 'k03', 'k05'].forEach((k, i) => ctx.coopNote_(ctx.child_(k + '@kyoiku.edu.nishi.or.jp'), 1, 10 + i));
  // 遊んでいる間は見返せない
  asKid('k02@kyoiku.edu.nishi.or.jp');
  assert.ok(!ctx.coopReview().ok);
  assert.ok(!ctx.coopPeek(60).review);
  ctx.Session = teacherSession; ctx.coopStop();
  asKid('k02@kyoiku.edu.nishi.or.jp');
  const pk = ctx.coopPeek(60);
  assert.equal(pk.active, false); assert.equal(pk.review, true, '終わったら入口を出す');
  const v = ctx.coopReview();
  assert.ok(v.ok, JSON.stringify(v));
  assert.equal(v.me, 1); assert.equal(v.n, 8); assert.equal(v.total, 46); assert.equal(v.ev.length, 4);
  const txt = JSON.stringify(v);
  assert.ok(!txt.includes('@') && !txt.includes('児童') && !('names' in v) && !('nos' in v) && !('gi' in v), '名前・番号・メール・組の一覧を入れない');
  assert.equal(v.ev.filter(e => e[1] === 1).length, 1, '自分の分は自分の index のまま');
  assert.equal(v.ev.find(e => e[1] === 1)[2], 11);
  assert.equal(v.mine, false, '既定は「じぶん」の数を出さない');
  // 教師画面の設定で「じぶん」を出せる（config シートの coop_mine。図形の元になる正答の列は変わらない）
  ctx.Session = teacherSession; ctx.saveConfig({ coop_mine: 1 }); asKid('k02@kyoiku.edu.nishi.or.jp');
  const v1 = ctx.coopReview();
  assert.equal(v1.mine, true); assert.equal(v1.me, 1); assert.equal(v1.ev.length, v.ev.length);
  ctx.Session = teacherSession; ctx.saveConfig({ coop_mine: 0 }); asKid('k02@kyoiku.edu.nishi.or.jp');
  assert.equal(ctx.coopReview().mine, false);
  // 色はモニターと同じ：他の児童の index も名簿の並びのまま、呼ぶたびに変わらない
  assert.equal(JSON.stringify(v.ev.map(e => [e[1], e[2]])), '[[0,10],[1,11],[2,12],[4,13]]');
  for (let t = 0; t < 5; t++) assert.equal(JSON.stringify(ctx.coopReview().ev), JSON.stringify(v.ev));
  // 色の割り当て（シード）は新しく始めるたびに引き直す（続きからの回だけ前の回と同じ。上の b2 / b3 で確かめている）
  ctx.Session = teacherSession;
  const seeds = new Set();
  for (let t = 0; t < 5; t++) {
    assert.ok(ctx.coopStart({ cls: '3-1', pat: 'sunflower', minutes: 5, mode: 'child' }).ok);
    seeds.add(ctx.coopLive_().seed); ctx.coopStop();
  }
  assert.equal(seeds.size, 5, '新しく始めるたびにシードが変わる');
  asKid('k02@kyoiku.edu.nishi.or.jp');
  // 別のクラスの児童には出さない
  asKid('other@kyoiku.edu.nishi.or.jp');
  assert.ok(!ctx.coopReview().ok); assert.ok(!ctx.coopPeek(60).review);
  // グループの回：各正答に組番号だけを付ける。自分の組を返す
  ctx.Session = teacherSession;
  ctx.coopSavePlan('3-1', 3, [0, 1, 2, 0, 1, 2, 0, 1]);
  assert.ok(ctx.coopStart({ cls: '3-1', pat: 'sunflower', minutes: 5, mode: 'group', gn: 3 }).ok);
  const r2 = ctx.coopLive_(); r2.start -= 60000; ctx.coopPutLive_(r2);
  ctx.coopNote_(ctx.child_('k02@kyoiku.edu.nishi.or.jp'), 1, 7);
  ctx.coopNote_(ctx.child_('k03@kyoiku.edu.nishi.or.jp'), 1, 5);
  ctx.coopStop();
  asKid('k02@kyoiku.edu.nishi.or.jp');
  const vg = ctx.coopReview();
  assert.equal(vg.mode, 'group'); assert.equal(vg.g, 1);
  assert.equal(JSON.stringify(vg.ev.map(e => e[3]).sort()), '[1,2]');
  // キャッシュに別のクラスの回があっても、自分のクラスの最後に終わった回をシートから探す
  ctx.Session = teacherSession;
  const keepLive = store.coop_live;
  const fake = JSON.parse(keepLive); fake.cls = '4-2'; store.coop_live = JSON.stringify(fake);
  asKid('k02@kyoiku.edu.nishi.or.jp');
  const vs = ctx.coopReview();
  assert.ok(vs.ok, JSON.stringify(vs)); assert.equal(vs.mode, 'group');
  store.coop_live = keepLive;
  ctx.Session = teacherSession;
  // 画面：数値と枚数の式は教師画面の写し。できる操作は「とじる」と「自分の色を目立たせる」だけ
  const ui2 = read('common/index.html');
  const num = (src, k) => Number((src.match(new RegExp('\\b' + k + '\\s*[=:]\\s*([0-9.]+)')) || [])[1]);
  ['CVW', 'CSMIN', 'CZOOM_STEP', 'CCOVER', 'CAIM', 'CPART', 'CGAP'].forEach(k => {
    assert.ok(num(tui, k) > 0 && num(tui, k) === num(ui2.slice(ui2.indexOf('var CRV')), k), k + ' が教師画面と同じ');
  });
  const fT = vm.runInNewContext(tui.match(/var CAIM = [^\n]*\n/)[0] + tui.match(/function coopAutoRateOf\(p\)\{[\s\S]*?\n\}/)[0] + ';coopAutoRateOf');
  const fC = vm.runInNewContext(ui2.match(/var CRV = [^\n]*\n/)[0] + ui2.match(/function coopRvAutoRate\(p\)\{[\s\S]*?\n\}/)[0] + ';coopRvAutoRate');
  [{ tfin: 34669, n: 29, minutes: 10, lim: 60, pace: 20 }, { tfin: 21465, n: 25, minutes: 7, lim: 45, pace: 14, used: 9000 }, { tfin: 10, n: 3, minutes: 1, lim: 60, pace: 20 }]
    .forEach(p => assert.equal(fC(p), fT(p)));
  const rv = ui2.slice(ui2.indexOf('<div id="coopRv" hidden>'), ui2.indexOf('</div>\n<!-- 協力モード中だけ出る'));
  assert.equal((rv.match(/<button/g) || []).length, 2, 'ボタンは2つだけ');
  assert.ok(!/coopRvCv'\)\.addEventListener|coopRvCv\.on/.test(ui2), '図形を押して他の人の色を選ぶ手段は無い');
  // 自分の正答数は届いた列から数える（続きからの前の回の分も含む）。他の児童の数は出さない
  const myTot = vm.runInNewContext(ui2.match(/function coopRvMyTotal\(d\)\{[\s\S]*?\n\}/)[0] + ';coopRvMyTotal');
  assert.equal(myTot(v), 11);
  assert.equal(myTot({ me: 2, ev: [[1, 2, 5], [2, 0, 9], [3, 2, 4]] }), 9);
  assert.ok(ui2.includes("'<small>じぶん</small>' + coopRvMyTotal(d) + ' もん"));
  assert.ok(ui2.includes('d.mine === false'), 'mine が偽なら「じぶん」を出さない（古い Core は出す）');
  assert.ok(tui.includes('id="coopRvMine"') && tui.includes('saveConfig({ coop_mine'), '教師画面に切り替え欄（変えたらすぐ保存）');
  assert.ok(tui.includes('Number(c.coop_mine) === 1'), '既定は出さない（1 の時だけ出す）');
  // 教師画面：一気に組み直す時も引いた後で数え直す
  assert.ok(/if\(instant\)\{ CP\.S = ns; CP\.RENDER_S = ns; coopRecount\(\); return; \}/.test(tui));
}

/* ---- 色：児童画面と教師画面で同じ手順・同じ色。似た色を減らす（CIEDE2000 の最小色差で確かめる） ---- */
{
  const tui = read('common/teacher.html'), ui = read('common/index.html');
  const fT = vm.runInNewContext(tui.match(/function coopRng\(seed\)[^\n]*\n/)[0] +
    tui.slice(tui.indexOf('function coopOkToRgb('), tui.indexOf('function coopFam(rgb)')) + ';coopPalette');
  const fC = vm.runInNewContext(ui.match(/function coopRng_\(seed\)[^\n]*\n/)[0] +
    ui.slice(ui.indexOf('function coopOkToRgb_('), ui.indexOf('/* 自分の色：児童ごとなら')) + ';coopPalette_');
  const lab = rgb => {
    const c = rgb.split(',').map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2],
      Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const de00 = ([L1, a1, b1], [L2, a2, b2]) => {
    const rad = Math.PI / 180, p7 = x => Math.pow(x, 7);
    const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(p7(Cb) / (p7(Cb) + p7(25))));
    const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G), Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
    const hp = (x, y) => { if(!x && !y) return 0; const h = Math.atan2(y, x) / rad; return h < 0 ? h + 360 : h; };
    const h1 = hp(ap1, b1), h2 = hp(ap2, b2), dL = L2 - L1, dC = Cp2 - Cp1;
    let dh = 0; if(Cp1 * Cp2){ dh = h2 - h1; if(dh > 180) dh -= 360; else if(dh < -180) dh += 360; }
    const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh / 2 * rad), Lb = (L1 + L2) / 2, Cpb = (Cp1 + Cp2) / 2;
    let hb = h1 + h2; if(Cp1 * Cp2) hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
    const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.20 * Math.cos((4 * hb - 63) * rad);
    const dT = 30 * Math.exp(-Math.pow((hb - 275) / 25, 2)), RC = 2 * Math.sqrt(p7(Cpb) / (p7(Cpb) + p7(25)));
    const SL = 1 + 0.015 * Math.pow(Lb - 50, 2) / Math.sqrt(20 + Math.pow(Lb - 50, 2)), SC = 1 + 0.045 * Cpb, SH = 1 + 0.015 * Cpb * T;
    const RT = -Math.sin(2 * dT * rad) * RC;
    return Math.sqrt(Math.pow(dL / SL, 2) + Math.pow(dC / SC, 2) + Math.pow(dH / SH, 2) + RT * (dC / SC) * (dH / SH));
  };
  const minDe = cols => { const L = cols.map(lab); let m = 1e9;
    for(let i = 0; i < L.length; i++) for(let j = i + 1; j < L.length; j++) m = Math.min(m, de00(L[i], L[j])); return m; };
  for(let seed = 1; seed <= 30; seed++){
    [29, 6, 1].forEach(n => assert.equal(JSON.stringify(fC(n, seed)), JSON.stringify(fT(n, seed)), '同じシードなら同じ色 n=' + n));
    const p29 = fT(29, seed);
    assert.equal(p29.length, 29); assert.equal(new Set(p29).size, 29);
    p29.forEach(c => assert.ok(/^\d{1,3},\d{1,3},\d{1,3}$/.test(c) && c.split(',').every(v => +v <= 255), c));
    // 旧手順（金色の角度で色相だけを回す）は 29人で最小 1.5〜4.6。新しい手順は 9 を超える（実測）
    assert.ok(minDe(p29) >= 8, '29人の最小色差 ' + minDe(p29).toFixed(1));
    assert.ok(minDe(fT(6, seed * 31 + 11)) >= 18, '6組の最小色差');
  }
  // シードが変われば、同じ index・同じ組でも色が変わる
  assert.equal(new Set(Array.from({ length: 30 }, (_, k) => fT(29, k + 1)[0])).size, 30);
  assert.ok(new Set(Array.from({ length: 30 }, (_, k) => fT(6, (k + 1) * 31 + 11)[0])).size >= 25);
}

/* ---- 児童画面：協力していない間は左上が灰色の「前回の協力プレイ」になり、押すと見返しを開く ---- */
{
  const ui = read('common/index.html'), core = read('common/Core.gs');
  assert.ok(!ui.includes('coopRvBtn'), '右下の入口は無くした');
  assert.ok(/var past = !COOP\.active && !!COOP\.review && !!cv;/.test(ui));
  assert.ok(ui.includes("$('coopA').textContent = '前回の協力プレイ';"));
  assert.ok(/body\.coopPast\[data-scr="start"\] #coop,\nbody\.coopPast\[data-scr="result"\] #coop\{display:flex;color:#5A6068;background:#EEF0F2;/.test(ui), '灰色の札はメニュー・結果の画面だけ');
  assert.ok(!/body\.coopPast\[data-scr="play"\]/.test(ui), '遊んでいる間は出さない');
  assert.ok(ui.includes("$('coop').addEventListener('click', function(){ if($('coop').classList.contains('past')) coopRvOpen(); });"));
  assert.ok(core.includes('{ active: false, review: true, rid: s.id, pat: s.pat }'));
}

/* ---- 教師画面：協力モードは左に操作欄、右にステージ（狭い画面では上下） ---- */
{
  const tui = read('common/teacher.html');
  assert.ok(tui.includes('#pageCoop{display:grid;grid-template-columns:minmax(340px,380px) minmax(0,1fr);'));
  assert.ok(tui.includes('#pageCoop > #coopStage{grid-column:2;grid-row:1;'));
  const pc = tui.slice(tui.indexOf('<div id="pageCoop"'), tui.indexOf('</div><!-- /pageCoop -->'));
  assert.ok(pc.indexOf('class="box coopBox"') < pc.indexOf('<div id="coopStage"'));
  assert.ok(/var full = st\.offsetWidth;/.test(tui), 'ステージの幅は右の列の幅から');
  // 状態・案内は左の欄の中：高さを取り置かず、空なら詰める（1366×768 で欄の中を送らずに収めるため）
  assert.ok(tui.includes('#coopStat:empty,#coopGuide:empty{display:none}'));
  // 設定は見出し｜操作の2列。クラスは3列の格子（6クラスまで2段）。全クラス同じ学年なら「1組」だけ
  assert.ok(tui.includes('.coopBox .cform{display:grid;grid-template-columns:6.4rem minmax(0,1fr);'));
  assert.ok(tui.includes('.coopBox .clsPick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));'));
  assert.ok(tui.includes("if(one) name = name.replace(/^\\d+年/, '');"));
  // 常に出ている見出しは1段（題名・タブ・写し・注意・行き先）。タブは見出しの段の中
  const top = tui.slice(tui.indexOf('<div class="topbar">'), tui.indexOf('<div id="verWarn"'));
  ['id="h1"', 'class="tabs"', 'id="tabCoop"', 'id="sub"', 'id="cautions"', 'id="golinks"'].forEach(k => assert.ok(top.includes(k), k));
  assert.ok(!/#coopStat\{min-height/.test(tui) && !/#coopGuide\{min-height/.test(tui));
}

/* ---- 起点：1〜児童数（グループは1〜組数）。起点ごとに担当（児童 i／組 g は起点 i mod 数）から育つ ---- */
{
  ctx.Session = teacherSession;
  const S = o => { const r = ctx.coopStart(Object.assign({ cls: '3-1', minutes: 5 }, o)); assert.ok(r.ok, JSON.stringify(r)); const l = ctx.coopLive_(); ctx.coopStop(); return l; };
  assert.equal(S({ mode: 'child', org: 1 }).org, 1);
  assert.equal(S({ mode: 'child' }).org, 1, '送らなければ前の回の数（古い画面）');
  const nKids = S({ mode: 'child', org: 999 });
  assert.equal(nKids.org, nKids.names.length, '児童ごとは児童数まで');
  assert.equal(S({ mode: 'group', gn: 3, org: 7 }).org, 3, 'グループは組数まで');
  assert.equal(S({ mode: 'child', org: -5 }).org, 1);
  assert.equal(S({ mode: 'child', org: 4 }).org, 4);
  ctx.coopStart({ reset: true }); assert.equal(ctx.coopLive_().org, 4, 'リセットは同じ起点の数'); ctx.coopStop();
  assert.equal(sheets.coop.values[sheets.coop.values.length - 1][14], 4, 'coop シートの15列目に置く');
  assert.equal(ctx.coopState(0).org, 4);
  const tui = read('common/teacher.html'), ui = read('common/index.html');
  // 起点の手続きは teacher.html と index.html で一字一句同じ
  const cut = src => src.slice(src.indexOf('/* ---- 起点（teacher.html と index.html に同じものを置く'), src.indexOf('function coopFinOf(')) +
    src.slice(src.indexOf('function coopFinOf('), src.indexOf('\n}\n', src.indexOf('function coopFinOf(')) + 3);
  assert.ok(cut(tui).length > 1500); assert.equal(cut(ui), cut(tui));
  const F = vm.runInNewContext(cut(tui) + ';({ coopOrigins, coopOrders, coopAlloc, coopTake, coopFinOf })');
  // 合成のタイル：格子。育ち始める点（vx, vy）から近い順に並べてある（教師画面と同じ前提）
  const W = 800, H = 450, OX = W * 0.14, OY = H * 0.78, VX = 1.1 * OX / 0.32, VY = 1.1 * OY / 0.32;
  const tiles = [];
  for (let x = 0; x < W * 3.6; x += 20) for (let y = 0; y < H * 3.6; y += 20) tiles.push({ cx: x, cy: y, d: Math.hypot(x - VX, y - VY) });
  tiles.sort((a, b) => a.d - b.d);
  const view = sc => ({ x0: VX - OX / sc, x1: VX + (W - OX) / sc, y0: VY - OY / sc, y1: VY + (H - OY) / sc });
  const inV = vr => t => t.cx >= vr.x0 && t.cx <= vr.x1 && t.cy >= vr.y0 && t.cy <= vr.y1;
  // 起点1つ：今までと同じ（近い順のまま、完成の枚数も今までの式と同じ）
  const o1 = F.coopOrders(tiles, F.coopOrigins(1, VX, VY, OX, OY, W, H, 7));
  assert.equal(o1.length, 1); assert.ok(o1[0].every((v, i) => v === i));
  const vmin = view(0.32), idx = []; tiles.forEach((t, i) => { if (inV(vmin)(t)) idx.push(i); });
  assert.equal(F.coopFinOf(tiles, o1, inV(vmin), 0.9), idx[Math.ceil(idx.length * 0.9) - 1] + 1);
  // 起点 k 個：最初の画面の中に k 個、同じシードなら同じ並び、シードが違えば並びが変わる
  const v1 = view(1);
  [2, 6, 29].forEach(k => {
    const p = F.coopOrigins(k, VX, VY, OX, OY, W, H, 7);
    assert.equal(p.length, k);
    p.forEach(q => assert.ok(q[0] > v1.x0 && q[0] < v1.x1 && q[1] > v1.y0 && q[1] < v1.y1, '最初の画面の中'));
    assert.equal(new Set(p.map(q => q.join(','))).size, k, '重ならない');
    assert.equal(JSON.stringify(F.coopOrigins(k, VX, VY, OX, OY, W, H, 7)), JSON.stringify(p));
  });
  assert.notEqual(JSON.stringify(F.coopOrigins(6, VX, VY, OX, OY, W, H, 7)), JSON.stringify(F.coopOrigins(6, VX, VY, OX, OY, W, H, 8)));
  // 担当：起点0の担当の正答は起点0の近くに、起点1の担当は起点1の近くに貼る。同じタイルを2度使わない
  const p2 = F.coopOrigins(2, VX, VY, OX, OY, W, H, 3), ord2 = F.coopOrders(tiles, p2), A = F.coopAlloc(ord2);
  const got = [[], []];
  for (let r = 0; r < 40; r++) { got[0].push(F.coopTake(A, 0)); got[1].push(F.coopTake(A, 1)); got[1].push(F.coopTake(A, 3)); }  // 3 mod 2 = 1
  const near = (j, o) => Math.hypot(tiles[j].cx - p2[o][0], tiles[j].cy - p2[o][1]);
  got[0].forEach(j => assert.ok(near(j, 0) < near(j, 1)));
  got[1].forEach(j => assert.ok(near(j, 1) < near(j, 0)));
  assert.equal(new Set(got[0].concat(got[1])).size, 120);
  // 正答の少ない起点も、自分の起点のまわりに島ができる（多い隣に起点のまわりを先に埋められない）。
  // 起点0が1枚貼る間に他は6枚ずつ。近い順だけの並びでは起点0の60枚が 180〜234px まで散った（半径の目安は約90px）
  [5, 6, 7].forEach(seed => {
    const p6 = F.coopOrigins(6, VX, VY, OX, OY, W, H, seed), A6 = F.coopAlloc(F.coopOrders(tiles, p6)), small = [];
    for (let r = 0; r < 60; r++) { small.push(F.coopTake(A6, 0)); for (let o = 1; o < 6; o++) for (let q = 0; q < 6; q++) F.coopTake(A6, o); }
    const far = Math.max(...small.map(j => Math.hypot(tiles[j].cx - p6[0][0], tiles[j].cy - p6[0][1])));
    assert.ok(far < 130, '正答の少ない起点の島が起点のまわりにまとまる ' + far.toFixed(0));
  });
  // 全部埋まったら -1
  const Af = F.coopAlloc(o1); for (let i = 0; i < tiles.length; i++) F.coopTake(Af, 0); assert.equal(F.coopTake(Af, 0), -1);
  // 教師画面：貼る位置は担当の起点から。組が変わったら、起点が複数のグループの回は組み直す。開始で起点の数を送る
  assert.ok(tui.includes('var n = Math.round(e[2] * coopRateAt(e[0])), c0 = CP.cursor, o = keyOf(e[1]), vr = coopView(CP.S);'));
  assert.ok(tui.includes("if(CP.MODE === 'group' && CP.ORD && CP.ORD.length > 1) coopRecompute(CP.evI); else coopRepaint();"));
  assert.ok(tui.includes('opts.org = coopOrgVal();'));
  assert.ok(!/coopRoster\(\); coopRepaint\(\);\n\s*dirty\.textContent = '保存しました。児童/.test(tui));
  // 児童の見返しも同じ手続き（グループは各正答の組番号が担当）
  assert.ok(ui.includes("var m = Math.round(e[2] * rateAt(e[0])), o = grp ? (e[3] || 0) : e[1];"));
  assert.ok(ui.includes('RV.ord = coopOrders(RV.tiles, coopOrigins(d.org || 1, VX, VY, OX, OY, W, H, d.seed || 1));'));
}

console.log('coop.test.cjs: all assertions passed.');
