# Tema claro y oscuro

La aplicación nació solo en oscuro. Desde octubre de 2026 cada persona puede verla en
**claro u oscuro**: por defecto sigue lo que tenga su teléfono, y con el botón de tema puede
fijar uno (se guarda en su navegador).

El tema claro se activa **módulo por módulo**, a medida que cada uno se revisa. Los módulos
que aún no están en la lista se siguen viendo en oscuro aunque el teléfono esté en claro.

| Módulo | Tema claro |
|--------|------------|
| Clientes (`/clientes`) | Sí |
| Todo lo demás | Pendiente |

## Cómo funciona

1. `lib/tema/tema.ts` — la preferencia (automático / claro / oscuro), qué rutas tienen tema
   (`RUTAS_CON_TEMA`) y el pequeño script que fija el tema antes de pintar la página.
2. `<html data-theme="light|dark">` — lo pone ese script y lo mantiene `components/tema/TemaSync`.
3. `components/AppChrome.tsx` envuelve en `.ci-tema` las pantallas de `RUTAS_CON_TEMA`.
4. Colores:
   - `app/globals.css` (`:root`) tiene los valores en oscuro.
   - `app/tema-claro.css` tiene los de claro, que solo aplican dentro de
     `html[data-theme="light"] .ci-tema`. Además traduce las clases pensadas para fondo
     negro (`text-white`, `text-zinc-300`, `border-white/10`…) a su equivalente claro.
5. `components/tema/BotonTema.tsx` — el botón (Auto → Claro → Oscuro).

## Reglas al escribir pantallas

- Texto y fondos: variables (`var(--label-primary)`, `var(--bg-primary)`, `var(--superficie)`),
  no `white`, `#000` ni `rgba(28,28,30,…)`.
- Blancos translúcidos: `tinta(0.1)` para rellenos y bordes, `tintaTexto(0.45)` para texto
  (`lib/tema/tinta.ts`). En oscuro dan lo mismo que `rgba(255,255,255,…)`.
- Colores de acento como texto o icono: `var(--tono-azul|verde|naranja|rojo|celeste)`.
  Como fondo sólido de un botón pueden seguir fijos (`#007AFF`).
- Texto blanco sobre un botón de color sólido con clases Tailwind: añadir `sobre-color`
  para que siga blanco en claro.

## Pasar un módulo a claro

1. `python3 scripts/tema-visor/codemod-colores.py archivo.tsx …` sobre sus archivos con
   colores escritos a mano. Imprime las líneas que quedan por revisar.
2. Añadir sus pantallas y datos de ejemplo al visor (`scripts/tema-visor/`), fotografiar en
   oscuro y claro, y corregir lo que no se lea. Las clases que falten en la traducción se
   agregan en `app/tema-claro.css`.
3. Comprobar que en oscuro no cambió nada que no se quisiera.
4. Añadir la ruta a `RUTAS_CON_TEMA` y a la tabla de arriba.

Cuando todos los módulos estén en la lista, `.ci-tema` puede pasar a envolver toda la
aplicación y la barra inferior (`IOSNavBar`) se pasa a tema también; hoy sigue oscura.
