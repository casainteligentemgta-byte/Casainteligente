import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let client;

function getSb() {
  const url = env.supabaseUrl();
  const key = env.supabaseServiceKey();
  if (!url || !key) {
    throw new Error(
      'Supabase no configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env)',
    );
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function isCasaDatosConfigured() {
  return Boolean(env.supabaseUrl() && env.supabaseServiceKey());
}

/**
 * Lista obras / proyectos activos.
 * @param {string} [filtro]
 */
export async function listarObras(filtro = '') {
  if (!isCasaDatosConfigured()) {
    return { ok: false, error: 'Supabase no configurado en el asistente.' };
  }
  const sb = getSb();
  let q = sb
    .from('ci_proyectos')
    .select('id,nombre,codigo,estatus,entidad_id')
    .order('nombre')
    .limit(40);

  const f = filtro.trim();
  if (f) {
    q = q.or(`nombre.ilike.%${f}%,codigo.ilike.%${f}%`);
  }

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const obras = (data || []).map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre || 'Sin nombre'),
    codigo: r.codigo != null ? String(r.codigo) : null,
    estatus: r.estatus != null ? String(r.estatus) : null,
  }));

  return { ok: true, obras };
}

/**
 * Resumen contable simple de una obra (últimas compras + totales).
 * @param {string} proyectoId
 */
export async function resumenObra(proyectoId) {
  if (!isCasaDatosConfigured()) {
    return { ok: false, error: 'Supabase no configurado en el asistente.' };
  }
  if (!proyectoId) return { ok: false, error: 'Falta proyecto_id' };

  const sb = getSb();

  const { data: proy, error: pErr } = await sb
    .from('ci_proyectos')
    .select('id,nombre,codigo,estatus')
    .eq('id', proyectoId)
    .maybeSingle();
  if (pErr) return { ok: false, error: pErr.message };
  if (!proy) return { ok: false, error: 'Obra no encontrada' };

  const { data: compras, error: cErr } = await sb
    .from('contabilidad_compras')
    .select('id,fecha,supplier_name,invoice_number,monto_usd,monto_ves,origen')
    .eq('proyecto_id', proyectoId)
    .order('fecha', { ascending: false })
    .limit(15);

  if (cErr) return { ok: false, error: cErr.message };

  const rows = compras || [];
  const totalUsd = rows.reduce((a, r) => a + (Number(r.monto_usd) || 0), 0);
  const totalVes = rows.reduce((a, r) => a + (Number(r.monto_ves) || 0), 0);

  // Conteo aproximado (si hay muchas, el limit no es el total; pedimos count)
  const { count } = await sb
    .from('contabilidad_compras')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', proyectoId);

  return {
    ok: true,
    obra: {
      id: String(proy.id),
      nombre: String(proy.nombre || ''),
      codigo: proy.codigo != null ? String(proy.codigo) : null,
      estatus: proy.estatus != null ? String(proy.estatus) : null,
    },
    compras_registradas: count ?? rows.length,
    muestra_ultimas: rows.length,
    suma_muestra_usd: Math.round(totalUsd * 100) / 100,
    suma_muestra_ves: Math.round(totalVes * 100) / 100,
    ultimas: rows.map((r) => ({
      fecha: r.fecha,
      proveedor: r.supplier_name,
      factura: r.invoice_number,
      usd: Number(r.monto_usd) || 0,
      ves: Number(r.monto_ves) || 0,
    })),
  };
}

/**
 * Busca una obra por nombre y devuelve la mejor coincidencia.
 * @param {string} nombre
 */
export async function buscarObraPorNombre(nombre) {
  const r = await listarObras(nombre);
  if (!r.ok) return r;
  if (!r.obras.length) return { ok: false, error: `No encontré obra con «${nombre}»` };
  const needle = nombre.trim().toLowerCase();
  const exact = r.obras.find((o) => o.nombre.toLowerCase() === needle);
  return { ok: true, obra: exact || r.obras[0], candidatas: r.obras.slice(0, 5) };
}
