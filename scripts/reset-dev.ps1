$ErrorActionPreference = "SilentlyContinue"

Write-Host "Reseteando entorno de desarrollo..."

# Cerrar procesos que ocupan puertos comunes de Next.js
$ports = @(3000, 3001, 3002, 3003)
foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen
  foreach ($conn in $conns) {
    if ($conn.OwningProcess -gt 0) {
      Stop-Process -Id $conn.OwningProcess -Force
    }
  }
}

Start-Sleep -Milliseconds 400

# Limpiar build cache de Next
if (Test-Path ".next") {
  Remove-Item ".next" -Recurse -Force
}

Write-Host "Iniciando Next.js limpio..."
npm run dev
