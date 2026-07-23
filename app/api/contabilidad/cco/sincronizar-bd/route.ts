import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { proyectoId } = await request.json();

    if (!proyectoId) {
      return Response.json({ ok: false, error: 'Falta proyectoId' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Llamar a la función RPC que creamos en la base de datos
    const { data, error } = await supabase.rpc('ci_sincronizar_desde_suegro', {
      p_proyecto_id: proyectoId
    });

    if (error) {
      console.error('Error en RPC ci_sincronizar_desde_suegro:', error);
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Error inesperado en sincronización:', error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
