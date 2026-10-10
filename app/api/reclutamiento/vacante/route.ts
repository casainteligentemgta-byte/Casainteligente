import { NextResponse } from 'next/server';
import { vacantePublicaPorId, vacantesPublicasDeProyecto } from '@/lib/reclutamiento/datosPublicos';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Datos públicos de una vacante para el formulario de postulación (sin sesión).
 *
 *   GET ?need=<id>       la vacante del enlace y el nombre de su obra
 *   GET ?proyecto=<id>   las vacantes de una obra (enlace antiguo ?prj=&role=)
 *
 * Devuelve solo cargo, nivel, tipo y si sigue abierta: nada de sueldos ni de personal.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const needId = (searchParams.get('need') ?? '').trim();
  const proyectoId = (searchParams.get('proyecto') ?? '').trim();
  if (!needId && !proyectoId) {
    return NextResponse.json({ error: 'Falta la vacante o el proyecto del enlace.' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  if (needId) {
    const r = await vacantePublicaPorId(admin.client, needId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, need: r.need, proyectoNombre: r.proyectoNombre });
  }

  const r = await vacantesPublicasDeProyecto(admin.client, proyectoId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, needs: r.needs });
}
