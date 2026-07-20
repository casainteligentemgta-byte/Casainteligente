import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { clasificarTipoGasto } from '@/lib/contabilidad/ccoClasificarGasto';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import {
  claveGastoDividido,
  parsePctDistribucion,
} from '@/lib/contabilidad/cco/egresosVista';
import { parseOrigenIngreso } from '@/lib/contabilidad/cco/ingresosVista';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolverTasa(r: Record<string, unknown>, moneda: string, montoUsd: number): number {
  const tasaBcv = num(r.tasa_bcv_ves_por_usd);
  if (tasaBcv > 0) return tasaBcv;
  const montoVes = num(r.monto_ves);
  if (montoUsd > 0 && montoVes > 0) return montoVes / montoUsd;
  const binance = num(r.tasa_binance);
  if (binance > 0) return binance;
  return moneda === 'VES' ? 1 : 0;
}

/** Si monto_usd viene en 0 pero hay VES+tasa (CSV mal tipado), deriva USD. */
function resolverMontoBaseUsd(r: Record<string, unknown>, moneda: string): number {
  const montoUsd = num(r.monto_usd);
  if (montoUsd > 0) return montoUsd;
  const montoVes = num(r.monto_ves);
  const tasa = resolverTasa(r, moneda, 0);
  if (montoVes > 0 && tasa > 0) return montoVes / tasa;
  return 0;
}

function resolverMontoOrig(
  r: Record<string, unknown>,
  moneda: string,
  montoUsd: number,
  tasa: number,
): number {
  const montoVes = num(r.monto_ves);
  if (moneda === 'VES' || (montoUsd <= 0 && montoVes > 0)) {
    if (montoVes > 0) return montoVes;
    if (tasa > 0 && montoUsd > 0) return montoUsd * tasa;
    return montoUsd;
  }
  if (montoUsd > 0) return montoUsd;
  if (montoVes > 0 && tasa > 0) return montoVes; // mostrar orig en Bs si USD faltaba
  return 0;
}

function esNotaImportacionGenerica(notas: string): boolean {
  return /importaci[oó]n desde (csv|tabla)/i.test(notas);
}

const GASTO_SELECT_FULL = [
  'id',
  'fecha',
  'supplier_name',
  'notas',
  'monto_usd',
  'monto_ves',
  'tasa_bcv_ves_por_usd',
  'tasa_binance',
  'tasa_usada',
  'porcentaje_brecha_real',
  'monto_pagado_usd',
  'tipo_gasto_cco',
  'capitulo_cco',
  'subcapitulo_cco',
  'honorarios_usd',
  'admin_pct_override',
  'cco_estado',
  'contrato_obra_id',
  'moneda_original',
  'invoice_number',
  'origen_v4_id',
  'forma_pago_cco',
  'compra_factura_id',
  'document_storage_path',
  'document_file_name',
  'purchase_invoice_id',
  'origen',
].join(',');

const GASTO_SELECT_BASE = [
  'id',
  'fecha',
  'supplier_name',
  'notas',
  'monto_usd',
  'monto_ves',
  'tasa_bcv_ves_por_usd',
  'tasa_binance',
  'tipo_gasto_cco',
  'capitulo_cco',
  'subcapitulo_cco',
  'honorarios_usd',
  'admin_pct_override',
  'cco_estado',
  'contrato_obra_id',
  'moneda_original',
  'invoice_number',
  'origen_v4_id',
  'forma_pago_cco',
  'document_storage_path',
  'document_file_name',
  'purchase_invoice_id',
].join(',');

const META_VACIO = {
  tiene_documento: false,
  document_file_name: null as string | null,
  monto_pagado_usd: null as number | null,
  tasa_binance: 0,
  tasa_usada: null as string | null,
  porcentaje_brecha_real: null as number | null,
  contrato_label: null as string | null,
};

function descripcionDebil(desc: string, invoice: string | null): boolean {
  const d = desc.trim();
  if (!d || d === 'Gasto') return true;
  if (invoice && d === invoice) return true;
  if (/^RUBRO:\s*[^|]+$/i.test(d)) return true;
  if (esNotaImportacionGenerica(d)) return true;
  return false;
}

/** Quita prefijo RUBRO: … | de notas del egreso manual antiguo. */
function limpiarNotasEgreso(notas: string): string {
  const m = notas.match(/^RUBRO:\s*[^|\n]+\|\s*(.+)$/i);
  if (m?.[1]?.trim()) return m[1].trim();
  if (/^RUBRO:/i.test(notas)) return '';
  return notas.trim();
}

async function enriquecerDescripcionesDesdeLineas(
  supabase: SupabaseClient,
  filas: CcoLibroFila[],
): Promise<void> {
  const ids = filas
    .filter((f) => f.fuente === 'compra' && descripcionDebil(f.descripcion, f.invoice_number))
    .map((f) => f.id);
  if (ids.length === 0) return;

  const porCompra = new Map<string, string[]>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('contabilidad_compra_lineas')
      .select('compra_id,descripcion')
      .in('compra_id', slice)
      .order('created_at', { ascending: true });
    if (error) {
      if (!/contabilidad_compra_lineas|schema cache/i.test(error.message ?? '')) {
        console.warn('[cargarLibroMaestro] lineas:', error.message);
      }
      return;
    }
    for (const row of data ?? []) {
      const r = row as { compra_id?: string; descripcion?: string };
      const cid = String(r.compra_id ?? '');
      const d = String(r.descripcion ?? '').trim();
      if (!cid || !d) continue;
      const list = porCompra.get(cid) ?? [];
      if (list.length < 3) list.push(d);
      porCompra.set(cid, list);
    }
  }

  for (const f of filas) {
    if (f.fuente !== 'compra') continue;
    const parts = porCompra.get(f.id);
    if (!parts?.length) continue;
    if (!descripcionDebil(f.descripcion, f.invoice_number)) continue;
    f.descripcion = parts.join(' · ');
    f.split_group_key = claveGastoDividido({
      invoice_number: f.invoice_number,
      fecha: f.fecha,
      proveedor: f.proveedor,
      descripcion: f.descripcion,
    });
  }
}

async function cargarContratoLabels(
  supabase: SupabaseClient,
  contratoIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = Array.from(new Set(contratoIds.filter(Boolean)));
  if (uniq.length === 0) return out;
  const { data, error } = await supabase
    .from('cco_contratos_obra')
    .select('id,descripcion,proveedor')
    .in('id', uniq);
  if (error) return out;
  for (const row of data ?? []) {
    const r = row as { id: string; descripcion?: string; proveedor?: string };
    const label =
      String(r.descripcion ?? '').trim() ||
      String(r.proveedor ?? '').trim() ||
      String(r.id).slice(0, 8);
    out.set(String(r.id), label.slice(0, 80));
  }
  return out;
}

export async function cargarLibroMaestro(
  supabase: SupabaseClient,
  params: { proyectoId: string; clase?: string | null; limit?: number },
): Promise<{ filas: CcoLibroFila[]; total: number; honorarios_admin_pct: number }> {
  const proyectoId = params.proyectoId;
  const limit = params.limit ?? 2000;
  const claseFiltro = params.clase?.trim().toUpperCase() || null;
  const filas: CcoLibroFila[] = [];

  const { data: cfg } = await supabase
    .from('cco_proyecto_config')
    .select('honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  const pctGlobal = num(cfg?.honorarios_admin_pct) || 15;

  if (!claseFiltro || claseFiltro === 'GASTO') {
    let compras: unknown[] | null = null;
    let error: { message?: string } | null = null;

    const full = await supabase
      .from('contabilidad_compras')
      .select(GASTO_SELECT_FULL)
      .eq('proyecto_id', proyectoId)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .order('fecha', { ascending: false })
      .limit(limit);

    if (full.error) {
      const msg = full.error.message ?? '';
      const soft =
        /tipo_gasto_cco|capitulo_cco|schema cache|origen_v4|compra_factura|document_storage|purchase_invoice|tasa_usada|porcentaje_brecha|monto_pagado/i.test(
          msg,
        );
      if (!soft) throw full.error;
      const base = await supabase
        .from('contabilidad_compras')
        .select(GASTO_SELECT_BASE)
        .eq('proyecto_id', proyectoId)
        .neq('imputacion', IMPUTACION_ENTIDAD)
        .order('fecha', { ascending: false })
        .limit(limit);
      if (base.error) {
        const soft2 =
          /tipo_gasto_cco|capitulo_cco|schema cache|origen_v4|document_storage|purchase_invoice/i.test(
            base.error.message ?? '',
          );
        if (!soft2) throw base.error;
        error = base.error;
        compras = base.data;
      } else {
        compras = base.data;
      }
    } else {
      compras = full.data;
    }

    if (error && !(compras?.length)) {
      /* sin filas por columnas ausentes: continuar vacío */
    }

    const contratoIds: string[] = [];
    for (const row of compras ?? []) {
      const r = row as unknown as Record<string, unknown>;
      if (r.contrato_obra_id) contratoIds.push(String(r.contrato_obra_id));
    }
    const contratoLabels = await cargarContratoLabels(supabase, contratoIds);

    for (const row of compras ?? []) {
      const r = row as unknown as Record<string, unknown>;
      const monedaRaw = String(r.moneda_original ?? 'USD').toUpperCase() || 'USD';
      const base = resolverMontoBaseUsd(r, monedaRaw);
      // Si USD faltaba y venía solo VES, tratar como VES para Monto Orig.
      const moneda =
        num(r.monto_usd) <= 0 && num(r.monto_ves) > 0 && monedaRaw === 'USD' ? 'VES' : monedaRaw;
      const tipo =
        String(r.tipo_gasto_cco ?? '').trim() ||
        clasificarTipoGasto(String(r.supplier_name ?? ''));
      const calc = aplicarHonorariosABase(base, num(r.admin_pct_override) || null, pctGlobal);
      const honorarios = r.honorarios_usd != null ? num(r.honorarios_usd) : calc.honorariosUsd;
      const tasaBinance = num(r.tasa_binance);
      const tasa = resolverTasa(r, moneda, base);
      const notasRaw = String(r.notas ?? '').trim();
      const notasLimpias = limpiarNotasEgreso(notasRaw);
      const invoice = String(r.invoice_number ?? '').trim() || null;
      const descripcion =
        (notasLimpias && !esNotaImportacionGenerica(notasLimpias) ? notasLimpias : '') ||
        invoice ||
        'Gasto';
      const pctDist = parsePctDistribucion(descripcion) ?? 100;
      const origenV4 = r.origen_v4_id != null ? num(r.origen_v4_id) : null;
      const proveedor = String(r.supplier_name ?? '').trim() || 'Sin proveedor';
      const fecha = r.fecha != null ? String(r.fecha).slice(0, 10) : null;
      const compraId = String(r.id);
      const docPath = String(r.document_storage_path ?? '').trim();
      const docName = String(r.document_file_name ?? '').trim() || null;
      const purchaseInvoiceId = String(r.purchase_invoice_id ?? '').trim();
      const tieneDocumento = Boolean(docPath || purchaseInvoiceId);
      const estado = String(r.cco_estado ?? 'PAGADO');
      const montoPagadoRaw =
        r.monto_pagado_usd != null && r.monto_pagado_usd !== ''
          ? num(r.monto_pagado_usd)
          : null;
      const montoPagado =
        montoPagadoRaw != null
          ? montoPagadoRaw
          : /^PAGADO$/i.test(estado)
            ? base
            : null;
      const contratoId = r.contrato_obra_id != null ? String(r.contrato_obra_id) : null;

      filas.push({
        id: compraId,
        display_id: origenV4 && origenV4 > 0 ? origenV4 : compraId.slice(0, 8),
        origen_v4_id: origenV4 && origenV4 > 0 ? origenV4 : null,
        clase: 'GASTO',
        fecha,
        proveedor,
        tipo,
        capitulo: String(r.capitulo_cco ?? '').trim() || '—',
        subcapitulo: String(r.subcapitulo_cco ?? '').trim() || '—',
        descripcion,
        moneda,
        tasa,
        monto_orig: resolverMontoOrig(r, moneda, base, tasa),
        pct_distribucion: pctDist,
        admin_pct: calc.adminPct,
        monto_base_usd: base,
        honorarios_usd: honorarios,
        costo_total_usd: base + honorarios,
        estado,
        forma_pago: r.forma_pago_cco != null ? String(r.forma_pago_cco) : null,
        invoice_number: invoice,
        link_factura: tieneDocumento
          ? `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`
          : null,
        tiene_documento: tieneDocumento,
        document_file_name: docName,
        monto_pagado_usd: montoPagado,
        tasa_binance: tasaBinance,
        tasa_usada: r.tasa_usada != null ? String(r.tasa_usada) : null,
        porcentaje_brecha_real:
          r.porcentaje_brecha_real != null ? num(r.porcentaje_brecha_real) : null,
        contrato_label: contratoId ? contratoLabels.get(contratoId) ?? null : null,
        split_group_key: claveGastoDividido({
          invoice_number: invoice,
          fecha,
          proveedor,
          descripcion,
        }),
        contrato_obra_id: contratoId,
        fuente: 'compra',
      });
    }

    await enriquecerDescripcionesDesdeLineas(supabase, filas);
  }

  if (!claseFiltro || claseFiltro === 'INGRESO') {
    const { data: iny, error } = await supabase
      .from('ci_inyecciones_capital')
      .select(
        'id,fecha_ingreso,creado_al,monto_usd,monto_ves,tasa_bcv,tasa_aplicada,metodo_pago,origen_fondo,moneda_recibida',
      )
      .eq('proyecto_id', proyectoId)
      .order('fecha_ingreso', { ascending: false })
      .limit(limit);
    if (error && error.code !== '42P01') throw error;
    for (const row of iny ?? []) {
      const r = row as unknown as Record<string, unknown>;
      const base = num(r.monto_usd);
      const moneda = String(r.moneda_recibida ?? 'USD').toUpperCase() || 'USD';
      const tasa = num(r.tasa_aplicada) || num(r.tasa_bcv) || 0;
      const montoVes = num(r.monto_ves);
      const parsed = parseOrigenIngreso(String(r.origen_fondo ?? ''));
      const montoRecibido = num(r.monto_recibido);
      filas.push({
        id: String(r.id),
        display_id:
          parsed.origen_v4_id && parsed.origen_v4_id > 0
            ? parsed.origen_v4_id
            : String(r.id).slice(0, 8),
        origen_v4_id: parsed.origen_v4_id,
        clase: 'INGRESO',
        fecha: String(r.fecha_ingreso ?? r.creado_al ?? '').slice(0, 10) || null,
        proveedor: parsed.proveedor,
        tipo: 'INGRESO',
        capitulo: '—',
        subcapitulo: '—',
        descripcion: parsed.descripcion,
        moneda,
        tasa,
        monto_orig:
          montoRecibido > 0
            ? montoRecibido
            : moneda === 'VES' && montoVes > 0
              ? montoVes
              : base,
        pct_distribucion: 100,
        admin_pct: 0,
        monto_base_usd: base,
        honorarios_usd: 0,
        costo_total_usd: base,
        estado: 'REGISTRADO',
        forma_pago: r.metodo_pago != null ? String(r.metodo_pago) : null,
        invoice_number: null,
        link_factura: null,
        ...META_VACIO,
        split_group_key: null,
        contrato_obra_id: null,
        fuente: 'inyeccion',
      });
    }
  }

  if (!claseFiltro || claseFiltro === 'CONTRATO') {
    const { data: contratos, error } = await supabase
      .from('cco_contratos_obra')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('fecha', { ascending: false })
      .limit(limit);
    if (error && !/cco_contratos_obra|schema cache/i.test(error.message ?? '')) throw error;
    for (const row of contratos ?? []) {
      const r = row as Record<string, unknown>;
      const origenV4 = r.origen_v4_id != null ? num(r.origen_v4_id) : null;
      const base = num(r.monto_base_usd);
      filas.push({
        id: String(r.id),
        display_id: origenV4 && origenV4 > 0 ? origenV4 : String(r.id).slice(0, 8),
        origen_v4_id: origenV4 && origenV4 > 0 ? origenV4 : null,
        clase: 'CONTRATO',
        fecha: r.fecha != null ? String(r.fecha).slice(0, 10) : null,
        proveedor: String(r.proveedor ?? ''),
        tipo: String(r.tipo_gasto_cco ?? 'CONTRATO'),
        capitulo: '—',
        subcapitulo: '—',
        descripcion: String(r.descripcion ?? ''),
        moneda: String(r.moneda ?? 'USD'),
        tasa: 0,
        monto_orig: base,
        pct_distribucion: 100,
        admin_pct: num(r.admin_pct) || pctGlobal,
        monto_base_usd: base,
        honorarios_usd: num(r.honorarios_usd),
        costo_total_usd: num(r.costo_total_usd),
        estado: String(r.estado ?? 'PENDIENTE'),
        forma_pago: null,
        invoice_number: null,
        link_factura: null,
        ...META_VACIO,
        split_group_key: null,
        contrato_obra_id: String(r.id),
        fuente: 'contrato',
      });
    }
  }

  if (!claseFiltro || claseFiltro === 'PRESUPUESTO') {
    const { data: presup, error } = await supabase
      .from('cco_presupuestos_capitulo')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('capitulo')
      .limit(limit);
    if (error && !/cco_presupuestos|schema cache/i.test(error.message ?? '')) throw error;
    for (const row of presup ?? []) {
      const r = row as Record<string, unknown>;
      const est = num(r.estimado_usd);
      const origenV4 = r.origen_v4_id != null ? num(r.origen_v4_id) : null;
      filas.push({
        id: String(r.id),
        display_id: origenV4 && origenV4 > 0 ? origenV4 : String(r.id).slice(0, 8),
        origen_v4_id: origenV4 && origenV4 > 0 ? origenV4 : null,
        clase: 'PRESUPUESTO',
        fecha: null,
        proveedor: '—',
        tipo: 'PRESUPUESTO',
        capitulo: String(r.capitulo ?? ''),
        subcapitulo: String(r.subcapitulo ?? '—'),
        descripcion: String(r.descripcion ?? r.capitulo ?? ''),
        moneda: 'USD',
        tasa: 0,
        monto_orig: est,
        pct_distribucion: 100,
        admin_pct: 0,
        monto_base_usd: est,
        honorarios_usd: 0,
        costo_total_usd: est,
        estado: 'ESTIMADO',
        forma_pago: null,
        invoice_number: null,
        link_factura: null,
        ...META_VACIO,
        split_group_key: null,
        contrato_obra_id: null,
        fuente: 'presupuesto',
      });
    }
  }

  filas.sort((a, b) => {
    const fa = a.fecha ?? '';
    const fb = b.fecha ?? '';
    if (fa !== fb) return fb.localeCompare(fa);
    const ida = typeof a.display_id === 'number' ? a.display_id : 0;
    const idb = typeof b.display_id === 'number' ? b.display_id : 0;
    if (ida !== idb) return idb - ida;
    return a.clase.localeCompare(b.clase);
  });

  return { filas: filas.slice(0, limit), total: filas.length, honorarios_admin_pct: pctGlobal };
}
