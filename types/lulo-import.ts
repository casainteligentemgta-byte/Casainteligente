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

export type LuloMdbParseResult = {
  partidas: PartidaLuloInsert[];
  gastos: GastoObraLuloInsert[];
  meta: {
    tableNames: string[];
    partidasTable: string | null;
    gastosTable: string | null;
    presupuestoTotalUsd: number;
    filasOmitidas: number;
    tablasPartidas?: string[];
    tablasGastos?: string[];
  };
};

export type LuloSnapshotResumen = {
  partidas: number;
  gastos: number;
  presupuestoTotalUsd: number;
  tablas?: number;
  filasTotales?: number;
  formato: 'mdb' | 'csv';
};
