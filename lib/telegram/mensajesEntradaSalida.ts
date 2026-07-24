export function tituloMovimiento(tipo: 'entrada' | 'salida'): string {
  return tipo === 'entrada' ? 'Entrada a obra' : 'Salida de obra';
}

export function emojiMovimiento(tipo: 'entrada' | 'salida'): string {
  return tipo === 'entrada' ? '📥' : '📤';
}

export function mensajeInicioEntradaSalida(tipo: 'entrada' | 'salida'): string {
  const e = emojiMovimiento(tipo);
  const titulo = tituloMovimiento(tipo);
  if (tipo === 'salida') {
    return (
      `${e} <b>${titulo}</b>\n\n` +
      '1️⃣ Elige la obra.\n' +
      '2️⃣ Elige el <b>capítulo</b> presupuestario.\n' +
      '3️⃣ Envía una <b>foto</b> (se leen materiales con OCR).\n' +
      '4️⃣ Escribe la <b>observación</b>.\n' +
      '5️⃣ Elige el <b>almacén de origen</b> (descuento de stock).\n\n' +
      '<code>/cancelar</code> para abortar.'
    );
  }
  return (
    `${e} <b>${titulo}</b>\n\n` +
    '1️⃣ Elige la obra en la lista.\n' +
    '2️⃣ Envía una <b>foto</b> de lo que ingresa o egresa.\n' +
    '3️⃣ Escribe una <b>observación</b> detallando lo visto en la foto.\n\n' +
    '<code>/cancelar</code> para abortar.'
  );
}

export function mensajeObraListaEntradaSalida(
  tipo: 'entrada' | 'salida',
  nombreObra: string,
): string {
  const e = emojiMovimiento(tipo);
  return (
    `${e} Obra: <b>${nombreObra}</b>\n\n` +
    'Envía la <b>foto</b> del material o equipo que ' +
    (tipo === 'entrada' ? 'ingresa' : 'egresa') +
    ' a la obra.'
  );
}

export function mensajePedirObservacion(tipo: 'entrada' | 'salida'): string {
  return (
    `${emojiMovimiento(tipo)} Foto recibida.\n\n` +
    'Ahora escribe la <b>observación</b>: describe qué se ve en la foto, cantidades, ' +
    'proveedor, destino, estado del material, etc.'
  );
}

export function mensajeRegistroCompleto(params: {
  tipo: 'entrada' | 'salida';
  nombreObra: string;
  observacion: string;
  linkObra: string;
}): string {
  const e = emojiMovimiento(params.tipo);
  const obs = params.observacion.trim().slice(0, 800);
  return (
    `${e} <b>${tituloMovimiento(params.tipo)} registrada</b>\n` +
    `🏗 ${params.nombreObra}\n\n` +
    `📝 ${obs}\n\n` +
    `<a href="${params.linkObra}">Ver obra en la app</a>`
  );
}
