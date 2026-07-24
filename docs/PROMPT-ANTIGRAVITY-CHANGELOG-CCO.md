# Prompt para Antigravity — changelog CCO (suegro → Casa Inteligente)

Copia **todo el bloque** de abajo y pégalo en Antigravity (en el proyecto CCO del suegro).
Cambia las fechas si hace falta. El resultado se pega después en Cursor / Casa Inteligente.

---

## BLOQUE PARA ANTIGRAVITY (copiar desde aquí)

```text
Eres Antigravity trabajando en el módulo CCO (Control de Costos de Obra / libro maestro V4).

TAREA:
Genera un INFORME DE CAMBIOS del módulo CCO desde el LUNES de esta semana hasta HOY (inclusive).
Si no hay commits con fecha clara, usa el historial de archivos tocados, diffs y conversaciones recientes del agente en este repo CCO.

OBJETIVO DEL INFORME:
Este documento lo usará OTRA aplicación (Casa Inteligente = Next.js + Supabase) para PORTAR
las mismas mejoras sin borrar lo que esa app ya tiene (Telegram, almacén, OCR de facturas, etc.).
Es un MERGE de comportamiento: CI debe hacer lo que hace este CCO + lo propio de CI.

NO reescribas toda la app. NO inventes features que no existan en el código.
Solo lista cambios REALES detectados en el período.

FORMATO OBLIGATORIO (Markdown):

# Changelog CCO → port a Casa Inteligente
- Período: YYYY-MM-DD → YYYY-MM-DD
- Repo/app origen: (nombre)
- Generado: (fecha/hora)

## Resumen ejecutivo
3–8 viñetas de qué cambió para el usuario final.

## Cambios (uno por bloque)

### CCO-YYYYMMDD-01 — título corto
- Tipo: ui | regla_negocio | dato_schema | import_export | bugfix | performance | otro
- Pantalla / menú CCO afectado: …
- Comportamiento ANTES: …
- Comportamiento AHORA: …
- Archivos tocados: path1, path2, …
- Datos / columnas nuevas (si aplica): nombre, tipo, ejemplo
- Fórmulas o reglas (si aplica): …
- Cómo probarlo en CCO: pasos 1-2-3
- Prioridad sugerida para port: alta | media | baja
- Dependencias: (otros cambios del listado, o ninguna)

(Repite ### CCO-…-02, 03, …)

## Lo que NO cambió
Lista breve de áreas CCO que seguían igual (egresos, ingresos, contratos, etc.).

## Notas para el port (merge)
- Qué debe replicarse igual en Casa Inteligente
- Qué es solo local de este programa (rutas de disco, SQLite UI, OneDrive paths…) y NO debe copiarse
- Riesgos si se porta mal

REGLAS:
1. Sé concreto y verificable. Prefiere “agregó columna FORMA_PAGO en egresos” a “mejoró la UI”.
2. Si un cambio es cosmético, márcalo prioridad baja.
3. Si toca montos, tasas, devaluación, honorarios o estados PAGADO/PENDIENTE, prioridad alta.
4. Incluye snippets cortos SOLO si aclaran una fórmula (máx. 15 líneas c/u).
5. Al final, una sección "## Texto listo para pegar en Cursor" con un párrafo de instrucción:
   “Porta a Casa Inteligente (/contabilidad/cco) los cambios listados arriba en merge:
   no reemplazar flujos CI (Telegram, almacén, empareje de facturas). Datos ya se refrescan por botón a Supabase.”
```

## FIN DEL BLOQUE

---

## Cómo usarlo (merge)

1. Suegro pega el bloque en Antigravity → obtiene el changelog.
2. Te pasa ese Markdown.
3. En Cursor / Casa Inteligente pegas:  
   `Porta en merge el changelog CCO adjunto. No rompas Telegram, almacén ni el agente de facturas. Datos ya vienen por el botón a Supabase.`
4. Se implementa solo lo del informe; CI = CCO del suegro + lo vuestro.

## Cadencia sugerida

- Viernes (o cuando haya varias mejoras): generar el informe de “lunes → hoy”.
- Un port semanal suele ser más sano que uno diario, salvo cambios de plata/KPIs urgentes.
