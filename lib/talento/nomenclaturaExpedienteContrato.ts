/**
 * Nomenclatura de expediente en contratos individuales de trabajo:
 * AÑO-MES-ENTIDAD-OBRA-Número (sin prefijo EXPRESS).
 * Ej.: 2026-08-DIMA-ASFJG-0001
 *
 * ENTIDAD = abreviatura derivada del nombre de la entidad contratante.
 * OBRA = `ci_proyectos.codigo_nomenclatura` (preferido), luego `obra_codigo`, luego abreviatura del nombre.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PartesExpedienteContrato = {
  anio: number;
  mes: number;
  entidadCodigo: string;
  obraCodigo: string;
  numero: number;
};

/** Códigos genéricos que no deben aparecer en expedientes reales. */
const PLACEHOLDER_ENTIDAD = new Set(['ENT', 'ENTE', 'XXX']);
const PLACEHOLDER_OBRA = new Set(['OBRA', 'XXX']);

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

/** Sanea un código ya corto (p. ej. `obra_codigo`) sin inventar placeholders. */
export function sanearCodigoExpediente(codigo: string | null | undefined, maxLen: number): string {
  const c = String(codigo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLen);
  return c || 'XXX';
}

export function formatearExpedienteContrato(p: PartesExpedienteContrato): string {
  const anio = Math.trunc(p.anio);
  const mes = String(Math.max(1, Math.min(12, Math.trunc(p.mes)))).padStart(2, '0');
  const ent = sanearCodigoExpediente(p.entidadCodigo, 8);
  const obra = sanearCodigoExpediente(p.obraCodigo, 12);
  const num = String(Math.max(1, Math.trunc(p.numero))).padStart(4, '0');
  return `${anio}-${mes}-${ent}-${obra}-${num}`;
}

/** Parsea `2026-08-DIMA-ASFALT-0001` (obra puede tener varios segmentos). */
export function parsearExpedienteContrato(label: string | null | undefined): PartesExpedienteContrato | null {
  const t = String(label ?? '').trim();
  if (!t || /^EXPRESS-/i.test(t)) return null;
  const parts = t.split('-').filter(Boolean);
  if (parts.length < 5) return null;
  const anio = Number(parts[0]);
  const mes = Number(parts[1]);
  const numero = Number(parts[parts.length - 1]);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  if (!Number.isFinite(numero) || numero < 1) return null;
  const entidadCodigo = parts[2] ?? '';
  const obraCodigo = parts.slice(3, -1).join('') || parts[3] || '';
  if (!entidadCodigo || !obraCodigo) return null;
  return { anio, mes, entidadCodigo, obraCodigo, numero };
}

/** True si el label usa los fallbacks genéricos ENT/ENTE + OBRA (o XXX). */
export function esExpedientePlaceholder(label: string | null | undefined): boolean {
  const p = parsearExpedienteContrato(label);
  if (!p) return !String(label ?? '').trim() || /^EXPRESS-/i.test(String(label ?? ''));
  const ent = sanearCodigoExpediente(p.entidadCodigo, 8);
  const obra = sanearCodigoExpediente(p.obraCodigo, 12);
  return PLACEHOLDER_ENTIDAD.has(ent) || PLACEHOLDER_OBRA.has(obra);
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
): Promise<{ entidadNombre: string; obraCodigoFuente: string; entidadId: string | null }> {
  const proyectoId = opts.proyectoId.trim();
  let entidadId = (opts.entidadId ?? '').trim() || null;
  let obraCodigoFuente = '';
  let entidadNombre = '';

  if (proyectoId) {
    const selects = [
      'nombre,codigo_nomenclatura,obra_codigo,entidad_id',
      'nombre,obra_codigo,entidad_id',
      'nombre,entidad_id',
    ];
    for (const sel of selects) {
      const { data: proy, error } = await admin.from('ci_proyectos').select(sel).eq('id', proyectoId).maybeSingle();
      if (error) {
        if (/column|42703|schema cache/i.test(error.message)) continue;
        console.warn('[resolverNombresExpediente] proyecto', error.message);
        break;
      }
      const p = proy as {
        nombre?: string | null;
        codigo_nomenclatura?: string | null;
        obra_codigo?: string | null;
        entidad_id?: string | null;
      } | null;
      const codigoNom = (p?.codigo_nomenclatura ?? '').trim();
      const codigoObra = (p?.obra_codigo ?? '').trim();
      const nombreObra = (p?.nombre ?? '').trim();
      // Preferir código de nomenclatura del proyecto (ej. ASFJG).
      obraCodigoFuente = codigoNom || codigoObra || nombreObra;
      if (!entidadId) entidadId = (p?.entidad_id ?? '').trim() || null;
      break;
    }
  }

  if (entidadId) {
    entidadNombre = await cargarNombreEntidad(admin, entidadId);
  }

  return { entidadNombre, obraCodigoFuente, entidadId };
}

async function cargarNombreEntidad(admin: SupabaseClient, entidadId: string): Promise<string> {
  const selects = [
    'nombre,nombre_comercial,nombre_legal',
    'nombre,nombre_comercial',
    'nombre,nombre_legal',
    'nombre',
  ];
  for (const sel of selects) {
    const { data, error } = await admin.from('ci_entidades').select(sel).eq('id', entidadId).maybeSingle();
    if (error) {
      if (/column|42703|schema cache/i.test(error.message)) continue;
      console.warn('[cargarNombreEntidad]', error.message);
      return '';
    }
    const e = data as {
      nombre?: string | null;
      nombre_comercial?: string | null;
      nombre_legal?: string | null;
    } | null;
    const n =
      (e?.nombre ?? '').trim() ||
      (e?.nombre_comercial ?? '').trim() ||
      (e?.nombre_legal ?? '').trim();
    if (n) return n;
  }
  return '';
}

/**
 * Código de entidad: abreviatura del nombre (DIMA, CASA, …).
 * Código de obra: `codigo_nomenclatura` / `obra_codigo` saneado; si es nombre largo, se abrevia.
 */
export function codigosDesdeNombresExpediente(opts: {
  entidadNombre: string;
  obraCodigoFuente: string;
}): { entidadCodigo: string; obraCodigo: string } {
  const entidadCodigo = codigoCortoDesdeNombre(opts.entidadNombre, 6);
  const fuente = opts.obraCodigoFuente.trim();
  let obraCodigo: string;
  if (!fuente) {
    obraCodigo = 'XXX';
  } else if (/^[A-Za-z0-9._-]{1,16}$/.test(fuente) && !/\s/.test(fuente)) {
    // Código de nomenclatura / obra almacenado (ej. ASFJG).
    obraCodigo = sanearCodigoExpediente(fuente, 12);
  } else {
    obraCodigo = codigoCortoDesdeNombre(fuente, 8);
  }
  return { entidadCodigo, obraCodigo };
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
  // Preferir fecha_ingreso; si la columna no existe, created_at.
  const { data, error } = await admin
    .from('ci_contratos_express')
    .select('id,fecha_ingreso,created_at')
    .eq('proyecto_id', proyectoId)
    .limit(500);

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
  /** Si ya hay label persistido, se reutiliza (salvo placeholders ENTE/OBRA). */
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
  if (existente && !/^EXPRESS-/i.test(existente) && !esExpedientePlaceholder(existente)) {
    return existente;
  }

  const parsedBad = esExpedientePlaceholder(existente) ? parsearExpedienteContrato(existente) : null;
  const fecha = partesFechaIso(opts.fechaIso);
  const anio = String(opts.fechaIso ?? '').trim() ? fecha.anio : (parsedBad?.anio ?? fecha.anio);
  const mes = String(opts.fechaIso ?? '').trim() ? fecha.mes : (parsedBad?.mes ?? fecha.mes);

  const nombres = await resolverNombresExpediente(admin, {
    proyectoId: opts.proyectoId,
    entidadId: opts.entidadId,
  });
  const { entidadCodigo, obraCodigo } = codigosDesdeNombresExpediente({
    entidadNombre: nombres.entidadNombre,
    obraCodigoFuente: nombres.obraCodigoFuente,
  });

  // Si regeneramos un placeholder, conservar el correlativo ya impreso (p. ej. 0018).
  const numero =
    parsedBad?.numero && parsedBad.numero >= 1
      ? parsedBad.numero
      : await correlativoExpressEnObraMes(admin, opts.proyectoId, anio, mes, opts.expressId);

  return formatearExpedienteContrato({
    anio,
    mes,
    entidadCodigo,
    obraCodigo,
    numero,
  });
}
