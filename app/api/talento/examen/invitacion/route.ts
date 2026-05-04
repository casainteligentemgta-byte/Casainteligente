import { NextResponse } from 'next/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * GET ?token= — datos de la invitación (válida si no expiró ni se usó).
 * Usa service role en servidor; no expongas la key al cliente.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get('token') ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 });
  }

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  const { data: inv, error } = await admin.client
    .from('ci_examenes')
    .select('id, token, expira_at, usado_at, completado, empleado_id')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[invitacion]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!inv) {
    return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
  }

  const row = inv as {
    expira_at: string;
    usado_at: string | null;
    completado?: boolean;
    empleado_id: string;
    token: string;
  };
  const expira = new Date(row.expira_at).getTime();
  if (Number.isNaN(expira) || Date.now() > expira) {
    return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 });
  }

  if (row.completado) {
    return NextResponse.json(
      { error: 'Esta invitación ya se cerró (p. ej. tiempo agotado)' },
      { status: 409 },
    );
  }

  if (row.usado_at) {
    return NextResponse.json({ error: 'Esta invitación ya fue utilizada' }, { status: 409 });
  }

  const { data: emp, error: errEmp } = await admin.client
    .from('ci_empleados')
    .select(
      'nombre_completo, telefono, celular, email, cedula, documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, rol_examen, rol_buscado',
    )
    .eq('id', row.empleado_id)
    .maybeSingle();

  if (errEmp || !emp) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const e = emp as {
    nombre_completo: string;
    telefono: string | null;
    celular: string | null;
    email: string | null;
    cedula: string | null;
    documento: string | null;
    primer_nombre: string | null;
    segundo_nombre: string | null;
    primer_apellido: string | null;
    segundo_apellido: string | null;
    rol_examen: string;
    rol_buscado: string | null;
  };

  const whatsapp = (e.celular ?? e.telefono ?? '').trim() || null;
  const cedulaDoc = (e.cedula ?? e.documento ?? '').trim() || null;

  return NextResponse.json({
    empleado_id: row.empleado_id,
    examen_token: row.token,
    expira_at: row.expira_at,
    nombre_completo: e.nombre_completo,
    telefono: e.telefono,
    celular: e.celular,
    whatsapp,
    email: e.email,
    cedula: cedulaDoc,
    primer_nombre: e.primer_nombre,
    segundo_nombre: e.segundo_nombre,
    primer_apellido: e.primer_apellido,
    segundo_apellido: e.segundo_apellido,
    rol_examen: e.rol_examen,
    rol_buscado: e.rol_buscado,
  });
}
