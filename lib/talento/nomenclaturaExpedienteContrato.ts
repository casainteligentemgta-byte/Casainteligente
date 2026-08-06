/**
 * Nomenclatura de expediente en contratos individuales de trabajo:
 * AÑO-MES-ENTIDAD-OBRA-Número (sin prefijo EXPRESS).
 * Ej.: 2026-08-DIMA-ASFALT-0001
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PartesExpedienteContrato = {
  anio: number;
  mes: number;
  entidadCodigo: string;
  obraCodigo: string;
  numero: number;
};

/** Código corto estable a partir de un nombre (entidad u obra). */
export function codigoCortoDesdeNombre(nombre: string | null | undefined, maxLen = 6): string {
  const raw = String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return 'XXX';

  if (/CASA\s+INTELIGENTE/.test(raw) || /^CASA\b/.test(raw)) return 'CASA';
  if (/DIMAQUINA/.test(raw)) return 'DIMA';
  if (/PROCODIMA/.test(raw)) return 'PROCO';

  const stop = new Set(['CA', 'SA', 'SRL', 'RL', 'CS', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'E', 'EN', 'A']);
  const words = raw.split(' ').filter((w) => w.length > 0 && !stop.has(w));
  if (words.length === 0) return 'XXX';

  const first = words[0]!;
  if (first.length >= 4) return first.slice(0, maxLen);

  const initials = words.map((w) => w[0]!).join('');
  if (initials.length >= 3) return initials.slice(0, maxLen);
  return (first + initials).slice(0, maxLen) || 'XXX';
}

export function formatearExpedienteContrato(p: PartesExpedienteContrato): string {
  const anio = Math.trunc(p.anio);
  const mes = String(Math.max(1, Math.min(12, Math.trunc(p.mes)))).padStart(2, '0');
  const ent = (p.entidadCodigo || 'ENT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'ENT';
  const obra = (p.obraCodigo || 'OBRA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'OBRA';
  const num = String(Math.max(1, Math.trunc(p.numero))).padStart(4, '0');
  return `${anio}-${mes}-${ent}-${obra}-${num}`;
}

function partesFechaIso(iso: string | null | undefined): { anio: number; mes: number } {
  const t = String(iso ?? '').trim();
  if (/^\d{4}-\d{2}/.test(t)) {
    const anio = Number(t.slice(0, 4));
    const mes = Number(t.slice(5, 7));
    if (Number.isFinite(anio) && Number.isFinite(mes) && mes >= 1 && mes <= 12) {
      return { anio, mes };
    }
  }
  const d = new Date();
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

async function resolverNombresExpediente(
  admin: SupabaseClient,
  opts: { proyectoId: string; entidadId?: string | null },
): Promise<{ entidadNombre: string; obraNombre: string; entidadId: string | null }> {
  const proyectoId = opts.proyectoId.trim();
  let entidadId = (opts.entidadId ?? '').trim() || null;
  let obraNombre = '';
  let entidadNombre = '';

  if (proyectoId) {
    const { data: proy } = await admin
      .from('ci_proyectos')
      .select('nombre,obra_codigo,entidad_id')
      .eq('id', proyectoId)
      .maybeSingle();
    const p = proy as {
      nombre?: string | null;
      obra_codigo?: string | null;
      entidad_id?: string | null;
    } | null;
    obraNombre = (p?.obra_codigo ?? '').trim() || (p?.nombre ?? '').trim();
    if (!entidadId) entidadId = (p?.entidad_id ?? '').trim() || null;
  }

  if (entidadId) {
    const { data: ent } = await admin
      .from('ci_entidades')
      .select('nombre,nombre_legal')
      .eq('id', entidadId)
      .maybeSingle();
    const e = ent as { nombre?: string | null; nombre_legal?: string | null } | null;
    entidadNombre = (e?.nombre ?? '').trim() || (e?.nombre_legal ?? '').trim();
  }

  return { entidadNombre, obraNombre, entidadId };
}

/**
 * Cuenta contratos express de la obra en el mismo año-mes (para el correlativo).
 * Si `excludeId` se pasa, no se cuenta esa fila (útil al regenerar).
 */
async function correlativoExpressEnObraMes(
  admin: SupabaseClient,
  proyectoId: string,
  anio: number,
  mes: number,
  excludeId?: string | null,
): Promise<number> {
  const mesStr = String(mes).padStart(2, '0');
  const desde = `${anio}-${mesStr}-01`;
  const hastaMes = mes === 12 ? 1 : mes + 1;
  const hastaAnio = mes === 12 ? anio + 1 : anio;
  const hasta = `${hastaAnio}-${String(hastaMes).padStart(2, '0')}-01`;

  // Preferir fecha_ingreso; si la columna no existe, created_at.
  let q = admin
    .from('ci_contratos_express')
    .select('id,fecha_ingreso,created_at')
    .eq('proyecto_id', proyectoId)
    .limit(500);

  const { data, error } = await q;
  if (error && /fecha_ingreso|42703|column|schema cache/i.test(error.message)) {
    const bare = await admin
      .from('ci_contratos_express')
      .select('id,created_at')
      .eq('proyecto_id', proyectoId)
      .limit(500);
    return contarEnRango(bare.data ?? [], anio, mes, excludeId, true);
  }
  if (error) {
    console.warn('[correlativoExpressEnObraMes]', error.message);
    return 1;
  }
  void desde;
  void hasta;
  return contarEnRango(data ?? [], anio, mes, excludeId, false);
}

function contarEnRango(
  rows: unknown[],
  anio: number,
  mes: number,
  excludeId: string | null | undefined,
  soloCreatedAt: boolean,
): number {
  const excl = (excludeId ?? '').trim();
  let n = 0;
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as { id?: string; fecha_ingreso?: string | null; created_at?: string | null };
    if (excl && String(r.id ?? '') === excl) continue;
    const iso = soloCreatedAt
      ? String(r.created_at ?? '')
      : String(r.fecha_ingreso ?? r.created_at ?? '');
    const p = partesFechaIso(iso.includes('T') ? iso.slice(0, 10) : iso);
    if (p.anio === anio && p.mes === mes) n += 1;
  }
  return n + 1;
}

export type ConstruirExpedienteExpressOpts = {
  proyectoId: string;
  entidadId?: string | null;
  /** Fecha de ingreso / firma YYYY-MM-DD. */
  fechaIso?: string | null;
  /** Al regenerar: id del contrato para no duplicar correlativo y reusar label guardado. */
  expressId?: string | null;
  /** Si ya hay label persistido, se reutiliza. */
  expedienteLabelExistente?: string | null;
};

/**
 * Construye el expediente para contrato express / individual:
 * AÑO-MES-ENTIDAD-OBRA-Número (sin EXPRESS-).
 */
export async function construirExpedienteContratoExpress(
  admin: SupabaseClient,
  opts: ConstruirExpedienteExpressOpts,
): Promise<string> {
  const existente = String(opts.expedienteLabelExistente ?? '').trim();
  if (existente && !/^EXPRESS-/i.test(existente)) return existente;

  const { anio, mes } = partesFechaIso(opts.fechaIso);
  const nombres = await resolverNombresExpediente(admin, {
    proyectoId: opts.proyectoId,
    entidadId: opts.entidadId,
  });
  const entidadCodigo = codigoCortoDesdeNombre(nombres.entidadNombre || 'ENT', 6);
  const obraCodigo = codigoCortoDesdeNombre(nombres.obraNombre || 'OBRA', 8);
  const numero = await correlativoExpressEnObraMes(
    admin,
    opts.proyectoId,
    anio,
    mes,
    opts.expressId,
  );

  return formatearExpedienteContrato({
    anio,
    mes,
    entidadCodigo,
    obraCodigo,
    numero,
  });
}
