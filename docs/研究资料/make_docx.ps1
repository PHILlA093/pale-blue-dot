# 生成 Word(.docx)词表文档:纯 OOXML 组装,不依赖 Office/WPS
# 用法: & .\make_docx.ps1 -InputJson <数据.json> -OutDocx <输出.docx>
# 输入 JSON 结构:{ meta:{title,subtitle,notes[],footer}, columns:[列名...], sections:[{title, lines[], rows:[{...}]}] }
param(
  [Parameter(Mandatory = $true)][string]$InputJson,
  [Parameter(Mandatory = $true)][string]$OutDocx
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

function Esc([string]$s) {
  if ($null -eq $s) { return '' }
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;')
}

$data = Get-Content $InputJson -Raw -Encoding UTF8 | ConvertFrom-Json
$meta = $data.meta
$sections = $data.sections
$COLS = @($data.columns)
if (-not $COLS -or $COLS.Count -eq 0) { $COLS = @('序号', '单词', '音标', '词性 · 释义', '高考真题频次') }

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
[void]$sb.Append('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>')

function Add-Para([string]$text, [int]$size, [bool]$bold, [string]$color, [string]$align) {
  $b = ''
  if ($bold) { $b = '<w:b/>' }
  $c = ''
  if ($color) { $c = '<w:color w:val="' + $color + '"/>' }
  $j = ''
  if ($align) { $j = '<w:jc w:val="' + $align + '"/>' }
  $rpr = '<w:rPr>' + $b + '<w:sz w:val="' + $size + '"/><w:szCs w:val="' + $size + '"/>' + $c + '</w:rPr>'
  $ppr = '<w:pPr>' + $j + '<w:spacing w:before="60" w:after="60"/></w:pPr>'
  [void]$sb.Append('<w:p>' + $ppr + '<w:r>' + $rpr + '<w:t xml:space="preserve">' + (Esc $text) + '</w:t></w:r></w:p>')
}

function Get-CellValue($row, [string]$col) {
  if ($col -eq '序号') { return [string]$row.no }
  if ($col -eq '单词') { return [string]$row.word }
  if ($col -eq '音标') { return [string]$row.ph }
  if ($col -eq '词性 · 释义') { return (([string]$row.pos + ' ' + [string]$row.def).Trim()) }
  if ($col -eq '高考真题频次') {
    $t = '' + $row.freq + ' 次'
    if ($row.years -gt 0) { $t = $t + ' / ' + $row.years + ' 年' }
    return $t
  }
  if ($col -eq '教材出处') {
    if ($row.tb) { return [string]$row.tb }
    return '—'
  }
  return ''
}

function Get-ColWidth([string]$col) {
  if ($col -eq '序号') { return '560' }
  if ($col -eq '单词') { return '1750' }
  if ($col -eq '音标') { return '1700' }
  if ($col -eq '词性 · 释义') { return '4200' }
  if ($col -eq '高考真题频次') { return '1750' }
  if ($col -eq '教材出处') { return '2100' }
  return '1500'
}

function Add-TableHeader {
  $w = @($COLS | ForEach-Object { Get-ColWidth $_ })
  [void]$sb.Append('<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
    '<w:top w:val="single" w:sz="6" w:color="BFBFBF"/><w:left w:val="single" w:sz="6" w:color="BFBFBF"/>' +
    '<w:bottom w:val="single" w:sz="6" w:color="BFBFBF"/><w:right w:val="single" w:sz="6" w:color="BFBFBF"/>' +
    '<w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/>' +
    '</w:tblBorders></w:tblPr><w:tblGrid>' + (($w | ForEach-Object { '<w:gridCol w:w="' + $_ + '"/>' }) -join '') + '</w:tblGrid>')
  [void]$sb.Append('<w:tr><w:trPr><w:tblHeader/></w:trPr>')
  for ($i = 0; $i -lt $COLS.Count; $i++) {
    [void]$sb.Append('<w:tc><w:tcPr><w:tcW w:w="' + $w[$i] + '" w:type="dxa"/><w:shd w:val="clear" w:fill="F2F6FC"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="18"/></w:rPr>' +
      '<w:t>' + (Esc $COLS[$i]) + '</w:t></w:r></w:p></w:tc>')
  }
  [void]$sb.Append('</w:tr>')
}

function Add-TableRow($row) {
  $w = @($COLS | ForEach-Object { Get-ColWidth $_ })
  [void]$sb.Append('<w:tr>')
  for ($i = 0; $i -lt $COLS.Count; $i++) {
    $val = Get-CellValue $row $COLS[$i]
    $b = ''
    $f = ''
    if ($COLS[$i] -eq '单词') { $b = '<w:b/>'; $f = '<w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/>' }
    [void]$sb.Append('<w:tc><w:tcPr><w:tcW w:w="' + $w[$i] + '" w:type="dxa"/></w:tcPr>' +
      '<w:p><w:pPr><w:spacing w:before="10" w:after="10"/></w:pPr><w:r><w:rPr>' + $f + $b + '<w:sz w:val="18"/></w:rPr>' +
      '<w:t xml:space="preserve">' + (Esc $val) + '</w:t></w:r></w:p></w:tc>')
  }
  [void]$sb.Append('</w:tr>')
}

# 封面与口径说明
Add-Para $meta.title 32 $true '1F3864' 'center'
Add-Para $meta.subtitle 20 $false '595959' 'center'
Add-Para '' 18 $false '' ''
foreach ($ln in $meta.notes) { Add-Para $ln 18 $false '' '' }

foreach ($sec in $sections) {
  Add-Para '' 18 $false '' ''
  Add-Para $sec.title 24 $true '1F3864' ''
  if ($sec.lines) { foreach ($ln in $sec.lines) { Add-Para $ln 18 $false '' '' } }
  if ($sec.rows -and $sec.rows.Count -gt 0) {
    Add-TableHeader
    foreach ($r in $sec.rows) { Add-TableRow $r }
    [void]$sb.Append('</w:tbl>')
  }
}
Add-Para '' 18 $false '' ''
Add-Para $meta.footer 16 $false '808080' 'center'
[void]$sb.Append('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>')
[void]$sb.Append('</w:body></w:document>')

# ---- 打包 docx:显式写 zip 条目,条目名统一用正斜杠 ----
$contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
'<Default Extension="xml" ContentType="application/xml"/>' +
'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
$rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'

function Add-Entry([System.IO.Compression.ZipArchive]$z, [string]$name, [string]$text, [System.Text.Encoding]$encoding) {
  $entry = $z.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
  $s = $entry.Open()
  $bytes = $encoding.GetBytes($text)
  $s.Write($bytes, 0, $bytes.Length)
  $s.Dispose()
}

$enc = New-Object System.Text.UTF8Encoding($false)
if (Test-Path $OutDocx) { Remove-Item $OutDocx -Force }
$fs = [System.IO.File]::Open($OutDocx, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
Add-Entry $zip '[Content_Types].xml' $contentTypes $enc
Add-Entry $zip '_rels/.rels' $rels $enc
Add-Entry $zip 'word/document.xml' $sb.ToString() $enc
$zip.Dispose()
$fs.Dispose()
'DOCX OK -> ' + $OutDocx + '  (' + (Get-Item $OutDocx).Length + ' bytes)'
