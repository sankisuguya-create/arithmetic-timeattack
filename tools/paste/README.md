# 貼り付け補助

`common/` と `apps/` のファイルを Apps Script のエディタへ貼るときの補助ページ。

clasp と GitHub Actions は Apps Script API を使うので、校務ドメインで API が
使えない環境では手貼りしか無い。手貼りで実際に事故るのは次の2つで、
どちらもコードの問題ではなく対応表の問題なので、ここで固定してしまう。

- **`common/ui.html` を Apps Script 上で `index` という名前で貼る**という付け替え
- **貼り忘れた単元だけ古い `Core.gs` で動き続ける**こと

## 使い方

リポジトリの**ルート**を静的サーバーで配信して、`tools/paste/paste.html` を開く。

```bash
# Windows（node/python 不要）
powershell -ExecutionPolicy Bypass -File tools/preview/serve.ps1

# Mac / Linux
python3 -m http.server 8791
```

→ `http://127.0.0.1:8791/tools/paste/paste.html`

単元を選ぶと、貼る順・Apps Script 上の名前・コピーボタンが並ぶ。

## 貼り忘れの見つけ方

ページの上に、いま貼ろうとしている `Core.gs` の版（`CORE_VERSION`）が出る。
貼り終えたら各単元の教師画面を開き、見出しの「Core ○○」がその版と一致するか見る。
単元が増えるほど目視は当てにならないので、**ハブの `dashboard` シート**にも
単元ごとの Core の版が並ぶようにしてある（ハブの教師画面「ダッシュボードを作る」）。

## デプロイのときの注意

**デプロイ › デプロイを管理 › 鉛筆 › バージョン「新バージョン」** で更新する。
「新しいデプロイ」を選ぶと URL が変わり、児童のリンクとハブのリンクが全部切れる。
