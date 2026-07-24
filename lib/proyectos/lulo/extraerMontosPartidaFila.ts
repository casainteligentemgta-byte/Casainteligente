import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';
import { parseLuloNumber, parseLuloValueUnknown } from '@/lib/proyectos/luloCleanNumber';
import { montoPartidaDesdeCantidadPrecio } from '@/lib/utils/numericDbLimits';

const CLAVES_NO_MONTO = new Set([
  'id',
  'idpar',
  'id_par',
  'idins',
  'orden',
  'indice',
  'nivel',
  'tipo',
  'tippar',
  'flag',
  'activo',
  'codobr',
  'cod_obr',
  'codcap',
  'cod_cap',
  'capitulo',
  'numcap',
]);

/** Columnas de texto/cantidad Lulo Access — no usar en heurística de montos. */
const COLUMNAS_TEXTO_O_CANTIDAD = new Set([
  'codpar',
  'cod_par',
  'codpartida',
  'cod_partida',
  'codigo',
  'codigo_partida',
  'despar',
  'des_par',
  'descripcion',
  'unipar',
  'uni_par',
  'unidad',
  'canpar',
  'can_par',
  'cantidad',
  'nompar',
  'nom_par',
  'nombre',
  'wbs',
  'item',
]);

function esClaveTextoONoMonto(key: string): boolean {
  if (CLAVES_NO_MONTO.has(key)) return true;
  if (COLUMNAS_TEXTO_O_CANTIDAD.has(key)) return true;
  if (
    /^(cod|des|uni|nom|fec|tip|cap|obra|wbs|item|codigo)/.test(key) &&
    !/precio|monto|total|importe|valor|costo|prepar|monpar|pre_par|mon_par|imp|cos|pu|pvp|venta|parcial/.test(
      key,
    )
  ) {
    return true;
  }
  return false;
}

function leerCol(
  row: Record<string, string>,
  col: string | null | undefined,
  raw?: Record<string, unknown>,
): number {
  if (!col) return 0;
  const want = normalizeColumnKey(col);
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (normalizeColumnKey(k) === want) {
        const n = parseLuloValueUnknown(v);
        if (n !== 0) return n;
      }
    }
  }
  return parseLuloNumber(row[want] ?? row[col] ?? '');
}

/**
 * Extrae P.U. y monto desde fila PARTIDAS Lulo cuando PrePar/MonPar vienen vacíos
 * o con nombres no estándar (ImpPar, Valor, etc.).
 */
export function extraerMontosPartidaFila(
  row: Record<string, string>,
  cantidad: number,
  cols?: { precio?: string | null; monto?: string | null },
  raw?: Record<string, unknown>,
): { precio: number; monto: number } {
  let precio = leerCol(row, cols?.precio ?? null, raw);
  let monto = leerCol(row, cols?.monto ?? null, raw);

  if (monto <= 0 && precio > 0 && cantidad > 0) {
    monto = montoPartidaDesdeCantidadPrecio(cantidad, precio);
  }
  if (precio <= 0 && monto > 0 && cantidad > 0) {
    precio = monto / cantidad;
  }
  if (precio > 0 || monto > 0) {
    return {
      precio,
      monto: montoPartidaDesdeCantidadPrecio(cantidad, precio, monto > 0 ? monto : undefined),
    };
  }

  const candidatos: { key: string; val: number }[] = [];
  const fuentes: Array<Record<string, unknown>> = raw ? [raw] : [];
  fuentes.push(row);

  for (const src of fuentes) {
    for (const [k, v] of Object.entries(src)) {
      const nk = normalizeColumnKey(k);
      if (esClaveTextoONoMonto(nk)) continue;
      const n =
        typeof v === 'string' || typeof v === 'number'
          ? parseLuloValueUnknown(v)
          : parseLuloNumber(String(v ?? ''));
      if (n > 0) candidatos.push({ key: nk, val: n });
    }
  }

  if (candidatos.length === 0) return { precio: 0, monto: 0 };

  candidatos.sort((a, b) => b.val - a.val);

  const montoInferido =
    candidatos.find((c) => /mon|monto|total|importe|imp|valor|parcial|monpar|pt$/.test(c.key))
      ?.val ??
    candidatos[0]?.val ??
    0;

  const precioInferido =
    candidatos.find((c) => /pre|pu$|pvp|unit|cos.*uni|precio|prepar/.test(c.key))?.val ??
    (cantidad > 0 && montoInferido > 0 ? montoInferido / cantidad : candidatos[1]?.val ?? 0);

  return {
    precio: precioInferido,
    monto: montoPartidaDesdeCantidadPrecio(
      cantidad,
      precioInferido,
      montoInferido > 0 ? montoInferido : undefined,
    ),
  };
}
