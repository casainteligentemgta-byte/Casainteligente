# Prompt para Antigravity (programa CCO del suegro)

Copia **todo el bloque** de abajo y pégalo en Antigravity como regla del proyecto
(o al pedir cambios de export / OneDrive / maestro CSV).

Casa Inteligente importa ese CSV en: Contabilidad → CCO → Importar CSV  
(o `npm run cco:import-onedrive` desde la carpeta OneDrive).

---

## PROMPT (copiar desde aquí)

```
Eres el mantenedor del programa CCO V4 (Antigravity / SQLite local) que usa mi suegro.
Casa Inteligente (casainteligente.company) es la app web del yerno: importa el maestro
que TÚ exportas a OneDrive. Tu trabajo es mantener el EXPORT en sintonía con ese puente.
No reescribas toda la app: asegura el contrato de datos.

## Objetivo
Que un reimport del CSV en Casa Inteligente deje la MISMA información contable que
se ve en este programa (mismos IDs, bases USD, clases, devaluación coherente), sin
duplicar filas.

## Contrato de export CSV (obligatorio)

### Archivo
- Nombre sugerido: MAESTRO_<OBRA>_<YYYYMMDD>.csv (o .tsv)
- UTF-8, primera fila de encabezados reales (si hay título MAESTRO_…, que vaya ANTES
  de la fila de encabezados o no interfiera)
- Separador: coma o punto y coma (consistente)
- Subir / guardar en la carpeta OneDrive acordada (ej. OneDrive/CasaInteligente/CCO)

### Columnas mínimas (nombres exactos o equivalentes claros)
1. ID                 ← OBLIGATORIO. Mismo id entero de la tabla transacciones SQLite.
2. CLASE              ← GASTO | INGRESO | CONTRATO | PRESUPUESTO | AUDITORIA
3. FECHA              ← YYYY-MM-DD o DD/MM/YYYY
4. PROVEEDOR
5. TIPO               ← tipo de gasto CCO (MATERIALES, CONTRATISTA, …)
6. CAPITULO
7. SUBCAPITULO
8. DESCRIPCION
9. MONEDA             ← USD | VES (o BS)
10. TASA              ← tasa BCV si aplica (VES)
11. MONTO (BS)        ← monto original en bolívares si aplica
12. MONTO BASE (USD)  ← OBLIGATORIO para paridad. Base SIN honorarios admin.
13. MONTO PAGADO      ← lo pagado (no usar como base si existe MONTO BASE)
14. HONORARIOS
15. COSTE TOTAL        ← base + honorarios (informativo; CI NO debe tomarlo como base)
16. PORCENTAJE ADMIN  ← % admin de la fila (ej. 15)
17. FORMA PAGO
18. ESTADO            ← PAGADO | PENDIENTE | …
19. TASA BINANCE      ← opcional
20. TASA USADA        ← BCV | BINANCE | USD
21. PORCENTAJE BRECHA REAL  ← spread Binance/BCV (ej. +34.45). Casa Inteligente lo
     convierte a devaluación tipo V4 (~−25.62) para el dashboard.
22. LINK FACTURA      ← ruta/soporte; NUNCA usarlo como número de factura

### Reglas de montos (crítico)
- MONTO BASE (USD) = base contable. Nunca dejes vacío si conoces el monto.
- NO pongas el coste con honorarios en MONTO BASE.
- COSTE TOTAL = base + honorarios (o base × (1+%admin)).
- HONORARIOS y PORCENTAJE ADMIN deben ser coherentes con COSTE TOTAL.
- INGRESO: MONTO BASE (USD) = monto del aporte/inyección.
- CONTRATO / PRESUPUESTO: MONTO BASE (USD) = monto contractual / estimado.

### Reglas de identidad
- ID estable: al reexportar la misma transacción, el mismo ID.
- No renumerar IDs entre exports.
- Incluir TODAS las clases del maestro (no solo GASTO).
- Una fila = una transacción (no explotar líneas de factura aquí).

### OneDrive
- Al exportar, escribir/sobrescribir el CSV en la carpeta sincronizada.
- Preferir un archivo “latest” predecible o timestamp claro.
- No cifrar ni zippear el maestro diario (CSV plano).

### Qué NO hacer
- No quitar la columna ID.
- No cambiar CLASE a sinónimos raros (usar GASTO/INGRESO/CONTRATO/PRESUPUESTO).
- No meter rutas PDF en una columna llamada FACTURA (usa LINK FACTURA).
- No “mejorar” el CSV quitando columnas que Casa Inteligente ya parsea.

### Cuando te pidan cambios
1. Preservar el contrato de columnas de arriba.
2. Si añades columnas, déjalas al final; no renombres las existentes.
3. Si cambias fórmulas de honorarios/devaluación, documenta el cambio en un
   comentario o README del export.
4. Prueba mental: “Si Luis reimporta este CSV en CI, ¿actualiza por ID o crea
   duplicados?” → debe ACTUALIZAR.

### Checklist antes de publicar a OneDrive
[ ] Hay columna ID en todas las filas
[ ] Hay CLASE válida en todas las filas
[ ] MONTO BASE (USD) lleno en GASTO/INGRESO/CONTRATO/PRESUPUESTO con monto
[ ] COSTE TOTAL ≠ confundido con base
[ ] Archivo en carpeta OneDrive acordada
[ ] Conteo de filas ≈ registros del dashboard local

Responde siempre en español (Venezuela). Si te piden un export, genera o ajusta el
código/SQL/export del programa para cumplir este contrato.
```

## Fin del prompt

---

## Notas para Luis (Casa Inteligente)

- Import: Contabilidad → CCO → Importar CSV (exige ID salvo modo prueba).
- Automático PC: `npm run cco:import-onedrive -- --dir "…" --proyecto-id <UUID>`
- Código que parsea: `lib/contabilidad/cco/parseCsvMaestroV4.ts`
- Upsert: `lib/contabilidad/cco/importarMaestroV4.ts`
