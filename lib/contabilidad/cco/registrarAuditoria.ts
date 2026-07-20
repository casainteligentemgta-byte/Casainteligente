import type { SupabaseClient } from '@supabase/supabase-js';

export type CcoAuditoriaInsert = {
  proyecto_id?: string | null;
  accion: string;
  detalle?: string | null;
  actor?: string | null;
  metadata?: Record<string, unknown>;
  origen_v4_id?: number | null;
  fecha?: string | null;
};

/** Resuelve el usuario de la sesión (email o nombre) para auditoría CCO. */
export async function resolverActorCco(fallback = 'sistema'): Promise<string> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fallback;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const nombre =
      String(meta.full_name ?? meta.name ?? meta.nombre ?? '')
        .trim() || null;
    const email = user.email?.trim() || null;
    if (nombre && email) return `${nombre} <${email}>`;
    return nombre || email || user.id.slice(0, 8);
  } catch {
    return fallback;
  }
}

/** Inserta un evento de auditoría con actor (si no viene) y detalle acotado. */
export async function registrarEventoAuditoriaCco(
  supabase: SupabaseClient,
  input: CcoAuditoriaInsert,
): Promise<void> {
  const actor =
    (input.actor && String(input.actor).trim()) ||
    (await resolverActorCco('cco'));
  const row: Record<string, unknown> = {
    proyecto_id: input.proyecto_id?.trim() || null,
    accion: String(input.accion ?? '').trim().slice(0, 200) || 'ACCION CCO',
    detalle: input.detalle ? String(input.detalle).slice(0, 4000) : null,
    actor: actor.slice(0, 200),
    metadata: input.metadata ?? {},
  };
  if (input.origen_v4_id != null) row.origen_v4_id = input.origen_v4_id;
  if (input.fecha) row.fecha = input.fecha;

  const { error } = await supabase.from('cco_auditoria_eventos').insert(row);
  if (error) {
    console.error('[cco_auditoria]', error.message);
  }
}

function fmtMoney(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n ?? '—');
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function cambioTexto(campo: string, antes: unknown, despues: unknown): string | null {
  const a = String(antes ?? '').trim();
  const b = String(despues ?? '').trim();
  if (!b && despues === undefined) return null;
  if (a === b) return null;
  if (!a && b) return `${campo}: «${b}»`;
  if (a && !b) return `${campo}: «${a}» → (vacío)`;
  return `${campo}: «${a}» → «${b}»`;
}

export type ResumenCambioFila = {
  id: string;
  etiqueta?: string;
  cambios: string[];
};

/** Arma un detalle puntual a partir de resúmenes por fila. */
export function construirDetalleCambios(params: {
  verbo: string;
  filas: ResumenCambioFila[];
  eliminadas?: number;
  maxFilas?: number;
}): string {
  const max = params.maxFilas ?? 5;
  const partes: string[] = [];
  const n = params.filas.length;
  if (n > 0) {
    partes.push(`${params.verbo} ${n} fila${n === 1 ? '' : 's'}`);
    const muestras = params.filas.slice(0, max).map((f) => {
      const quien = f.etiqueta ? ` [${f.etiqueta}]` : '';
      const ch = f.cambios.length ? f.cambios.join('; ') : 'sin cambios de campo';
      return `·${quien} ${ch}`.trim();
    });
    partes.push(muestras.join(' | '));
    if (n > max) partes.push(`(+${n - max} más)`);
  }
  if (params.eliminadas && params.eliminadas > 0) {
    partes.push(`Eliminó ${params.eliminadas}`);
  }
  return partes.filter(Boolean).join('. ') || params.verbo;
}

/**
 * Diff de un PATCH de egreso (compra) vs fila previa.
 * Solo incluye campos enviados en el cambio.
 */
export function resumirCambioEgreso(
  prev: Record<string, unknown>,
  c: {
    fecha?: string;
    proveedor?: string;
    descripcion?: string;
    moneda?: string;
    tasa?: number;
    monto_orig?: number;
    admin_pct?: number | null;
    tipo?: string;
    capitulo?: string;
    subcapitulo?: string;
    estado?: string;
    forma_pago?: string | null;
  },
): string[] {
  const out: string[] = [];
  if (c.fecha != null) {
    const ch = cambioTexto('fecha', String(prev.fecha ?? '').slice(0, 10), String(c.fecha).slice(0, 10));
    if (ch) out.push(ch);
  }
  if (c.proveedor != null) {
    const ch = cambioTexto('proveedor', prev.supplier_name, c.proveedor);
    if (ch) out.push(ch);
  }
  if (c.descripcion != null) {
    const ch = cambioTexto('descripción', prev.notas, c.descripcion);
    if (ch) out.push(ch);
  }
  if (c.capitulo != null) {
    const ch = cambioTexto('capítulo', prev.capitulo_cco, c.capitulo);
    if (ch) out.push(ch);
  }
  if (c.subcapitulo != null) {
    const ch = cambioTexto('subcapítulo', prev.subcapitulo_cco, c.subcapitulo);
    if (ch) out.push(ch);
  }
  if (c.tipo != null) {
    const ch = cambioTexto('tipo', prev.tipo_gasto_cco, c.tipo);
    if (ch) out.push(ch);
  }
  if (c.estado != null) {
    const ch = cambioTexto('estado', prev.cco_estado, c.estado);
    if (ch) out.push(ch);
  }
  if (c.forma_pago !== undefined) {
    const ch = cambioTexto('forma pago', prev.forma_pago_cco, c.forma_pago);
    if (ch) out.push(ch);
  }
  if (c.moneda != null) {
    const ch = cambioTexto('moneda', prev.moneda_original, c.moneda);
    if (ch) out.push(ch);
  }
  if (c.monto_orig != null && Number.isFinite(Number(c.monto_orig))) {
    const prevMoneda = String(prev.moneda_original ?? 'USD').toUpperCase();
    const prevMonto =
      prevMoneda.startsWith('VE') ? prev.monto_ves : prev.monto_usd;
    if (Number(prevMonto) !== Number(c.monto_orig)) {
      out.push(`monto: ${fmtMoney(prevMonto)} → ${fmtMoney(c.monto_orig)}`);
    }
  }
  if (c.tasa != null && Number.isFinite(Number(c.tasa))) {
    if (Number(prev.tasa_bcv_ves_por_usd) !== Number(c.tasa)) {
      out.push(`tasa: ${prev.tasa_bcv_ves_por_usd ?? '—'} → ${c.tasa}`);
    }
  }
  if (c.admin_pct !== undefined) {
    const prevPct = prev.admin_pct_override;
    if (String(prevPct ?? '') !== String(c.admin_pct ?? '')) {
      out.push(`% admin: ${prevPct ?? '—'} → ${c.admin_pct ?? '—'}`);
    }
  }
  return out;
}
