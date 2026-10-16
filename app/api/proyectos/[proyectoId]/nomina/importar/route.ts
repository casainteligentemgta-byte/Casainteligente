import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import { importarNominaProyecto } from '@/lib/proyectos/importarNominaCsv';
import { isValidProyectoUuid, mensajeProyectoIdInvalido } from '@/lib/proyectos/validarProyectoUuid';
import { requireAlgunPermisoWeb } from '@/lib/auth/requirePermisoRoute';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: { proyectoId: string } };

const MAX_BYTES = 512 * 1024;

/** POST: CSV de la nómina (multipart «archivo» o texto plano en el cuerpo). */
export async function POST(req: Request, { params }: RouteCtx) {
  const acceso = await requireAlgunPermisoWeb(['equipo.gestionar', 'admin.config']);
  if (!acceso.ok) return acceso.response;

  const proyectoId = params.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json({ error: mensajeProyectoIdInvalido(proyectoId) }, { status: 400 });
  }

  let texto = '';
  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await req.formData();
      const archivo = form.get('archivo');
      if (!archivo || typeof archivo === 'string') {
        return NextResponse.json({ error: 'Adjunte el archivo CSV' }, { status: 400 });
      }
      if (archivo.size > MAX_BYTES) {
        return NextResponse.json({ error: 'El archivo pasa de 512 KB' }, { status: 400 });
      }
      texto = await archivo.text();
    } else {
      texto = await req.text();
    }
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 });
  }
  if (!texto.trim()) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });

  const supabase = createSupabaseAdminOnlyClient() ?? (await createClient());
  try {
    const r = await importarNominaProyecto(supabase, proyectoId, texto);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo importar' },
      { status: 500 },
    );
  }
}
