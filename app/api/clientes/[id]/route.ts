import { NextResponse } from 'next/server';
import { requirePermisoWeb } from '@/lib/auth/requirePermisoRoute';
import { guardarClienteEnDb, payloadClientePermitido } from '@/lib/clientes/guardarCliente';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/clientes/[id]
 * Edición y archivo (status). No cambia entidad_id desde el cliente.
 */
export async function PATCH(req: Request, context: { params: { id: string } }) {
  const acceso = await requirePermisoWeb('clientes.editar');
  if (!acceso.ok) return acceso.response;

  const id = decodeURIComponent(context.params?.id ?? '').trim();
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Identificador no válido.' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const payload = payloadClientePermitido(body);
  if (payload.status != null) {
    const s = String(payload.status).toLowerCase();
    if (s !== 'activo' && s !== 'inactivo' && s !== 'pendiente') {
      return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 });
    }
    payload.status = s;
  }
  if (!Object.keys(payload).length) {
    return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
  }

  const result = await guardarClienteEnDb(acceso.supabase, payload, id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id ?? id });
}
