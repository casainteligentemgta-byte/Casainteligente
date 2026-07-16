import type { SupabaseClient } from '@supabase/supabase-js';
import { extractFullLuloCsv, extractFullLuloMdb, type LuloCsvFullDump, type LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';
import { toMdbNodeBuffer } from '@/lib/proyectos/mdbBuffer';
import type { LuloSnapshotResumen } from '@/types/lulo-import';

export type LuloCatalogoTabla = {
  name: string;
  rowCount: number;
  columns: string[];
};

export type LuloExtraccionCompleta = {
  formato: 'mdb' | 'csv';
  payload: LuloMdbFullDump | LuloCsvFullDump;
  catalogoTablas: LuloCatalogoTabla[];
  filasTotales: number;
  creationDate: string | null;
};

export function catalogoDesdeMdb(dump: LuloMdbFullDump): LuloCatalogoTabla[] {
  return dump.tables.map((t) => ({
    name: t.name,
    rowCount: t.rowCount,
    columns: t.columns,
  }));
}

export function catalogoDesdeCsv(dump: LuloCsvFullDump): LuloCatalogoTabla[] {
  return [
    {
      name: 'CSV',
      rowCount: dump.rows.length,
      columns: dump.headers,
    },
  ];
}

export function extraerMdbLuloCompleto(buffer: Buffer | ArrayBuffer | Uint8Array): LuloExtraccionCompleta {
  const nodeBuffer = toMdbNodeBuffer(buffer);
  const payload = extractFullLuloMdb(nodeBuffer);
  const catalogoTablas = catalogoDesdeMdb(payload);
  const filasTotales = catalogoTablas.reduce((s, t) => s + t.rowCount, 0);
  return {
    formato: 'mdb',
    payload,
    catalogoTablas,
    filasTotales,
    creationDate: payload.creationDate,
  };
}

export function extraerCsvLuloCompleto(text: string): LuloExtraccionCompleta {
  const payload = extractFullLuloCsv(text);
  const catalogoTablas = catalogoDesdeCsv(payload);
  return {
    formato: 'csv',
    payload,
    catalogoTablas,
    filasTotales: payload.rows.length,
    creationDate: null,
  };
}

export function buildResumenSnapshotExtraccion(
  extraccion: LuloExtraccionCompleta,
  opts?: { partidas?: number; gastos?: number; presupuestoTotalUsd?: number },
): LuloSnapshotResumen & { catalogoTablas: LuloCatalogoTabla[] } {
  return {
    partidas: opts?.partidas ?? 0,
    gastos: opts?.gastos ?? 0,
    presupuestoTotalUsd: opts?.presupuestoTotalUsd ?? 0,
    formato: extraccion.formato,
    tablas: extraccion.catalogoTablas.length,
    filasTotales: extraccion.filasTotales,
    catalogoTablas: extraccion.catalogoTablas,
    creationDate: extraccion.creationDate,
    modo: opts?.partidas || opts?.gastos ? 'importacion' : 'extraccion_completa',
  };
}

export async function guardarSnapshotLulo(
  supabase: SupabaseClient,
  params: {
    proyectoId: string;
    nombreArchivo: string;
    extraccion: LuloExtraccionCompleta;
    resumen: LuloSnapshotResumen & { catalogoTablas?: LuloCatalogoTabla[] };
    reemplazarSnapshots?: boolean;
  },
): Promise<{ id: string; created_at: string } | null> {
  const pid = params.proyectoId.trim();
  if (!pid) return null;

  if (params.reemplazarSnapshots) {
    await supabase.from('ci_lulo_import_snapshots').delete().eq('proyecto_id', pid);
  }

  const { data, error } = await supabase
    .from('ci_lulo_import_snapshots')
    .insert({
      proyecto_id: pid,
      nombre_archivo: params.nombreArchivo,
      formato: params.extraccion.formato,
      resumen: params.resumen,
      payload: params.extraccion.payload as unknown as Record<string, unknown>,
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.warn('[guardarSnapshotLulo]', error.message);
    return null;
  }
  return data;
}

function isMdbFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.mdb') || name.endsWith('.accdb');
}

/** Extrae todas las tablas/filas del MDB o CSV y las guarda en `ci_lulo_import_snapshots`. */
export async function postExtraerLuloCompleto(
  supabase: SupabaseClient,
  proyectoId: string,
  file: File,
  reemplazarSnapshot = false,
): Promise<{
  extraccion: LuloExtraccionCompleta;
  resumen: LuloSnapshotResumen & { catalogoTablas: LuloCatalogoTabla[] };
  snapshotId: string | null;
}> {
  const extraccion =
    isMdbFile(file)
      ? extraerMdbLuloCompleto(toMdbNodeBuffer(await file.arrayBuffer()))
      : extraerCsvLuloCompleto(await file.text());

  const resumen = buildResumenSnapshotExtraccion(extraccion);
  const snap = await guardarSnapshotLulo(supabase, {
    proyectoId,
    nombreArchivo: file.name,
    extraccion,
    resumen,
    reemplazarSnapshots: reemplazarSnapshot,
  });

  return { extraccion, resumen, snapshotId: snap?.id ?? null };
}

export function extraccionDesdePayload(
  payload: Record<string, unknown>,
  formato: 'mdb' | 'csv',
): LuloExtraccionCompleta | null {
  if (formato === 'mdb' && Array.isArray(payload.tables)) {
    const dump = payload as unknown as LuloMdbFullDump;
    const catalogoTablas = catalogoDesdeMdb(dump);
    return {
      formato: 'mdb',
      payload: dump,
      catalogoTablas,
      filasTotales: catalogoTablas.reduce((s, t) => s + t.rowCount, 0),
      creationDate: dump.creationDate ?? null,
    };
  }
  if (formato === 'csv' && Array.isArray(payload.rows)) {
    const dump = payload as unknown as LuloCsvFullDump;
    const catalogoTablas = catalogoDesdeCsv(dump);
    return {
      formato: 'csv',
      payload: dump,
      catalogoTablas,
      filasTotales: dump.rows.length,
      creationDate: null,
    };
  }
  return null;
}
