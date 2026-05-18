# Desarrollo local cuando Node falla con "unable to verify the first certificate" (antivirus/proxy).
# Uso: npm run dev:tls
$env:SUPABASE_DEV_INSECURE_TLS = '1'
Write-Host "SUPABASE_DEV_INSECURE_TLS=1 (solo desarrollo; no usar en produccion)" -ForegroundColor Yellow
npm run dev
