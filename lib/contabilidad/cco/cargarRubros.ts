/**
 * Lista de Rubros CCO V4: consolida gastos por tipo → concepto (cant., unidad, P.prom, total).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import {
  CCO_TIPOS_GASTO,
  CCO_TIPO_COLOR_PIE,
  clasificarTipoGasto,
  type CcoTipoGasto,
} from '@/lib/contabilidad/ccoClasificarGasto';
import {
  esCompraSoloAuditoriaCco,
  esDescripcionAuditoriaCco,
} from '@/lib/contabilidad/compraEsAuditoriaCco';
import {
  esGastoAnulado,
  honorariosDeFila,
  resolverMontoBaseUsdKpi,
} from '@/lib/contabilidad/cco/kpisOficiales';
import {
  normalizarConceptoRubro,
  RUBRO_SECCIONES,
} from '@/lib/contabilidad/cco/normalizarConceptoRubro';
import { TIPO_CONTRATO_AD, ESTADO_CONTRATO_EXITOSO } from '@/lib/proyectos/contratoAdministracionDelegada';

export type CcoRubroConcepto = {
  concepto: string;
  cantidad: number;
  unidad: string;
  precioPromedio: number;
  costoTotal: number;
};

export type CcoRubroSeccion = {
  key: string;
  titulo: string;
  icon: string;
  subtotal: number;
  conceptos: CcoRubroConcepto[];
};

export type CcoRubroTransaccion = {
  id: string;
  fecha: string | null;
  proveedor: string;
  descripcion: string;
  concepto: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  gastoNeto: number;
  costoTotal: number;
  lineaId: string | null;
};

export type CcoRubroKpis = {
  materiales: number;
  equipos: number;
  manoObra: number;
  contratistas: number;
  transporte: number;
  insumos: number;
  proyPermisos: number;
  costoNeto: number;
};

export type CcoRubroPie = { name: string; value: number; color: string };

export type CcoRubrosResult = {
  proyectoId: string;
  kpis: CcoRubroKpis;
  pie: CcoRubroPie[];
  secciones: CcoRubroSeccion[];
  transacciones: CcoRubroTransaccion[];
  proveedores: string[];
  totalTransacciones: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function limpiarNotas(notas: string): string {
  const m = notas.match(/^RUBRO:\s*[^|\n]+\|\s*(.+)$/i);
  if (m) return m[1].trim();
  if (/^RUBRO:/i.test(notas)) return '';
  return notas.trim();
}

function esNotaImportacion(notas: string): boolean {
  return /importaci[oó]n desde (csv|tabla)/i.test(notas);
}

async function honorariosPctGlobal(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<number> {
  const { data: cfg } = await supabase
    .from('cco_proyecto_config')
    .select('honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .maybeSingle();
  if (cfg && (cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct != null) {
    return num((cfg as { honorarios_admin_pct?: number }).honorarios_admin_pct);
  }
  const { data: contrato } = await supabase
    .from('ci_contratos_express')
    .select('honorarios_admin_pct')
    .eq('proyecto_id', proyectoId)
    .eq('tipo_contrato', TIPO_CONTRATO_AD)
    .eq('estado', ESTADO_CONTRATO_EXITOSO)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contrato?.honorarios_admin_pct != null) return num(contrato.honorarios_admin_pct);
  return 15;
}

export async function cargarRubrosCco(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoRubrosResult> {
  const pctGlobal = await honorariosPctGlobal(supabase, proyectoId);

  const selectCco =
    'id,fecha,proyecto_id,monto_usd,monto_ves,tasa_bcv_ves_por_usd,tasa_binance,moneda_original,supplier_name,notas,invoice_number,tipo_gasto_cco,honorarios_usd,admin_pct_override,cco_estado';
  const selectBase =
    'id,fecha,proyecto_id,monto_usd,monto_ves,tasa_bcv_ves_por_usd,tasa_binance,moneda_original,supplier_name,notas,invoice_number';

  type CompraRow = Record<string, unknown>;
  const compras: CompraRow[] = [];
  const pageSize = 1000;
  let from = 0;
  let cols = selectCco;
  for (let guard = 0; guard < 60; guard += 1) {
    const { data, error } = await supabase
      .from('contabilidad_compras')
      .select(cols)
      .eq('proyecto_id', proyectoId)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .order('fecha', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      if (
        cols === selectCco &&
        /tipo_gasto_cco|honorarios_usd|cco_estado|42703|PGRST204|schema cache/i.test(
          error.message ?? '',
        )
      ) {
        cols = selectBase;
        from = 0;
        compras.length = 0;
        continue;
      }
      throw error;
    }
    const batch = (data ?? []) as unknown as CompraRow[];
    compras.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const compraIds = compras.map((c) => String(c.id));
  type LineaRow = {
    id: string;
    compra_id: string;
    descripcion: string | null;
    unidad: string | null;
    cantidad: number | null;
    precio_unitario: number | null;
    subtotal: number | null;
  };
  const lineasByCompra = new Map<string, LineaRow[]>();

  for (let i = 0; i < compraIds.length; i += 200) {
    const chunk = compraIds.slice(i, i + 200);
    if (chunk.length === 0) break;
    const { data: lineas, error: lErr } = await supabase
      .from('contabilidad_compra_lineas')
      .select('id,compra_id,descripcion,unidad,cantidad,precio_unitario,subtotal')
      .in('compra_id', chunk);
    if (lErr && !/contabilidad_compra_lineas|schema cache|42P01/i.test(lErr.message ?? '')) {
      throw lErr;
    }
    for (const ln of (lineas ?? []) as LineaRow[]) {
      const cid = String(ln.compra_id);
      if (!lineasByCompra.has(cid)) lineasByCompra.set(cid, []);
      lineasByCompra.get(cid)!.push(ln);
    }
  }

  const transacciones: CcoRubroTransaccion[] = [];
  const proveedoresSet = new Set<string>();

  type AggKey = string;
  const agg = new Map<
    AggKey,
    { tipo: string; concepto: string; unidad: string; cantidad: number; costo: number }
  >();
  const porTipo = new Map<string, number>();

  for (const row of compras) {
    if (esGastoAnulado(row.cco_estado != null ? String(row.cco_estado) : null)) continue;

    const notasRaw = String(row.notas ?? '').trim();
    const notas = limpiarNotas(notasRaw);
    const invoice = String(row.invoice_number ?? '').trim() || null;
    const proveedor = String(row.supplier_name ?? '').trim() || 'Sin proveedor';
    const descHeader =
      (notas && !esNotaImportacion(notas) ? notas : '') || invoice || 'Gasto';

    if (
      esDescripcionAuditoriaCco(descHeader) ||
      esDescripcionAuditoriaCco(notasRaw) ||
      esCompraSoloAuditoriaCco({
        supplier_name: proveedor,
        notas: notasRaw,
        invoice_number: invoice,
        lineas: notas ? [{ descripcion: notas }] : [],
      })
    ) {
      continue;
    }

    const baseUsd = resolverMontoBaseUsdKpi({
      monto_usd: num(row.monto_usd),
      monto_ves: num(row.monto_ves),
      tasa_bcv_ves_por_usd: num(row.tasa_bcv_ves_por_usd),
      tasa_binance: num(row.tasa_binance),
      moneda_original: row.moneda_original != null ? String(row.moneda_original) : null,
    });
    if (baseUsd <= 0) continue;

    const honorarios = honorariosDeFila(
      baseUsd,
      {
        honorarios_usd: row.honorarios_usd != null ? num(row.honorarios_usd) : null,
        admin_pct_override:
          row.admin_pct_override != null ? num(row.admin_pct_override) : null,
      },
      pctGlobal,
    );
    const factorCosto = baseUsd > 0 ? (baseUsd + honorarios) / baseUsd : 1;

    const tipoPersistido = String(row.tipo_gasto_cco ?? '').trim();
    const tipo = (CCO_TIPOS_GASTO as readonly string[]).includes(tipoPersistido)
      ? tipoPersistido
      : clasificarTipoGasto(proveedor);

    // Admin delegada no entra en el desglose de rubros de gasto neto V4.
    if (tipo === 'ADMINISTRACIÓN DELEGADA') continue;

    proveedoresSet.add(proveedor);
    const compraId = String(row.id);
    const fecha = row.fecha != null ? String(row.fecha).slice(0, 10) : null;
    const lineas = lineasByCompra.get(compraId) ?? [];

    const usableLineas = lineas.filter((ln) => {
      const d = String(ln.descripcion ?? '').trim();
      return d && !esDescripcionAuditoriaCco(d);
    });

    if (usableLineas.length > 0) {
      const sumSub = usableLineas.reduce((s, ln) => {
        const st = num(ln.subtotal);
        if (st > 0) return s + st;
        return s + num(ln.cantidad) * num(ln.precio_unitario);
      }, 0);
      const scale = sumSub > 0 ? baseUsd / sumSub : 0;

      for (const ln of usableLineas) {
        const cant = num(ln.cantidad) > 0 ? num(ln.cantidad) : 1;
        const und = String(ln.unidad ?? 'UND').trim().toUpperCase() || 'UND';
        let sub = num(ln.subtotal);
        if (sub <= 0) sub = cant * num(ln.precio_unitario);
        const gastoNeto = scale > 0 ? sub * scale : baseUsd / usableLineas.length;
        const pu = cant > 0 ? gastoNeto / cant : gastoNeto;
        const desc = String(ln.descripcion ?? '').trim() || descHeader;
        const concepto = normalizarConceptoRubro(desc, { tipo, proveedor });

        transacciones.push({
          id: compraId,
          fecha,
          proveedor,
          descripcion: desc,
          concepto,
          tipo,
          cantidad: cant,
          unidad: und,
          precioUnitario: pu,
          gastoNeto,
          costoTotal: gastoNeto * factorCosto,
          lineaId: String(ln.id),
        });

        const key = `${tipo}||${concepto}||${und}`;
        const prev = agg.get(key);
        if (prev) {
          prev.cantidad += cant;
          prev.costo += gastoNeto;
        } else {
          agg.set(key, { tipo, concepto, unidad: und, cantidad: cant, costo: gastoNeto });
        }
        porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + gastoNeto);
      }
    } else {
      const concepto = normalizarConceptoRubro(descHeader, { tipo, proveedor });
      const und = 'UND';
      const cant = 1;
      transacciones.push({
        id: compraId,
        fecha,
        proveedor,
        descripcion: descHeader,
        concepto,
        tipo,
        cantidad: cant,
        unidad: und,
        precioUnitario: baseUsd,
        gastoNeto: baseUsd,
        costoTotal: baseUsd + honorarios,
        lineaId: null,
      });
      const key = `${tipo}||${concepto}||${und}`;
      const prev = agg.get(key);
      if (prev) {
        prev.cantidad += cant;
        prev.costo += baseUsd;
      } else {
        agg.set(key, { tipo, concepto, unidad: und, cantidad: cant, costo: baseUsd });
      }
      porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + baseUsd);
    }
  }

  transacciones.sort((a, b) => {
    const fa = a.fecha ?? '';
    const fb = b.fecha ?? '';
    if (fa !== fb) return fa.localeCompare(fb);
    return a.descripcion.localeCompare(b.descripcion, 'es');
  });

  const secciones: CcoRubroSeccion[] = RUBRO_SECCIONES.map((sec) => {
    const conceptos: CcoRubroConcepto[] = Array.from(agg.values())
      .filter((a) => sec.tipos.includes(a.tipo))
      .map((a) => ({
        concepto: a.concepto,
        cantidad: a.cantidad,
        unidad: a.unidad,
        precioPromedio: a.cantidad > 0 ? a.costo / a.cantidad : a.costo,
        costoTotal: a.costo,
      }))
      .sort((a, b) => b.costoTotal - a.costoTotal);
    const subtotal = conceptos.reduce((s, c) => s + c.costoTotal, 0);
    return {
      key: sec.key,
      titulo: sec.titulo,
      icon: sec.icon,
      subtotal,
      conceptos,
    };
  }).filter((s) => s.subtotal > 0 || s.conceptos.length > 0);

  const kpis: CcoRubroKpis = {
    materiales: porTipo.get('MATERIALES') ?? 0,
    equipos: porTipo.get('EQUIPOS') ?? 0,
    manoObra: porTipo.get('MANO DE OBRA') ?? 0,
    contratistas: porTipo.get('CONTRATISTA') ?? 0,
    transporte: porTipo.get('TRANSPORTE') ?? 0,
    insumos: porTipo.get('INSUMOS') ?? 0,
    proyPermisos: (porTipo.get('PROYECTO') ?? 0) + (porTipo.get('PERMISOLOGIA') ?? 0),
    costoNeto: 0,
  };
  kpis.costoNeto =
    kpis.materiales +
    kpis.equipos +
    kpis.manoObra +
    kpis.contratistas +
    kpis.transporte +
    kpis.insumos +
    kpis.proyPermisos;

  const pie: CcoRubroPie[] = CCO_TIPOS_GASTO.filter((t) => t !== 'ADMINISTRACIÓN DELEGADA')
    .map((name) => ({
      name,
      value: porTipo.get(name) ?? 0,
      color: CCO_TIPO_COLOR_PIE[name as CcoTipoGasto],
    }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    proyectoId,
    kpis,
    pie,
    secciones,
    transacciones,
    proveedores: Array.from(proveedoresSet).sort((a, b) => a.localeCompare(b, 'es')),
    totalTransacciones: transacciones.length,
  };
}
