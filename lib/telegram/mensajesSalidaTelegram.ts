import { etiquetaRequisitoFoto } from '@/lib/telegram/fotoObligatoria';

/** Textos del menú /salida y pasos de cada flujo (una sola fuente). */

const REQUISITO_FOTO = etiquetaRequisitoFoto();

export const MENU_SALIDA_TEXTO =
  '📤 <b>Salida de material</b>\n\n' +
  'Elija una opción:\n\n' +
  '🏗 A un obrero\n' +
  '🏭 Despacho a obra u otro almacén\n' +
  '🔄 Traspaso entre almacenes\n' +
  '📝 Pedir material\n' +
  '🗑 Deterioro / merma (baja de stock)\n\n' +
  '<code>/cancelar</code> para salir.';

export const FLUJO_PASOS_SALIDA_OBRA =
  '1️⃣ Se toma la <b>obra</b> y su almacén (sin elegir).\n' +
  '2️⃣ ¿<b>Quién recibe</b>? Elija el obrero de la obra.\n' +
  '3️⃣ <b>Material</b> con stock y <b>cantidad</b>.\n' +
  '4️⃣ ¿<b>Agregar más materiales</b>?\n' +
  `5️⃣ <b>Foto</b> ${REQUISITO_FOTO} y <b>observaciones</b>.\n` +
  '6️⃣ <b>Confirmar</b> — descuenta stock y deja trazabilidad.\n\n' +
  '<code>/cancelar</code> para abortar.';

export const FLUJO_PASOS_SALIDA_DESPACHO =
  '1️⃣ Elige la <b>obra</b> y el <b>almacén de origen</b>.\n' +
  '2️⃣ <b>Obrero</b> que recibe (nómina o nombre + cédula).\n' +
  '3️⃣ Destino: <b>obra</b> (capítulo → partida o actividad) u <b>otro almacén</b>.\n' +
  '4️⃣ <b>Observaciones</b> (opcional) → materiales del stock y cantidades.\n' +
  `5️⃣ <b>Foto</b> del material saliente ${REQUISITO_FOTO}.\n` +
  '6️⃣ <b>Confirmar</b> — descuenta stock (paridad con Despacho en la app).\n\n' +
  '<code>/cancelar</code> para abortar.';

export const FLUJO_PASOS_SALIDA_TRASPASO =
  '1️⃣ Elige el <b>almacén u obra de origen</b>.\n' +
  '2️⃣ Elige el <b>destino</b> (otro almacén u obra).\n' +
  '3️⃣ Elige el <b>material</b> con stock y la <b>cantidad</b>.\n' +
  '4️⃣ <b>Nota</b> breve (chofer, placas, motivo).\n' +
  `5️⃣ <b>Foto</b> del material ${REQUISITO_FOTO}.\n` +
  '6️⃣ <b>Confirmar</b> — mueve el stock.\n\n' +
  '<code>/cancelar</code> para abortar.';

export const MENSAJE_INICIO_SALIDA_OBRA =
  '🏗 <b>Salida a un obrero en obra</b> (<code>/salida</code>)\n\n' + FLUJO_PASOS_SALIDA_OBRA;

export const MENSAJE_INICIO_SALIDA_DESPACHO =
  '🏭 <b>Despacho a obra u otro almacén</b> (<code>/salida</code>)\n\n' + FLUJO_PASOS_SALIDA_DESPACHO;

export const MENSAJE_INICIO_SALIDA_TRASPASO =
  '🔄 <b>Traspaso / préstamo entre almacenes</b> (<code>/salida</code>)\n\n' +
  FLUJO_PASOS_SALIDA_TRASPASO;

export const MENSAJE_INICIO_SALIDA_MERMA =
  '🗑 <b>Deterioro / merma</b>\n\n' +
  'Almacén → producto → cantidad → motivo → foto (opcional).\n' +
  'Se descuenta el stock y se avisa a administración.\n\n' +
  '<code>/cancelar</code> para salir.';
