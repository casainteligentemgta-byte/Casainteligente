import type { LuloEstructuradoParse } from '@/lib/proyectos/parseLuloMdbEstructurado';

export type ValidacionLuloResult =
  | { ok: true }
  | { ok: false; errors: string[]; hint?: string };

/**
 * Valida el parseo estructurado antes de persistir en cascada.
 */
export function validarLuloEstructurado(parsed: LuloEstructuradoParse): ValidacionLuloResult {
  const errors: string[] = [];

  if (!parsed.partidas.length) {
    errors.push('No se encontraron partidas (tabla PARTIDAS / equivalente).');
  }

  if (!parsed.insumos.length && parsed.apu.length > 0) {
    errors.push('Hay composición APU pero no hay insumos en el maestro (INSUMOS).');
  }

  const codigosPartida = new Set(
    parsed.partidas.map((p) => p.codigo_partida.trim().toUpperCase()).filter(Boolean),
  );
  const codigosInsumo = new Set(
    parsed.insumos.map((i) => i.codigo.trim().toUpperCase()).filter(Boolean),
  );

  let apuHuerfanoPartida = 0;
  let apuHuerfanoInsumo = 0;
  for (const line of parsed.apu) {
    const cp = line.codigo_partida.trim().toUpperCase();
    const ci = line.codigo_insumo.trim().toUpperCase();
    if (cp && !codigosPartida.has(cp)) apuHuerfanoPartida += 1;
    if (ci && !codigosInsumo.has(ci)) apuHuerfanoInsumo += 1;
  }

  if (apuHuerfanoPartida > 0) {
    errors.push(
      `${apuHuerfanoPartida} línea(s) APU referencian partidas que no están en el presupuesto.`,
    );
  }
  if (apuHuerfanoInsumo > 0) {
    errors.push(
      `${apuHuerfanoInsumo} línea(s) APU referencian insumos ausentes en INSUMOS.`,
    );
  }

  const tablas = parsed.tablasUsadas;
  if (!tablas.partidas) {
    errors.push('No se detectó la tabla de partidas del MDB Lulo.');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      hint:
        'Exporte el presupuesto desde LuloWin como .mdb/.accdb estándar o use inspeccionar-mdb para ver tablas disponibles.',
    };
  }

  return { ok: true };
}

export function extensionArchivoPresupuestoLulo(nombre: string): 'mdb' | 'csv' | null {
  const n = nombre.toLowerCase();
  if (n.endsWith('.mdb') || n.endsWith('.accdb')) return 'mdb';
  if (n.endsWith('.csv') || n.endsWith('.txt')) return 'csv';
  return null;
}
