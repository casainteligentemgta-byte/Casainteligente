$ErrorActionPreference = "SilentlyContinue"

Write-Host "Liberando puertos de desarrollo..."
& "$PSScriptRoot\kill-dev-ports.ps1"

Start-Sleep -Milliseconds 400

Write-Host "Limpiando .next..."
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  node scripts/clean-next.mjs
} finally {
  Pop-Location
}

Write-Host "Iniciando Next.js en http://127.0.0.1:3000 ..."
Set-Location (Split-Path -Parent $PSScriptRoot)
npx next dev -H 127.0.0.1 -p 3000
