# Error: `TypeError: fetch failed` con Supabase

Ese mensaje significa que **Node (Next.js) no puede hacer la petición HTTPS** al host de Supabase. No suele ser un problema de tablas ni de RLS.

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

Si tras esto sigue fallando, anota si **PowerShell** (`Invoke-WebRequest`) funciona o no y lo revisamos con ese dato.
