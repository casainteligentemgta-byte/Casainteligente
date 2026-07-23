/**
 * Parsea CSV exportado desde Antigravity / CCO V4 → payload import-v4.
 * Sin columna id: genera origen_v4_id estable (SHA-256 → int) para anti-duplicados.
 */
import type { CcoV4ImportPayload, CcoV4EstructuraRow, CcoV4TransaccionRow } from '@/lib/contabilidad/cco/importarMaestroV4';
import { parseCsvMaestroRows, parseNumeroCsv } from '@/lib/contabilidad/cco/parseCsvMaestro';

function num(v: unknown): number | null {
  return parseNumeroCsv(v);
}

function fecha10(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s || null;
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** SHA-256 hex → entero 1..2e9 (Web Crypto o Node). */
async function stableOrigenId(parts: string[]): Promise<number> {
  const data = new TextEncoder().encode(parts.join('|'));
  let buf: ArrayBuffer;
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  } else {
    const { createHash } = await import('crypto');
    const dig = createHash('sha256').update(Buffer.from(data)).digest();
    buf = dig.buffer.slice(dig.byteOffset, dig.byteOffset + dig.byteLength);
  }
  const view = new DataView(buf);
  const n = view.getUint32(0, false) % 2_000_000_000;
  return n + 1;
}

function parseCsvRows(text: string): Record<string, string>[] {
  return parseCsvMaestroRows(text);
}

function pick(row: Record<string, string>, ...names: string[]): string {
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]));
  for (const n of names) {
    const k = lower.get(n.toLowerCase());
    if (k != null) return (row[k] ?? '').trim();
  }
  return '';
}

export async function parseCcoV4Csv(
  text: string,
  opts?: { proyecto_id?: string; honorarios_admin_pct?: number; obra_alias?: string },
): Promise<CcoV4ImportPayload> {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error('CSV vacío o sin filas de datos.');

  const occ = new Map<string, number>();
  const transacciones: CcoV4TransaccionRow[] = [];
  const caps = new Map<
    string,
    CcoV4EstructuraRow & { _padreNombre?: string | null }
  >();
  let capSeq = 0;

  const ensureCap = (
    nombre: string,
    tipo: 'CAPITULO' | 'SUBCAPITULO',
    padreNombre?: string | null,
  ): number | null => {
    const n = norm(nombre);
    if (!n) return null;
    const hit = caps.get(n);
    if (hit) return hit.origen_v4_id;
    let padre: number | null = null;
    if (padreNombre && tipo === 'SUBCAPITULO') {
      padre = ensureCap(padreNombre, 'CAPITULO');
    }
    capSeq += 1;
    const oid = 10_000_000 + capSeq;
    caps.set(n, {
      origen_v4_id: oid,
      nombre: nombre.trim(),
      tipo_nivel: tipo,
      padre_origen_v4_id: padre,
    });
    return oid;
  };

  for (const r of rows) {
    const clase = (pick(r, 'CLASE') || 'GASTO').toUpperCase();
    const fecha = fecha10(pick(r, 'FECHA'));
    const proveedor = pick(r, 'PROVEEDOR');
    const tipo = pick(r, 'TIPO');
    const capitulo = pick(r, 'CAPITULO');
    const subcapitulo = pick(r, 'SUBCAPITULO');
    const descripcion = pick(r, 'DESCRIPCION');
    const moneda = (pick(r, 'MONEDA') || 'USD').toUpperCase();
    const montoOrig = num(pick(r, 'MONTO ORIG', 'MONTO_ORIG'));
    const montoBase = num(pick(r, 'MONTO BASE USD', 'MONTO_BASE_USD'));
    const estado = pick(r, 'ESTADO');

    if (capitulo) ensureCap(capitulo, 'CAPITULO');
    if (subcapitulo) ensureCap(subcapitulo, 'SUBCAPITULO', capitulo || null);

    const fingerprint = [
      clase,
      fecha || '',
      norm(proveedor),
      norm(tipo),
      norm(capitulo),
      norm(subcapitulo),
      norm(descripcion),
      moneda,
      (montoBase ?? 0).toFixed(4),
      (montoOrig ?? 0).toFixed(4),
      norm(estado),
    ].join('|');
    const nOcc = occ.get(fingerprint) ?? 0;
    occ.set(fingerprint, nOcc + 1);
    const origen_v4_id = await stableOrigenId([fingerprint, String(nOcc)]);

    transacciones.push({
      origen_v4_id,
      clase,
      fecha,
      proveedor: proveedor || null,
      tipo: tipo || null,
      capitulo: capitulo || null,
      subcapitulo: subcapitulo || null,
      descripcion: descripcion || null,
      moneda,
      tasa: num(pick(r, 'TASA')),
      monto_orig: montoOrig,
      monto_base_usd: montoBase,
      monto_pagado: num(pick(r, 'MONTO PAGADO', 'MONTO_PAGADO')),
      forma_pago: pick(r, 'FORMA PAGO', 'FORMA_PAGO') || null,
      estado: estado || null,
      honorarios: num(pick(r, 'HONORARIOS')),
      costo_total: num(pick(r, 'COSTO TOTAL', 'COSTO_TOTAL')),
      porcentaje_admin: num(pick(r, '% ADMIN', 'PORCENTAJE_ADMIN', 'ADMIN')),
      tasa_binance: num(pick(r, 'TASA BINANCE', 'TASA_BINANCE')),
      tasa_usada: pick(r, 'TASA USADA', 'TASA_USADA') || null,
      porcentaje_brecha_real: num(pick(r, '% BRECHA REAL', 'PORCENTAJE_BRECHA_REAL')),
      contrato_vinculado: pick(r, 'CONTRATO_VINCULADO') || null,
    });
  }

  const estructura = Array.from(caps.values()).sort((a, b) => {
    if (a.tipo_nivel === b.tipo_nivel) return a.origen_v4_id - b.origen_v4_id;
    return a.tipo_nivel === 'CAPITULO' ? -1 : 1;
  });

  return {
    proyecto_id: opts?.proyecto_id || '',
    honorarios_admin_pct: opts?.honorarios_admin_pct ?? 15,
    devaluacion_pct: 0,
    obra_alias: opts?.obra_alias ?? 'RANCHO FLAMBOYANT',
    auto_vincular: true,
    estructura,
    transacciones,
  };
}
