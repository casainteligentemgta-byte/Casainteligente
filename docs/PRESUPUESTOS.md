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

## Pendiente conocido

- La tabla `ventas` (vacía) y su formulario de «venta sencilla» ya no se usan; el formulario se quitó.
- Las migraciones `020` (número correlativo), `312` (fecha del documento) y `318` (abonos y cuotas) no están aplicadas en producción: mientras tanto el número se calcula por orden de creación.
