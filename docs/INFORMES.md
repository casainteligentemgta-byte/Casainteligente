# Centro de informes

Ruta: `/informes` (acceso con módulo Contabilidad o Almacén).

También desde Contabilidad → **Reportes**.

## Pack 1

| Informe | Ruta | Datos |
|---------|------|--------|
| Compras del período | `/informes/compras` | Misma lógica que Telegram `/comprasdia`… |
| Cadena procura → compra | `/informes/cadena-procura` | `ci_procuras` (pedida vs compra vs factura) |
| Stock valorizado | `/informes/stock` | Stock × `average_weighted_cost` |
| Rentabilidad de obra | `/informes/rentabilidad` | Ventas del cliente de la obra vs compras |
| Conciliación factura · recepción · stock | `/informes/conciliacion` | `purchase_invoices`, `quality_inspections`, `inv_movimientos` (con `documento_id`) e `inventario_stock` |

Cada informe exporta CSV.

## APIs

- `GET /api/informes/compras?periodo=dia\|semana\|mes`
- `GET /api/informes/cadena-procura?proyecto_id=`
- `GET /api/informes/stock?proyecto_id=`
- `GET /api/informes/rentabilidad?proyecto_id=`
- `GET /api/informes/conciliacion`

## Conciliación factura · recepción · stock

Una fila por (factura, ubicación, material). Solo lee; no corrige nada.

- **Estado:** recibido, en cuarentena, en tránsito o factura borrada.
- **Alertas:** factura borrada con movimientos en el ledger; tránsito sin cuarentena pendiente; ledger distinto de lo aprobado.
- **Ledger vs stock:** compara la suma de `inv_movimientos` por ubicación y material con `inventario_stock` y lista los descuadres.

Código: `lib/informes/cargarInformeConciliacionCompras.ts` (función pura `conciliarCompras`, con tests).

## Próximos packs (no implementados)

Proveedores, recepción FRM vs factura, despacho/fill-rate, nómina vs presupuesto MO, CCO unificado en el mismo hub.
