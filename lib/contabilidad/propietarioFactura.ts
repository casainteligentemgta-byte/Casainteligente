/**
 * Compara a quién está a nombre la factura (receptor) con el propietario de la obra destino.
 * Pura: sin base de datos. Si no hay dato suficiente para comparar, no avisa.
 */

const SUFIJOS = new Set(['ca', 'c', 'a', 'sa', 'srl', 'compania', 'anonima', 'cia', 'rl', 'de', 'la', 'y']);

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** "Inversiones Neroca 78 Mil, C.A." → "inversiones neroca 78 mil" */
export function normalizarNombreEmpresa(nombre: string | null | undefined): string {
  const limpio = sinAcentos(String(nombre ?? ''))
    .toLowerCase()
    .replace(/[.,;:()\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return limpio
    .split(' ')
    .filter((t) => t && !SUFIJOS.has(t))
    .join(' ');
}

/** Solo caracteres del RIF, para comparar J-29570569-7 con J295705697. */
export function normalizarRif(rif: string | null | undefined): string {
  return String(rif ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export type ResultadoPropietario =
  | { estado: 'coincide' }
  | { estado: 'no_coincide'; receptor: string; propietario: string; motivo: 'rif' | 'nombre' }
  | { estado: 'sin_datos' };

export function compararReceptorConPropietario(
  receptor: { nombre?: string | null; rif?: string | null },
  propietario: { nombre?: string | null; rif?: string | null },
): ResultadoPropietario {
  const rifR = normalizarRif(receptor.rif);
  const rifP = normalizarRif(propietario.rif);
  const nomR = normalizarNombreEmpresa(receptor.nombre);
  const nomP = normalizarNombreEmpresa(propietario.nombre);

  if (rifR && rifP) {
    if (rifR === rifP) return { estado: 'coincide' };
    return {
      estado: 'no_coincide',
      receptor: receptor.nombre ?? rifR,
      propietario: propietario.nombre ?? rifP,
      motivo: 'rif',
    };
  }
  if (!nomR || !nomP) return { estado: 'sin_datos' };
  if (nomR === nomP) return { estado: 'coincide' };
  return {
    estado: 'no_coincide',
    receptor: receptor.nombre ?? nomR,
    propietario: propietario.nombre ?? nomP,
    motivo: 'nombre',
  };
}
