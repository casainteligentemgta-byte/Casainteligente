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
import {
  cargarDescripcionesCatalogoPorCodigo,
  cargarRendimientoCatalogoPorCodigo,
  completarApuPartidasObra,
  completarPrecioUnitarioPartidas,
  completarMontoTotalPartidas,
  cantidadRendimientoApuLinea,
  fetchApuItemsCascada,
  finalizarCapitulosSidebar,
  normalizarCodigoLulo,
  numCapDesdeCodigo,
  resolverCapitulosSidebarObra,
  resolverDescripcionPartida,
} from '@/lib/proyectos/luloCatalogoApuHelpers';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const IN_BATCH = 80;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function coalesceNum(v: unknown): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
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
    codigo: String(c.num_cap ?? ''),
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
      precioUnitario: 0,
      montoTotal: 0,
      rendimiento: Number(p.rendimiento ?? 1) || 1,
    };
    partidasByCapitulo[capKey].push(partida);
    apuByPartidaId[partida.id] = apuVacio();
  }

  if (!capitulos.find((c) => c.id === sinCap) && partidasByCapitulo[sinCap]?.length) {
    capitulos.push({ id: sinCap, codigo: '0', numCap: 9999, nombre: 'Sin capítulo' });
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
    capitulos: finalizarCapitulosSidebar(capitulos, partidasByCapitulo),
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

  type PartidaRow = {
    id: string;
    capitulo_id: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad_presupuestada: number;
    precio_unitario?: number;
    monto_total?: number;
  };

  async function fetchPartidasPorProyecto(
    selectCols: string,
  ): Promise<{ rows: PartidaRow[]; error: { message?: string } | null }> {
    const { data, error } = await supabase
      .from('partidas')
      .select(selectCols)
      .eq('capitulos.proyecto_id', proyectoId)
      .order('codigo');
    return { rows: (data as PartidaRow[] | null) ?? [], error };
  }

  const selectCompleto =
    'id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada, precio_unitario, monto_total, capitulos!inner(proyecto_id)';
  const selectSinMonto =
    'id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada, precio_unitario, capitulos!inner(proyecto_id)';
  const selectBasico =
    'id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada, capitulos!inner(proyecto_id)';

  let partidas: PartidaRow[] = [];
  let joined = await fetchPartidasPorProyecto(selectCompleto);
  if (joined.error && /monto_total|column/i.test(joined.error.message ?? '')) {
    joined = await fetchPartidasPorProyecto(selectSinMonto);
  }
  if (joined.error && /precio_unitario|column/i.test(joined.error.message ?? '')) {
    joined = await fetchPartidasPorProyecto(selectBasico);
  }
  if (joined.error) {
    const capIds = caps.map((c) => c.id as string);
    for (const batch of chunk(capIds, IN_BATCH)) {
      let data: PartidaRow[] | null = null;
      let pErr: { message?: string } | null = null;
      const withMontos = await supabase
        .from('partidas')
        .select(
          'id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada, precio_unitario, monto_total',
        )
        .in('capitulo_id', batch)
        .order('codigo');
      data = (withMontos.data as PartidaRow[] | null) ?? null;
      pErr = withMontos.error;
      if (pErr && /monto_total|column/i.test(pErr.message ?? '')) {
        const soloPu = await supabase
          .from('partidas')
          .select(
            'id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada, precio_unitario',
          )
          .in('capitulo_id', batch)
          .order('codigo');
        data = (soloPu.data as PartidaRow[] | null) ?? null;
        pErr = soloPu.error;
      }
      if (pErr && /precio_unitario|column/i.test(pErr.message ?? '')) {
        const sinPu = await supabase
          .from('partidas')
          .select('id, capitulo_id, codigo, descripcion, unidad, cantidad_presupuestada')
          .in('capitulo_id', batch)
          .order('codigo');
        data = (sinPu.data as PartidaRow[] | null) ?? null;
        pErr = sinPu.error;
      }
      if (pErr) throw new Error(formatErrorMessage(pErr));
      if (data?.length) partidas.push(...data);
    }
  } else {
    partidas = joined.rows;
  }

  if (!partidas.length) return null;

  const partidaIds = partidas.map((p) => p.id as string);
  let apuRows: Awaited<ReturnType<typeof fetchApuItemsCascada>> = [];
  try {
    apuRows = await fetchApuItemsCascada(supabase, partidaIds);
  } catch (aErr: unknown) {
    const code = (aErr as { code?: string })?.code;
    if (code === '42P01') {
      apuRows = [];
    } else {
      throw new Error(formatErrorMessage(aErr));
    }
  }

  const codigosPartida = partidas.map((p) => String(p.codigo));
  const [rendMap, descMap] = await Promise.all([
    cargarRendimientoCatalogoPorCodigo(supabase, codigosPartida),
    cargarDescripcionesCatalogoPorCodigo(supabase, codigosPartida),
  ]);

  const capitulos: LuloWebErpCapitulo[] = caps.map((c, i) => {
    const cod = String(c.codigo ?? '').trim();
    return {
      id: String(c.id),
      codigo: cod || String(i + 1),
      numCap: numCapDesdeCodigo(cod, i + 1),
      nombre: String(c.nombre ?? cod).trim() || `Capítulo ${cod}`,
    };
  });

  const capIdToKey = new Map(capitulos.map((c) => [c.id, c.id]));
  const partidasByCapitulo: Record<string, LuloWebErpPartida[]> = {};
  const apuByPartidaId: Record<string, LuloWebErpApuPartida> = {};

  for (const p of partidas) {
    const capKey = capIdToKey.get(String(p.capitulo_id)) ?? String(p.capitulo_id);
    if (!partidasByCapitulo[capKey]) partidasByCapitulo[capKey] = [];

    const codigo = String(p.codigo).trim();
    const partida: LuloWebErpPartida = {
      id: String(p.id),
      codigo,
      descripcion: resolverDescripcionPartida(
        codigo,
        String(p.descripcion),
        descMap,
      ),
      unidad: String(p.unidad || 'UND'),
      cantidad: Number(p.cantidad_presupuestada ?? 0),
      precioUnitario: coalesceNum(p.precio_unitario),
      montoTotal: coalesceNum(p.monto_total),
      rendimiento:
        rendMap.get(codigo.toUpperCase()) ??
        rendMap.get(normalizarCodigoLulo(codigo)) ??
        1,
    };
    partidasByCapitulo[capKey].push(partida);
    apuByPartidaId[partida.id] = apuVacio();
  }

  for (const row of apuRows) {
    const pid = String(row.partida_id);
    const apu = apuByPartidaId[pid];
    if (!apu) continue;

    pushLineaApu(
      apu,
      {
        codigo: String(row.codigo_insumo ?? ''),
        descripcion: String(row.descripcion ?? row.codigo_insumo ?? ''),
        unidad: String(row.unidad ?? 'UND'),
        precio_base: Number(row.costo_unitario ?? 0),
        tipo: String(row.tipo ?? 'material'),
      },
      cantidadRendimientoApuLinea(row.rendimiento),
      0,
    );
  }

  const partidasFlat = Object.values(partidasByCapitulo).flat();
  await completarApuPartidasObra(
    supabase,
    proyectoId,
    partidasFlat,
    apuByPartidaId,
    pushLineaApu,
    esHerramientaMenor,
  );
  completarPrecioUnitarioPartidas(partidasByCapitulo, apuByPartidaId, config);
  completarMontoTotalPartidas(partidasByCapitulo);

  const capitulosSidebar = resolverCapitulosSidebarObra(capitulos, partidasByCapitulo);

  if (!capitulosSidebar.length) return null;

  return {
    fuente: 'cascada',
    proyecto: { id: proyectoId, nombre: proyectoNombre, codigoLulo },
    config,
    capitulos: capitulosSidebar,
    partidasByCapitulo,
    apuByPartidaId,
  };
}

async function contarCapitulosObra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('capitulos')
    .select('id', { count: 'exact', head: true })
    .eq('proyecto_id', proyectoId);
  if (error?.code === '42P01') return 0;
  if (error) return 0;
  return count ?? 0;
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
      'id, codigo_partida, descripcion, unidad, cantidad_presupuestada, precio_unitario_estimado, monto_total_estimado, capitulo_codigo, capitulo_descripcion, capitulo_orden',
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
        codigo: capCod,
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
      precioUnitario: coalesceNum(p.precio_unitario_estimado),
      montoTotal: coalesceNum(p.monto_total_estimado),
      rendimiento:
        rendMap.get(codigo.toUpperCase()) ??
        rendMap.get(normalizarCodigoLulo(codigo)) ??
        1,
    };
    partidasByCapitulo[capId].push(partida);
    apuByPartidaId[partida.id] = apuVacio();
  }

  const capitulos = finalizarCapitulosSidebar(
    Array.from(capBuckets.values()),
    partidasByCapitulo,
  );
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

  const partidasCi = Object.values(partidasByCapitulo).flat();
  await completarApuPartidasObra(
    supabase,
    proyectoId,
    partidasCi,
    apuByPartidaId,
    pushLineaApu,
    esHerramientaMenor,
  );
  completarPrecioUnitarioPartidas(partidasByCapitulo, apuByPartidaId, config);
  completarMontoTotalPartidas(partidasByCapitulo);

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

    const supabaseAdmin = createSupabaseAdminOnlyClient();
    const supabaseSession = await createClient();
    const supabase = supabaseAdmin ?? supabaseSession;

    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('id, nombre, codigo_lulo')
      .eq('id', proyectoId)
      .maybeSingle();

    const proyectoNombre = String(proy?.nombre ?? 'Proyecto');
    const codigoLulo = proy?.codigo_lulo ?? null;
    const config = await cargarConfig(supabase, proyectoId);

    const capsObra = await contarCapitulosObra(supabase, proyectoId);

    const desdeObra = await cargarDesdeCascadaObra(
      supabase,
      proyectoId,
      proyectoNombre,
      codigoLulo,
      config,
    );

    if (desdeObra?.capitulos.length) {
      return NextResponse.json(desdeObra);
    }

    // Proyecto con capítulos en obra pero cascada vacía: reintento con cliente admin si hace falta
    if (capsObra > 0 && supabaseAdmin && supabase !== supabaseAdmin) {
      const retryAdmin = await cargarDesdeCascadaObra(
        supabaseAdmin,
        proyectoId,
        proyectoNombre,
        codigoLulo,
        config,
      );
      if (retryAdmin?.capitulos.length) {
        return NextResponse.json(retryAdmin);
      }
    }

    // Obra importada: no usar catálogo global (*ARME01…); pedir reimportar si sigue vacío
    if (capsObra > 0) {
      return NextResponse.json({
        fuente: 'cascada' as const,
        proyecto: { id: proyectoId, nombre: proyectoNombre, codigoLulo },
        config,
        capitulos: [],
        partidasByCapitulo: {},
        apuByPartidaId: {},
        aviso:
          'Hay capítulos en la obra pero ninguno tiene partidas enlazadas. Ejecuta: npm run import:lulo-mdb -- --proyecto ' +
          proyectoId +
          ' --mdb "…FLAMBO1E.MDB" --codigo-obra FLAMBO1E --reemplazar',
      });
    }

    const desdeCi = await cargarDesdeCiPresupuesto(
      supabase,
      proyectoId,
      proyectoNombre,
      codigoLulo,
      config,
    );

    const desdeCatalogo =
      (await cargarDesdeCatalogo(
        supabase,
        proyectoId,
        proyectoNombre,
        codigoLulo,
        config,
      )) ?? desdeCi;

    if (desdeCatalogo?.capitulos.length) {
      return NextResponse.json({
        ...desdeCatalogo,
        capitulos: finalizarCapitulosSidebar(
          desdeCatalogo.capitulos,
          desdeCatalogo.partidasByCapitulo,
        ),
      });
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
