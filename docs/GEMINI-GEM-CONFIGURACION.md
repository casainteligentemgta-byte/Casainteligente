# Cómo crear la Gem en Google AI Studio

Guía paso a paso para configurar **Arquitecto Casa Inteligente** en Gemini.

---

## 1. Abrir Google AI Studio

1. Ve a [https://aistudio.google.com](https://aistudio.google.com)
2. Inicia sesión con tu cuenta Google
3. Menú lateral → **Gems** → **Create new Gem**

---

## 2. Datos básicos de la Gem

| Campo | Valor sugerido |
|-------|----------------|
| **Name** | Arquitecto Casa Inteligente |
| **Description** | Asistente técnico del ERP Casa Inteligente: compras, almacén, Telegram, Supabase, Lulo y RRHH para obras en Venezuela. |
| **Instructions** | Copia **todo** `docs/GEMINI-GEM-INSTRUCTIONS-COMPLETO.txt` (recomendado) o la versión compacta `GEMINI-GEM-INSTRUCCIONES.txt` |

> Si el campo Instructions tiene límite de caracteres, usa solo `GEMINI-GEM-INSTRUCCIONES.txt` y sube `GEMINI-MEGA-PROMPT.md` completo a Conocimiento.

---

## 3. Conocimiento (Knowledge)

Sube archivos del repo para que la Gem no alucine el esquema. Prioridad:

### Imprescindibles (núcleo operativo)
```
docs/GEMINI-MEGA-PROMPT.md
.cursor/rules/casa-inteligente-app.mdc
lib/telegram/ingresoManualTelegram.ts
lib/telegram/ingresoFacturaTelegram.ts
lib/telegram/botCommands.ts
lib/contabilidad/registrarCompraDesdeIngresoManualFactura.ts
lib/contabilidad/confirmarCompraDesdeCanal.ts
lib/contabilidad/ingresoAlmacenDesdePendienteCanal.ts
app/contabilidad/compras/page.tsx
app/almacen/page.tsx
```

### Migraciones (según el módulo que uses)
```
supabase/manual_migraciones_132_a_138.sql
supabase/migrations/180_inventario_compras_custodia_partidas.sql
supabase/migrations/185_ci_facturas_canal_idempotencia_telegram.sql
supabase/migrations/199_ci_recepciones_provisionales_campo.sql
supabase/migrations/207_get_stock_real_obra_almacen_central.sql
supabase/migrations/212_trazabilidad_stock_resultante_rpc.sql
supabase/migrations/213_recepciones_campo_contabilidad_compra.sql
supabase/migrations/214_recepcion_campo_stock_referencia.sql
supabase/migrations/233_ci_telegram_ttl_pendiente_atomico.sql
supabase/migrations/241_ci_catalogo_por_entidad.sql
supabase/migrations/242_ci_material_aliases_inteligente.sql
supabase/migrations/243_ci_procura_flujo_admin_pm.sql
supabase/migrations/244_ci_procura_en_compra_solo_con_factura.sql
supabase/migrations/245_ci_proyectos_naturaleza_gasto_entidad.sql
supabase/migrations/249_ci_rrhh_views_conciliacion_compra.sql
```

### Por módulo (opcional)
| Módulo | Archivos extra |
|--------|----------------|
| Despacho | `lib/almacen/registrarDespachoWeb.ts`, `components/almacen/DistribucionDespachoPartidas.tsx` |
| Procuras | `lib/telegram/procuraAdminTelegram.ts`, `224_ci_procuras_lote.sql`, `240_ci_procura_abastecimiento_almacen.sql` |
| Talento | `lib/talento/exam.ts`, `preguntasActitudObraObrero.ts` |
| Lulo | `lib/proyectos/importarLuloPresupuesto.ts`, `components/proyectos/ControlObraClient.tsx` |
| Gemini OCR | `lib/almacen/extractPurchaseInvoiceGemini.ts`, `lib/gemini/client.ts` |

---

## 4. Modelo recomendado

| Uso | Modelo |
|-----|--------|
| Diagnóstico / arquitectura | Gemini 2.5 Pro |
| Respuestas rápidas / campo | Gemini 2.5 Flash |
| OCR facturas (en app, no Gem) | `GEMINI_PROCUREMENT_MODEL=gemini-2.5-flash` |

---

## 5. Prompts de inicio sugeridos

Pega estos al abrir un chat con la Gem:

**Diagnóstico compras Telegram**
```
Tengo un error al confirmar una factura de Telegram en /contabilidad/compras/telegram/[id].
Error: [pega aquí].
¿Qué tablas y migraciones reviso? ¿Hay FRM sin conciliar?
```

**Flujo ingreso unificado (4×9 pasos)**
```
Explícame /ingreso → los 4 flujos con esquema de 9 pasos en Telegram:
RPC, tablas, contabilidad provisional y cómo evitar duplicar stock.
```

**Auditoría cuadros duplicados**
```
Ejecuta Fase 0 de limpieza: inventario de app/**/page.tsx,
Top 10 duplicidades almacén/contabilidad, propuesta Fase 1 solo redirects.
Ver sección LIMPIEZA en GEMINI-MEGA-PROMPT.md.
```

**Nueva feature almacén**
```
Necesito [descripción]. Propón diseño mínimo respetando los 6 pilares de blindaje,
archivos a tocar, y plan de prueba en iPad.
```

**Migración pendiente**
```
Supabase devuelve: column "X" does not exist en tabla Y.
¿Qué archivo en supabase/migrations/ debo ejecutar y en qué orden?
```

---

## 6. Mantenimiento

Actualiza la Gem cuando:
- Se añadan migraciones nuevas en `supabase/migrations/`
- Cambien flujos Telegram (`botCommands.ts`, `ingresoManualTelegram.ts`)
- Se modifique el cuadro compras o inventario

Archivos a regenerar:
1. `docs/GEMINI-MEGA-PROMPT.md` — referencia completa
2. `docs/GEMINI-GEM-INSTRUCCIONES.txt` — pegar en Instructions
3. Re-subir conocimiento en AI Studio

---

## 7. Diferencia: Gem vs API en la app

| | Gem (AI Studio) | API (`GEMINI_API_KEY`) |
|--|-----------------|------------------------|
| Uso | Asistente humano: diseño, diagnóstico, SQL | OCR facturas, extracción agua, análisis automático |
| Código | No se integra al repo | `lib/gemini/client.ts`, `extractPurchaseInvoiceGemini.ts` |
| Contexto | Instructions + Knowledge subidos manualmente | `systemInstruction` + prompt por llamada |

---

*Configuración Gem v5 — Casa Inteligente — 2026-06-07 · migr. hasta 249*
