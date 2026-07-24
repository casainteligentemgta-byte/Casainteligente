/** Convierte subida HTTP a Buffer de Node (mdb-reader exige Buffer, no ArrayBuffer). */
export function toMdbNodeBuffer(input: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  return Buffer.from(input);
}

export function assertMdbFileBuffer(buffer: Buffer): void {
  if (!buffer?.length || buffer.length < 2048) {
    throw new Error(
      'El archivo está vacío o es demasiado pequeño. Sube el .mdb o .accdb original exportado desde Lulo.',
    );
  }
  if (buffer[0] === undefined) {
    throw new Error(
      'No se pudo leer el archivo en el servidor. Reinicia con npm run dev:fresh e intenta de nuevo.',
    );
  }
  if (buffer[0] !== 0) {
    const engine = buffer.slice(4, 19).toString('ascii');
    if (engine !== 'Standard Jet DB') {
      throw new Error(
        'No parece un Access MDB/ACCDB válido (cabecera incorrecta). Usa el archivo original de Lulo, no CSV renombrado.',
      );
    }
  }
}

export function formatMdbReadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Wrong page type')) {
    return (
      'No se pudo abrir el archivo Access. Suele deberse a: archivo corrupto, contraseña en la base, ' +
      'o formato no compatible. Prueba guardar de nuevo desde Lulo como .mdb (Access 2000-2003) o .accdb, ' +
      'sin contraseña de apertura.'
    );
  }
  if (msg.includes('Wrong password')) {
    return 'La base Access tiene contraseña. Quítala en Lulo/Access y vuelve a exportar.';
  }
  if (msg.includes("Unsupported version")) {
    return 'Versión de Access no soportada por el lector. Guarda como .mdb (Jet 4) o .accdb reciente desde Lulo.';
  }
  return msg;
}
