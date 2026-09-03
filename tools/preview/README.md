# プレビュー

`apps/<単元>/Unit.gs` を、スプレッドシートも Apps Script デプロイも用意せずブラウザで見るための開発用ツール。
出題ロジックは `Unit.gs` をそのまま実行するので、二重管理にならない（`docs/ADD_UNIT.md` の「やってはいけないこと」参照）。

## 使い方

リポジトリの**ルート**を静的サーバーで配信して、`tools/preview/preview.html?unit=<単元id>` を開く。

```bash
# Windows（node/python 不要）
powershell -ExecutionPolicy Bypass -File tools/preview/serve.ps1

# Mac / Linux / クラウド環境
python3 -m http.server 8791
```

→ `http://127.0.0.1:8791/tools/preview/preview.html?unit=weight`

`unit` には `apps/` 配下のディレクトリ名を指定する（例: `kuku` / `length` / `weight`）。
新しい単元を追加したときは、この仕組み自体を直す必要はない
（`preview.html` は `UNIT.gen` / `UNIT.modes` / `UNIT.units` を読むだけの単元非依存の実装のため。
画面上部のリンクに増やしたい場合だけ `preview.html` の `KNOWN_UNITS` に id を足す）。

## できないこと

- 名簿・ランキング・weak_child などサーバー側の記録は再現しない（採点も本番と同じ再判定はしない）
- 順次開放（`modes[].needs`）とクラスごとの公開設定は再現しない。
  試行回数も `class_config` も無いので、全モードが開いた状態で出る
- `settings`（教師が調整する表示設定）は `UNIT.defaults` の値をそのまま使う。教師画面での上書きは反映されない

## 実機との一致について

自動確定の桁数は、実機の `boot()` と同じく `DIGITCAP` に入れて `ui.html` に渡している。
`ui.html` 側の経路（`digitCap_()`）は実機と共有しているので、
`digitCap` の宣言漏れ・桁幅の不一致はこのプレビューでそのまま再現する。

一致しないのは、名簿・ランキング・集計などサーバー側だけの部分（上記「できないこと」）。
