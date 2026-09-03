# clasp で管理する

> **この方法が使えるかは環境による。**
> `clasp` は Apps Script API を経由するので、Google Workspace 側で
> Apps Script API またはサードパーティ OAuth アプリが遮断されていると
> `clasp login` の時点で通らない（`admin_policy_enforced`）。
> 遮断されている環境では GitHub Actions での自動配布も同様に不可能で、
> **手でエディタに貼るしかない**。その場合は `tools/paste/README.md` を見る。
>
> 手貼りで実際に問題になるのは貼る手間ではなく、
> **貼り忘れた単元だけ古い `Core.gs` で動き続けること**。
> `Core.gs` の `CORE_VERSION` を教師画面とハブの `dashboard` に出してあるので、
> 版が揃っているかで気づける。

各アプリのプロジェクトに `common/` のファイルも含める必要がある。
シンボリックリンクは clasp が追わないので、`push` 前にコピーする。

## 準備

```bash
npm i -g @google/clasp
clasp login
```

## 各アプリのディレクトリ構成（push 用）

```
build/kuku/
  Core.gs        ← common/Core.gs のコピー
  Unit.gs        ← apps/kuku/Unit.gs のコピー
  index.html     ← common/ui.html のコピー
  teacher.html   ← common/teacher.html のコピー
  appsscript.json
  .clasp.json    ← scriptId を書く
```

## ビルドと push

```bash
# 例: 九九
mkdir -p build/kuku
cp common/Core.gs        build/kuku/Core.gs
cp apps/kuku/Unit.gs     build/kuku/Unit.gs
cp common/ui.html        build/kuku/index.html
cp common/teacher.html   build/kuku/teacher.html
cd build/kuku && clasp push
```

`.clasp.json` の例:

```json
{ "scriptId": "スクリプトIDをここに", "rootDir": "." }
```

`appsscript.json` の例:

```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "DOMAIN" }
}
```

`build/` は `.gitignore` に入れておく。
