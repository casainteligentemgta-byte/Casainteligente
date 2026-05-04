/**
 * Llamadas a PostgREST sin supabase-js: lee env en runtime y acepta alias de variables.
 * Evita caer en Drizzle/DATABASE_URL cuando la app ya usa Supabase en el cliente.
 */

export type SupabasePostgrestCreds = { url: string; key: string };

/** URL del proyecto (con o sin NEXT_PUBLIC_). */
export function resolveSupabaseProjectUrl(): string | null {
  const u = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  return u ? u.replace(/\/$/, '') : null;
}

/**
 * Clave para PostgREST: prioriza service role (insert sin depender de políticas RLS),
 * luego anon (mismo rol que el navegador).
 */
export function resolveSupabasePostgrestKey(): string | null {
  const k =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    '';
  return k || null;
}

export function resolveSupabasePostgrestCreds(): SupabasePostgrestCreds | null {
  const url = resolveSupabaseProjectUrl();
  const key = resolveSupabasePostgrestKey();
  if (!url || !key) return null;
  return { url, key };
}

const jsonHeaders = (creds: SupabasePostgrestCreds) => ({
  apikey: creds.key,
  Authorization: `Bearer ${creds.key}`,
  Accept: 'application/json',
});

/** ¿Existe una fila con esa PK en tabla `public.<table>`? */
export async function restRowExistsById(
  creds: SupabasePostgrestCreds,
  table: 'ci_obras' | 'ci_proyectos',
  id: string,
): Promise<boolean> {
  const u = `${creds.url}/rest/v1/${table}?select=id&id=eq.${encodeURIComponent(id)}&limit=1`;
  const r = await fetch(u, { headers: jsonHeaders(creds) });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PostgREST ${table}: ${r.status} ${t}`);
  }
  const rows = (await r.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** Metadatos de vacante para `?need=` (validación sin Drizzle). */
export type RestRecruitmentNeedMeta =
  | { kind: 'row'; title: string; protocolActive: boolean }
  | { kind: 'not_found' }
  | { kind: 'http_error'; status: number; detail: string };

export async function restFetchRecruitmentNeedMeta(
  creds: SupabasePostgrestCreds,
  needId: string,
): Promise<RestRecruitmentNeedMeta> {
  for (const sel of ['title,protocol_active', 'title'] as const) {
    const u = `${creds.url}/rest/v1/recruitment_needs?id=eq.${encodeURIComponent(needId)}&select=${sel}&limit=1`;
    const r = await fetch(u, { headers: jsonHeaders(creds) });
    const t = await r.text();
    if (!r.ok) {
      continue;
    }
    let rows: unknown;
    try {
      rows = t.trim() ? JSON.parse(t) : [];
    } catch {
      continue;
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { kind: 'not_found' };
    }
    const row = rows[0] as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    const protocolActive =
      typeof row.protocol_active === 'boolean' ? row.protocol_active : true;
    return { kind: 'row', title: title || '(sin título)', protocolActive };
  }
  return { kind: 'http_error', status: 502, detail: 'PostgREST no devolvió la vacante (revisa select/columnas).' };
}

export type RecruitmentNeedInsert = {
  title: string;
  notes: string | null;
  protocol_active: boolean;
  cargo_codigo: string;
  cargo_nombre: string;
  cargo_nivel: number | null;
  tipo_vacante: string;
  proyecto_id: string | null;
  proyecto_modulo_id: string | null;
  alerta_presupuesto_ignorada: boolean;
  notas_autorizacion: string | null;
  /** Plazas solicitadas (1–500); por defecto 1. */
  cantidad_requerida?: number;
};

/** Texto legado `cargo_solicitado` (NOT NULL en algunas bases) a partir del tabulador actual. */
function cargoSolicitadoTexto(row: RecruitmentNeedInsert): string {
  const cod = String(row.cargo_codigo ?? '').trim();
  const nom = String(row.cargo_nombre ?? '').trim();
  if (cod && nom) return `${nom} (${cod})`;
  return nom || cod || 'Vacante';
}

/** Columna legado `nivel_tabulador` (NOT NULL en algunas bases) = nivel salarial 1–9. */
function nivelTabuladorValor(row: RecruitmentNeedInsert): number {
  if (row.cargo_nivel != null && Number.isInteger(row.cargo_nivel) && row.cargo_nivel >= 1 && row.cargo_nivel <= 9) {
    return row.cargo_nivel;
  }
  return 1;
}

/** Solo columnas presentes: PostgREST falla (PGRST204) si el JSON incluye claves que no existen en la tabla. */
function recruitmentNeedInsertPayload(row: RecruitmentNeedInsert): Record<string, unknown> {
  const p: Record<string, unknown> = {
    title: row.title,
    protocol_active: row.protocol_active,
    cargo_codigo: row.cargo_codigo,
    cargo_nombre: row.cargo_nombre,
    cargo_solicitado: cargoSolicitadoTexto(row),
    nivel_tabulador: nivelTabuladorValor(row),
    cantidad_requerida:
      typeof row.cantidad_requerida === 'number' &&
      Number.isFinite(row.cantidad_requerida) &&
      row.cantidad_requerida >= 1
        ? Math.min(500, Math.floor(row.cantidad_requerida))
        : 1,
    tipo_vacante: row.tipo_vacante,
    alerta_presupuesto_ignorada: row.alerta_presupuesto_ignorada,
  };
  if (row.cargo_nivel != null) p.cargo_nivel = row.cargo_nivel;
  if (row.notes != null && row.notes !== '') p.notes = row.notes;
  if (row.proyecto_id != null) p.proyecto_id = row.proyecto_id;
  if (row.proyecto_modulo_id != null) p.proyecto_modulo_id = row.proyecto_modulo_id;
  if (row.notas_autorizacion != null && row.notas_autorizacion !== '') {
    p.notas_autorizacion = row.notas_autorizacion;
  }
  return p;
}

/** Evita `"clave": null` en el JSON: PostgREST puede enviar NULL explícito a Postgres. */
function jsonStringifyInsertPayload(obj: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return JSON.stringify(out);
}

/** PGRST204: columna desconocida en caché / esquema remoto incompleto. */
function parsePgrst204MissingColumn(responseBody: string): string | null {
  const m = responseBody.match(/Could not find the '(\w+)' column/i);
  return m?.[1] ?? null;
}

const INSERT_PAYLOAD_PROTECTED = new Set(['title']);

function parseRecruitmentNeedResponse(t: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = t ? JSON.parse(t) : null;
  } catch {
    throw new Error(`PostgREST recruitment_needs: respuesta no JSON (${t.slice(0, 200)})`);
  }
  if (Array.isArray(data)) return (data[0] ?? {}) as Record<string, unknown>;
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  return {};
}

/**
 * Insert con reintentos ante PGRST204: quita del JSON la columna que PostgREST no reconoce
 * (hasta 24 intentos; no se elimina `title`).
 */
export async function restInsertRecruitmentNeed(
  creds: SupabasePostgrestCreds,
  row: RecruitmentNeedInsert,
): Promise<Record<string, unknown>> {
  const url = `${creds.url}/rest/v1/recruitment_needs`;
  const headers = {
    ...jsonHeaders(creds),
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  } as const;

  let payload: Record<string, unknown> = { ...recruitmentNeedInsertPayload(row) };
  let lastText = '';

  for (let attempt = 0; attempt < 24; attempt++) {
    const r = await fetch(url, { method: 'POST', headers, body: jsonStringifyInsertPayload(payload) });
    lastText = await r.text();
    if (r.ok) {
      return parseRecruitmentNeedResponse(lastText);
    }
    const missing = r.status === 400 ? parsePgrst204MissingColumn(lastText) : null;
    if (missing === 'title') {
      throw new Error(
        'La tabla public.recruitment_needs no tiene la columna title (o PostgREST no la ve). ' +
          'Ejecuta en Supabase el SQL de supabase/migrations/053_recruitment_needs_ensure_title.sql ' +
          '(o aplica desde 031 el historial completo) y recarga el esquema de la API. ' +
          `Detalle: ${lastText.slice(0, 350)}`,
      );
    }
    if (
      r.status === 400 &&
      /23502/i.test(lastText) &&
      /proyecto_id/i.test(lastText) &&
      (/not-null|null value/i.test(lastText) || /violates not-null/i.test(lastText))
    ) {
      throw new Error(
        'La columna proyecto_id sigue con NOT NULL en tu base; con vacantes solo por módulo integral debe permitir NULL. ' +
          'En Supabase → SQL Editor ejecuta el contenido de supabase/migrations/055_recruitment_needs_proyecto_id_drop_notnull.sql ' +
          '(o 054). Ejemplo: alter table public.recruitment_needs alter column proyecto_id drop not null; ' +
          "notify pgrst, 'reload schema'; — Detalle: " +
          lastText.slice(0, 400),
      );
    }
    if (
      r.status === 400 &&
      /23502/i.test(lastText) &&
      /cargo_solicitado/i.test(lastText) &&
      (/not-null|null value/i.test(lastText) || /violates not-null/i.test(lastText))
    ) {
      throw new Error(
        'La columna cargo_solicitado exige valor en tu base y el insert no la llenaba. ' +
          'La app ya envía cargo_solicitado derivado de cargo_nombre/cargo_codigo; recarga el servidor. ' +
          'Si el error sigue, ejecuta supabase/migrations/056_recruitment_needs_cargo_solicitado_nullable.sql ' +
          '(hace la columna opcional). Detalle: ' +
          lastText.slice(0, 400),
      );
    }
    if (
      r.status === 400 &&
      /23502/i.test(lastText) &&
      /nivel_tabulador/i.test(lastText) &&
      (/not-null|null value/i.test(lastText) || /violates not-null/i.test(lastText))
    ) {
      throw new Error(
        'La columna nivel_tabulador exige valor en tu base. La app ya envía nivel_tabulador (= cargo_nivel o 1); recarga el servidor. ' +
          'Si sigue fallando, ejecuta supabase/migrations/057_recruitment_needs_nivel_tabulador_nullable.sql. Detalle: ' +
          lastText.slice(0, 400),
      );
    }
    if (
      r.status === 400 &&
      /23502/i.test(lastText) &&
      /cantidad_requerida/i.test(lastText) &&
      (/not-null|null value/i.test(lastText) || /violates not-null/i.test(lastText))
    ) {
      throw new Error(
        'La columna cantidad_requerida exige valor en tu base. La app envía cantidad_requerida=1 por fila (una vacante por POST). ' +
          'Recarga el servidor. Opcional: supabase/migrations/058_recruitment_needs_cantidad_requerida_nullable.sql. Detalle: ' +
          lastText.slice(0, 400),
      );
    }
    if (missing && !INSERT_PAYLOAD_PROTECTED.has(missing) && missing in payload) {
      if (missing === 'notes' && typeof payload.title === 'string' && row.notes) {
        const t0 = payload.title as string;
        const merged =
          t0.length + row.notes.length < 480 ? `${t0} — ${row.notes}` : `${t0} — ${row.notes.slice(0, 400)}…`;
        payload = { ...payload, title: merged };
      }
      const { [missing]: _removed, ...rest } = payload;
      payload = rest;
      continue;
    }
    throw new Error(`PostgREST recruitment_needs: ${r.status} ${lastText}`);
  }

  throw new Error(`PostgREST recruitment_needs: demasiados reintentos; último error: ${lastText}`);
}
