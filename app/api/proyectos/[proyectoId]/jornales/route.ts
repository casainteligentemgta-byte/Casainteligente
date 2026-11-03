import { NextResponse } from 'next/server';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { listarEmpleadosProyectoEgreso } from '@/lib/almacen/listarEmpleadosProyectoEgreso';
import {
  esMigracionJornalesPendiente,
} from '@/lib/proyectos/jornales/calcularJornalesSemana';
import {
  cargarJornalesSemana,
  resolverCostoJornal,
} from '@/lib/proyectos/jornales/cargarJornalesProyecto';
import {
  hoyIsoCaracas,
  lunesDeSemanaJornales,
} from '@/lib/proyectos/jornales/semanaJornales';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import type { JornalesPostBody } from '@/types/jornales';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

export async function GET(req: Request, { params }: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['equipo.gestionar']);
  if (!acceso.ok) return acceso.response;

  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  const url = new URL(req.url);
  const semana = url.searchParams.get('semana_inicio')?.trim() || hoyIsoCaracas();

  try {
    const payload = await cargarJornalesSemana(acceso.supabase, proyectoId, semana);
    return NextResponse.json(payload);
  } catch (err) {
    const msg = formatErrorMessage(err);
    const status = /no encontrado/i.test(msg) ? 404 : /migración 382/i.test(msg) ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request, { params }: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['equipo.gestionar']);
  if (!acceso.ok) return acceso.response;

  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  let body: JornalesPostBody;
  try {
    body = (await req.json()) as JornalesPostBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const supabase = acceso.supabase;

  try {
    if (body.accion === 'tarifa') {
      const empleadoId = body.empleado_id?.trim();
      const costo = Number(body.costo_jornal_usd);
      if (!empleadoId) return NextResponse.json({ error: 'Falta empleado_id' }, { status: 400 });
      if (!Number.isFinite(costo) || costo < 0) {
        return NextResponse.json({ error: 'Jornal diario inválido' }, { status: 400 });
      }
      const { error } = await supabase.from('ci_jornales_obra_tarifas').upsert(
        {
          proyecto_id: proyectoId,
          empleado_id: empleadoId,
          costo_jornal_usd: costo,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'proyecto_id,empleado_id' },
      );
      if (error) throw error;
      if (body.aplicar_semana) {
        const lunes = lunesDeSemanaJornales(body.semana_inicio || hoyIsoCaracas());
        await supabase
          .from('ci_jornales_obra_asistencias')
          .update({ costo_jornal: costo, updated_at: new Date().toISOString() })
          .eq('proyecto_id', proyectoId)
          .eq('empleado_id', empleadoId)
          .gte('fecha', lunes);
      }
      const payload = await cargarJornalesSemana(
        supabase,
        proyectoId,
        body.semana_inicio || hoyIsoCaracas(),
      );
      return NextResponse.json(payload);
    }

    if (body.accion === 'toggle') {
      const empleadoId = body.empleado_id?.trim();
      const fecha = body.fecha?.slice(0, 10);
      if (!empleadoId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
        return NextResponse.json({ error: 'empleado_id y fecha (YYYY-MM-DD) son obligatorios' }, { status: 400 });
      }
      if (body.presente) {
        const costo = await resolverCostoJornal(supabase, proyectoId, empleadoId, body.costo_jornal);
        const { error } = await supabase.from('ci_jornales_obra_asistencias').upsert(
          {
            proyecto_id: proyectoId,
            empleado_id: empleadoId,
            fecha,
            costo_jornal: costo,
            estado: 'presente',
            origen: 'web',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'proyecto_id,empleado_id,fecha' },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ci_jornales_obra_asistencias')
          .delete()
          .eq('proyecto_id', proyectoId)
          .eq('empleado_id', empleadoId)
          .eq('fecha', fecha);
        if (error) throw error;
      }
      const payload = await cargarJornalesSemana(supabase, proyectoId, fecha);
      return NextResponse.json(payload);
    }

    if (body.accion === 'marcar_hoy') {
      const hoy = hoyIsoCaracas();
      const roster = await listarEmpleadosProyectoEgreso(supabase, proyectoId);
      const { data: ya } = await supabase
        .from('ci_jornales_obra_asistencias')
        .select('empleado_id')
        .eq('proyecto_id', proyectoId)
        .eq('fecha', hoy);
      const yaSet = new Set((ya ?? []).map((r) => String((r as { empleado_id: string }).empleado_id)));
      const filas = [];
      for (const emp of roster) {
        if (yaSet.has(emp.id)) continue;
        const costo = await resolverCostoJornal(supabase, proyectoId, emp.id, body.costo_jornal);
        filas.push({
          proyecto_id: proyectoId,
          empleado_id: emp.id,
          fecha: hoy,
          costo_jornal: costo,
          estado: 'presente',
          origen: 'web',
        });
      }
      if (filas.length) {
        const { error } = await supabase.from('ci_jornales_obra_asistencias').insert(filas);
        if (error) throw error;
      }
      const payload = await cargarJornalesSemana(supabase, proyectoId, hoy);
      return NextResponse.json({ ...payload, marcados: filas.length, fecha: hoy });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err) {
    const msg = formatErrorMessage(err);
    if (esMigracionJornalesPendiente(msg)) {
      return NextResponse.json(
        { error: 'Aplique la migración 382_ci_jornales_obra_y_desviacion.sql en Supabase.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
