import type { PartidaLuloInsert } from '@/lib/proyectos/parsePresupuestoLuloCsv';

export type GastoObraLuloInsert = {
  proyecto_id: string | null;
  fecha: string;
  tipo: string;
  disciplina: string;
  proveedor: string;
  descripcion: string;
  costo: number;
  origen: string;
};

export type LuloCatalogoTablaResumen = {
  name: string;
  rowCount: number;
  columns: string[];
};

export type LuloSnapshotResumen = {
  partidas: number;
  gastos: number;
  presupuestoTotalUsd: number;
  tablas?: number;
  filasTotales?: number;
  formato: 'mdb' | 'csv';
  /** Catálogo de tablas del MDB (modo extracción completa). */
  catalogoTablas?: LuloCatalogoTablaResumen[];
  creationDate?: string | null;
  modo?: 'importacion' | 'extraccion_completa';
};

export type LuloMdbParseMetaBase = {
  tableNames: string[];
  partidasTable: string | null;
  gastosTable: string | null;
  presupuestoTotalUsd: number;
  filasOmitidas: number;
  tablasPartidas?: string[];
  tablasGastos?: string[];
  diagnosticoResumen?: string;
  tablasDiagnostico?: Array<{
    name: string;
    rowCount: number;
    columns: string[];
    partidaScore: number;
    gastoScore: number;
  }>;
  modoImportacion?: string;
  columnasDetectadas?: string[];
  mapeoInferido?: Record<string, string>;
};

export type LuloMdbParseResult = {
  partidas: PartidaLuloInsert[];
  gastos: GastoObraLuloInsert[];
  meta: LuloMdbParseMetaBase;
};

/** Parser completó partidas/gastos. */
export type LuloMdbParseSuccess = LuloMdbParseResult & {
  success: true;
  fullDump?: import('@/lib/proyectos/extractLuloFull').LuloMdbFullDump;
  tablasPartidas?: string[];
  tablasGastos?: string[];
};

/** Columnas no reconocidas: el usuario debe emparejar en UI. */
export type LuloMdbParseNeedsMapping = {
  success: false;
  requireMapping: true;
  detectedColumns: string[];
  suggestedTable: string | null;
  meta: LuloMdbParseMetaBase;
  fullDump?: import('@/lib/proyectos/extractLuloFull').LuloMdbFullDump;
};

/** No hay tabla Partidas/Presupuesto: el usuario debe elegir tabla. */
export type LuloMdbParseNeedsTableSelection = {
  success: false;
  requireTableSelection: true;
  availableTables: string[];
  meta: LuloMdbParseMetaBase;
  fullDump?: import('@/lib/proyectos/extractLuloFull').LuloMdbFullDump;
};

export type LuloMdbParseOutcome =
  | LuloMdbParseSuccess
  | LuloMdbParseNeedsMapping
  | LuloMdbParseNeedsTableSelection;
