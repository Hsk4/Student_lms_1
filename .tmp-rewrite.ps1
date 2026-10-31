param([string]$Root, [string]$Pattern, [string]$Replacement, [switch]$WholeWord)
$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Include *.ts, *.tsx
$n = 0
foreach ($f in $files) {
  $c = [System.IO.File]::ReadAllText($f.FullName)
  $opts = [System.Text.RegularExpressions.RegexOptions]::None
  $u = [System.Text.RegularExpressions.Regex]::Replace($c, $Pattern, $Replacement)
  if ($u -ne $c) {
    [System.IO.File]::WriteAllText($f.FullName, $u)
    $n++
  }
}
Write-Output "updated $n of $($files.Count) files"
