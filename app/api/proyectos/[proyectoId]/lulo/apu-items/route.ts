import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type LineaUpdate = {
  codigo: string;
  tipo: 'material' | 'mano_obra' | 'equipo';
  cantidad: number;
  precio: number;
};

type Body = {
  partidaId: string;
  rendimiento?: number;
  lineas: LineaUpdate[];
};

/**
 * PATCH /api/proyectos/:proyectoId/lulo/apu-items
 * Persiste cantidades/precios editados en apu_items (cascada obra).
 */
export async function PATCH(
  req: Request,
  { params }: { params: { proyectoId: string } },
) {
  try {
    const proyectoId = params.proyectoId?.trim() ?? '';
    if (!isValidProyectoUuid(proyectoId)) {
      return NextResponse.json(
        { error: mensajeProyectoIdInvalido(proyectoId) },
        { status: 400 },
      );
    }

    const body = (await req.json()) as Body;
    const partidaId = body.partidaId?.trim();
    if (!partidaId || !Array.isArray(body.lineas)) {
      return NextResponse.json({ error: 'partidaId y lineas son obligatorios' }, { status: 400 });
    }

    const supabase =
      createSupabaseAdminOnlyClient() ?? (await createClient());

    const { data: partida, error: pErr } = await supabase
      .from('partidas')
      .select('id, capitulo_id, codigo')
      .eq('id', partidaId)
      .maybeSingle();
    if (pErr) throw new Error(formatErrorMessage(pErr));
    if (!partida?.capitulo_id) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    }
    const { data: cap, error: cErr } = await supabase
      .from('capitulos')
      .select('proyecto_id')
      .eq('id', partida.capitulo_id)
      .maybeSingle();
    if (cErr) throw new Error(formatErrorMessage(cErr));
    if (cap?.proyecto_id !== proyectoId) {
      return NextResponse.json({ error: 'Partida no pertenece al proyecto' }, { status: 404 });
    }

    for (const linea of body.lineas) {
      const codigo = String(linea.codigo ?? '').trim();
      if (!codigo) continue;
      const { error: uErr } = await supabase
        .from('apu_items')
        .update({
          rendimiento: Number(linea.cantidad) || 0,
          costo_unitario: Number(linea.precio) || 0,
        })
        .eq('partida_id', partidaId)
        .eq('codigo_insumo', codigo)
        .eq('tipo', linea.tipo);
      if (uErr) throw new Error(formatErrorMessage(uErr));
    }

    if (body.rendimiento != null && body.rendimiento > 0) {
      const cod = String(partida.codigo ?? '').trim();
      if (cod) {
        await supabase
          .from('lulo_catalogo_partidas')
          .update({ rendimiento: body.rendimiento })
          .eq('codigo_lulo', cod);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[apu-items PATCH]', err);
    return NextResponse.json({ error: formatErrorMessage(err) }, { status: 500 });
  }
}
