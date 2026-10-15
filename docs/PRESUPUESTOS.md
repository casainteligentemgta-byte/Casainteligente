# Presupuestos (y ventas)

Un solo módulo. En la barra hay un botón, **Presupuestos**.

- **Lista:** `/presupuestos`. Totales, filtros por estado, botón de tema claro/oscuro y «+ Nuevo».
- **Armar o editar:** `/ventas` (nuevo) y `/ventas?id=…` (editar). La dirección se conserva por los enlaces guardados; en la cabecera dice «Nuevo» o el número (P-523) y tiene flecha para volver a la lista. Avisa si se sale con cambios sin guardar.
- **Vista previa e impresión:** `/ventas/preview?id=…`. Si hay cambios sin guardar abre `…&borrador=1` y muestra lo que está en pantalla, no lo guardado. Las notas se pueden guardar desde ahí. La vista previa siempre es clara (es el papel).

## Número y fechas

- **Número fijo (P-500, P-501…):** lo pone la base de datos al crear (`budgets_correlativo_seq`) y un disparador impide cambiarlo después. Un número borrado no se vuelve a usar.
- **Fecha de creación (`created_at`):** la pone la base al crear y no se puede cambiar.
- **Fecha de modificación (`updated_at`):** la base la actualiza en cada cambio. Ambas se ven en el armado: «Creado el … · Última modificación: …».
- **Fecha del documento (`fecha`):** la que sale impresa; se puede escoger.
- Migración `354_presupuestos_numero_fechas_abonos.sql`.

## Abonos

Botón **Abono** en cada presupuesto. Los abonos (`budget_abonos`) y las cuotas (`budget_cuotas`) se registran con funciones de la base que exigen sesión (`ci_registrar_abono_presupuesto`, `ci_reaplicar_abonos_presupuesto`…). La base recalcula `monto_pagado`, `saldo` y el estado: con saldo pendiente queda **Parcial**, sin saldo queda **Pagado**. No deja abonar más que el saldo. Borrar un abono recalcula todo.

Protecciones:

- No se puede borrar un presupuesto aceptado o con abonos (disparador `budgets_no_borrar_aceptados`).
- Editar un presupuesto aceptado pide confirmación.
- Cambiar el estado desde la lista pide confirmación.

## Ganancia guardada

Cada línea guarda el costo del momento. Los servicios de mano de obra cuestan, por regla general, la mitad del precio (se puede cambiar en el producto). La migración `355_presupuestos_costo_mano_de_obra.sql` corrigió las líneas de mano de obra guardadas con costo igual o mayor al precio, y guardó un respaldo en `respaldo.budgets_ganancia_20261015`.

## Tema

Lista, armado, abonos y filtros siguen el tema claro/oscuro (fichas `var(--superficie)`, textos `tinta`/`tintaTexto`, estados con `tonoFondo`/`tonoTexto` de `lib/tema/tinta.ts`).

## Qué es una venta

No hay un registro de ventas aparte. Una **venta** es un presupuesto que el cliente ya aceptó: estados `aprobado`, `cobrado` (por pagar), `parcialmente_pagado` y `pagado`. Por eso «Ventas» es un filtro de la lista (`/presupuestos?ver=ventas`) y el número de ventas del tablero cuenta esos presupuestos. La lógica está en `lib/presupuesto/listaPresupuestos.ts`.

- **Aprobado / Vendido:** suma de lo aceptado.
- **Por pagar:** lo aceptado que falta cobrar. Un presupuesto solo enviado todavía no se debe.
- **Pagado:** lo cobrado.

## Permisos

El botón de la barra es el módulo `presupuestos`. La pantalla de armar y la vista previa (`/ventas`) tienen su permiso propio, `ventas`, que tienen el administrador y el PM (`pm_obra`, desde el 15-oct-2026: arma, edita, imprime, cobra y ve costos y ganancia). Quien tiene `presupuestos` sin `ventas` ve la lista pero no puede armar, editar ni abrir la vista previa.

## Pendiente conocido

- La tabla `ventas` (vacía) y su formulario de «venta sencilla» ya no se usan; el formulario se quitó.
- Los 10 presupuestos creados antes del número fijo con la fecha cambiada por el sistema anterior conservan esa fecha como creación; la hora original no se puede recuperar.
