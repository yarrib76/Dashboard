$txtFile = Get-ChildItem -Path "docs" -Filter "Dise*.txt" | Select-Object -First 1
if (-not $txtFile) {
  throw "No se encontro docs\\Diseño.txt"
}

$src = $txtFile.FullName
$dst = Join-Path $txtFile.DirectoryName "Diseño.html"
$lines = Get-Content -Path $src

function New-Slug([string]$s) {
  $t = $s.ToLowerInvariant()
  $t = [regex]::Replace($t, "[^a-z0-9]+", "-")
  $t = $t.Trim("-")
  if ([string]::IsNullOrWhiteSpace($t)) { return "sec" }
  return $t
}

$sections = @()
$i = 0
while ($i -lt $lines.Count) {
  if (
    $i + 2 -lt $lines.Count -and
    $lines[$i] -match "^={10,}$" -and
    $lines[$i + 2] -match "^={10,}$"
  ) {
    $title = $lines[$i + 1].Trim()
    $j = $i + 3
    $body = New-Object System.Collections.Generic.List[string]
    while ($j -lt $lines.Count) {
      if (
        $j + 2 -lt $lines.Count -and
        $lines[$j] -match "^={10,}$" -and
        $lines[$j + 2] -match "^={10,}$"
      ) { break }
      $body.Add($lines[$j])
      $j++
    }
    $sections += [pscustomobject]@{
      Title = $title
      Id    = (New-Slug $title)
      Body  = ($body -join "`n")
    }
    $i = $j
    continue
  }
  $i++
}

if ($sections.Count -eq 0) {
  $sections += [pscustomobject]@{
    Title = "Documento"
    Id    = "documento"
    Body  = ($lines -join "`n")
  }
}

$tocItems = ($sections | ForEach-Object {
  "<li><a href='#$($_.Id)'>$([System.Net.WebUtility]::HtmlEncode($_.Title))</a></li>"
}) -join "`n"

$sectionHtml = ($sections | ForEach-Object {
  $bodyEnc = [System.Net.WebUtility]::HtmlEncode($_.Body)
  "<section id='$($_.Id)' class='doc-section'><h2>$([System.Net.WebUtility]::HtmlEncode($_.Title))</h2><pre>$bodyEnc</pre></section>"
}) -join "`n"

$html = @"
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Diseño tecnico - Dashboard</title>
  <style>
    :root { --bg:#f4f6f8; --panel:#ffffff; --text:#1f2937; --muted:#6b7280; --line:#e5e7eb; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Segoe UI, Tahoma, sans-serif; color:var(--text); background:var(--bg); }
    .layout { display:grid; grid-template-columns: 280px 1fr; min-height:100vh; }
    .sidebar { border-right:1px solid var(--line); background:var(--panel); padding:16px; position:sticky; top:0; height:100vh; overflow:auto; }
    .sidebar h1 { font-size:16px; margin:0 0 8px; }
    .sidebar p { color:var(--muted); font-size:12px; margin:0 0 12px; }
    .sidebar ul { list-style:none; padding:0; margin:0; }
    .sidebar li { margin:6px 0; }
    .sidebar a { color:#0b4f4a; text-decoration:none; font-size:13px; }
    .sidebar a:hover { text-decoration:underline; }
    .content { padding:20px; }
    .topbar { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:14px; }
    .topbar code { background:#eef2f7; padding:2px 6px; border-radius:6px; }
    .doc-section { background:var(--panel); border:1px solid var(--line); border-radius:10px; margin-bottom:14px; }
    .doc-section h2 { margin:0; padding:12px 14px; border-bottom:1px solid var(--line); font-size:15px; }
    .doc-section pre { margin:0; padding:14px; white-space:pre-wrap; line-height:1.45; font-family:Consolas, monospace; font-size:12px; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { position:static; height:auto; border-right:none; border-bottom:1px solid var(--line); }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <h1>Diseño Dashboard</h1>
      <p>Indice navegable</p>
      <ul>
$tocItems
      </ul>
    </aside>
    <main class="content">
      <div class="topbar">
        Archivo HTML: <code>docs\Diseño.html</code><br />
        Fuente: <code>docs\Diseño.txt</code>
      </div>
$sectionHtml
    </main>
  </div>
</body>
</html>
"@

Set-Content -Path $dst -Value $html -Encoding UTF8
Write-Output "Generado: $dst"
