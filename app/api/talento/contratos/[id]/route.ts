import { NextResponse } from 'next/server';
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
    monto_acordado_usd: number;
    porcentaje_inicial: number;
    texto_legal: string;
    created_at: string;
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

  const proyectoTabla = contrato.obra_id ? 'ci_obras' : 'ci_proyectos';
  const proyectoSelect = contrato.obra_id
    ? 'id,nombre,ubicacion,fecha_inicio,fecha_entrega_prometida'
    : 'id,nombre,ubicacion_texto,fecha_inicio,fecha_fin_estimada';

  const [empRes, obraRes] = await Promise.all([
    supabase
      .from('ci_empleados')
      .select('id,nombre_completo,cedula,documento,direccion')
      .eq('id', contrato.empleado_id)
      .maybeSingle(),
    supabase
      .from(proyectoTabla)
      .select(proyectoSelect)
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
    direccion?: string | null;
  };
  const obraRaw = obraRes.data as {
    nombre: string;
    ubicacion?: string | null;
    ubicacion_texto?: string | null;
    fecha_inicio: string | null;
    fecha_entrega_prometida?: string | null;
    fecha_fin_estimada?: string | null;
  };
  const obra = {
    nombre: obraRaw.nombre,
    ubicacion: obraRaw.ubicacion ?? obraRaw.ubicacion_texto ?? null,
    fecha_inicio: obraRaw.fecha_inicio ?? null,
    fecha_fin: obraRaw.fecha_entrega_prometida ?? obraRaw.fecha_fin_estimada ?? null,
  };

  return NextResponse.json({
    id: contrato.id,
    empleado: {
      nombre: empleado.nombre_completo,
      cedula: empleado.cedula ?? empleado.documento ?? 'No registrada',
      direccion: empleado.direccion ?? 'No registrada',
    },
    proyecto: {
      nombre: obra.nombre,
      ubicacion: obra.ubicacion ?? 'No definida',
      duracion_estimada: estimateDuration(obra.fecha_inicio, obra.fecha_fin),
    },
    contrato: {
      cargo: 'Perfil técnico asignado',
      nivel: 0,
      salario_diario: 'N/D',
      bono_asistencia: 'N/D',
      fecha_inicio: formatDate(obra.fecha_inicio) ?? formatDate(contrato.created_at) ?? 'No definida',
      monto_acordado_usd: contrato.monto_acordado_usd,
      porcentaje_inicial: contrato.porcentaje_inicial,
      texto_legal: contrato.texto_legal,
    },
  });
}
