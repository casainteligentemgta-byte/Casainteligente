import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import { normalizeLuloRow, pickField } from '@/lib/proyectos/luloFieldMapping';
import { extraerMontosPartidaFila } from '@/lib/proyectos/lulo/extraerMontosPartidaFila';
import { leerValorNumericoFila } from '@/lib/proyectos/lulo/leerValorNumericoFila';
import { normalizarCodigoPartidaKey } from '@/lib/proyectos/lulo/normalizarCodigoPartida';
import {
  findLuloTable,
  LULO_PARTIDA_COLS,
  resolveLuloColumn,
} from '@/lib/proyectos/luloTablasNativas';
import { montoPartidaDesdeCantidadPrecio } from '@/lib/utils/numericDbLimits';

export type MontosPartidaVolcado = {
  codigo: string;
  cantidad: number;
  precio: number;
  monto: number;
};

export function buildMapaMontosDesdeVolcadoMdb(dump: LuloMdbFullDump): Map<string, MontosPartidaVolcado> {
  const map = new Map<string, MontosPartidaVolcado>();
  const tabla = findLuloTable(dump, 'partidas');
  if (!tabla?.rows.length) return map;

  const cols = tabla.columns;
  const cCod = resolveLuloColumn(cols, LULO_PARTIDA_COLS.codigo);
  const cCan = resolveLuloColumn(cols, LULO_PARTIDA_COLS.cantidad);
  const cPre = resolveLuloColumn(cols, LULO_PARTIDA_COLS.precio);
  const cMon = resolveLuloColumn(cols, LULO_PARTIDA_COLS.monto);

  for (const raw of tabla.rows) {
    const row = normalizeLuloRow(raw);
    const codigo = pickField(row, [...LULO_PARTIDA_COLS.codigo]);
    if (!codigo.trim()) continue;

    const cantidad = leerValorNumericoFila(raw, row, cCan, LULO_PARTIDA_COLS.cantidad);
    const { precio, monto } = extraerMontosPartidaFila(
      row,
      cantidad,
      { precio: cPre, monto: cMon },
      raw,
    );

    if (precio <= 0 && monto <= 0) continue;

    const key = normalizarCodigoPartidaKey(codigo);
    map.set(key, {
      codigo: codigo.trim(),
      cantidad,
      precio,
      monto: montoPartidaDesdeCantidadPrecio(cantidad, precio, monto > 0 ? monto : undefined),
    });
  }

  return map;
}

type PartidaConMontos = {
  id?: string;
  codigo_partida?: string | null;
  cantidad_presupuestada?: number | null;
  precio_unitario_estimado?: number | null;
  monto_total_estimado?: number | null;
};

function partidaSinMontos(p: PartidaConMontos): boolean {
  return Number(p.precio_unitario_estimado ?? 0) <= 0 || Number(p.monto_total_estimado ?? 0) <= 0;
}

/**
 * Aplica montos leídos del volcado MDB (tabla PARTIDAS) a las partidas en BD.
 */
export function enriquecerPartidasMontosDesdeVolcado<T extends PartidaConMontos>(
  partidas: T[],
  dump: LuloMdbFullDump | null | undefined,
): { partidas: T[]; actualizadas: number; mapaSize: number } {
  if (!dump?.tables?.length) return { partidas, actualizadas: 0, mapaSize: 0 };

  const mapa = buildMapaMontosDesdeVolcadoMdb(dump);
  if (mapa.size === 0) return { partidas, actualizadas: 0, mapaSize: 0 };

  let actualizadas = 0;
  const resultado = partidas.map((p) => {
    if (!partidaSinMontos(p)) return p;
    const cod = String(p.codigo_partida ?? '').trim();
    if (!cod) return p;

    const key = normalizarCodigoPartidaKey(cod);
    const hit =
      mapa.get(key) ??
      mapa.get(cod.toUpperCase()) ??
      Array.from(mapa.values()).find(
        (m) => normalizarCodigoPartidaKey(m.codigo) === key,
      );

    if (!hit || (hit.precio <= 0 && hit.monto <= 0)) return p;

    actualizadas += 1;
    const cantidad =
      Number(p.cantidad_presupuestada) > 0 ? Number(p.cantidad_presupuestada) : hit.cantidad;
    const precio =
      Number(p.precio_unitario_estimado) > 0
        ? Number(p.precio_unitario_estimado)
        : hit.precio;
    const monto =
      Number(p.monto_total_estimado) > 0
        ? Number(p.monto_total_estimado)
        : montoPartidaDesdeCantidadPrecio(cantidad, precio, hit.monto);

    return {
      ...p,
      cantidad_presupuestada: cantidad,
      precio_unitario_estimado: precio,
      monto_total_estimado: monto,
    };
  });

  return { partidas: resultado, actualizadas, mapaSize: mapa.size };
}
