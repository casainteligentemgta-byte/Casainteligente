# Cadena de compras por Telegram

Cómo viaja una solicitud de material desde que el ingeniero la pide hasta que entra al
almacén. Todo el recorrido se prueba con el bot de ensayo (`docs/BOT-DE-ENSAYO.md`,
recorridos `compra_*`).

| Paso | Quién | Qué pasa |
| --- | --- | --- |
| 1 | Ingeniero | `/procura`: material, cantidad, prioridad. |
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

## Chat de verificación

Hay dos mecanismos distintos:

| | Qué hace | Variables |
| --- | --- | --- |
| **Desvío** | Los mensajes personales **no llegan** a su destinatario: van todos a un chat de pruebas con la cabecera «📬 Recibe: …». | `TELEGRAM_PRUEBAS_REDIRECT`, `TELEGRAM_PRUEBAS_REDIRECT_CHAT_ID` |
| **Espejo** | Cada destinatario recibe su mensaje y además llega **una copia** a un chat de registro (otro bot). | `TELEGRAM_LOG_BOT_TOKEN`, `TELEGRAM_LOG_CHAT_ID` (se apaga con `TELEGRAM_LOG_ESPEJO_SALIDA=false`) |

Para que el chat de verificación conviva con los avisos reales se apaga el desvío y se
deja el espejo.
