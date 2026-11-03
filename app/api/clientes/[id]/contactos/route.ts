import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import {
  cargarContactosCliente,
  esCanalContacto,
  registrarContactoCliente,
  type CanalContactoCliente,
} from '@/lib/clientes/contactosCliente';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idDe(context: { params: { id: string } }): string {
  return decodeURIComponent(context.params?.id ?? '').trim();
}

export async function GET(_req: Request, context: { params: { id: string } }) {
  const acceso = await requirePermisoWeb('clientes.ver');
  if (!acceso.ok) return acceso.response;

  const id = idDe(context);
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Identificador no válido.' }, { status: 400 });
  }

  const r = await cargarContactosCliente(acceso.supabase, id);
  if (r.error) {
    return NextResponse.json(
      { error: r.error, hint: r.migracionPendiente ? '389_customers_entidad_rls_contactos.sql' : undefined },
      { status: r.migracionPendiente ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, contactos: r.contactos });
}

export async function POST(req: Request, context: { params: { id: string } }) {
  const acceso = await requirePermisoWeb('clientes.ver');
  if (!acceso.ok) return acceso.response;

  const id = idDe(context);
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Identificador no válido.' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const canalRaw = String(body.canal ?? 'whatsapp').trim().toLowerCase();
  if (!esCanalContacto(canalRaw)) {
    return NextResponse.json({ error: 'Canal no válido.' }, { status: 400 });
  }
  const canal = canalRaw as CanalContactoCliente;
  const nota = typeof body.nota === 'string' ? body.nota : null;
  const nombre =
    acceso.actor.nombre?.trim() ||
    acceso.actor.email?.trim() ||
    null;

  const r = await registrarContactoCliente(acceso.supabase, {
    customerId: id,
    canal,
    nota,
    usuarioId: acceso.userId,
    usuarioNombre: nombre,
  });
  if (r.error) {
    return NextResponse.json(
      { error: r.error, hint: r.migracionPendiente ? '389_customers_entidad_rls_contactos.sql' : undefined },
      { status: r.migracionPendiente ? 409 : 400 },
    );
  }
  return NextResponse.json({ ok: true, contacto: r.contacto }, { status: 201 });
}
