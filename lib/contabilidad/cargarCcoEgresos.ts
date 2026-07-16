import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import {
  clasificarTipoGasto,
  CCO_TIPOS_GASTO,
  type CcoTipoGasto,
} from '@/lib/contabilidad/ccoClasificarGasto';
import {
  payloadCompraBimonetario,
  resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
import { resolverEntidadIdDesdeProyecto } from '@/lib/contabilidad/resolverEntidadProyecto';
import { deleteCompraRegistro } from '@/lib/contabilidad/deleteCompraRegistro';

export type CcoEgresoFila = {
  id: string;
  fecha: string;
  descripcion: string;
  rubro: CcoTipoGasto | string;
  proveedor: string;
  factura: string;
  montoUsd: number;
  estado: string;
  origen: string;
  proyectoId: string | null;
  proyectoNombre: string;
};

export type CcoEgresosKpis = {
  ingresos: number;
  egresos: number;
  saldo: number;
  adminDelegada: number;
  costoTotal: number;
  countEgresos: number;
  countIngresos: number;
};

export type CcoEgresosPayload = {
  proyectoId: string | null;
  anio: number;
  mes: number | null;
  kpis: CcoEgresosKpis;
  filas: CcoEgresoFila[];
  aniosDisponibles: number[];
  honorariosPct: number;
};

export type CcoEgresoAltaInput = {
  proyectoId: string;
  fecha: string;
  rubro: string;
  montoUsd: number;
  descripcion: string;
  proveedor?: string;
  factura?: string;
};

const RUBRO_PREFIX = 'RUBRO:';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ymParts(fecha: string | null | undefined): { anio: number; mes: number } | null {
  const s = String(fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const anio = Number(s.slice(0, 4));
  const mes = Number(s.slice(5, 7));
  if (!Number.isFinite(anio) || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

export function parseRubroDesdeNotas(notas: string | null | undefined): string | null {
  const m = String(notas ?? '').match(/^RUBRO:\s*([^|\n]+)/i);
  return m?.[1]?.trim() || null;
}

export function buildNotasEgreso(rubro: string, descripcion: string): string {
  const r = rubro.trim() || 'MATERIALES';
  const d = descripcion.trim();
  return d ? `${RUBRO_PREFIX} ${r} | ${d}` : `${RUBRO_PREFIX} ${r}`;
}

export function descripcionDesdeNotas(notas: string | null | undefined, fallback: string): string {
  const s = String(notas ?? '').trim();
  if (!s) return fallback;
  const m = s.match(/^RUBRO:\s*[^|\n]+\|\s*(.+)$/i);
  if (m?.[1]?.trim()) return m[1].trim();
  if (/^RUBRO:/i.test(s)) return fallback;
  return s;
}

function esTipoGasto(v: string): v is CcoTipoGasto {
  return (CCO_TIPOS_GASTO as readonly string[]).includes(v);
}

export async function cargarCcoEgresos(
  supabase: SupabaseClient,
  params?: {
    proyectoId?: string | null;
    anio?: number | null;
    mes?: number | null;
  },
): Promise<CcoEgresosPayload> {
  const proyectoId = params?.proyectoId?.trim() || null;

  const { data: proyectosRows } = await supabase
    .from('ci_proyectos')
    .select('id,nombre')
    .order('nombre')
    .limit(500);
  const nombrePorId = new Map(
    (proyectosRows ?? []).map((p) => [
      String((p as { id: string }).id),
      String((p as { nombre?: string }).nombre ?? 'Obra').trim() || 'Obra',
    ]),
  );

  let comprasQ = supabase
    .from('contabilidad_compras')
    .select(
      'id,fecha,proyecto_id,monto_usd,supplier_name,invoice_number,estado,origen,notas,imputacion',
    )
    .not('proyecto_id', 'is', null)
    .neq('imputacion', IMPUTACION_ENTIDAD)
    .order('fecha', { ascending: false })
    .limit(5000);
  if (proyectoId) comprasQ = comprasQ.eq('proyecto_id', proyectoId);
  const { data: compras, error: cErr } = await comprasQ;
  if (cErr) throw cErr;

  let inyQ = supabase
    .from('ci_inyecciones_capital')
    .select('id,fecha_ingreso,creado_al,monto_usd,proyecto_id')
    .order('fecha_ingreso', { ascending: false })
    .limit(5000);
  if (proyectoId) inyQ = inyQ.eq('proyecto_id', proyectoId);
  const { data: inyecciones, error: iErr } = await inyQ;
  if (iErr && iErr.code !== '42P01' && !/ci_inyecciones_capital|schema cache/i.test(iErr.message ?? '')) {
    throw iErr;
  }

  let honorariosPct = 12;
  if (proyectoId) {
    const { data: contrato } = await supabase
      .from('ci_contratos_express')
      .select('honorarios_admin_pct')
      .eq('proyecto_id', proyectoId)
      .limit(1)
      .maybeSingle();
    if (contrato && (contrato as { honorarios_admin_pct?: number }).honorarios_admin_pct != null) {
      honorariosPct = num((contrato as { honorarios_admin_pct?: number }).honorarios_admin_pct);
    }
  }

  const anios = new Set<number>();
  for (const c of compras ?? []) {
    const p = ymParts((c as { fecha?: string }).fecha);
    if (p) anios.add(p.anio);
  }
  for (const i of inyecciones ?? []) {
    const p = ymParts(
      (i as { fecha_ingreso?: string }).fecha_ingreso ??
        String((i as { creado_al?: string }).creado_al ?? ''),
    );
    if (p) anios.add(p.anio);
  }
  const aniosDisponibles = Array.from(anios).sort((a, b) => b - a);
  if (aniosDisponibles.length === 0) aniosDisponibles.push(new Date().getFullYear());

  const anio =
    params?.anio && aniosDisponibles.includes(params.anio)
      ? params.anio
      : aniosDisponibles[0];
  const mes =
    params?.mes != null && params.mes >= 1 && params.mes <= 12 ? params.mes : null;

  const filas: CcoEgresoFila[] = [];
  let egresos = 0;
  for (const raw of compras ?? []) {
    const c = raw as {
      id: string;
      fecha?: string;
      proyecto_id?: string;
      monto_usd?: number;
      supplier_name?: string;
      invoice_number?: string;
      estado?: string;
      origen?: string;
      notas?: string;
    };
    const p = ymParts(c.fecha);
    if (!p || p.anio !== anio) continue;
    if (mes != null && p.mes !== mes) continue;

    const monto = num(c.monto_usd);
    egresos += monto;
    const rubroNotas = parseRubroDesdeNotas(c.notas);
    const rubro =
      rubroNotas && esTipoGasto(rubroNotas.toUpperCase())
        ? rubroNotas.toUpperCase()
        : rubroNotas || clasificarTipoGasto(String(c.supplier_name ?? ''));
    const pid = String(c.proyecto_id ?? '').trim() || null;
    const proveedor = String(c.supplier_name ?? '').trim() || 'Sin proveedor';
    const factura = String(c.invoice_number ?? '').trim() || 'S/N';
    filas.push({
      id: String(c.id),
      fecha: String(c.fecha ?? '').slice(0, 10),
      descripcion: descripcionDesdeNotas(c.notas, `${proveedor} · ${factura}`),
      rubro,
      proveedor,
      factura,
      montoUsd: monto,
      estado: String(c.estado ?? 'REGISTRADA').trim() || 'REGISTRADA',
      origen: String(c.origen ?? '').trim() || 'CI',
      proyectoId: pid,
      proyectoNombre: pid ? nombrePorId.get(pid) ?? 'Obra' : 'Obra',
    });
  }

  let ingresos = 0;
  let countIngresos = 0;
  for (const raw of inyecciones ?? []) {
    const i = raw as {
      monto_usd?: number;
      fecha_ingreso?: string;
      creado_al?: string;
    };
    const p = ymParts(i.fecha_ingreso ?? String(i.creado_al ?? ''));
    if (!p || p.anio !== anio) continue;
    if (mes != null && p.mes !== mes) continue;
    ingresos += num(i.monto_usd);
    countIngresos += 1;
  }

  const adminDelegada = egresos * (honorariosPct / 100);
  const costoTotal = egresos + adminDelegada;

  return {
    proyectoId,
    anio,
    mes,
    honorariosPct,
    aniosDisponibles,
    filas,
    kpis: {
      ingresos,
      egresos,
      saldo: ingresos - costoTotal,
      adminDelegada,
      costoTotal,
      countEgresos: filas.length,
      countIngresos,
    },
  };
}

export async function crearEgresoManualCco(
  supabase: SupabaseClient,
  input: CcoEgresoAltaInput,
): Promise<{ id: string }> {
  const proyectoId = input.proyectoId.trim();
  if (!proyectoId) throw new Error('Selecciona una obra para registrar el egreso.');

  const fecha = String(input.fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida.');

  const montoUsd = num(input.montoUsd);
  if (!(montoUsd > 0)) throw new Error('El monto debe ser mayor a 0.');

  const rubroRaw = input.rubro.trim().toUpperCase();
  const rubro = esTipoGasto(rubroRaw) ? rubroRaw : 'MATERIALES';
  const descripcion = input.descripcion.trim() || 'Egreso manual CCO';
  const proveedor = input.proveedor?.trim() || `MANUAL ${rubro}`;
  const factura =
    input.factura?.trim() ||
    `CCO-EG-${fecha.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;

  const montos = await resolverMontosCompraBimonetario({
    montoTotal: montoUsd,
    moneda: 'USD',
    fecha,
  });
  const entidadId = await resolverEntidadIdDesdeProyecto(supabase, proyectoId);

  const { data: compra, error } = await supabase
    .from('contabilidad_compras')
    .insert({
      invoice_number: factura,
      supplier_rif: 'S/R',
      supplier_name: proveedor,
      fecha,
      ...payloadCompraBimonetario(montos),
      origen: 'CCO_MANUAL',
      estado: 'REGISTRADA',
      proyecto_id: proyectoId,
      imputacion: 'obra',
      ...(entidadId ? { entidad_id: entidadId } : {}),
      notas: buildNotasEgreso(rubro, descripcion),
    })
    .select('id')
    .single();

  if (error || !compra?.id) {
    throw new Error(error?.message ?? 'No se pudo registrar el egreso.');
  }

  const { error: lineErr } = await supabase.from('contabilidad_compra_lineas').insert({
    compra_id: compra.id,
    descripcion,
    item_code: null,
    unidad: 'UND',
    cantidad: 1,
    precio_unitario: montos.montoUsd,
    subtotal: montos.montoUsd,
  });
  if (lineErr) {
    // Compra ya creada; no tumbar por falla de línea opcional
    console.warn('[crearEgresoManualCco] línea:', lineErr.message);
  }

  return { id: String(compra.id) };
}

export async function eliminarEgresoCco(
  supabase: SupabaseClient,
  compraId: string,
): Promise<void> {
  const id = compraId.trim();
  if (!id) throw new Error('ID de egreso requerido.');
  await deleteCompraRegistro(supabase, id);
}
