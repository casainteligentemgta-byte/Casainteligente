import { createClient } from '@/lib/supabase/server';
import {
  isValidProyectoUuid,
  mensajeProyectoIdInvalido,
} from '@/lib/proyectos/validarProyectoUuid';
import { formatErrorMessage } from '@/lib/utils/formatErrorMessage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export type RegistroAguaRow = {
  id: string;
  proyecto_id: string;
  foto_tanque_url: string;
  foto_prueba_url: string;
  creado_por: string;
  chat_id: string | null;
  created_at: string;
  registrado_en: string;
  placa_vehiculo: string | null;
  medicion_agua: number | null;
  unidad_medicion: string | null;
  detalle_medicion: string | null;
  extraccion_ia: Record<string, unknown>;
};

export async function GET(
  _req: Request,
  { params }: { params: { proyectoId: string } },
) {
  const proyectoId = params?.proyectoId?.trim() ?? '';
  if (!isValidProyectoUuid(proyectoId)) {
    return NextResponse.json(
      { error: mensajeProyectoIdInvalido(proyectoId) },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('registro_agua_obrero')
      .select(
        'id, proyecto_id, foto_tanque_url, foto_prueba_url, creado_por, chat_id, created_at, registrado_en, placa_vehiculo, medicion_agua, unidad_medicion, detalle_medicion, extraccion_ia',
      )
      .eq('proyecto_id', proyectoId)
      .order('registrado_en', { ascending: false })
      .limit(300);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ registros: (data ?? []) as RegistroAguaRow[] });
  } catch (e) {
    return NextResponse.json(
      { error: formatErrorMessage(e) },
      { status: 500 },
    );
  }
}
