import type { LuloMdbFullDump } from '@/lib/proyectos/extractLuloFull';

export type LuloPartida = {
  id: string;
  codigo_partida: string;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  precio_unitario_estimado: number;
  monto_total_estimado: number;
  origen: string;
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
  capitulo_orden?: number | null;
};

export type LuloGasto = {
  id: string;
  fecha: string;
  tipo: string;
  disciplina: string;
  proveedor: string;
  descripcion: string | null;
  costo: number;
  origen: string;
};

export type LuloSnapshotMeta = {
  id: string;
  nombre_archivo: string;
  formato: string;
  resumen: Record<string, unknown>;
  created_at: string;
};

export type LuloMdbTable = {
  name: string;
  columns: string[];
  rowCount: number;
  rows: Record<string, unknown>[];
};

export type LuloSnapshotPayload = {
  formato?: string;
  tables?: LuloMdbTable[];
  headers?: string[];
  rows?: Record<string, string>[];
};

export type LuloSnapshotDetail = {
  id: string;
  payload: LuloSnapshotPayload;
  nombre_archivo: string;
};

export type LuloProyectoMeta = {
  nombre?: string | null;
  ubicacion_texto?: string | null;
  obra_ubicacion?: string | null;
  obra_cliente?: string | null;
  codigo_lulo?: string | null;
  porcentaje_admin?: number | null;
  porcentaje_utilidad?: number | null;
  porcentaje_fcm?: number | null;
};

export type LuloResumenNativo = {
  apuLineas: number;
  insumosEnApu: number;
  insumosMaestroTotal: number;
};

export type TabLuloId = 'importar' | 'presupuesto' | 'partidas' | 'volcado' | 'tablas';

export function tabLuloDesdeQuery(raw: string | null): TabLuloId | null {
  if (!raw) return null;
  if (raw === 'presupuesto' || raw === 'reporte') return 'presupuesto';
  if (raw === 'partidas' || raw === 'cuadro') return 'partidas';
  if (raw === 'volcado') return 'volcado';
  if (raw === 'tablas' || raw === 'explorar') return 'tablas';
  if (raw === 'importar') return 'importar';
  return null;
}

export function esTablaPartidasMdb(nombre: string): boolean {
  const n = nombre.trim().toUpperCase();
  return n === 'PARTIDAS' || n === 'PARTIDA';
}

export function payloadComoMdbDump(payload: LuloSnapshotPayload | null | undefined): LuloMdbFullDump | null {
  if (payload?.formato !== 'mdb' || !payload.tables) return null;
  return payload as LuloMdbFullDump;
}
