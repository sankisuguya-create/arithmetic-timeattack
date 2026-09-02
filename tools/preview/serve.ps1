# リポジトリのルートを静的配信するだけの開発用サーバー（Windows / node・python 不要）。
# preview.html は fetch でリポジトリ内のファイルを読みに行くため、
# 「tools/preview だけ」ではなく必ずリポジトリのルートを配信すること。
#
# 使い方:
#   powershell -ExecutionPolicy Bypass -File tools/preview/serve.ps1 [ポート番号、既定8791]
#   -> http://127.0.0.1:8791/tools/preview/preview.html?unit=weight を開く
# Ctrl+C で停止。

$Port = 8791
if ($args.Count -ge 1) { $Port = [int]$args[0] }

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Output "listening: http://127.0.0.1:$Port/tools/preview/preview.html?unit=weight"
Write-Output "root: $root"

$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript'; '.gs'='text/plain; charset=utf-8'; '.css'='text/css' }

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $localPath = [Uri]::UnescapeDataString($request.Url.LocalPath).TrimStart('/')
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = 'tools/preview/preview.html' }
    $filePath = Join-Path $root $localPath

    if (Test-Path $filePath -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $ext = [System.IO.Path]::GetExtension($filePath)
      if ($mime.ContainsKey($ext)) { $response.ContentType = $mime[$ext] } else { $response.ContentType = 'application/octet-stream' }
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
    }
    $response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
