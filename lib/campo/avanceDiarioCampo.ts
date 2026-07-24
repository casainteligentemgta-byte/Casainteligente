import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calcularEficienciaCampo,
  calcularRentabilidadDiaria,
} from '@/lib/campo/calculosAvance';
import type { AvanceDiarioCampo } from '@/types/campo';

export type PartidaCampoRow = {
  id: string;
  codigo: string;
  codigo_lulo: string | null;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  rendimiento: number;
  precio_unitario: number;
  monto_total: number;
  capitulo_id: string;
};

export async function listarPartidasCampoProyecto(
  supabase: SupabaseClient,
  proyectoId: string,
  limite = 40,
): Promise<PartidaCampoRow[]> {
  const selectConMontos =
    'id, codigo, codigo_lulo, descripcion, unidad, cantidad_presupuestada, rendimiento, precio_unitario, monto_total, capitulo_id, capitulos!inner(proyecto_id)';
  const selectBasico =
    'id, codigo, codigo_lulo, descripcion, unidad, cantidad_presupuestada, rendimiento, capitulo_id, capitulos!inner(proyecto_id)';

  let { data, error } = await supabase
    .from('partidas')
    .select(selectConMontos)
    .eq('capitulos.proyecto_id', proyectoId)
    .order('codigo')
    .limit(limite);

  if (error && /precio_unitario|monto_total|column/i.test(error.message ?? '')) {
    const retry = await supabase
      .from('partidas')
      .select(selectBasico)
      .eq('capitulos.proyecto_id', proyectoId)
      .order('codigo')
      .limit(limite);
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (error?.code === '42P01') return [];
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((p) => ({
    id: String(p.id),
    codigo: String(p.codigo_lulo ?? p.codigo),
    codigo_lulo: p.codigo_lulo != null ? String(p.codigo_lulo) : null,
    descripcion: String(p.descripcion ?? ''),
    unidad: String(p.unidad ?? 'UND'),
    cantidad_presupuestada: Number(p.cantidad_presupuestada ?? 0),
    rendimiento: Number(p.rendimiento ?? 1) || 1,
    precio_unitario: Number(p.precio_unitario ?? 0),
    monto_total: Number(p.monto_total ?? 0),
    capitulo_id: String(p.capitulo_id),
  }));

  const codigos = rows.map((r) => r.codigo).filter(Boolean);
  if (!codigos.length) return rows;

  const { data: cat } = await supabase
    .from('lulo_catalogo_partidas')
    .select('codigo_lulo, rendimiento')
    .in('codigo_lulo', codigos);
  const rendCat = new Map<string, number>();
  for (const c of cat ?? []) {
    const cod = String(c.codigo_lulo ?? '').trim().toUpperCase();
    const ren = Number(c.rendimiento ?? 0);
    if (cod && ren > 0) rendCat.set(cod, ren);
  }

  return rows.map((r) => {
    const renCat = rendCat.get(r.codigo.toUpperCase());
    if (renCat && r.rendimiento <= 1) {
      return { ...r, rendimiento: renCat };
    }
    return r;
  });
}

export async function costoDirectoUnitarioPartida(
  supabase: SupabaseClient,
  partidaId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('apu_items')
    .select('rendimiento, costo_unitario')
    .eq('partida_id', partidaId);
  if (error?.code === '42P01') return 0;
  if (error) return 0;
  let sum = 0;
  for (const row of data ?? []) {
    const ren = Number(row.rendimiento ?? 0);
    const costo = Number(row.costo_unitario ?? 0);
    sum += ren * costo;
  }
  return Math.round(sum * 100) / 100;
}

export type RegistrarAvanceInput = {
  proyectoId: string;
  partidaId: string;
  perfilId?: string | null;
  empleadoId?: string | null;
  cantidadEjecutadaHoy: number;
  fechaReporte?: string;
  telegramUserId?: string;
  notas?: string;
};

export async function registrarAvanceDiarioCampo(
  supabase: SupabaseClient,
  input: RegistrarAvanceInput,
): Promise<AvanceDiarioCampo & { eficienciaPct: number }> {
  const { data: partida, error: pErr } = await supabase
    .from('partidas')
    .select(
      'id, codigo, unidad, rendimiento, precio_unitario, monto_total, cantidad_presupuestada, capitulo_id, capitulos!inner(proyecto_id)',
    )
    .eq('id', input.partidaId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!partida) throw new Error('Partida no encontrada.');

  const rendimiento = Number(partida.rendimiento ?? 1) || 1;
  const cantidad = Math.max(0, input.cantidadEjecutadaHoy);
  const eficiencia = calcularEficienciaCampo(cantidad, rendimiento);

  let precioUnitario = Number(partida.precio_unitario ?? 0);
  if (!(precioUnitario > 0)) {
    const cantPres = Number(partida.cantidad_presupuestada ?? 0);
    const monto = Number(partida.monto_total ?? 0);
    if (cantPres > 0 && monto > 0) precioUnitario = monto / cantPres;
  }
  const costoDirecto = await costoDirectoUnitarioPartida(supabase, input.partidaId);
  const rentabilidad = calcularRentabilidadDiaria(
    cantidad,
    precioUnitario,
    costoDirecto,
  );

  const fecha =
    input.fechaReporte ?? new Date().toISOString().slice(0, 10);

  const payload: Record<string, unknown> = {
    proyecto_id: input.proyectoId,
    partida_id: input.partidaId,
    perfil_id: input.perfilId ?? null,
    empleado_id: input.empleadoId ?? null,
    fecha_reporte: fecha,
    cantidad_ejecutada_hoy: cantidad,
    rendimiento_teorico: rendimiento,
    eficiencia_calculada: eficiencia,
    rentabilidad_diaria: rentabilidad,
    unidad: String(partida.unidad ?? 'UND'),
    notas: input.notas ?? null,
    telegram_user_id: input.telegramUserId ?? null,
  };

  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;

  const q = supabase
    .from('avance_diario_campo')
    .select('id')
    .eq('partida_id', input.partidaId)
    .eq('fecha_reporte', fecha);
  let existingQuery = q;
  if (input.empleadoId) {
    existingQuery = existingQuery.eq('empleado_id', input.empleadoId);
  } else if (input.perfilId) {
    existingQuery = existingQuery.eq('perfil_id', input.perfilId);
  } else {
    existingQuery = existingQuery.is('perfil_id', null).is('empleado_id', null);
  }
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.id) {
    const upd = await supabase
      .from('avance_diario_campo')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    data = upd.data as Record<string, unknown>;
    error = upd.error;
  } else {
    let ins = await supabase.from('avance_diario_campo').insert(payload).select('*').single();
    if (ins.error && /empleado_id|column/i.test(ins.error.message ?? '')) {
      const { empleado_id: _e, ...sinEmp } = payload;
      ins = await supabase.from('avance_diario_campo').insert(sinEmp).select('*').single();
    }
    data = ins.data as Record<string, unknown>;
    error = ins.error;
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No se pudo guardar el avance.');

  await sincronizarAvanceCronograma(supabase, input.proyectoId, input.partidaId).catch(
    () => undefined,
  );

  return {
    id: String(data.id),
    proyecto_id: String(data.proyecto_id),
    partida_id: String(data.partida_id),
    perfil_id: data.perfil_id != null ? String(data.perfil_id) : null,
    fecha_reporte: String(data.fecha_reporte),
    cantidad_ejecutada_hoy: Number(data.cantidad_ejecutada_hoy),
    rendimiento_teorico: Number(data.rendimiento_teorico),
    eficiencia_calculada: Number(data.eficiencia_calculada),
    rentabilidad_diaria: Number(data.rentabilidad_diaria),
    unidad: String(data.unidad),
    notas: data.notas != null ? String(data.notas) : null,
    created_at: String(data.created_at),
    eficienciaPct: eficiencia,
  };
}

/** Actualiza % avance en cronograma_tareas si existe la partida legacy. */
async function sincronizarAvanceCronograma(
  supabase: SupabaseClient,
  proyectoId: string,
  partidaCascadaId: string,
): Promise<void> {
  const { data: p } = await supabase
    .from('partidas')
    .select('codigo, cantidad_presupuestada')
    .eq('id', partidaCascadaId)
    .maybeSingle();
  if (!p?.codigo) return;

  const codigo = String(p.codigo).trim();
  const cantPres = Number(p.cantidad_presupuestada ?? 0);
  if (!(cantPres > 0)) return;

  const { data: avances } = await supabase
    .from('avance_diario_campo')
    .select('cantidad_ejecutada_hoy')
    .eq('partida_id', partidaCascadaId);
  const acumulado = (avances ?? []).reduce(
    (s, r) => s + Number(r.cantidad_ejecutada_hoy ?? 0),
    0,
  );
  const pct = Math.min(100, Math.round((acumulado / cantPres) * 10000) / 100);

  const { data: ciPart } = await supabase
    .from('ci_presupuesto_partidas')
    .select('id')
    .eq('proyecto_id', proyectoId)
    .eq('codigo_partida', codigo)
    .maybeSingle();
  if (!ciPart?.id) return;

  await supabase
    .from('cronograma_tareas')
    .update({ porcentaje_avance: pct, updated_at: new Date().toISOString() })
    .eq('proyecto_id', proyectoId)
    .eq('partida_id', ciPart.id);
}
