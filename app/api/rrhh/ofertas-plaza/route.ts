import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermisoRrhhObra } from '@/lib/rrhh/requirePermisoRrhh';
import { crearOfertaPlaza } from '@/lib/rrhh/ofertasPlaza';

export const runtime = 'nodejs';

const bodySchema = z.object({
  empleado_id: z.string().uuid(),
  oficio_nombre: z.string().min(2).max(240),
  oficio_codigo: z.string().max(40).optional().nullable(),
  proyecto_id: z.string().uuid().optional().nullable(),
  entidad_id: z.string().uuid().optional().nullable(),
  labor_request_id: z.string().uuid().optional().nullable(),
  notas: z.string().max(2000).optional().nullable(),
  abrir_whatsapp: z.boolean().optional(),
});

/** POST — Crea oferta de plaza (banca → obrero). */
export async function POST(req: Request) {
  const gate = await requirePermisoRrhhObra();
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de oferta inválidos' }, { status: 400 });
  }

  const out = await crearOfertaPlaza(gate.supabase, {
    empleadoId: parsed.data.empleado_id,
    oficioNombre: parsed.data.oficio_nombre,
    oficioCodigo: parsed.data.oficio_codigo,
    proyectoId: parsed.data.proyecto_id,
    entidadId: parsed.data.entidad_id,
    laborRequestId: parsed.data.labor_request_id,
    notas: parsed.data.notas,
    marcarMensajeEnviado: true,
  });

  if (!out.ok) {
    const msg = out.error;
    const status = /schema cache|does not exist|ci_ofertas_plaza/i.test(msg) ? 503 : 500;
    return NextResponse.json(
      {
        error:
          status === 503
            ? 'Falta migración 319 (ci_ofertas_plaza). Aplíquela en Supabase.'
            : msg,
      },
      { status },
    );
  }

  return NextResponse.json({ ok: true, oferta: out.oferta });
}
