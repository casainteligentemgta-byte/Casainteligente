import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { crearExpedienteToken } from '@/lib/reclutamiento/validarExpedienteToken';
import { celularParaInserto } from '@/lib/registro/ciEmpleadosCelular';
import { nombresLegadoDesdeTextoLibre } from '@/lib/registro/ciEmpleadosNombresLegado';
import { tipoVacantePorNivel } from '@/lib/constants/cargosObreros';
import { validarFilaCarga, type FilaCargaMasivaEntrada } from '@/lib/rrhh/cargaMasivaObreros';

export const dynamic = 'force-dynamic';

const MAX_FILAS = 300;
/** El enlace personal vale 15 días: da tiempo al sindicato y al obrero. */
const VIGENCIA_ENLACE_MS = 15 * 24 * 60 * 60 * 1000;

function trimBase(u: string): string {
  return u.trim().replace(/\/$/, '');
}

function urlPublica(req: Request): string {
  const origin = trimBase(req.headers.get('origin') ?? '');
  if (origin && /^https?:\/\//i.test(origin)) return origin;
  return trimBase(process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '');
}

async function exigirSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

type ResultadoFila = {
  fila: number;
  nombre: string;
  cedula: string;
  oficio: string;
  whatsapp: string;
  estado: 'creado' | 'existente' | 'error';
  mensaje?: string;
  empleado_id?: string;
  enlace?: string;
};

/**
 * POST: crea un expediente por obrero (obra y oficio asignados por la empresa) y un enlace personal
 * de un solo uso para que llene su hoja de vida, suba la cédula, firme y presente la evaluación.
 * Body: { proyecto_id, filas: [{ nombre, cedula, oficio, whatsapp }] }
 */
export async function POST(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para cargar personal.' }, { status: 401 });

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const db = admin.client;

  let body: { proyecto_id?: string; filas?: FilaCargaMasivaEntrada[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const proyectoId = String(body.proyecto_id ?? '').trim();
  const filas = Array.isArray(body.filas) ? body.filas : [];
  if (!proyectoId) return NextResponse.json({ error: 'Elige la obra.' }, { status: 400 });
  if (!filas.length) return NextResponse.json({ error: 'El archivo no trae obreros.' }, { status: 400 });
  if (filas.length > MAX_FILAS) {
    return NextResponse.json({ error: `Máximo ${MAX_FILAS} obreros por carga.` }, { status: 400 });
  }

  const base = urlPublica(req);
  if (!base) return NextResponse.json({ error: 'No se pudo determinar la dirección pública del sistema.' }, { status: 503 });

  const { data: proyecto, error: errPr } = await db
    .from('ci_proyectos')
    .select('id,nombre,nombre_proyecto')
    .eq('id', proyectoId)
    .maybeSingle();
  if (errPr || !proyecto) return NextResponse.json({ error: 'La obra no existe.' }, { status: 404 });

  // Expedientes ya creados en esta obra, por cédula: evita duplicar si se sube el mismo Excel dos veces.
  const { data: existentes } = await db
    .from('ci_empleados')
    .select('id,cedula,token_registro,estado_proceso')
    .eq('proyecto_modulo_id', proyectoId);
  const porCedula = new Map<string, { id: string; token_registro: string | null }>();
  for (const e of (existentes ?? []) as Array<{ id: string; cedula: string | null; token_registro: string | null }>) {
    const c = String(e.cedula ?? '').toUpperCase().replace(/[^VE0-9]/g, '');
    if (c) porCedula.set(c, { id: e.id, token_registro: e.token_registro });
  }

  const resultados: ResultadoFila[] = [];
  const vistasEnArchivo = new Set<string>();

  for (let i = 0; i < filas.length; i++) {
    const v = validarFilaCarga(filas[i] ?? { nombre: '', cedula: '', oficio: '', whatsapp: '' });
    const baseRes = {
      fila: i + 2,
      nombre: v.nombre,
      cedula: v.cedulaNormalizada || String(v.cedula ?? ''),
      oficio: v.cargo ? `${v.cargo.codigo.replace('.', ',')} ${v.cargo.nombre}` : String(v.oficio ?? ''),
      whatsapp: v.whatsappInternacional,
    };
    if (v.errores.length || !v.cargo) {
      resultados.push({ ...baseRes, estado: 'error', mensaje: v.errores.join(' · ') });
      continue;
    }
    const claveCedula = v.cedulaNormalizada.replace(/[^VE0-9]/g, '');
    if (vistasEnArchivo.has(claveCedula)) {
      resultados.push({ ...baseRes, estado: 'error', mensaje: 'Cédula repetida en el archivo' });
      continue;
    }
    vistasEnArchivo.add(claveCedula);

    const previo = porCedula.get(claveCedula);
    if (previo?.token_registro) {
      resultados.push({
        ...baseRes,
        estado: 'existente',
        mensaje: 'Ya tenía expediente en esta obra',
        empleado_id: previo.id,
        enlace: `${base}/reclutamiento/onboarding/${previo.token_registro}`,
      });
      continue;
    }

    const token = randomUUID();
    const expira = new Date(Date.now() + VIGENCIA_ENLACE_MS).toISOString();
    const cargo = v.cargo;
    const { data: emp, error: errEmp } = await db
      .from('ci_empleados')
      .insert({
        nombre_completo: v.nombre,
        nombres: nombresLegadoDesdeTextoLibre(v.nombre),
        cedula: v.cedulaNormalizada,
        documento: v.cedulaNormalizada,
        telefono: v.whatsappInternacional,
        celular: celularParaInserto(null, v.whatsappInternacional),
        proyecto_modulo_id: proyectoId,
        cargo_codigo: cargo.codigo,
        cargo_nombre: cargo.nombre,
        cargo_nivel: cargo.nivel,
        tipo_vacante: tipoVacantePorNivel(cargo.nivel),
        cargo: cargo.nombre,
        rol_buscado: cargo.nombre,
        rol_examen: 'obrero',
        estado_proceso: 'pendiente_cv',
        token,
        token_registro: token,
        respuestas_personalidad: {},
        respuestas_logica: {},
      } as never)
      .select('id')
      .single();

    if (errEmp || !emp) {
      resultados.push({ ...baseRes, estado: 'error', mensaje: errEmp?.message ?? 'No se pudo crear el expediente' });
      continue;
    }
    const empleadoId = (emp as { id: string }).id;
    await crearExpedienteToken(db, { token, empleadoId, expiresAt: expira });
    const { error: errExa } = await db
      .from('ci_examenes')
      .insert({ empleado_id: empleadoId, token, expira_at: expira } as never);
    if (errExa) console.warn('[carga-masiva] ci_examenes', errExa.message);

    resultados.push({
      ...baseRes,
      estado: 'creado',
      empleado_id: empleadoId,
      enlace: `${base}/reclutamiento/onboarding/${token}`,
    });
  }

  return NextResponse.json({
    obra: String((proyecto as { nombre?: string; nombre_proyecto?: string }).nombre ?? (proyecto as { nombre_proyecto?: string }).nombre_proyecto ?? ''),
    resultados,
  });
}

/** GET ?proyecto_id= → avance de los obreros de la obra (para el tablero de seguimiento). */
export async function GET(req: Request) {
  const user = await exigirSesion();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });
  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;
  const proyectoId = new URL(req.url).searchParams.get('proyecto_id')?.trim() ?? '';
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 });

  const base = urlPublica(req);
  const { data, error } = await admin.client
    .from('ci_empleados')
    .select('id,nombre_completo,cedula,telefono,cargo_codigo,cargo_nombre,estado_proceso,token_registro,created_at')
    .eq('proyecto_modulo_id', proyectoId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    obreros: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id,
      nombre: r.nombre_completo,
      cedula: r.cedula,
      whatsapp: r.telefono,
      oficio: [String(r.cargo_codigo ?? '').replace('.', ','), r.cargo_nombre].filter(Boolean).join(' '),
      estado_proceso: r.estado_proceso,
      enlace: r.token_registro && base ? `${base}/reclutamiento/onboarding/${r.token_registro}` : null,
    })),
  });
}
