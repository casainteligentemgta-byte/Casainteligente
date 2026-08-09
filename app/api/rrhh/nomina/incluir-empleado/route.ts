import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermisoRrhhAny } from '@/lib/rrhh/requirePermisoRrhh';
import { incluirEmpleadoEnNominaSemanal } from '@/lib/rrhh/incluirEmpleadoNominaSemanal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  empleado_id: z.string().uuid(),
  proyecto_id: z.string().uuid().optional().nullable(),
  tasa_bcv: z.number().positive().optional().nullable(),
  dias_laborados: z.number().min(0).max(6).optional(),
  meta_integral_semanal_usd: z.number().positive().optional().nullable(),
});

/** POST — Incluye un obrero contratado en la nómina semanal (borrador) actual. */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos (empleado_id UUID)' }, { status: 400 });
  }

  // Obra puede empujar a borrador tras formalizar; Dirección también.
  const gate = await requirePermisoRrhhAny({
    proyectoId: parsed.data.proyecto_id ?? null,
  });
  if (!gate.ok) return gate.response;

  const out = await incluirEmpleadoEnNominaSemanal(gate.supabase, {
    empleadoId: parsed.data.empleado_id,
    proyectoId: parsed.data.proyecto_id,
    tasaBcv: parsed.data.tasa_bcv,
    diasLaborados: parsed.data.dias_laborados,
    metaIntegralSemanalUsd: parsed.data.meta_integral_semanal_usd,
  });

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    ok: true,
    periodo_id: out.periodoId,
    recibo_id: out.reciboId,
    ya_existia: out.yaExistia,
    fecha_inicio: out.fechaInicio,
    fecha_fin: out.fechaFin,
  });
}
