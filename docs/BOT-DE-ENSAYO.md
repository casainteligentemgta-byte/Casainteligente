# Bot de ensayo

Permite probar el bot de Telegram **sin Telegram**: conversaciones completas contra el
código real, con las respuestas del bot capturadas en un reporte.

## Qué es real y qué no

| Parte | En un ensayo |
| --- | --- |
| Rutas y flujos del bot (`lib/telegram/*`) | El código real, sin cambios |
| Base de datos | La real, pero solo la **obra ficticia** «ZZ · PRUEBAS DEL BOT» |
| Mensajes hacia Telegram | **No salen.** Se capturan (`lib/telegram/simulacion/contexto.ts`) |
| Fotos que «llegan» | Una imagen de relleno de 1×1 px, que sí se sube a Storage |
| Chat espejo (log bot) | Apagado |

## Dónde corre

Solo en las **copias de prueba de Vercel** (una por cada rama o PR) y en desarrollo local.
En `casainteligente.company` la ruta responde 404. Las copias de prueba no tienen la clave
del bot, así que aunque algo fallara no podría salir un mensaje real.

```
GET /api/pruebas/bot                        lista de recorridos y personas
GET /api/pruebas/bot?escenario=salida_obrero
GET /api/pruebas/bot?guion=<JSON en base64>[&reiniciar=1]
```

El guion libre es una lista de pasos; cada paso es de una persona (`q`) y lleva una acción:

```json
[
  { "q": "depo", "t": "/salida" },
  { "q": "depo", "b": "obrero" },
  { "q": "depo", "f": 1, "c": "texto que acompaña la foto" },
  { "q": "depo", "d": "se:conf:ok" }
]
```

`t` escribe un texto, `b` pulsa el botón cuyo texto contiene eso, `d` pulsa un botón por su
dato interno y `f` envía una foto. Sin `reiniciar=1` el guion continúa la conversación que
quedó abierta.

## Personas

| Clave | Nombre | En la nómina de la obra de ensayo | En el departamento de compras |
| --- | --- | --- | --- |
| `ing` | Ing. Ensayo | Ingeniero residente | Solicitante |
| `conta` | Conta Ensayo | Contador | Contador (revisa fondos) |
| `pm` | PM Ensayo | PM de obra | Aprobador |
| `compra` | Compra Ensayo | Comprador | Comprador |
| `logi` | Logi Ensayo | Logística | — |
| `depo` | Depo Ensayo | Depositario | — |

Sus chats son números que no pueden existir en Telegram.

Los roles del departamento de compras son **globales** en `ci_usuarios_sistema_telegram`:
una fila ficticia allí recibiría los avisos de las obras reales. Por eso esos roles
**no se guardan en la base**: existen solo dentro del ensayo (`usuariosSistema` del
contexto). Mientras corre un ensayo, las funciones que leen esa tabla devuelven
únicamente a las personas del ensayo, y nada se copia de la nómina a la tabla real.
Nadie de la nómina de ensayo es `admin`, porque ese rol sí se copia como Administrador global.

## Seguros

- Un ensayo no puede pulsar un botón que apunte a una obra o un almacén real, y si la
  sesión del bot queda apuntando a uno, se cierra y el ensayo se detiene.
- Antes de cada recorrido la obra de ensayo vuelve a su estado inicial (100 y 50 unidades
  de los dos materiales de prueba, sin movimientos). La limpieza solo toca filas de la
  obra, las ubicaciones, los materiales y los chats de ensayo.
- Si alguien renombra la obra ficticia (deja de empezar por «ZZ ·»), los ensayos se niegan
  a correr.

## Recorridos

| Grupo | Recorridos |
| --- | --- |
| Salida a obrero | `salida_obrero`, `salida_obrero_foto_antes`, `salida_obrero_sin_foto` |
| Pedir material al almacén | `pedido_uso`, `pedido_colocacion`, `pedido_traspaso`, `pedido_devolucion`, `pedido_deterioro`, `pedido_no_propio`, `pedido_rechazado`, `pedido_soltado`, `pedido_supera_stock` |
| Traspaso | `traspaso`, `traspaso_foto_antes` |
| Compras | `compra_completa`, `compra_foto_factura_antes`, `compra_despacho_con_foto`, `compra_a_credito` |

`compra_completa` recorre toda la cadena: el ingeniero pide 150 con 100 en almacén → el
Contador confirma fondos → el PM aprueba → el depositario despacha 100 **con foto** y el
comprador recibe **una sola** orden por 50 → factura manual con foto, en dólares → Logística
la retira con foto → el depositario la ingresa con foto, el almacén sube 50, la solicitud
queda «recibida» y el ingeniero recibe el aviso. Comprueba además que el depositario solo
ve las facturas de su obra y que el monto en bolívares sea dólares × tasa una sola vez.

`compra_a_credito`: el Contador dice que no hay fondos, el PM aprueba **a crédito**, la orden
al comprador lo dice y la factura se registra a crédito sin preguntar contado o crédito.

`?escenario=todos` los corre todos, uno tras otro (más de dos minutos). Con `&grupo=compra`
(o `salida`, `pedido`, `traspaso`) corre solo ese grupo, que es lo práctico desde una herramienta
con límite de tiempo por llamada.

## Qué no cubre

- La entrega real por Telegram (que el mensaje llegue al teléfono) ni cómo se ve.
- La lectura automática de facturas por foto.

## Datos

`supabase/pruebas/obra_de_ensayo.sql` crea la obra, el almacén, los materiales y las
personas. Ya está aplicado en producción.
