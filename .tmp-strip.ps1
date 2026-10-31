Get-ChildItem -LiteralPath "apps\web\app" -Recurse -File -Include *.tsx, *.ts | ForEach-Object {
  $c = [System.IO.File]::ReadAllText($_.FullName)
  $u = $c -replace '(?m)^export const instant = false;\r?\n\r?\n?', ''
  if ($u -ne $c) { [System.IO.File]::WriteAllText($_.FullName, $u) }
}
Write-Output "done"
