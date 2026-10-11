# Visor de pantallas (tema claro / oscuro)

Herramienta de desarrollo. No forma parte de la aplicación ni se publica.

Sirve para **ver** una pantalla en claro y en oscuro sin entrar al sitio: arma la pantalla
real con datos inventados (ningún cliente, precio ni proveedor de verdad) y le toma fotos
con un navegador sin ventana.

```bash
node scripts/tema-visor/build.mjs
node scripts/tema-visor/shot.mjs /ruta/de/capturas            # todas, oscuro y claro
node scripts/tema-visor/shot.mjs /ruta/de/capturas ficha light
```

- `entry.tsx`: lista de pantallas que se pueden fotografiar. Para sumar un módulo, añadir su
  página ahí y sus datos de ejemplo en `stubs/supabase-client.ts`.
- `stubs/`: reemplazos de Next, Supabase y otras librerías para que la pantalla funcione sola.
- `tw.mjs`: compila los estilos. Usa Tailwind 4 en modo compatible (la app usa Tailwind 3), así
  que los colores son fieles pero algún redondeo o sombra puede verse distinto que en el sitio.
- `codemod-colores.py`: pasa los colores escritos a mano de un archivo a colores de tema
  (ver `docs/TEMA-CLARO-OSCURO.md`).

Depende de herramientas instaladas en el entorno de trabajo de Claude (`/opt/npm-tools`:
esbuild, React, Tailwind, Playwright). En otra máquina hay que ajustar esas rutas.
