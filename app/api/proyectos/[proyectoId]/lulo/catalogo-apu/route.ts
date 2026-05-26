import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { clasificarInsumoApu } from '@/lib/proyectos/apuCalculos';
import { apuVacio } from '@/lib/proyectos/calcularApuLuloWin';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import type {
  LuloWebErpApuPartida,
  LuloWebErpCapitulo,
  LuloWebErpConfig,
  LuloWebErpPartida,
  LuloWebErpPayload,
} from '@/types/lulo-web-erp';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const IN_BATCH = 80;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type InsumoRow = {
  codigo: string;
  descripcion: string;
  unidad: string;
  precio_base?: number;
  precio_unitario?: number;
  tipo: string | null;
  bono_diario?: number;
};

function tipoDbToClasificacion(tipo: string | null | undefined): 'material' | 'mano_obra' | 'equipo' {
  const t = String(tipo ?? '').trim();
  if (t === 'ManoDeObra') return 'mano_obra';
  if (t === 'Equipo') return 'equipo';
  if (t === 'Material') return 'material';
  return clasificarInsumoApu(t);
}

function esHerramientaMenor(descripcion: string, flag?: boolean): boolean {
  if (flag) return true;
  const d = descripcion.toLowerCase();
  return /herramientas?\s*menor|5\s*%.*mano|auto.*mo/.test(d);
}

function pushLineaApu(
  apu: LuloWebErpApuPartida,
  insumo: InsumoRow,
  cantidad: number,
  desperdicio: number,
): void {
  const cat = tipoDbToClasificacion(insumo.tipo);
  const precio = Number(insumo.precio_base ?? insumo.precio_unitario ?? 0);
  const codigo = String(insumo.codigo ?? '').trim();
  const descripcion = String(insumo.descripcion ?? codigo).trim();

  if (cat === 'material') {
    const factor = 1 + (Number.isFinite(desperdicio) ? desperdicio : 0) / 100;
    apu.materiales.push({
      codigo,
      descripcion,
      unidad: insumo.unidad || 'UND',
      cantidad: cantidad * factor,
      precio,
    });
    return;
  }

  if (cat === 'mano_obra') {
    apu.manoObra.push({
      codigo,
      descripcion,
      cantidad,
      salario: precio,
      bono: Number(insumo.bono_diario ?? 0),
    });
    return;
  }

  apu.equipos.push({
    codigo,
    descripcion,
    cantidad,
    tarifa: precio,
    esPorcentajeManoObra: esHerramientaMenor(descripcion),
  });
}

async function cargarConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
): Promise<LuloWebErpConfig> {
  const { data } = await supabase
    .from('ci_proyectos')
    .select('porcentaje_admin, porcentaje_utilidad')
    .eq('id', proyectoId)
    .maybeSingle();

  return {
    prestacionesSociales: 60,
    gastosAdministrativos: Number(data?.porcentaje_admin ?? 15) || 15,
    utilidad: Number(data?.porcentaje_utilidad ?? 10) || 10,
  };
}

async function cargarDesdeCatalogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
  proyectoNombre: string,
  codigoLulo: string | null,
  config: LuloWebErpConfig,
): Promise<LuloWebErpPayload | null> {
  const { data: caps, error: capErr } = await supabase
    .from('lulo_catalogo_capitulos')
    .select('id, num_cap, descripcion')
    .order('num_cap');
  if (capErr?.code === '42P01') return null;
  if (capErr) throw new Error(formatErrorMessage(capErr));
  if (!caps?.length) return null;

  const { data: partidas, error: pErr } = await supabase
    .from('lulo_catalogo_partidas')
    .select('id, codigo_lulo, capitulo_id, descripcion, unidad, cantidad, rendimiento');
  if (pErr) throw new Error(formatErrorMessage(pErr));

  const capitulos: LuloWebErpCapitulo[] = caps.map((c) => ({
    id: String(c.id),
    numCap: Number(c.num_cap),
    nombre: String(c.descripcion),
  }));

  const capKeyById = new Map(capitulos.map((c) => [c.id, c.id]));
  const sinCap = 'sin-capitulo';
  const partidasByCapitulo: Record<string, LuloWebErpPartida[]> = {};
  const apuByPartidaId: Record<string, LuloWebErpApuPartida> = {};

  const cantidadObra = new Map<string, number>();
  const { data: obraPartidas } = await supabase
    .from('ci_presupuesto_partidas')
    .select('codigo_partida, cantidad_presupuestada')
    .eq('proyecto_id', proyectoId);
  for (const row of obraPartidas ?? []) {
    const cod = String(row.codigo_partida ?? '').trim().toUpperCase();
    if (cod) cantidadObra.set(cod, Number(row.cantidad_presupuestada ?? 0));
  }

  for (const p of partidas ?? []) {
    const capId = p.capitulo_id ? capKeyById.get(String(p.capitulo_id)) : null;
    const capKey = capId ?? sinCap;
    if (!partidasByCapitulo[capKey]) partidasByCapitulo[capKey] = [];

    const codigo = String(p.codigo_lulo).trim();
    const partida: LuloWebErpPartida = {
      id: String(p.id),
      codigo,
      descripcion: String(p.descripcion),
      unidad: String(p.unidad || 'UND'),
      cantidad: cantidadObra.get(codigo.toUpperCase()) ?? Number(p.cantidad ?? 0),
      rendimiento: Number(p.rendimiento ?? 1) || 1,
    };
    partidasByCapitulo[capKey].push(partida);
    apuByPartidaId[partida.id] = apuVacio();
  }

  if (!capitulos.find((c) => c.id === sinCap) && partidasByCapitulo[sinCap]?.length) {
    capitulos.push({ id: sinCap, numCap: 9999, nombre: 'Sin capítulo' });
  }

  const partidaIds = (partidas ?? []).map((p) => p.id as string);
  if (partidaIds.length > 0) {
    const { data: lineas, error: lErr } = await supabase
      .from('lulo_catalogo_partida_insumos')
      .select(
        'partida_id, cantidad_diseno, es_auto_porcentaje, insumo:lulo_catalogo_insumos(codigo, descripcion, unidad, tipo, precio_unitario, bono_diario)',
      )
      .in('partida_id', partidaIds);
    if (lErr) throw new Error(formatErrorMessage(lErr));

    for (const row of lineas ?? []) {
      const pid = String(row.partida_id);
      const insumoRaw = row.insumo;
      const insumo = (Array.isArray(insumoRaw) ? insumoRaw[0] : insumoRaw) as InsumoRow | null;
      if (!insumo || !apuByPartidaId[pid]) continue;

      const descripcion = String(insumo.descripcion ?? '');
      if (row.es_auto_porcentaje || esHerramientaMenor(descripcion, true)) {
        apuByPartidaId[pid].equipos.push({
          codigo: insumo.codigo,
          descripcion,
          cantidad: 1,
          tarifa: 0,
          esPorcentajeManoObra: true,
        });
        continue;
      }

      pushLineaApu(
        apuByPartidaId[pid],
        insumo,
        Number(row.cantidad_diseno ?? 0),
        0,
      );
    }
  }

  return {
    fuente: 'lulo_catalogo',
    proyecto: { id: proyectoId, nombre: proyectoNombre, codigoLulo },
    config,
    capitulos,
    partidasByCapitulo,
    apuByPartidaId,
  };
}

async function cargarDesdeCascadaObra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
  proyectoNombre: string,
  codigoLulo: string | null,
  config: LuloWebErpConfig,
): Promise<LuloWebErpPayload | null> {
  const { data: caps, error: capErr } = await supabase
    .from('capitulos')
    .select('id, codigo, nombre')
    .eq('proyecto_id', proyectoId)
    .order('codigo');
  if (capErr?.code === '42P01') return null;
  if (capErr) throw new Error(formatErrorMessage(capErr));
  if (!caps?.length) return null;

  const capIds = caps.map((c) => c.id as string);
  const partidas: Array<{
    id: string;
    capitulo_id: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad_presupuestada: number;
  }> = [];
  for (const batch of chunk(capIds, IN_BATCH)) {
    const { data, error: pErr } = await supabase
      .from('partidas')
      .select('id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada')
      .in('capitulo_id', batch)
      .order('codigo');
    if (pErr) throw new Error(formatErrorMessage(pErr));
    if (data?.length) partidas.push(...data);
  }
  if (!partidas.length) return null;

  const partidaIds = partidas.map((p) => p.id as string);
  const apuRows: Array<{
    partida_id: string;
    tipo: string;
    codigo_insumo: string;
    descripcion: string;
    unidad: string;
    rendimiento: number;
    costo_unitario: number;
  }> = [];
  for (const batch of chunk(partidaIds, IN_BATCH)) {
    const { data, error: aErr } = await supabase
      .from('apu_items')
      .select(
        'partida_id, tipo, codigo_insumo, descripcion, unidad, rendimiento, costo_unitario',
      )
      .in('partida_id', batch);
    if (aErr?.code === '42P01') return null;
    if (aErr) throw new Error(formatErrorMessage(aErr));
    if (data?.length) apuRows.push(...data);
  }

  const capitulos: LuloWebErpCapitulo[] = caps.map((c, i) => {
    const cod = String(c.codigo ?? '').trim();
    const num = Number.parseInt(cod.replace(/\D/g, ''), 10);
    return {
      id: String(c.id),
      numCap: Number.isFinite(num) && num > 0 ? num : i + 1,
      nombre: String(c.nombre ?? cod),
    };
  });

  const capIdToKey = new Map(capitulos.map((c) => [c.id, c.id]));
  const partidasByCapitulo: Record<string, LuloWebErpPartida[]> = {};
  const apuByPartidaId: Record<string, LuloWebErpApuPartida> = {};

  for (const p of partidas) {
    const capKey = capIdToKey.get(String(p.capitulo_id)) ?? String(p.capitulo_id);
    if (!partidasByCapitulo[capKey]) partidasByCapitulo[capKey] = [];

    const partida: LuloWebErpPartida = {
      id: String(p.id),
      codigo: String(p.codigo).trim(),
      descripcion: String(p.descripcion),
      unidad: String(p.unidad || 'UND'),
      cantidad: Number(p.cantidad_presupuestada ?? 0),
      rendimiento: 1,
    };
    partidasByCapitulo[capKey].push(partida);
    apuByPartidaId[partida.id] = apuVacio();
  }

  for (const row of apuRows ?? []) {
    const pid = String(row.partida_id);
    const apu = apuByPartidaId[pid];
    if (!apu) continue;

    const tipo = String(row.tipo ?? 'material');
    const insumo: InsumoRow = {
      codigo: String(row.codigo_insumo ?? ''),
      descripcion: String(row.descripcion ?? row.codigo_insumo ?? ''),
      unidad: String(row.unidad ?? 'UND'),
      precio_base: Number(row.costo_unitario ?? 0),
      tipo:
        tipo === 'mano_obra'
          ? 'ManoDeObra'
          : tipo === 'equipo'
            ? 'Equipo'
            : 'Material',
    };

    if (tipo === 'mano_obra') {
      apu.manoObra.push({
        codigo: insumo.codigo,
        descripcion: insumo.descripcion,
        cantidad: Number(row.rendimiento ?? 0),
        salario: Number(row.costo_unitario ?? 0),
        bono: 0,
      });
      continue;
    }
    if (tipo === 'equipo') {
      apu.equipos.push({
        codigo: insumo.codigo,
        descripcion: insumo.descripcion,
        cantidad: Number(row.rendimiento ?? 0),
        tarifa: Number(row.costo_unitario ?? 0),
        esPorcentajeManoObra: esHerramientaMenor(insumo.descripcion),
      });
      continue;
    }

    apu.materiales.push({
      codigo: insumo.codigo,
      descripcion: insumo.descripcion,
      unidad: insumo.unidad,
      cantidad: Number(row.rendimiento ?? 0),
      precio: Number(row.costo_unitario ?? 0),
    });
  }

  return {
    fuente: 'cascada',
    proyecto: { id: proyectoId, nombre: proyectoNombre, codigoLulo },
    config,
    capitulos,
    partidasByCapitulo,
    apuByPartidaId,
  };
}

async function cargarDesdeCiPresupuesto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
  proyectoNombre: string,
  codigoLulo: string | null,
  config: LuloWebErpConfig,
): Promise<LuloWebErpPayload | null> {
  const { data: partidas, error: pErr } = await supabase
    .from('ci_presupuesto_partidas')
    .select(
      'id, codigo_partida, descripcion, unidad, cantidad_presupuestada, capitulo_codigo, capitulo_descripcion, capitulo_orden',
    )
    .eq('proyecto_id', proyectoId)
    .order('capitulo_orden', { ascending: true });
  if (pErr) throw new Error(formatErrorMessage(pErr));
  if (!partidas?.length) return null;

  const rendMap = new Map<string, number>();
  const codigos = partidas.map((p) => String(p.codigo_partida).trim()).filter(Boolean);
  if (codigos.length > 0) {
    const { data: cat } = await supabase
      .from('lulo_catalogo_partidas')
      .select('codigo_lulo, rendimiento')
      .in('codigo_lulo', codigos);
    for (const row of cat ?? []) {
      rendMap.set(String(row.codigo_lulo).toUpperCase(), Number(row.rendimiento ?? 1) || 1);
    }
  }

  const capBuckets = new Map<string, LuloWebErpCapitulo>();
  const partidasByCapitulo: Record<string, LuloWebErpPartida[]> = {};
  const apuByPartidaId: Record<string, LuloWebErpApuPartida> = {};

  for (const p of partidas) {
    const capCod = String(p.capitulo_codigo ?? '0').trim() || '0';
    const capId = `cap-${capCod}`;
    if (!capBuckets.has(capId)) {
      capBuckets.set(capId, {
        id: capId,
        numCap: Number(capCod) || 0,
        nombre: String(p.capitulo_descripcion ?? `Capítulo ${capCod}`),
      });
    }
    if (!partidasByCapitulo[capId]) partidasByCapitulo[capId] = [];

    const codigo = String(p.codigo_partida).trim();
    const partida: LuloWebErpPartida = {
      id: String(p.id),
      codigo,
      descripcion: String(p.descripcion),
      unidad: String(p.unidad || 'UND'),
      cantidad: Number(p.cantidad_presupuestada ?? 0),
      rendimiento: rendMap.get(codigo.toUpperCase()) ?? 1,
    };
    partidasByCapitulo[capId].push(partida);
    apuByPartidaId[partida.id] = apuVacio();
  }

  const capitulos = Array.from(capBuckets.values()).sort((a, b) => a.numCap - b.numCap);
  const ids = partidas.map((p) => p.id as string);

  const { data: apuRows, error: aErr } = await supabase
    .from('ci_presupuesto_partida_apu')
    .select(
      'partida_id, cantidad_rendimiento, desperdicio_porcentaje, insumo:ci_lulo_insumos_maestro(id, codigo, descripcion, unidad, precio_base, tipo)',
    )
    .in('partida_id', ids);
  if (aErr) throw new Error(formatErrorMessage(aErr));

  for (const row of apuRows ?? []) {
    const pid = String(row.partida_id);
    const insumoRaw = row.insumo;
    const insumo = (Array.isArray(insumoRaw) ? insumoRaw[0] : insumoRaw) as InsumoRow | null;
    if (!insumo || !apuByPartidaId[pid]) continue;
    pushLineaApu(
      apuByPartidaId[pid],
      { ...insumo, precio_base: insumo.precio_base },
      Number(row.cantidad_rendimiento ?? 0),
      Number(row.desperdicio_porcentaje ?? 0),
    );
  }

  return {
    fuente: 'ci_presupuesto',
    proyecto: { id: proyectoId, nombre: proyectoNombre, codigoLulo },
    config,
    capitulos,
    partidasByCapitulo,
    apuByPartidaId,
  };
}

/**
 * GET /api/proyectos/:proyectoId/lulo/catalogo-apu
 * Datos para la vista LuloWeb ERP (capítulos, partidas, APU por partida).
 */
export async function GET(
  _req: Request,
  { params }: { params: { proyectoId: string } },
) {
  try {
    const proyectoId = params.proyectoId?.trim() ?? '';
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json(
        { error: mensajeProyectoIdInvalido(proyectoId) },
        { status: 400 },
      );
    }

    const supabase =
      createSupabaseAdminOnlyClient() ?? (await createClient());

    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('id, nombre, codigo_lulo')
      .eq('id', proyectoId)
      .maybeSingle();

    const proyectoNombre = String(proy?.nombre ?? 'Proyecto');
    const codigoLulo = proy?.codigo_lulo ?? null;
    const config = await cargarConfig(supabase, proyectoId);

    const desdeObra =
      (await cargarDesdeCascadaObra(
        supabase,
        proyectoId,
        proyectoNombre,
        codigoLulo,
        config,
      )) ??
      (await cargarDesdeCiPresupuesto(
        supabase,
        proyectoId,
        proyectoNombre,
        codigoLulo,
        config,
      )) ??
      (await cargarDesdeCatalogo(
        supabase,
        proyectoId,
        proyectoNombre,
        codigoLulo,
        config,
      ));

    if (desdeObra) {
      return NextResponse.json(desdeObra);
    }

    const vacio: LuloWebErpPayload = {
      fuente: 'vacio',
      proyecto: { id: proyectoId, nombre: proyectoNombre, codigoLulo },
      config,
      capitulos: [],
      partidasByCapitulo: {},
      apuByPartidaId: {},
    };
    return NextResponse.json(vacio);
  } catch (err) {
    console.error('[catalogo-apu]', err);
    return NextResponse.json(
      { error: formatErrorMessage(err) },
      { status: 500 },
    );
  }
}
