import { NextResponse } from 'next/server';
import {
  parseFormaPago,
  parseJornada,
  parseTipoContrato,
  salarioBasicoDiarioVesDesdeNivel,
} from '@/lib/talento/contratoGacetaLaboral';
import { resolverPatronoDesdeEntidad } from '@/lib/talento/contratoObreroPdfContext';
import { supabaseForRoute } from '@/lib/talento/supabase-route';

function formatDate(d?: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function estimateDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return 'No definida';
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 'No definida';
  const days = Math.ceil((b.getTime() - a.getTime()) / 86400000);
  const months = Math.max(1, Math.round(days / 30));
  return `${months} mes${months === 1 ? '' : 'es'}`;
}

export async function GET(_req: Request, context: { params: { id: string } }) {
  const id = context.params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de contrato' }, { status: 400 });
  }

  const sb = supabaseForRoute();
  if (!sb.ok) return sb.response;
  const supabase = sb.client;

  const { data: contratoRaw, error: e1 } = await supabase
    .from('ci_contratos_empleado_obra')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const contrato = contratoRaw as {
    id: string;
    empleado_id: string;
    obra_id?: string | null;
    proyecto_id?: string | null;
    monto_acordado_usd?: number | null;
    porcentaje_inicial?: number | null;
    texto_legal: string;
    created_at: string;
    fecha_ingreso?: string | null;
    recruitment_need_id?: string | null;
    cargo_oficio_desempeño?: string | null;
    tabulador_nivel?: number | null;
    salario_basico_diario_ves?: number | null;
    forma_pago?: string | null;
    lugar_pago?: string | null;
    jornada_trabajo?: string | null;
    lugar_prestacion_servicio?: string | null;
    tipo_contrato?: string | null;
    objeto_contrato?: string | null;
    numero_oficio_tabulador?: string | null;
    gaceta_denominacion_oficio?: string | null;
  } | null;

  if (e1 || !contrato) {
    return NextResponse.json({ error: e1?.message ?? 'Contrato no encontrado' }, { status: 404 });
  }

  const vinculoId = contrato.obra_id ?? contrato.proyecto_id ?? null;
  if (!vinculoId) {
    return NextResponse.json(
      { error: 'El contrato no tiene obra_id ni proyecto_id. Ajusta el esquema.' },
      { status: 500 },
    );
  }

  const [empRes, obraRes] = await Promise.all([
    supabase
      .from('ci_empleados')
      .select('id,nombre_completo,cedula,documento,direccion_habitacion')
      .eq('id', contrato.empleado_id)
      .maybeSingle(),
    supabase
      .from('ci_proyectos')
      .select('id,nombre,ubicacion_texto,obra_ubicacion,obra_fecha_inicio,obra_fecha_entrega,entidad_id')
      .eq('id', vinculoId)
      .maybeSingle(),
  ]);

  if (empRes.error || !empRes.data) {
    return NextResponse.json({ error: empRes.error?.message ?? 'Empleado no encontrado' }, { status: 404 });
  }
  if (obraRes.error || !obraRes.data) {
    return NextResponse.json({ error: obraRes.error?.message ?? 'Obra no encontrada' }, { status: 404 });
  }

  const empleado = empRes.data as {
    nombre_completo: string;
    cedula: string | null;
    documento: string | null;
    direccion_habitacion?: string | null;
  };
  const obraRaw = obraRes.data as {
    nombre: string;
    ubicacion_texto?: string | null;
    obra_ubicacion?: string | null;
    obra_fecha_inicio?: string | null;
    obra_fecha_entrega?: string | null;
    entidad_id?: string | null;
  };
  const obra = {
    nombre: obraRaw.nombre,
    ubicacion: obraRaw.obra_ubicacion ?? obraRaw.ubicacion_texto ?? null,
    fecha_inicio: obraRaw.obra_fecha_inicio ?? null,
    fecha_fin: obraRaw.obra_fecha_entrega ?? null,
  };

  const entidadIdProyecto =
    obraRaw.entidad_id != null && String(obraRaw.entidad_id).trim() ? String(obraRaw.entidad_id).trim() : null;
  const patrono = await resolverPatronoDesdeEntidad(supabase, entidadIdProyecto);

  const nivel = contrato.tabulador_nivel ?? 0;
  const salVes = contrato.salario_basico_diario_ves;
  const salarioTxt =
    salVes != null && Number.isFinite(Number(salVes)) ? `${Number(salVes).toFixed(2)} VES (tabulador)` : 'N/D';

  return NextResponse.json({
    id: contrato.id,
    empleado: {
      nombre: empleado.nombre_completo,
      cedula: empleado.cedula ?? empleado.documento ?? 'No registrada',
      direccion: empleado.direccion_habitacion ?? 'No registrada',
    },
    patrono: {
      nombre: patrono.nombre,
      /** Domicilio fiscal desde `ci_entidades` del proyecto (no se edita en el contrato). */
      domicilio_fiscal: patrono.domicilio,
      representante: patrono.representante || null,
    },
    proyecto: {
      nombre: obra.nombre,
      ubicacion: obra.ubicacion ?? 'No definida',
      duracion_estimada: estimateDuration(obra.fecha_inicio, obra.fecha_fin),
    },
    contrato: {
      cargo: (contrato.cargo_oficio_desempeño ?? '').trim() || 'Perfil técnico asignado',
      nivel,
      salario_diario: salarioTxt,
      bono_asistencia: 'N/D',
      fecha_inicio: formatDate(contrato.fecha_ingreso ?? undefined) ?? formatDate(obra.fecha_inicio) ?? formatDate(contrato.created_at) ?? 'No definida',
      monto_acordado_usd: contrato.monto_acordado_usd ?? null,
      porcentaje_inicial: contrato.porcentaje_inicial ?? null,
      texto_legal: contrato.texto_legal,
      laboral: {
        fecha_ingreso: contrato.fecha_ingreso ?? null,
        recruitment_need_id: contrato.recruitment_need_id ?? null,
        cargo_oficio_desempeño: contrato.cargo_oficio_desempeño ?? null,
        tabulador_nivel: contrato.tabulador_nivel ?? null,
        salario_basico_diario_ves: contrato.salario_basico_diario_ves ?? null,
        forma_pago: contrato.forma_pago ?? null,
        lugar_pago: contrato.lugar_pago ?? null,
        jornada_trabajo: contrato.jornada_trabajo ?? null,
        lugar_prestacion_servicio: contrato.lugar_prestacion_servicio ?? null,
        tipo_contrato: contrato.tipo_contrato ?? null,
        objeto_contrato: contrato.objeto_contrato ?? null,
        numero_oficio_tabulador: contrato.numero_oficio_tabulador ?? null,
        gaceta_denominacion_oficio: contrato.gaceta_denominacion_oficio ?? null,
      },
    },
  });
}

/** Campos laborales Gaceta / LOTTT editables por admin o RRHH. */
export async function PATCH(req: Request, context: { params: { id: string } }) {
  const id = context.params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Falta id de contrato' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const sb = supabaseForRoute();
  if (!sb.ok) return sb.response;
  const supabase = sb.client;

  const { data: exists, error: e0 } = await supabase.from('ci_contratos_empleado_obra').select('id').eq('id', id).maybeSingle();
  if (e0 || !exists) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  if ('fecha_ingreso' in body) {
    const raw = body.fecha_ingreso;
    if (raw === null || raw === '') {
      patch.fecha_ingreso = null;
    } else {
      const d = new Date(String(raw).trim());
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'fecha_ingreso inválida' }, { status: 400 });
      }
      patch.fecha_ingreso = d.toISOString().slice(0, 10);
    }
  }

  if ('forma_pago' in body) {
    const v = body.forma_pago;
    if (v === null || v === '') patch.forma_pago = null;
    else {
      const p = parseFormaPago(v);
      if (!p) return NextResponse.json({ error: 'forma_pago debe ser transferencia, efectivo o pago_movil' }, { status: 400 });
      patch.forma_pago = p;
    }
  }

  if ('lugar_pago' in body) {
    patch.lugar_pago = body.lugar_pago == null || body.lugar_pago === '' ? null : String(body.lugar_pago).trim();
  }

  if ('jornada_trabajo' in body) {
    const v = body.jornada_trabajo;
    if (v === null || v === '') patch.jornada_trabajo = null;
    else {
      const p = parseJornada(v);
      if (!p) return NextResponse.json({ error: 'jornada_trabajo debe ser diurna, nocturna o mixta' }, { status: 400 });
      patch.jornada_trabajo = p;
    }
  }

  if ('lugar_prestacion_servicio' in body) {
    patch.lugar_prestacion_servicio =
      body.lugar_prestacion_servicio == null || body.lugar_prestacion_servicio === ''
        ? null
        : String(body.lugar_prestacion_servicio).trim();
  }

  if ('tipo_contrato' in body) {
    const v = body.tipo_contrato;
    if (v === null || v === '') patch.tipo_contrato = null;
    else {
      const p = parseTipoContrato(v);
      if (!p) {
        return NextResponse.json(
          { error: 'tipo_contrato debe ser tiempo_determinado o tiempo_indeterminado' },
          { status: 400 },
        );
      }
      patch.tipo_contrato = p;
    }
  }

  if ('objeto_contrato' in body) {
    patch.objeto_contrato =
      body.objeto_contrato == null || body.objeto_contrato === '' ? null : String(body.objeto_contrato).trim();
  }

  if ('cargo_oficio_desempeño' in body) {
    patch.cargo_oficio_desempeño =
      body.cargo_oficio_desempeño == null || body.cargo_oficio_desempeño === ''
        ? null
        : String(body.cargo_oficio_desempeño).trim();
  }

  if ('numero_oficio_tabulador' in body) {
    patch.numero_oficio_tabulador =
      body.numero_oficio_tabulador == null || body.numero_oficio_tabulador === ''
        ? null
        : String(body.numero_oficio_tabulador).trim();
  }

  if ('gaceta_denominacion_oficio' in body) {
    patch.gaceta_denominacion_oficio =
      body.gaceta_denominacion_oficio == null || body.gaceta_denominacion_oficio === ''
        ? null
        : String(body.gaceta_denominacion_oficio).trim();
  }

  if ('salario_basico_diario_ves' in body) {
    const n = Number(body.salario_basico_diario_ves);
    if (body.salario_basico_diario_ves === null || body.salario_basico_diario_ves === '') {
      patch.salario_basico_diario_ves = null;
    } else if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: 'salario_basico_diario_ves inválido' }, { status: 400 });
    } else {
      patch.salario_basico_diario_ves = n;
    }
  }

  if ('tabulador_nivel' in body) {
    const n = Number(body.tabulador_nivel);
    if (body.tabulador_nivel === null || body.tabulador_nivel === '') {
      patch.tabulador_nivel = null;
    } else if (!Number.isInteger(n) || n < 1 || n > 9) {
      return NextResponse.json({ error: 'tabulador_nivel debe ser entero 1–9' }, { status: 400 });
    } else {
      patch.tabulador_nivel = n;
      if (!('salario_basico_diario_ves' in body)) {
        const sbVes = salarioBasicoDiarioVesDesdeNivel(n);
        if (sbVes != null) patch.salario_basico_diario_ves = sbVes;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
  }

  const { error: up } = await supabase.from('ci_contratos_empleado_obra').update(patch as never).eq('id', id);
  if (up) {
    console.error('[contratos PATCH]', up);
    return NextResponse.json({ error: up.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, actualizado: patch });
}
