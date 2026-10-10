# Rendición de cuentas (administración delegada)

Pantalla: **Contabilidad → CCO → 📑 Rendición** (`/contabilidad/cco/rendicion`).

Para una obra muestra, y descarga en PDF, lo que el cliente aportó, lo que se gastó y los
honorarios de administración, en tres cortes:

| Corte | Qué abarca |
| --- | --- |
| Semana | De lunes a domingo |
| Mes | Mes calendario |
| Toda la obra | Desde el primer movimiento, con resumen mes a mes |

## Cuentas

```
HONORARIOS  = suma de los honorarios de cada gasto del período
TOTAL       = GASTOS + HONORARIOS
SALDO FINAL = SALDO ANTERIOR + APORTES − TOTAL
```

- El saldo final de un período es el saldo anterior del siguiente.
- «Toda la obra» da los mismos totales que el tablero del CCO: ambos usan la misma regla
  para decidir qué fila es un gasto (`esFilaAuditoriaKpiCco`) y las mismas fórmulas de
  `kpisOficiales.ts`.
- Honorarios de un gasto: el monto guardado en la fila; si no hay, gasto × % de la fila o,
  en su defecto, el % pactado de la obra (CCO → Ajustes).
- Los movimientos sin fecha solo cuentan en «toda la obra».

## Dos versiones del PDF

- **Para el cliente:** resumen, gastos por tipo, aportes y detalle de gastos.
- **Interno:** lo mismo, más *Control interno* — gastos sin soporte adjunto, no pagados,
  con honorarios calculados (no guardados) o con un % distinto al pactado, proveedores con
  más gasto y gastos por capítulo. Lleva la marca «USO INTERNO».

Con más de 800 gastos en el período, el PDF omite el detalle uno por uno (pasa en «toda la
obra»); ese detalle sale en las rendiciones semanales y mensuales.

## Código

- `lib/contabilidad/cco/rendicionHonorarios.ts` — cuentas y períodos (sin base de datos).
- `lib/contabilidad/cco/cargarRendicionHonorarios.ts` — lectura de gastos y aportes.
- `lib/contabilidad/cco/RendicionHonorariosPdf.tsx` — documento PDF.
- `app/api/contabilidad/cco/rendicion` (JSON) y `…/rendicion/pdf` — requieren sesión con acceso al CCO.
