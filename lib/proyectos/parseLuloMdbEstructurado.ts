import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';
import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import { normalizeLuloRow, pickField, pickNumber } from '@/lib/proyectos/luloFieldMapping';
import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';
import {
  findLuloTable,
  luloMdbHasEstructuraNativa,
  LULO_COMPOSICION_COLS,
  LULO_INSUMO_COLS,
  LULO_OBRA_COLS,
  LULO_PARTIDA_COLS,
  resolveLuloColumn,
} from '@/lib/proyectos/luloTablasNativas';

export type LuloInsumoParsed = {
  codigo: string;
  descripcion: string;
  unidad: string;
  precio_base: number;
  tipo: string | null;
};

export type LuloApuParsed = {
  codigo_partida: string;
  codigo_insumo: string;
  cantidad_rendimiento: number;
  desperdicio_porcentaje: number;
};

export type LuloObraParsed = {
  codigo_lulo: string;
  nombre?: string;
  porcentaje_admin?: number;
  porcentaje_utilidad?: number;
  porcentaje_fcm?: number;
};

export type LuloEstructuradoParse = {
  detected: true;
  insumos: LuloInsumoParsed[];
  partidas: PartidaLuloInsert[];
  apu: LuloApuParsed[];
  obra: LuloObraParsed | null;
  tablasUsadas: {
    insumos: string | null;
    partidas: string | null;
    composicion: string | null;
    obras: string | null;
  };
};

function cell(row: Record<string, string>, col: string | null): string {
  if (!col) return '';
  return row[normalizeColumnKey(col)] ?? '';
}

function num(row: Record<string, string>, col: string | null, aliases: readonly string[]): number {
  if (col) return pickNumber(row, [col]);
  return pickNumber(row, [...aliases]);
}

function parseInsumosTable(
  table: NonNullable<ReturnType<typeof findLuloTable>>,
): LuloInsumoParsed[] {
  const cols = table.columns;
  const cCod = resolveLuloColumn(cols, LULO_INSUMO_COLS.codigo);
  const cDes = resolveLuloColumn(cols, LULO_INSUMO_COLS.descripcion);
  const cUni = resolveLuloColumn(cols, LULO_INSUMO_COLS.unidad);
  const cPre = resolveLuloColumn(cols, LULO_INSUMO_COLS.precio);
  const cTip = resolveLuloColumn(cols, LULO_INSUMO_COLS.tipo);

  const out: LuloInsumoParsed[] = [];
  const seen = new Set<string>();

  for (const raw of table.rows) {
    const row = normalizeLuloRow(raw);
    const codigo =
      cell(row, cCod) || pickField(row, [...LULO_INSUMO_COLS.codigo]);
    if (!codigo.trim()) continue;
    const key = codigo.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const descripcion =
      cell(row, cDes) || pickField(row, [...LULO_INSUMO_COLS.descripcion]) || codigo;
    out.push({
      codigo: codigo.trim(),
      descripcion: descripcion.trim().slice(0, 500),
      unidad: (cell(row, cUni) || pickField(row, [...LULO_INSUMO_COLS.unidad]) || 'UND').trim(),
      precio_base: num(row, cPre, LULO_INSUMO_COLS.precio),
      tipo: (cell(row, cTip) || pickField(row, [...LULO_INSUMO_COLS.tipo]) || null)?.trim() || null,
    });
  }
  return out;
}

function parsePartidasTable(
  table: NonNullable<ReturnType<typeof findLuloTable>>,
  proyectoId: string,
  codigoObraFiltro?: string,
): PartidaLuloInsert[] {
  const cols = table.columns;
  const cObr = resolveLuloColumn(cols, LULO_PARTIDA_COLS.codigoObra);
  const cCod = resolveLuloColumn(cols, LULO_PARTIDA_COLS.codigo);
  const cDes = resolveLuloColumn(cols, LULO_PARTIDA_COLS.descripcion);
  const cUni = resolveLuloColumn(cols, LULO_PARTIDA_COLS.unidad);
  const cCan = resolveLuloColumn(cols, LULO_PARTIDA_COLS.cantidad);
  const cPre = resolveLuloColumn(cols, LULO_PARTIDA_COLS.precio);

  const out: PartidaLuloInsert[] = [];
  const seen = new Set<string>();
  const filtro = codigoObraFiltro?.trim().toUpperCase();

  for (const raw of table.rows) {
    const row = normalizeLuloRow(raw);
    if (filtro && cObr) {
      const codObr = cell(row, cObr) || pickField(row, [...LULO_PARTIDA_COLS.codigoObra]);
      if (codObr.trim().toUpperCase() !== filtro) continue;
    }

    const codigo =
      cell(row, cCod) || pickField(row, [...LULO_PARTIDA_COLS.codigo]);
    if (!codigo.trim()) continue;
    const key = codigo.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const descripcion =
      cell(row, cDes) || pickField(row, [...LULO_PARTIDA_COLS.descripcion]) || codigo;
    const cantidad = num(row, cCan, LULO_PARTIDA_COLS.cantidad);
    const precio = num(row, cPre, LULO_PARTIDA_COLS.precio);
    const monto = Math.round(cantidad * precio * 100) / 100;

    out.push({
      proyecto_id: proyectoId,
      codigo_partida: codigo.trim(),
      descripcion: descripcion.trim().slice(0, 800),
      unidad: (cell(row, cUni) || pickField(row, [...LULO_PARTIDA_COLS.unidad]) || 'UND').trim(),
      cantidad_presupuestada: cantidad,
      precio_unitario_estimado: precio,
      monto_total_estimado: monto > 0 ? monto : precio,
      origen: 'lulo_mdb',
    });
  }
  return out;
}

function parseComposicionTable(
  table: NonNullable<ReturnType<typeof findLuloTable>>,
): LuloApuParsed[] {
  const cols = table.columns;
  const cPar = resolveLuloColumn(cols, LULO_COMPOSICION_COLS.codigoPartida);
  const cIns = resolveLuloColumn(cols, LULO_COMPOSICION_COLS.codigoInsumo);
  const cCan = resolveLuloColumn(cols, LULO_COMPOSICION_COLS.cantidad);
  const cDes = resolveLuloColumn(cols, LULO_COMPOSICION_COLS.desperdicio);

  const out: LuloApuParsed[] = [];
  const seen = new Set<string>();

  for (const raw of table.rows) {
    const row = normalizeLuloRow(raw);
    const codigo_partida =
      cell(row, cPar) || pickField(row, [...LULO_COMPOSICION_COLS.codigoPartida]);
    const codigo_insumo =
      cell(row, cIns) || pickField(row, [...LULO_COMPOSICION_COLS.codigoInsumo]);
    if (!codigo_partida.trim() || !codigo_insumo.trim()) continue;
    const key = `${codigo_partida.trim()}|${codigo_insumo.trim()}`.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      codigo_partida: codigo_partida.trim(),
      codigo_insumo: codigo_insumo.trim(),
      cantidad_rendimiento: num(row, cCan, LULO_COMPOSICION_COLS.cantidad),
      desperdicio_porcentaje: num(row, cDes, LULO_COMPOSICION_COLS.desperdicio),
    });
  }
  return out;
}

function parseObrasTable(
  table: NonNullable<ReturnType<typeof findLuloTable>>,
  codigoObraPreferido?: string,
): LuloObraParsed | null {
  const cols = table.columns;
  const cCod = resolveLuloColumn(cols, LULO_OBRA_COLS.codigo);
  const cNom = resolveLuloColumn(cols, LULO_OBRA_COLS.nombre);
  const cAdm = resolveLuloColumn(cols, LULO_OBRA_COLS.admin);
  const cUti = resolveLuloColumn(cols, LULO_OBRA_COLS.utilidad);
  const cFcm = resolveLuloColumn(cols, LULO_OBRA_COLS.fcm);

  const prefer = codigoObraPreferido?.trim().toUpperCase();
  let picked: Record<string, string> | null = null;

  for (const raw of table.rows) {
    const row = normalizeLuloRow(raw);
    const cod =
      cell(row, cCod) || pickField(row, [...LULO_OBRA_COLS.codigo]);
    if (!cod.trim()) continue;
    if (prefer && cod.trim().toUpperCase() !== prefer) continue;
    picked = row;
    break;
  }

  if (!picked && table.rows.length > 0) {
    picked = normalizeLuloRow(table.rows[0]);
  }
  if (!picked) return null;

  const codigo_lulo =
    cell(picked, cCod) || pickField(picked, [...LULO_OBRA_COLS.codigo]);
  if (!codigo_lulo.trim()) return null;

  return {
    codigo_lulo: codigo_lulo.trim(),
    nombre: (cell(picked, cNom) || pickField(picked, [...LULO_OBRA_COLS.nombre]) || undefined)?.trim(),
    porcentaje_admin: num(picked, cAdm, LULO_OBRA_COLS.admin) || undefined,
    porcentaje_utilidad: num(picked, cUti, LULO_OBRA_COLS.utilidad) || undefined,
    porcentaje_fcm: num(picked, cFcm, LULO_OBRA_COLS.fcm) || undefined,
  };
}

/**
 * Parsea MDB Lulo con tablas nativas INSUMOS / PARTIDAS / COMPOSICION / OBRAS.
 * Devuelve null si el archivo no tiene estructura reconocible.
 */
export function parseLuloMdbEstructurado(
  dump: LuloMdbFullDump,
  proyectoId: string,
  opts?: { codigoObra?: string },
): LuloEstructuradoParse | null {
  if (!luloMdbHasEstructuraNativa(dump)) return null;

  const tPartidas = findLuloTable(dump, 'partidas');
  if (!tPartidas) return null;

  const tInsumos = findLuloTable(dump, 'insumos');
  const tComposicion = findLuloTable(dump, 'composicion');
  const tObras = findLuloTable(dump, 'obras');

  const obra = tObras ? parseObrasTable(tObras, opts?.codigoObra) : null;
  const codigoObra = opts?.codigoObra ?? obra?.codigo_lulo;

  const partidas = parsePartidasTable(tPartidas, proyectoId, codigoObra);
  if (partidas.length === 0) return null;

  const insumos = tInsumos ? parseInsumosTable(tInsumos) : [];
  const apu = tComposicion ? parseComposicionTable(tComposicion) : [];

  return {
    detected: true,
    insumos,
    partidas,
    apu,
    obra,
    tablasUsadas: {
      insumos: tInsumos?.name ?? null,
      partidas: tPartidas.name,
      composicion: tComposicion?.name ?? null,
      obras: tObras?.name ?? null,
    },
  };
}
