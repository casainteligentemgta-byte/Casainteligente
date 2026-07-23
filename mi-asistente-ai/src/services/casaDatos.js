import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { env } from '../config/env.js';

const require = createRequire(import.meta.url);

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
    /** @type {Record<string, unknown>} */
    const opts = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    try {
      const ws = require('ws');
      opts.realtime = { transport: ws };
    } catch {
      /* Node 22+ tiene WebSocket nativo */
    }
    client = createClient(url, key, opts);
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
    .select('id,nombre,entidad_id')
    .order('nombre')
    .limit(40);

  const f = filtro.trim();
  if (f) {
    q = q.or(`nombre.ilike.%${f}%`);
  }

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const obras = (data || []).map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre || 'Sin nombre'),
    codigo: null,
    estatus: null,
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
    .select('id,nombre')
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
      codigo: null,
      estatus: null,
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

const CCO_ORIGEN_HISTORICO = 'HISTORICO_TABLA';
const CCO_ORIGEN_V4 = 'cco_v4_import';
const IMPUTACION_ENTIDAD = 'entidad';
const PAGE = 1000;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ym(fecha) {
  const s = String(fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s.slice(0, 7);
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function aplicarDevaluacion(monto, devalPct) {
  const m = num(monto);
  const d = num(devalPct);
  if (!Number.isFinite(m)) return 0;
  if (!Number.isFinite(d) || d === 0) return m;
  if (d > 0) return m / (1 + d / 100);
  const factor = 1 + d / 100;
  if (factor <= 0) return m;
  return m * factor;
}

function esIngresoLibroCcoV4(row) {
  const por = String(row.creado_por ?? '').trim();
  if (por === CCO_ORIGEN_V4) return true;
  if (/^CCO-V4\b/i.test(String(row.origen_fondo ?? ''))) return true;
  return String(row.banco_origen ?? '').trim().toUpperCase() === 'CCO-V4';
}

/**
 * Pagina queries PostgREST (cap ~1000).
 * @param {() => { range: (from: number, to: number) => Promise<{ data: unknown[], error: unknown }> }} buildQuery
 */
async function fetchAllRows(buildQuery, maxRows = 50_000) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) return { data: all, error };
    const chunk = data || [];
    if (!chunk.length) break;
    all.push(...chunk);
    if (chunk.length < PAGE || all.length >= maxRows) break;
    from += PAGE;
  }
  return { data: all, error: null };
}

function fmtUsd(n) {
  return round2(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Consulta CCO rica (misma lógica base que el dashboard web):
 * saldo de caja, ingresos, gastos, admin, top proveedores, gastos por mes.
 * @param {string} proyectoId
 * @param {{ mes?: string, topN?: number }} [opts] mes = YYYY-MM
 */
export async function consultaCco(proyectoId, opts = {}) {
  if (!isCasaDatosConfigured()) {
    return { ok: false, error: 'Supabase no configurado en el asistente.' };
  }
  if (!proyectoId) return { ok: false, error: 'Falta proyecto_id' };

  const mesFiltro = opts.mes ? String(opts.mes).trim().slice(0, 7) : null;
  if (mesFiltro && !/^\d{4}-\d{2}$/.test(mesFiltro)) {
    return { ok: false, error: 'mes debe ser YYYY-MM (ej. 2026-07)' };
  }
  const topN = Math.min(Math.max(Number(opts.topN) || 10, 1), 25);

  const sb = getSb();

  const { data: proy, error: pErr } = await sb
    .from('ci_proyectos')
    .select('id,nombre')
    .eq('id', proyectoId)
    .maybeSingle();
  if (pErr) return { ok: false, error: pErr.message };
  if (!proy) return { ok: false, error: 'Obra no encontrada' };

  const selectFull =
    'id,fecha,proyecto_id,monto_usd,supplier_name,origen,origen_v4_id,imputacion';
  const selectBase = 'id,fecha,proyecto_id,monto_usd,supplier_name,origen,imputacion';

  const buildCompras = (cols) =>
    sb
      .from('contabilidad_compras')
      .select(cols)
      .eq('proyecto_id', proyectoId)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .neq('origen', CCO_ORIGEN_HISTORICO)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true });

  let { data: comprasRaw, error: cErr } = await fetchAllRows(() => buildCompras(selectFull));
  if (
    cErr &&
    /origen_v4_id|origen|imputacion|42703|PGRST204|schema cache/i.test(cErr.message || '')
  ) {
    ({ data: comprasRaw, error: cErr } = await fetchAllRows(() => buildCompras(selectBase)));
    if (cErr && /origen|imputacion|42703|PGRST204|schema cache/i.test(cErr.message || '')) {
      ({ data: comprasRaw, error: cErr } = await fetchAllRows(() =>
        sb
          .from('contabilidad_compras')
          .select('id,fecha,proyecto_id,monto_usd,supplier_name')
          .eq('proyecto_id', proyectoId)
          .order('fecha', { ascending: true })
          .order('id', { ascending: true }),
      ));
    }
  }
  if (cErr) return { ok: false, error: cErr.message || String(cErr) };

  const compras = (comprasRaw || []).filter((r) => {
    if (String(r.imputacion || '').toLowerCase() === IMPUTACION_ENTIDAD) return false;
    if (String(r.origen || '') === CCO_ORIGEN_HISTORICO) return false;
    return true;
  });

  const tieneLibroV4 = compras.some(
    (r) => String(r.origen || '') === CCO_ORIGEN_V4 || r.origen_v4_id != null,
  );

  let { data: inyeccionesRaw, error: iErr } = await fetchAllRows(() =>
    sb
      .from('ci_inyecciones_capital')
      .select('id,fecha_ingreso,creado_al,monto_usd,creado_por,origen_fondo,banco_origen')
      .eq('proyecto_id', proyectoId)
      .order('fecha_ingreso', { ascending: true })
      .order('id', { ascending: true }),
  );
  if (iErr && iErr.code !== '42P01' && !/ci_inyecciones_capital|schema cache/i.test(iErr.message || '')) {
    return { ok: false, error: iErr.message };
  }
  if (iErr) inyeccionesRaw = [];

  const inyecciones = tieneLibroV4
    ? (inyeccionesRaw || []).filter(esIngresoLibroCcoV4)
    : inyeccionesRaw || [];

  let honorariosPct = 15;
  let devaluacionPct = 0;
  const { data: cfg } = await sb
    .from('cco_proyecto_config')
    .select('honorarios_admin_pct,devaluacion_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  if (cfg?.honorarios_admin_pct != null) honorariosPct = num(cfg.honorarios_admin_pct);
  if (cfg?.devaluacion_pct != null) devaluacionPct = num(cfg.devaluacion_pct);

  let ingresos = 0;
  let countIngresos = 0;
  const porMesIngresos = new Map();
  for (const row of inyecciones) {
    const usd = num(row.monto_usd);
    ingresos += usd;
    countIngresos += 1;
    const p = ym(row.fecha_ingreso || row.creado_al);
    if (p) porMesIngresos.set(p, (porMesIngresos.get(p) || 0) + usd);
  }

  let gastosNetos = 0;
  const porMesEgresos = new Map();
  const porProveedor = new Map();
  const porProveedorMes = new Map();
  let gastosMes = 0;
  let countGastosMes = 0;

  for (const row of compras) {
    const usd = num(row.monto_usd);
    gastosNetos += usd;
    const p = ym(row.fecha);
    if (p) porMesEgresos.set(p, (porMesEgresos.get(p) || 0) + usd);

    const prov = String(row.supplier_name || '').trim() || 'Sin proveedor';
    porProveedor.set(prov, (porProveedor.get(prov) || 0) + usd);

    if (mesFiltro && p === mesFiltro) {
      gastosMes += usd;
      countGastosMes += 1;
      porProveedorMes.set(prov, (porProveedorMes.get(prov) || 0) + usd);
    }
  }

  const adminDelegada = gastosNetos * (honorariosPct / 100);
  const costoTotal = gastosNetos + adminDelegada;
  const saldoCaja = ingresos - costoTotal;

  const oficial = {
    ingresos: round2(ingresos),
    gastosNetos: round2(gastosNetos),
    adminDelegada: round2(adminDelegada),
    costoTotal: round2(costoTotal),
    saldoCaja: round2(saldoCaja),
    countIngresos,
    countGastos: compras.length,
  };

  const real = {
    ingresos: round2(aplicarDevaluacion(ingresos, devaluacionPct)),
    gastosNetos: round2(aplicarDevaluacion(gastosNetos, devaluacionPct)),
    adminDelegada: round2(aplicarDevaluacion(adminDelegada, devaluacionPct)),
    costoTotal: round2(aplicarDevaluacion(costoTotal, devaluacionPct)),
    saldoCaja: round2(aplicarDevaluacion(saldoCaja, devaluacionPct)),
    countIngresos,
    countGastos: compras.length,
  };

  const sortMap = (m) =>
    Array.from(m.entries())
      .map(([k, v]) => ({ nombre: k, usd: round2(v) }))
      .sort((a, b) => b.usd - a.usd);

  const topProveedores = sortMap(porProveedor).slice(0, topN);
  const topProveedoresMes = mesFiltro
    ? sortMap(porProveedorMes).slice(0, topN)
    : [];

  const meses = Array.from(
    new Set([...porMesIngresos.keys(), ...porMesEgresos.keys()]),
  ).sort();
  const flujoMensual = meses.map((periodo) => {
    const ing = porMesIngresos.get(periodo) || 0;
    const egr = porMesEgresos.get(periodo) || 0;
    return {
      periodo,
      ingresos: round2(ing),
      egresos: round2(egr),
      saldo: round2(ing - egr),
    };
  });

  const mesActualCaracas = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
    .slice(0, 7);
  const mesRef = mesFiltro || mesActualCaracas;
  const filaMes = flujoMensual.find((f) => f.periodo === mesRef) || {
    periodo: mesRef,
    ingresos: 0,
    egresos: mesFiltro ? round2(gastosMes) : 0,
    saldo: 0,
  };

  return {
    ok: true,
    obra: {
      id: String(proy.id),
      nombre: String(proy.nombre || ''),
      codigo: null,
    },
    honorariosPct,
    devaluacionPct,
    libroV4: tieneLibroV4,
    oficial,
    real,
    mesConsultado: mesFiltro,
    mesReferencia: mesRef,
    gastoMes: mesFiltro
      ? { periodo: mesFiltro, usd: round2(gastosMes), count: countGastosMes }
      : {
          periodo: mesRef,
          usd: filaMes.egresos,
          count: null,
        },
    topProveedores,
    topProveedoresMes,
    flujoMensual: flujoMensual.slice(-12),
  };
}

/**
 * Formatea consultaCco para Telegram (Markdown).
 * @param {Awaited<ReturnType<typeof consultaCco>>} r
 * @param {'completo'|'saldo'|'proveedores'|'mes'} [modo]
 */
export function formatConsultaCco(r, modo = 'completo') {
  if (!r?.ok) return r?.error || 'Error en consulta CCO';

  const o = r.oficial;
  const head = `*CCO · ${r.obra.nombre}*${r.libroV4 ? ' (libro V4)' : ''}`;

  if (modo === 'saldo') {
    return [
      head,
      `Saldo de caja (oficial): *${fmtUsd(o.saldoCaja)}*`,
      `Ingresos ${fmtUsd(o.ingresos)} − costo total ${fmtUsd(o.costoTotal)}`,
      `  (gastos ${fmtUsd(o.gastosNetos)} + admin ${r.honorariosPct}% ${fmtUsd(o.adminDelegada)})`,
      r.devaluacionPct > 0
        ? `Saldo real (deval ${r.devaluacionPct}%): ${fmtUsd(r.real.saldoCaja)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const topList = (arr) =>
    arr.length
      ? arr.map((p, i) => `${i + 1}. ${p.nombre} — ${fmtUsd(p.usd)}`).join('\n')
      : 'Sin datos.';

  if (modo === 'proveedores') {
    const titulo = r.mesConsultado
      ? `Top proveedores · ${r.mesConsultado}`
      : 'Top proveedores (todo el proyecto)';
    const lista = r.mesConsultado ? r.topProveedoresMes : r.topProveedores;
    return `${head}\n*${titulo}*\n${topList(lista)}`;
  }

  if (modo === 'mes' || r.mesConsultado) {
    const m = r.gastoMes;
    const fila = r.flujoMensual.find((f) => f.periodo === m.periodo);
    return [
      head,
      `*Mes ${m.periodo}*`,
      `Egresos: *${fmtUsd(m.usd)}*${m.count != null ? ` (${m.count} facturas)` : ''}`,
      fila ? `Ingresos del mes: ${fmtUsd(fila.ingresos)} · Saldo mes: ${fmtUsd(fila.saldo)}` : null,
      '',
      '*Top proveedores del mes*',
      topList(r.topProveedoresMes.length ? r.topProveedoresMes : r.topProveedores.slice(0, 5)),
    ]
      .filter((x) => x != null)
      .join('\n');
  }

  const ultimosMeses = (r.flujoMensual || [])
    .slice(-6)
    .map((f) => `${f.periodo}: egresos ${fmtUsd(f.egresos)} · saldo ${fmtUsd(f.saldo)}`)
    .join('\n');

  return [
    head,
    `*KPIs oficiales*`,
    `Ingresos: ${fmtUsd(o.ingresos)} (${o.countIngresos})`,
    `Gastos netos: ${fmtUsd(o.gastosNetos)} (${o.countGastos})`,
    `Admin ${r.honorariosPct}%: ${fmtUsd(o.adminDelegada)}`,
    `Costo total: ${fmtUsd(o.costoTotal)}`,
    `Saldo caja: *${fmtUsd(o.saldoCaja)}*`,
    r.devaluacionPct > 0
      ? `Saldo real (deval ${r.devaluacionPct}%): ${fmtUsd(r.real.saldoCaja)}`
      : null,
    '',
    `*Mes ${r.mesReferencia}* — egresos ${fmtUsd(r.gastoMes.usd)}`,
    '',
    '*Top proveedores*',
    topList(r.topProveedores.slice(0, 8)),
    ultimosMeses ? `\n*Últimos meses*\n${ultimosMeses}` : null,
  ]
    .filter((x) => x != null)
    .join('\n');
}
