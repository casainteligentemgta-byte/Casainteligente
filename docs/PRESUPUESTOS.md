# Presupuestos (y ventas)

Un solo módulo. En la barra hay un botón, **Presupuestos**.

- **Lista:** `/presupuestos`. Totales, filtros por estado y «+ Nuevo presupuesto».
- **Armar o editar:** `/ventas` (nuevo) y `/ventas?id=…` (editar). La dirección se conserva por los enlaces guardados; en pantalla se llama «Nuevo presupuesto» / «Editar presupuesto» y tiene flecha para volver a la lista. Avisa si se sale con cambios sin guardar.
- **Vista previa e impresión:** `/ventas/preview?id=…`.

## Qué es una venta

No hay un registro de ventas aparte. Una **venta** es un presupuesto que el cliente ya aceptó: estados `aprobado`, `cobrado` (por pagar), `parcialmente_pagado` y `pagado`. Por eso «Ventas» es un filtro de la lista (`/presupuestos?ver=ventas`) y el número de ventas del tablero cuenta esos presupuestos. La lógica está en `lib/presupuesto/listaPresupuestos.ts`.

- **Aprobado / Vendido:** suma de lo aceptado.
- **Por pagar:** lo aceptado que falta cobrar. Un presupuesto solo enviado todavía no se debe.
- **Pagado:** lo cobrado.

## Permisos

El botón de la barra es el módulo `presupuestos`. La pantalla de armar (`/ventas`) conserva su permiso propio, `ventas` (hoy solo el rol administrador): quien tiene `presupuestos` sin `ventas` ve la lista pero no puede armar ni editar.

## Número, fechas y abonos

- **Número (`numero_correlativo`):** fijo al crear (`P-500`, `P-501`, …). No se edita en la app; la migración `354` lo protege en BD.
- **Creación / modificación:** `created_at` (fijo) y `updated_at` (se actualiza al guardar o al abonar).
- **Fecha del documento (`fecha`):** editable; sale en PDF/listado; independiente de creación.
- **Abonos:** botón Abono en la lista y en el editor. Restan del `subtotal` vía `budget_abonos` / RPC `ci_registrar_abono_presupuesto`. Al editar el monto se llama `ci_recalcular_cobro_presupuesto`.
- **Ganancia:** al guardar se persisten `total_cost`, `total_profit` y `margin_pct` (utilidad %). El «markup sobre catálogo» del editor solo afecta precios al agregar/recalcular renglones; no es el `margin_pct` guardado.

## Pendiente conocido

- La tabla `ventas` (vacía) y su formulario de «venta sencilla» ya no se usan; el formulario se quitó.
- Si en producción faltan las migraciones `020`, `312`, `318` o `354`, aplicarlas en el SQL Editor y `notify pgrst, 'reload schema'`. Sin `020` el número se estima por orden de creación (estable en la lista, no editable).
