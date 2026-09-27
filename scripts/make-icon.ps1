Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDir = Join-Path $projectRoot 'assets'
New-Item -ItemType Directory -Path $assetDir -Force | Out-Null
$outputPath = Join-Path $assetDir 'icon.ico'
$previewPath = Join-Path $assetDir 'icon.png'
$sizes = @(16, 32, 48, 64, 128, 256)
$images = @()

foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(5, 10, 24))
  $scale = $size / 256.0

  $border = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(66, 217, 255), [single](9 * $scale))
  $graphics.DrawRectangle($border, [single](20 * $scale), [single](20 * $scale), [single](216 * $scale), [single](216 * $scale))
  $border.Dispose()

  $blocks = @(
    @(100, 44,  '#ff6be1'),
    @(44, 100,  '#4dd8ff'),
    @(100, 100, '#9b7cff'),
    @(156, 100, '#4dd8ff'),
    @(100, 156, '#9b7cff')
  )
  foreach ($block in $blocks) {
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($block[2]))
    $graphics.FillRectangle($brush, [single]($block[0] * $scale), [single]($block[1] * $scale), [single](48 * $scale), [single](48 * $scale))
    $brush.Dispose()
  }
  $graphics.Dispose()

  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $images += ,($stream.ToArray())
  $stream.Dispose()
  $bitmap.Dispose()
}

[System.IO.File]::WriteAllBytes($previewPath, [byte[]]$images[$images.Count - 1])

$file = [System.IO.File]::Create($outputPath)
$writer = New-Object System.IO.BinaryWriter($file)
try {
  $writer.Write([uint16]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  for ($index = 0; $index -lt $sizes.Count; $index++) {
    $writer.Write([byte]($sizes[$index] % 256))
    $writer.Write([byte]($sizes[$index] % 256))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$images[$index].Length)
    $writer.Write([uint32]$offset)
    $offset += $images[$index].Length
  }
  foreach ($imageBytes in $images) { $writer.Write([byte[]]$imageBytes) }
} finally {
  $writer.Dispose()
  $file.Dispose()
}

Write-Output $outputPath
