# Libera puertos típicos de Next (Windows). Usa netstat (fiable) + Stop-Process.
$ErrorActionPreference = "SilentlyContinue"
$ports = @(3000, 3001, 3002, 3003, 3004)

foreach ($port in $ports) {
  foreach ($line in (netstat -ano)) {
    if ($line -notmatch "LISTENING") { continue }
    if ($line -notmatch ":$port\s") { continue }
    $parts = ($line -split "\s+") | Where-Object { $_ -ne "" }
    if ($parts.Count -lt 5) { continue }
    $processId = [int]$parts[-1]
    if ($processId -le 0) { continue }
    Write-Host "Puerto $port -> deteniendo PID $processId"
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Milliseconds 500
exit 0
