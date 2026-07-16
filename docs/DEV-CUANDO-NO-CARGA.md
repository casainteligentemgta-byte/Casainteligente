# Si “no pasa nada” con `npm run dev`

## 1. Usa esta URL (no solo `localhost`)

Abre en el navegador:

- **http://127.0.0.1:3000**
- Prueba de API: **http://127.0.0.1:3000/api/health** → debe verse `{"ok":true,...}`

En Windows, `localhost` a veces va por **IPv6** (`::1`) y el servidor solo escucha en IPv4.

## 2. Un solo puerto fijo

El script `dev` usa **siempre el puerto 3000** en `127.0.0.1`.

Si dice que el puerto está en uso:

```powershell
npm run dev:reset
```

Cierra procesos en 3000–3004, borra `.next` y arranca de nuevo.

## 3. Espera a ver “Ready”

En la terminal debe aparecer algo como:

```txt
✓ Ready in …
```

La **primera** vez puede tardar 1–3 minutos. Si se queda minutos en “Starting” sin “Ready”, mira el punto 4.

## 4. Carpeta `Pictures` y OneDrive / antivirus

El proyecto está bajo **Pictures**. OneDrive o el antivirus a veces bloquean `.next` y aparece **EPERM** en `trace` o compilación muy lenta.

- Excluye la carpeta del proyecto o al menos `.next` del análisis en tiempo real, **o**
- Mueve el repo a `C:\dev\CASA-INTELIGENTE` (fuera de Pictures).

## 5. Si necesitas otro puerto

```bash
npm run dev:any -- -p 3005
```

Luego abre **http://127.0.0.1:3005**.
