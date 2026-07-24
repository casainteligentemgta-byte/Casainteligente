import { createClient } from '@/lib/supabase/server';
import type { LineaApuInsumoLulo, MargenesProyectoApu, PartidaApuLulo } from '@/types/apu-lulo';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ApuRowDb = {
  id: string;
  partida_id: string;
  insumo_id: string;
  cantidad_rendimiento: number;
  desperdicio_porcentaje: number;
  insumo:
    | {
        id: string;
        codigo: string;
        descripcion: string;
        unidad: string;
        precio_base: number;
        tipo: string | null;
      }
    | {
        id: string;
        codigo: string;
        descripcion: string;
        unidad: string;
        precio_base: number;
        tipo: string | null;
      }[]
    | null;
};

function mapLinea(row: ApuRowDb): LineaApuInsumoLulo | null {
  const insumoRaw = row.insumo;
  const insumo = Array.isArray(insumoRaw) ? insumoRaw[0] : insumoRaw;
  if (!insumo?.id) return null;

  return {
    id: row.id,
    partida_id: row.partida_id,
    insumo_id: row.insumo_id,
    cantidad_rendimiento: Number(row.cantidad_rendimiento ?? 0),
    desperdicio_porcentaje: Number(row.desperdicio_porcentaje ?? 0),
    insumo: {
      id: insumo.id,
      codigo: String(insumo.codigo ?? '').trim(),
      descripcion: String(insumo.descripcion ?? '').trim(),
      unidad: String(insumo.unidad ?? 'UND').trim() || 'UND',
      precio_base: Number(insumo.precio_base ?? 0),
      tipo: insumo.tipo ?? null,
    },
  };
}

async function cargarMargenesProyecto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  proyectoId: string,
): Promise<MargenesProyectoApu> {
  const extendido = await supabase
    .from('ci_proyectos')
    .select('porcentaje_admin, porcentaje_utilidad, porcentaje_fcm')
    .eq('id', proyectoId)
    .maybeSingle();

  if (!extendido.error && extendido.data) {
    return {
      porcentaje_admin: extendido.data.porcentaje_admin,
      porcentaje_utilidad: extendido.data.porcentaje_utilidad,
      porcentaje_fcm: extendido.data.porcentaje_fcm,
    };
  }

  const msg = extendido.error?.message ?? '';
  if (msg.includes('codigo_lulo') || msg.includes('porcentaje_') || extendido.error?.code === '42703') {
    return {};
  }

  if (extendido.error) throw new Error(formatErrorMessage(extendido.error));
  return {};
}

/**
 * GET /api/proyectos/lulo/partidas/:id/apu
 * Composición APU de una partida (join ci_presupuesto_partida_apu + ci_lulo_insumos_maestro).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const partidaId = params.id?.trim();
    if (!partidaId) {
      return NextResponse.json({ error: 'ID de partida requerido' }, { status: 400 });
    }

    const supabase = await createClient();

    const partidaRes = await supabase
      .from('ci_presupuesto_partidas')
      .select(
        'id, proyecto_id, codigo_partida, descripcion, unidad, cantidad_presupuestada, precio_unitario_estimado, monto_total_estimado',
      )
      .eq('id', partidaId)
      .maybeSingle();

    if (partidaRes.error) throw new Error(formatErrorMessage(partidaRes.error));
    if (!partidaRes.data) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    }

    const p = partidaRes.data;
    const partida: PartidaApuLulo = {
      id: p.id,
      codigo_partida: String(p.codigo_partida ?? ''),
      descripcion: String(p.descripcion ?? ''),
      unidad: String(p.unidad ?? 'UND'),
      cantidad_presupuestada: Number(p.cantidad_presupuestada ?? 0),
      precio_unitario_estimado: Number(p.precio_unitario_estimado ?? 0),
      monto_total_estimado: Number(p.monto_total_estimado ?? 0),
    };

    const apuRes = await supabase
      .from('ci_presupuesto_partida_apu')
      .select(
        `
        id,
        partida_id,
        insumo_id,
        cantidad_rendimiento,
        desperdicio_porcentaje,
        insumo:ci_lulo_insumos_maestro (
          id,
          codigo,
          descripcion,
          unidad,
          precio_base,
          tipo
        )
      `,
      )
      .eq('partida_id', partidaId)
      .order('cantidad_rendimiento', { ascending: false });

    if (apuRes.error) {
      const msg = apuRes.error.message ?? '';
      if (msg.includes('does not exist') || msg.includes('ci_presupuesto_partida_apu')) {
        return NextResponse.json({
          partida,
          lineas: [],
          margenes: await cargarMargenesProyecto(supabase, p.proyecto_id),
          hint: 'Tabla APU no migrada. Ejecuta npm run db:apply-lulo-telegram.',
        });
      }
      throw new Error(formatErrorMessage(apuRes.error));
    }

    const lineas = (apuRes.data ?? [])
      .map((row) => mapLinea(row as ApuRowDb))
      .filter((l): l is LineaApuInsumoLulo => l != null);

    const margenes = await cargarMargenesProyecto(supabase, p.proyecto_id);

    return NextResponse.json({ partida, lineas, margenes });
  } catch (err: unknown) {
    const message = formatErrorMessage(err) || 'Error al cargar APU';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
