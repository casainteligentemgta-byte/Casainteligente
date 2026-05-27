import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';
import { parseLuloValueUnknown } from '@/lib/proyectos/luloCleanNumber';
import { pickNumber } from '@/lib/proyectos/luloFieldMapping';

export function leerValorNumericoFila(
  raw: Record<string, unknown>,
  row: Record<string, string>,
  colResuelto: string | null,
  aliases: readonly string[],
): number {
  if (colResuelto) {
    const want = normalizeColumnKey(colResuelto);
    for (const [k, v] of Object.entries(raw)) {
      if (normalizeColumnKey(k) === want) {
        return parseLuloValueUnknown(v);
      }
    }
  }
  return pickNumber(row, [...aliases]);
}
