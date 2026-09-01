# 新しい単元を追加する

書くのは `Unit.gs` 1枚。Core と共通画面はコピーして貼るだけ。

## 1. Unit.gs を書く

`apps/<単元名>/Unit.gs` を作り、`UNIT` を定義する。

```js
var UNIT = {
  id: 'weight',
  title: 'おもさ タイムアタック！',
  teacherTitle: 'おもさ 設定・分析',

  defaults: { slow_ms: 5000 },        // 共通の既定値を上書き（任意）

  flags: [                             // モードの解禁条件（任意）
    { key: 'calc', label: '計算モード', gradeKey: 'calc_min_grade', defaultGrade: 3 }
  ],

  modes: [
    { id: 1, name: 'かんさん', desc: '3kg=□g', flag: null },
    { id: 2, name: 'けいさん', desc: '1kg300g + 500g', flag: 'calc' }
  ],

  types: { A: 'kg→g', B: 'g→kg g', C: 'たしざん' },   // 分析の列

  tips: 'weak_child の読み方をここに書く（教師画面に出る）',

  gen: function (rand, mode) {
    // 1問返す
  }
};
```

## 2. 1問の形

すべての単元がこの形で問題を表す。

```js
{
  t:   'A',                     // 問題型。types のキーと一致させる
  q:   ['3', 'kg'],             // 出題の表示トークン
  f:   ['g'],                   // 答えの欄と、その単位
  ans: { g: 3000 },             // 正解
  tag: '3kg'                    // 重複回避と分析用の識別子
}
```

- 単位ラベルが要らないなら `f: ['']`、`ans: { '': 56 }`
- `q` に `'+'` `'-'` を混ぜると演算子として描画される
- `ruler: { from, span, at }` を付けると目盛りが描かれる（単位は cm）

使える補助関数（Core が提供）：

| 関数 | 用途 |
|---|---|
| `ri_(rand, lo, hi)` | lo〜hi の整数 |
| `pick_(rand, arr)` | 配列から1つ |

`rand` は必ず引数の `rand` を使う。`Math.random()` を使うと
サーバーの再採点と食い違い、全員のスコアが0になる。

## 3. 桁数を揃える

自動判定は「正解の桁数に達したら確定」で動く。
**桁数そのものがヒントになる**ので、揃える責任は Unit 側にある。

| 状況 | 対処 |
|---|---|
| 2欄の下位の桁数がばらつく | 下位を3桁固定にする（例: m部は必ず100〜900） |
| 答えが0になりうる | 0 も出す。「0か否か」が漏れないようにする |
| どうしても揃わない | Enter 確定にし、画面に案内を出す |

## 4. 判定方式を選ぶ

位に分けること自体が目標なら欄ごとの一致（既定）。
値を読むことが目標なら合計での一致。

```js
byTotal: function (item) { return item.t === 'G'; },
unitScale: function (u) { return u === 'm' ? 100 : 1; }
```

合計判定にすると `1m87cm` と `187` の両方が正解になる。

## 5. 誤答を単位つきで表示する（任意）

答えが複数欄にまたがる単元（km/m のような）は、`fieldsByType` を定義すると
weak_class の「よくある誤答」と mistakes シートで単位つきに表示される。

```js
fieldsByType: { A: ['km', 'm'], C: ['m'] }
```

省略すると値をそのまま（スペース区切りで）表示する。答えが単一値の単元（九九など）は不要。

## 6. 練習で範囲を絞れるようにする（任意）

九九の「段を選ぶ」のように練習で範囲を絞りたい場合は、
`practiceNarrow` と `genNarrow` を足す。

```js
practiceNarrow: { key: 'dan', label: 'だん', values: [1,2,3,4,5,6,7,8,9] },
genNarrow: function (rand, mode, dan) { ... },
gen: function (rand, mode) { return this.genNarrow(rand, mode, 0); }
```

**範囲を絞った練習はハイスコアを記録しない。**
ランダム出題どうしでないと比較にならないため。

## 7. 設置する

1. 新しいスプレッドシートを作る
2. `拡張機能 > Apps Script` に4ファイルを貼る

| Apps Script 上の名前 | 中身 |
|---|---|
| `Core`（.gs） | `common/Core.gs` |
| `Unit`（.gs） | 作った `Unit.gs` |
| `index`（HTML） | `common/ui.html` |
| `teacher`（HTML） | `common/teacher.html` |

3. `setup` を1回実行して承認する
4. デプロイ（実行＝自分／アクセス＝ドメイン内）
5. `roster` の A1 に `=IMPORTRANGE("ハブのURL","roster!A:E")`
6. ハブの教師画面でリンクを追加する

## 8. 確認すること

- 名簿に自分だけ入れて、担任アカウントで1回通す
- 教師画面で `weak_child` が意図した列になっているか
- `slow_ms` の既定値は当てずっぽう。1〜2週で分布を見て調整する

## やってはいけないこと

- **Core に単元固有の分岐を書く。** 増えるほど Core が壊れやすくなる
- **クライアントに出題ロジックを持たせる。** サーバーと二重管理になり、
  片方だけ直した瞬間に全員のスコアが0になる
- **`log` に問題単位で全部記録する。** 1年で行数が破綻する
