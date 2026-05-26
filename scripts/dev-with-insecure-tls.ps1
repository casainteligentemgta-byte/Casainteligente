# Desarrollo local cuando Node falla con "unable to verify the first certificate" (antivirus/proxy).
# Uso: npm run dev:tls
$env:SUPABASE_DEV_INSECURE_TLS = '1'
$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'
Write-Host "SUPABASE_DEV_INSECURE_TLS=1 (solo desarrollo; no usar en produccion)" -ForegroundColor Yellow
Write-Host "Abra en el navegador: http://127.0.0.1:3000" -ForegroundColor Cyan
Write-Host "Diagnostico: http://127.0.0.1:3000/api/health/local" -ForegroundColor Cyan
npm run dev
