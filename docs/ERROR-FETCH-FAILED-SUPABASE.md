# Error: `TypeError: fetch failed` con Supabase

Ese mensaje significa que **Node (Next.js) no puede hacer la petición HTTPS** al host de Supabase. No suele ser un problema de tablas ni de RLS.

### 0. Diagnóstico rápido (Next en local)

Con `npm run dev` en marcha, abre en el navegador:

`http://localhost:3000/api/health/supabase`

- Si devuelve `"ok": true` → el **servidor** Node llega a Supabase; si la app en cliente falla, prueba otro navegador sin extensiones o confirma que entras por `localhost` (no `127.0.0.1` mezclado con cookies, aunque raro).
- Si devuelve `"ok": false` con `cause` (p. ej. certificado, `ENOTFOUND`) → mismo problema de **red/TLS** en la máquina; sigue los pasos de abajo.

## Comprueba en este orden

### 1. URL correcta en `.env.local`

Debe ser exactamente la **Project URL** de Supabase → **Project Settings** → **API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
```

- Con **`https://`**
- **Sin** barra al final (si la pones, la app la quita sola)
- **Sin comillas**
- Misma URL que ves en el panel (mismo proyecto donde ejecutaste el SQL)

### 2. Internet y firewall

- Prueba abrir en el navegador: `https://TU-PROYECTO.supabase.co` (debe responder algo de Supabase).
- Si usas **VPN**, prueba desactivarla o cambiar de red.
- **Antivirus / firewall** a veces bloquean a Node.js: permite Node o prueba otra red (datos móvil).

### 2b. `unable to verify the first certificate` (Windows, muy frecuente)

Si `/api/health/supabase` devuelve ese texto en `error`, **Node no confía en la cadena TLS** que ves (no suele ser la URL de Supabase en sí). Causas típicas:

1. **Antivirus con “inspección HTTPS” / escaneo SSL** (Kaspersky, ESET, Bitdefender, etc.): desactiva esa función *solo para desarrollo* o añade **excepción para `node.exe`** y para el dominio `*.supabase.co`.
2. **Proxy corporativo** que reemplaza certificados: tu TI debe darte un archivo **`.pem` con el certificado raíz** de la empresa. Luego, **antes** de `npm run dev` en la misma ventana de PowerShell:

   ```powershell
   $env:NODE_EXTRA_CA_CERTS = "C:\ruta\al\corp-root.pem"
   npm run dev
   ```

   (Ruta real al PEM que te indiquen; reinicia el servidor si cambias el archivo.)

3. **Opción integrada en este proyecto (solo desarrollo local)** — en `.env.local`:

   ```env
   SUPABASE_DEV_INSECURE_TLS=1
   ```

   Reinicia con `npm run dev`, o arranca directo con:

   ```powershell
   npm run dev:tls
   ```

   Afecta solo al `fetch` de Supabase en el servidor Next (no subas esta variable a Vercel).

4. **Último recurso solo en tu PC** (inseguro: no uses en producción ni lo subas a repositorio):

   ```powershell
   $env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
   npm run dev
   ```

   Vuelve a `1` o quita la variable cuando termines de depurar.

5. **Actualizar Node.js** a la última LTS a veces mejora la cadena de CAs embebida.

### 3. Reiniciar el servidor de desarrollo

Tras editar `.env.local`:

```bash
# Ctrl+C para parar
npm run dev
```

Las variables `NEXT_PUBLIC_*` solo se leen al **arrancar** Next.

### 4. Probar desde PowerShell (misma máquina)

Sustituye la URL y pega tu **anon key**:

```powershell
$url = "https://TU-PROYECTO.supabase.co/rest/v1/"
$key = "TU_ANON_KEY"
Invoke-WebRequest -Uri $url -Headers @{ apikey = $key; Authorization = "Bearer $key" } -UseBasicParsing
```

- Si aquí también falla → problema de **red/DNS/firewall** en el PC, no del código.
- Si aquí funciona pero la app no → revisa que `.env.local` esté en la **carpeta raíz del proyecto** (donde está `package.json`).

### 5. Proyecto abierto en la carpeta correcta

Si tienes **varias copias** del repo (por ejemplo en Escritorio y en Imágenes), asegúrate de que `.env.local` está en la carpeta desde la que ejecutas `npm run dev`.

## Resumen

| Causa frecuente        | Qué hacer                          |
|------------------------|------------------------------------|
| URL mal copiada        | Copiar de nuevo desde Supabase API |
| Sin reiniciar `npm run dev` | Parar y volver a arrancar      |
| Firewall / VPN         | Probar otra red o excepción        |
| `.env.local` en otra carpeta | Un solo proyecto, una raíz   |
| **TLS / certificado** (`unable to verify…`) | Ver **§2b** (antivirus, `NODE_EXTRA_CA_CERTS`, o último recurso dev) |

Si tras esto sigue fallando, anota si **PowerShell** (`Invoke-WebRequest`) funciona o no y lo revisamos con ese dato.
