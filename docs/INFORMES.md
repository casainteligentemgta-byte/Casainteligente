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

Cada informe exporta CSV.

## APIs

- `GET /api/informes/compras?periodo=dia\|semana\|mes`
- `GET /api/informes/cadena-procura?proyecto_id=`
- `GET /api/informes/stock?proyecto_id=`
- `GET /api/informes/rentabilidad?proyecto_id=`

## Próximos packs (no implementados)

Proveedores, recepción FRM vs factura, despacho/fill-rate, nómina vs presupuesto MO, CCO unificado en el mismo hub.
