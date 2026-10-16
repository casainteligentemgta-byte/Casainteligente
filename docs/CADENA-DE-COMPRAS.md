# Cadena de compras por Telegram

Cómo viaja una solicitud de material desde que el ingeniero la pide hasta que entra al
almacén. Todo el recorrido se prueba con el bot de ensayo (`docs/BOT-DE-ENSAYO.md`,
recorridos `compra_*`).

| Paso | Quién | Qué pasa |
| --- | --- | --- |
| 1 | Ingeniero | `/procura`: capítulo, material (del **catálogo por categoría** o escrito), cantidad, prioridad. Si el almacén de la obra ya lo tiene, la confirmación ofrece **pedirlo al almacén** en vez de comprarlo (o pedir lo que hay y comprar solo el resto). |
| 2 | Contador | Dice si hay fondos. **No bloquea**: con o sin fondos pasa al PM. |
| 3 | PM | Aprueba o rechaza. Sin fondos el botón es **«Aprobar a crédito»**. |
| 4 | Depositario | Recibe la orden de verificación. Si hay material que sacar, **debe enviar la foto**; con ella sale el stock hacia la obra. |
| 5 | Comprador | Recibe **una** orden por lo que falta y carga la factura (foto o manual). |
| 6 | Logística | Toma el retiro y envía la foto de lo que recoge. |
| 7 | Depositario | `/ingreso` → factura precargada → cuenta, foto y registra. |
| 8 | Ingeniero | Recibe «Su material ya está en el almacén»; la solicitud queda **Recibida**. |

## Reglas

- **Compra a crédito** (`lib/procuras/compraACredito.ts`). Si el Contador informó «no hay
  fondos» y el PM aprueba, la compra es a crédito: lo dicen el mensaje al PM, la orden al
  comprador y el ticket del ingeniero, y al cargar la factura no se pregunta
  contado/crédito, solo los días.
- **Foto del despacho** (`lib/telegram/despachoProcuraTelegram.ts`). El depositario toma el
  despacho al pulsar «Confirmar»; el stock solo se mueve al llegar la foto, que queda en la
  transferencia. Puede soltarlo con «No lo despacho yo»; a los 30 minutos sin foto queda
  libre. Si no hay nada que sacar del almacén no se pide foto. Migración 344.
- **Material recibido** (`lib/procuras/procuraRecibidaTrasIngreso.ts`). Al ingresar la
  compra al almacén la solicitud pasa a «Recibida» (o «Recibida parcial» si se contó menos)
  y se avisa al ingeniero en un mensaje nuevo.
- **Facturas de mi obra** (`lib/telegram/facturasPendientesDeMisObras.ts`). En `/ingreso`
  cada quien ve las facturas de las obras donde está en nómina. Los administradores del
  sistema ven todas. Una factura sin obra la ve solo quien la cargó.
- **Depositario virtual** (`lib/almacen/depositariosNomina.ts`). Si una obra no tiene a
  nadie de almacén (depositario fijo, grupo o rol Depositario en la nómina), sus avisos
  los recibe quien administra la obra y, si tampoco hay, los administradores del sistema.
  Deja de aplicar solo, al asignar un depositario en Proyecto → Nómina.

- **Almacén primero** (`pedirAlAlmacenYComprarResto` en
  `lib/compras/procuraDepartamentoTelegram.ts`). Con material del catálogo y existencia en
  la misma unidad, la confirmación ofrece «Pedirlo al almacén» (requerimiento de salida,
  sin contador, PM ni comprador) o «Pedir X y comprar Y». El stock se revisa de nuevo al
  pulsar. Sin nadie de almacén con Telegram, avisa y deja comprar.
- **Catálogo base de obra civil** (`lib/compras/catalogoBase.ts`, migración 361). ~300
  ítems en 20 categorías (acero y cabillas, arena y piedra, cemento, bloques, tuberías,
  ferretería, electricidad, sanitarios, puertas y ventanas, techos, pisos, pintura,
  herramientas, EPP, equipos, combustibles, servicios…), **sin precios ni proveedores**.
  Al elegir un ítem se busca o crea el material de la empresa de la obra y se enlaza
  (`global_inventory.catalogo_base_id`). Al escribir, también sugiere ítems del catálogo
  (📗). El texto libre sigue disponible (híbrido).

- **Control de compras** (`lib/compras/controlCompra.ts`, migración 362). Al confirmar la
  factura se compara con lo pedido: **facturó más de lo pedido** (más de 2 %) o **trae algo
  que nadie pidió** (solo si todas las procuras eran del catálogo). Al cerrar la recepción
  se compara con lo recibido (lo aprobado en cuarentena o el conteo del depositario):
  **llegó menos de lo facturado**. Cada diferencia se guarda una vez, con su monto, y se
  avisa por Telegram al comprador y al contador de la obra y a administración. Se revisa y
  marca «revisada» en `/compras/torre-control` (Torre de Control) → Control de compras.
  Desde la migración 364 también avisa el **precio alto**: un material pagado más de 15 %
  sobre la mediana en USD de sus últimas 5 compras (12 meses).

- **Proveedores** (`lib/compras/fichaProveedores.ts`). En la Torre de Control: compras,
  monto en USD, diferencias, líneas rechazadas y días hasta recibir de cada proveedor en
  los últimos 180 días, con un puntaje de 0 a 100.

- **Stock bajo el mínimo** (`materialesBajoMinimo` en `lib/compras/cuellosBotella.ts`).
  Etapa de la Torre de Control y del aviso diario: material cuyo disponible + en camino
  quedó por debajo del mínimo de la obra (Almacén → Maestros) o del mínimo global, y que
  no tiene una procura abierta. Avisa al comprador y a los depositarios; agotado = 🔴.

- **«Estoy cotizando»**. Botón en la orden de compra que recibe el comprador. Guarda
  `cotizando_at`/`cotizando_por` (migración 364); la Torre de Control le da 5 días en vez
  de 2 antes de marcarla detenida y muestra «en cotización por …».

- **Gasto del capítulo** (`lib/procuras/gastoCapituloProcura.ts`). El ticket del PM
  muestra lo ya comprado en ese capítulo de la obra, lo aprobado sin comprar y el total
  con esta procura. Solo informa; todavía no se compara contra un presupuesto.

## Pendientes

- **Catálogo completo.** El catálogo base es un punto de partida. Falta: revisar nombres y
  medidas con el personal de obra, agregar variantes (marcas, calibres, presentaciones),
  una pantalla web para editarlo (hoy se cambia con una migración) y depurar el catálogo
  de cada empresa (materiales creados solos desde facturas, incluidos los de prueba).
- **Procura atada al presupuesto (meta, con cautela).** Hoy se elige el capítulo. Falta
  la partida del presupuesto y comparar el gasto del capítulo (que el PM ya ve) contra
  lo presupuestado.

## Chat de verificación

Hay dos mecanismos distintos:

| | Qué hace | Variables |
| --- | --- | --- |
| **Desvío** | Los mensajes personales **no llegan** a su destinatario: van todos a un chat de pruebas con la cabecera «📬 Recibe: …». | `TELEGRAM_PRUEBAS_REDIRECT`, `TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID` |
| **Espejo** | Cada destinatario recibe su mensaje y además llega **una copia** a un chat de registro (otro bot). | `TELEGRAM_LOG_BOT_TOKEN`, `TELEGRAM_LOG_CHAT_ID` (se apaga con `TELEGRAM_LOG_ESPEJO_SALIDA=false`) |

Para que el chat de verificación conviva con los avisos reales se apaga el desvío y se
deja el espejo.
