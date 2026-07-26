import { createClient } from '@/lib/supabase/server';
import { createSupabaseAdminOnlyClient } from '@/lib/supabase/adminOnlyClient';
import {
  actualizarFechaRegistroAgua,
  crearRegistroAguaWeb,
} from '@/lib/proyectos/crearRegistroAguaWeb';
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
  litros_entregados: number | null;
  ppm_minerales: number | null;
  extraccion_ia: Record<string, unknown>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clientDb() {
  return createSupabaseAdminOnlyClient();
}

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
    const supabase = clientDb() ?? (await createClient());
    const { data, error } = await supabase
      .from('registro_agua_obrero')
      .select(
        'id, proyecto_id, foto_tanque_url, foto_prueba_url, creado_por, chat_id, created_at, registrado_en, placa_vehiculo, medicion_agua, unidad_medicion, detalle_medicion, litros_entregados, ppm_minerales, extraccion_ia',
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

/** Alta manual: multipart con fotos + fecha (días anteriores) y datos opcionales. */
export async function POST(
  req: Request,
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
    const form = await req.formData();
    const fotoTanque = form.get('foto_tanque');
    const fotoPrueba = form.get('foto_prueba');
    if (!(fotoTanque instanceof File) || !(fotoPrueba instanceof File)) {
      return NextResponse.json(
        { error: 'Envíe foto_tanque y foto_prueba (imágenes).' },
        { status: 400 },
      );
    }

    const registradoEnRaw = String(form.get('registrado_en') ?? '').trim();
    const placaRaw = String(form.get('placa_vehiculo') ?? '').trim();
    const litrosRaw = String(form.get('litros_entregados') ?? '').trim();
    const ppmRaw = String(form.get('ppm_minerales') ?? '').trim();
    const usarIa = String(form.get('usar_ia') ?? '1') !== '0';

    const litros =
      litrosRaw === ''
        ? null
        : Number(litrosRaw.replace(',', '.'));
    if (litros != null && (!Number.isFinite(litros) || litros < 0)) {
      return NextResponse.json({ error: 'Litros inválidos.' }, { status: 400 });
    }

    const ppm =
      ppmRaw === ''
        ? null
        : Number(ppmRaw.replace(',', '.'));
    if (ppm != null && (!Number.isFinite(ppm) || ppm < 0)) {
      return NextResponse.json({ error: 'PPM inválido.' }, { status: 400 });
    }

    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    const creadoPor =
      user?.email?.trim() ||
      user?.id?.trim() ||
      'web';

    const supabase = clientDb() ?? authClient;
    const registro = await crearRegistroAguaWeb(supabase, {
      proyectoId,
      fotoTanque,
      fotoPrueba,
      registradoEn: registradoEnRaw || null,
      placaVehiculo: placaRaw || null,
      litrosEntregados: litros,
      ppmMinerales: ppm,
      creadoPor,
      usarIa,
    });

    return NextResponse.json({ registro }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: formatErrorMessage(e) },
      { status: 500 },
    );
  }
}

/** Actualiza la fecha (`registrado_en`) de un registro existente. */
export async function PATCH(
  req: Request,
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
    const body = (await req.json()) as {
      id?: string;
      registrado_en?: string;
    };
    const id = String(body.id ?? '').trim();
    const registradoEn = String(body.registrado_en ?? '').trim();
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'id de registro inválido.' }, { status: 400 });
    }
    if (!registradoEn) {
      return NextResponse.json({ error: 'registrado_en es obligatorio.' }, { status: 400 });
    }

    const supabase = clientDb() ?? (await createClient());
    const registro = await actualizarFechaRegistroAgua(
      supabase,
      proyectoId,
      id,
      registradoEn,
    );
    return NextResponse.json({ registro });
  } catch (e) {
    return NextResponse.json(
      { error: formatErrorMessage(e) },
      { status: 500 },
    );
  }
}
