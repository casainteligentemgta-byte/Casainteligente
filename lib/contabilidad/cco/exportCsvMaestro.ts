/**
 * Exportación CSV maestro 25 columnas — compatible Streamlit V4.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CSV_MAESTRO_COLUMNS,
  normalizarClaseExport,
} from '@/lib/contabilidad/cco/csvMaestroColumns';
import { getGastosCCO } from '@/lib/contabilidad/cco/registrosGastos';
import type { GastoRegistro } from '@/types/gastos';

/** Fecha CSV Streamlit: YYYY-MM-DD HH:MM:SS.ffffff */
export function formatFechaCsvExport(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const raw = String(fecha).trim();
  if (!raw) return '';

  // Ya viene en formato CSV
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) {
    const base = raw.slice(0, 19);
    const frac = raw.match(/\.(\d+)/);
    const micro = (frac?.[1] ?? '000000').padEnd(6, '0').slice(0, 6);
    return `${base}.${micro}`;
  }

  // ISO / timestamptz
  const m = raw.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/,
  );
  if (m) {
    const micro = (m[5] ?? '000000').padEnd(6, '0').slice(0, 6);
    return `${m[1]} ${m[2]}:${m[3]}:${m[4]}.${micro}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) {
    return `${raw.slice(0, 10)} 00:00:00.000000`;
  }

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    const micro = String(d.getUTCMilliseconds()).padStart(3, '0') + '000';
    return `${y}-${mo}-${day} ${h}:${mi}:${s}.${micro}`;
  }

  return '';
}

function numCsv(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '0.0';
  const n = Number(v);
  // Sin separador de miles; punto decimal; evita notación científica en rangos normales.
  if (Number.isInteger(n)) return `${n}.0`;
  const s = String(n);
  return s.includes('e') || s.includes('E') ? n.toFixed(10).replace(/\.?0+$/, '') : s;
}

function textCsv(v: string | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (s === 'null' || s === 'None' || /^nan$/i.test(s)) return '';
  return s;
}

/** Escapa celda CSV (coma / comillas / salto de línea). */
export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function gastoRegistroToCsvCells(r: GastoRegistro): string[] {
  const clase = normalizarClaseExport(r.clase);
  return [
    clase,
    formatFechaCsvExport(r.fecha),
    textCsv(r.proveedor),
    textCsv(r.tipo),
    textCsv(r.capitulo),
    textCsv(r.subcapitulo),
    textCsv(r.descripcion),
    textCsv(r.contrato_vinculado),
    textCsv(r.moneda) || 'USD',
    numCsv(r.tasa ?? (String(r.moneda ?? 'USD').toUpperCase() === 'USD' ? 1 : null)),
    numCsv(r.monto_orig),
    numCsv(r.monto_base_usd),
    numCsv(r.monto_pagado),
    textCsv(r.forma_pago),
    textCsv(r.link_factura),
    textCsv(r.link_comprobante),
    textCsv(r.estado) || 'PAGADO',
    numCsv(r.honorarios),
    numCsv(r.costo_total),
    numCsv(r.porcentaje_admin),
    numCsv(r.tasa_binance),
    textCsv(r.tasa_usada),
    numCsv(r.porcentaje_brecha_real),
    numCsv(r.pool_asignado),
    numCsv(r.avance_fisico),
  ];
}

/** Orden de exportación: GASTO → INGRESO → CONTRATO → AUDITORIA → PRESUPUESTO_METADATA, luego fecha. */
function ordenClaseExport(clase: string | null): number {
  const c = normalizarClaseExport(clase);
  switch (c) {
    case 'GASTO':
      return 1;
    case 'INGRESO':
      return 2;
    case 'CONTRATO':
      return 3;
    case 'AUDITORIA':
      return 4;
    case 'PRESUPUESTO_METADATA':
      return 5;
    default:
      return 9;
  }
}

export function buildCsvMaestro(rows: GastoRegistro[]): string {
  const sorted = [...rows].sort((a, b) => {
    const oc = ordenClaseExport(a.clase) - ordenClaseExport(b.clase);
    if (oc !== 0) return oc;
    const fa = String(a.fecha ?? '');
    const fb = String(b.fecha ?? '');
    if (fa !== fb) return fa.localeCompare(fb);
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });

  const header = CSV_MAESTRO_COLUMNS.join(',');
  const lines = sorted.map((r) =>
    gastoRegistroToCsvCells(r).map(escapeCsvCell).join(','),
  );
  // UTF-8 sin BOM
  return [header, ...lines].join('\n') + (lines.length ? '\n' : '');
}

export type ExportCsvMaestroResult = {
  csv: string;
  count: number;
  proyectoId: string;
};

/**
 * Exporta el libro de una obra en formato CSV Streamlit (25 columnas).
 * No incluye id UUID/bigint de Supabase.
 */
export async function exportCsvMaestro(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<ExportCsvMaestroResult> {
  const pid = String(proyectoId || '').trim();
  if (!pid) throw new Error('proyecto_id requerido para exportar CSV.');

  const { rows } = await getGastosCCO(supabase, {
    proyectoId: pid,
    limit: 50_000,
  });

  return {
    csv: buildCsvMaestro(rows),
    count: rows.length,
    proyectoId: pid,
  };
}
