import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';

export const CCO_SNAPSHOT_VERSION = 1 as const;
export const CCO_SNAPSHOT_MOTIVOS = [
  'manual',
  'diario',
  'pre_restore',
  'pre_import',
  'pre_edit',
] as const;

export type CcoSnapshotMotivo = (typeof CCO_SNAPSHOT_MOTIVOS)[number];

export type CcoSnapshotPayload = {
  version: typeof CCO_SNAPSHOT_VERSION;
  proyecto_id: string;
  capturado_at: string;
  config: Record<string, unknown> | null;
  estructura: Record<string, unknown>[];
  contratos: Record<string, unknown>[];
  presupuestos: Record<string, unknown>[];
  ingresos: Record<string, unknown>[];
  gastos: Record<string, unknown>[];
  lineas: Record<string, unknown>[];
};

export type CcoSnapshotMeta = {
  id: string;
  proyecto_id: string;
  label: string | null;
  motivo: CcoSnapshotMotivo;
  punto_en_tiempo: string;
  creado_por: string | null;
  resumen: Record<string, unknown>;
  bytes_aprox: number;
  created_at: string;
};

export type CcoSnapshotCreateResult = {
  ok: true;
  snapshot: CcoSnapshotMeta;
} | {
  ok: false;
  error: string;
};

export type CcoRestoreResult = {
  ok: boolean;
  pre_snapshot_id?: string;
  restaurado?: {
    config: boolean;
    estructura: number;
    contratos: number;
    presupuestos: number;
    ingresos: number;
    gastos_upsert: number;
    gastos_insert: number;
    lineas: number;
    gastos_eliminados: number;
    gastos_protegidos: number;
  };
  avisos?: string[];
  error?: string;
};

const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
const KEEP_PER_PROYECTO = 40;

function stripInternal(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  return out;
}

async function resolverActor(fallback = 'sistema'): Promise<string> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fallback;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const nombre = String(meta.full_name ?? meta.name ?? meta.nombre ?? '').trim();
    const email = user.email?.trim() || null;
    if (nombre && email) return `${nombre} <${email}>`;
    return nombre || email || user.id.slice(0, 8);
  } catch {
    return fallback;
  }
}

async function fetchAllObraGastos(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .order('fecha', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function fetchLineas(
  supabase: SupabaseClient,
  compraIds: string[],
): Promise<Record<string, unknown>[]> {
  if (!compraIds.length) return [];
  const out: Record<string, unknown>[] = [];
  const chunk = 200;
  for (let i = 0; i < compraIds.length; i += chunk) {
    const ids = compraIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('contabilidad_compra_lineas')
      .select('*')
      .in('compra_id', ids);
    if (error) throw error;
    out.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return out;
}

export async function capturarPayloadSnapshot(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoSnapshotPayload> {
  const [
    { data: config, error: cfgErr },
    { data: estructura, error: estErr },
    { data: contratos, error: conErr },
    { data: presupuestos, error: preErr },
    { data: ingresos, error: ingErr },
  ] = await Promise.all([
    supabase.from('cco_proyecto_config').select('*').eq('proyecto_id', proyectoId).maybeSingle(),
    supabase.from('cco_estructura_costos').select('*').eq('proyecto_id', proyectoId),
    supabase.from('cco_contratos_obra').select('*').eq('proyecto_id', proyectoId),
    supabase.from('cco_presupuestos_capitulo').select('*').eq('proyecto_id', proyectoId),
    supabase.from('ci_inyecciones_capital').select('*').eq('proyecto_id', proyectoId),
  ]);

  if (cfgErr && !/schema cache|42P01/i.test(cfgErr.message)) throw cfgErr;
  if (estErr && !/schema cache|42P01/i.test(estErr.message)) throw estErr;
  if (conErr && !/schema cache|42P01/i.test(conErr.message)) throw conErr;
  if (preErr && !/schema cache|42P01/i.test(preErr.message)) throw preErr;
  if (ingErr && !/schema cache|42P01/i.test(ingErr.message)) throw ingErr;

  const gastos = await fetchAllObraGastos(supabase, proyectoId);
  const lineas = await fetchLineas(
    supabase,
    gastos.map((g) => String(g.id)),
  );

  return {
    version: CCO_SNAPSHOT_VERSION,
    proyecto_id: proyectoId,
    capturado_at: new Date().toISOString(),
    config: config ? stripInternal(config as Record<string, unknown>) : null,
    estructura: ((estructura ?? []) as Record<string, unknown>[]).map(stripInternal),
    contratos: ((contratos ?? []) as Record<string, unknown>[]).map(stripInternal),
    presupuestos: ((presupuestos ?? []) as Record<string, unknown>[]).map(stripInternal),
    ingresos: ((ingresos ?? []) as Record<string, unknown>[]).map(stripInternal),
    gastos: gastos.map(stripInternal),
    lineas: lineas.map(stripInternal),
  };
}

function resumenFromPayload(payload: CcoSnapshotPayload): Record<string, unknown> {
  return {
    version: payload.version,
    config: payload.config ? 1 : 0,
    estructura: payload.estructura.length,
    contratos: payload.contratos.length,
    presupuestos: payload.presupuestos.length,
    ingresos: payload.ingresos.length,
    gastos: payload.gastos.length,
    lineas: payload.lineas.length,
  };
}

async function pruneSnapshots(supabase: SupabaseClient, proyectoId: string): Promise<void> {
  const { data } = await supabase
    .from('cco_snapshots')
    .select('id')
    .eq('proyecto_id', proyectoId)
    .order('punto_en_tiempo', { ascending: false })
    .range(KEEP_PER_PROYECTO, KEEP_PER_PROYECTO + 200);
  const ids = (data ?? []).map((r) => String((r as { id: string }).id));
  if (!ids.length) return;
  await supabase.from('cco_snapshots').delete().in('id', ids);
}

export async function crearSnapshotCco(
  supabase: SupabaseClient,
  opts: {
    proyectoId: string;
    motivo?: CcoSnapshotMotivo;
    label?: string | null;
    actor?: string | null;
  },
): Promise<CcoSnapshotCreateResult> {
  try {
    const payload = await capturarPayloadSnapshot(supabase, opts.proyectoId);
    const json = JSON.stringify(payload);
    const bytes = Buffer.byteLength(json, 'utf8');
    if (bytes > MAX_PAYLOAD_BYTES) {
      return {
        ok: false,
        error: `Snapshot demasiado grande (${Math.round(bytes / 1024 / 1024)} MB). Reduce datos de la obra o contacta soporte.`,
      };
    }

    const actor = opts.actor ?? (await resolverActor('cco_snapshots'));
    const motivo = opts.motivo ?? 'manual';
    const label =
      opts.label?.trim() ||
      (motivo === 'diario'
        ? `Cierre ${new Date().toISOString().slice(0, 10)}`
        : motivo === 'pre_restore'
          ? 'Auto · antes de restaurar'
          : motivo === 'pre_import'
            ? 'Auto · antes de importar'
            : `Manual ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);

    const resumen = resumenFromPayload(payload);
    const { data, error } = await supabase
      .from('cco_snapshots')
      .insert({
        proyecto_id: opts.proyectoId,
        label,
        motivo,
        punto_en_tiempo: payload.capturado_at,
        creado_por: actor,
        resumen,
        payload,
        bytes_aprox: bytes,
      })
      .select('id,proyecto_id,label,motivo,punto_en_tiempo,creado_por,resumen,bytes_aprox,created_at')
      .single();

    if (error) {
      if (/cco_snapshots|schema cache|42P01/i.test(error.message)) {
        return {
          ok: false,
          error: 'Falta migración 275_cco_snapshots_restauracion.sql en Supabase.',
        };
      }
      return { ok: false, error: error.message };
    }

    await pruneSnapshots(supabase, opts.proyectoId);

    await supabase.from('cco_auditoria_eventos').insert({
      proyecto_id: opts.proyectoId,
      accion: 'SNAPSHOT CCO',
      detalle: `Creó punto de restauración «${label}» (${motivo}) · gastos ${resumen.gastos} · ingresos ${resumen.ingresos} · contratos ${resumen.contratos}`,
      actor,
      metadata: { snapshot_id: (data as { id: string }).id, resumen, motivo },
    });

    return { ok: true, snapshot: data as unknown as CcoSnapshotMeta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear snapshot' };
  }
}

export async function listarSnapshotsCco(
  supabase: SupabaseClient,
  proyectoId: string,
  limit = 30,
): Promise<{ snapshots: CcoSnapshotMeta[]; error?: string }> {
  const { data, error } = await supabase
    .from('cco_snapshots')
    .select('id,proyecto_id,label,motivo,punto_en_tiempo,creado_por,resumen,bytes_aprox,created_at')
    .eq('proyecto_id', proyectoId)
    .order('punto_en_tiempo', { ascending: false })
    .limit(Math.min(limit, 100));

  if (error) {
    if (/cco_snapshots|schema cache|42P01/i.test(error.message)) {
      return {
        snapshots: [],
        error: 'Falta migración 275_cco_snapshots_restauracion.sql en Supabase.',
      };
    }
    return { snapshots: [], error: error.message };
  }
  return { snapshots: (data ?? []) as unknown as CcoSnapshotMeta[] };
}

function esGastoProtegido(g: Record<string, unknown>): boolean {
  const origen = String(g.origen ?? '').toLowerCase();
  // Filas CCO puras se pueden borrar; el resto (telegram/canal/compras) se protege.
  if (origen.startsWith('cco_')) return false;
  if (g.compra_factura_id != null || g.purchase_invoice_id != null) return true;
  if (/telegram|canal|factura|recepcion|almacen|procura/i.test(origen)) return true;
  return origen !== '' && !origen.startsWith('cco');
}

export async function restaurarSnapshotCco(
  supabase: SupabaseClient,
  opts: { snapshotId: string; proyectoId: string; actor?: string | null },
): Promise<CcoRestoreResult> {
  const avisos: string[] = [];
  const actor = opts.actor ?? (await resolverActor('cco_restore'));

  const { data: snapRow, error: snapErr } = await supabase
    .from('cco_snapshots')
    .select('id,proyecto_id,label,motivo,payload,punto_en_tiempo')
    .eq('id', opts.snapshotId)
    .eq('proyecto_id', opts.proyectoId)
    .maybeSingle();

  if (snapErr || !snapRow) {
    return {
      ok: false,
      error: snapErr?.message || 'Snapshot no encontrado para esta obra.',
    };
  }

  const payload = (snapRow as { payload: CcoSnapshotPayload }).payload;
  if (!payload || payload.version !== CCO_SNAPSHOT_VERSION) {
    return { ok: false, error: 'Payload de snapshot inválido o versión no soportada.' };
  }

  // 1) Safety snapshot of current state
  const pre = await crearSnapshotCco(supabase, {
    proyectoId: opts.proyectoId,
    motivo: 'pre_restore',
    label: `Antes de restaurar → ${(snapRow as { label?: string }).label ?? opts.snapshotId.slice(0, 8)}`,
    actor,
  });
  if (!pre.ok) {
    return { ok: false, error: `No se pudo crear snapshot de seguridad: ${pre.error}` };
  }

  try {
    // 2) Break FK contrato on compras
    await supabase
      .from('contabilidad_compras')
      .update({ contrato_obra_id: null })
      .eq('proyecto_id', opts.proyectoId);

    // 3) Replace CCO-native tables
    await supabase.from('cco_presupuestos_capitulo').delete().eq('proyecto_id', opts.proyectoId);
    await supabase.from('cco_contratos_obra').delete().eq('proyecto_id', opts.proyectoId);
    await supabase.from('cco_estructura_costos').delete().eq('proyecto_id', opts.proyectoId);

    if (payload.config) {
      const cfg = { ...payload.config };
      delete cfg.created_at;
      await supabase.from('cco_proyecto_config').upsert(
        {
          ...cfg,
          proyecto_id: opts.proyectoId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'proyecto_id' },
      );
    }

    let estructuraN = 0;
    if (payload.estructura.length) {
      // Insert caps first then subs if padre_id present
      const caps = payload.estructura.filter((e) => String(e.tipo_nivel) === 'CAPITULO');
      const subs = payload.estructura.filter((e) => String(e.tipo_nivel) !== 'CAPITULO');
      for (const batch of [caps, subs]) {
        if (!batch.length) continue;
        const { error } = await supabase.from('cco_estructura_costos').insert(batch);
        if (error) avisos.push(`estructura: ${error.message}`);
        else estructuraN += batch.length;
      }
    }

    let contratosN = 0;
    if (payload.contratos.length) {
      const { error } = await supabase.from('cco_contratos_obra').insert(payload.contratos);
      if (error) avisos.push(`contratos: ${error.message}`);
      else contratosN = payload.contratos.length;
    }

    let presupuestosN = 0;
    if (payload.presupuestos.length) {
      const { error } = await supabase.from('cco_presupuestos_capitulo').insert(payload.presupuestos);
      if (error) avisos.push(`presupuestos: ${error.message}`);
      else presupuestosN = payload.presupuestos.length;
    }

    // 4) Ingresos: replace all for proyecto
    await supabase.from('ci_inyecciones_capital').delete().eq('proyecto_id', opts.proyectoId);
    let ingresosN = 0;
    if (payload.ingresos.length) {
      const { error } = await supabase.from('ci_inyecciones_capital').insert(payload.ingresos);
      if (error) avisos.push(`ingresos: ${error.message}`);
      else ingresosN = payload.ingresos.length;
    }

    // 5) Gastos: upsert snapshot rows; remove CCO-only extras
    const actuales = await fetchAllObraGastos(supabase, opts.proyectoId);
    const snapIds = new Set(payload.gastos.map((g) => String(g.id)));
    const actualesById = new Map(actuales.map((g) => [String(g.id), g]));

    let gastosUpsert = 0;
    let gastosInsert = 0;
    let gastosEliminados = 0;
    let gastosProtegidos = 0;

    for (const g of payload.gastos) {
      const id = String(g.id);
      const row = { ...g, proyecto_id: opts.proyectoId };
      if (actualesById.has(id)) {
        const { error } = await supabase.from('contabilidad_compras').update(row).eq('id', id);
        if (error) avisos.push(`gasto update ${id.slice(0, 8)}: ${error.message}`);
        else gastosUpsert += 1;
      } else {
        const { error } = await supabase.from('contabilidad_compras').insert(row);
        if (error) avisos.push(`gasto insert ${id.slice(0, 8)}: ${error.message}`);
        else gastosInsert += 1;
      }
    }

    for (const g of actuales) {
      const id = String(g.id);
      if (snapIds.has(id)) continue;
      if (esGastoProtegido(g)) {
        gastosProtegidos += 1;
        // Limpia vínculo CCO para que no distorsione el libro restaurado
        await supabase
          .from('contabilidad_compras')
          .update({
            contrato_obra_id: null,
            capitulo_cco: null,
            subcapitulo_cco: null,
            tipo_gasto_cco: null,
          })
          .eq('id', id);
        continue;
      }
      await supabase.from('contabilidad_compra_lineas').delete().eq('compra_id', id);
      const { error } = await supabase.from('contabilidad_compras').delete().eq('id', id);
      if (error) {
        avisos.push(`no se eliminó gasto ${id.slice(0, 8)}: ${error.message}`);
        gastosProtegidos += 1;
      } else {
        gastosEliminados += 1;
      }
    }

    // 6) Lineas: replace for snapshot compra ids
    let lineasN = 0;
    if (payload.lineas.length) {
      const compraIds = [...snapIds];
      const chunk = 200;
      for (let i = 0; i < compraIds.length; i += chunk) {
        await supabase
          .from('contabilidad_compra_lineas')
          .delete()
          .in('compra_id', compraIds.slice(i, i + chunk));
      }
      const { error } = await supabase.from('contabilidad_compra_lineas').insert(payload.lineas);
      if (error) avisos.push(`líneas: ${error.message}`);
      else lineasN = payload.lineas.length;
    }

    const restaurado = {
      config: Boolean(payload.config),
      estructura: estructuraN,
      contratos: contratosN,
      presupuestos: presupuestosN,
      ingresos: ingresosN,
      gastos_upsert: gastosUpsert,
      gastos_insert: gastosInsert,
      lineas: lineasN,
      gastos_eliminados: gastosEliminados,
      gastos_protegidos: gastosProtegidos,
    };

    const label = String((snapRow as { label?: string }).label ?? opts.snapshotId.slice(0, 8));
    const punto = String((snapRow as { punto_en_tiempo?: string }).punto_en_tiempo ?? '').slice(0, 19);

    await supabase.from('cco_auditoria_eventos').insert({
      proyecto_id: opts.proyectoId,
      accion: 'RESTAURAR SNAPSHOT CCO',
      detalle: [
        `Restableció libro CCO al punto «${label}» (${punto.replace('T', ' ')})`,
        `gastos ~${gastosUpsert + gastosInsert}`,
        `ingresos ${ingresosN}`,
        `contratos ${contratosN}`,
        gastosProtegidos ? `${gastosProtegidos} gasto(s) protegido(s) no borrados` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      actor,
      metadata: {
        snapshot_id: opts.snapshotId,
        pre_snapshot_id: pre.snapshot.id,
        restaurado,
        avisos: avisos.slice(0, 30),
      },
    });

    return {
      ok: avisos.length === 0,
      pre_snapshot_id: pre.snapshot.id,
      restaurado,
      avisos: avisos.length ? avisos : undefined,
      error: avisos.length ? avisos[0] : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      pre_snapshot_id: pre.snapshot.id,
      error: e instanceof Error ? e.message : 'Error al restaurar',
      avisos,
    };
  }
}

export async function crearSnapshotsDiariosTodasLasObras(
  supabase: SupabaseClient,
): Promise<{ ok: number; fail: number; detalles: string[] }> {
  const { data: proyectos, error } = await supabase
    .from('cco_proyecto_config')
    .select('proyecto_id')
    .limit(500);
  if (error) throw error;

  let ok = 0;
  let fail = 0;
  const detalles: string[] = [];
  const hoy = new Date().toISOString().slice(0, 10);

  for (const row of proyectos ?? []) {
    const proyectoId = String((row as { proyecto_id: string }).proyecto_id);
    // Evitar duplicar diario del mismo día
    const { data: ya } = await supabase
      .from('cco_snapshots')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('motivo', 'diario')
      .gte('punto_en_tiempo', `${hoy}T00:00:00.000Z`)
      .limit(1);
    if (ya?.length) {
      detalles.push(`${proyectoId.slice(0, 8)}: ya tenía diario hoy`);
      continue;
    }
    const res = await crearSnapshotCco(supabase, {
      proyectoId,
      motivo: 'diario',
      label: `Cierre ${hoy}`,
      actor: 'cron_diario',
    });
    if (res.ok) {
      ok += 1;
      detalles.push(`${proyectoId.slice(0, 8)}: ok`);
    } else {
      fail += 1;
      detalles.push(`${proyectoId.slice(0, 8)}: ${res.error}`);
    }
  }

  return { ok, fail, detalles };
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtResumen(r: Record<string, unknown> | null | undefined): string {
  if (!r) return '—';
  const parts = [
    r.gastos != null ? `${r.gastos} gastos` : null,
    r.ingresos != null ? `${r.ingresos} ingresos` : null,
    r.contratos != null ? `${r.contratos} contratos` : null,
    r.presupuestos != null ? `${r.presupuestos} presup.` : null,
  ].filter(Boolean);
  return parts.join(' · ') || '—';
}
