import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';
import { listarCandidatosContratoMasiva } from '@/lib/talento/listarCandidatosContratoMasiva';
import { payloadContratoDesdeCandidato } from '@/lib/talento/candidatosContratoMasiva';
import { generarContratoTrabajoObrero } from '@/lib/talento/generarContratoTrabajoObrero';
import { ARREGLO_PAGO_MAX_USD } from '@/lib/nomina/arregloPago';

export const runtime = 'nodejs';
export const maxDuration = 300;

const bodySchema = z.object({
  proyecto_id: z.string().uuid(),
  empleado_ids: z.array(z.string().uuid()).min(1).max(40),
  config_nomina_id: z.string().uuid().optional().nullable(),
  fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jornada_trabajo: z.enum(['DIURNA', 'NOCTURNA', 'MIXTA', 'diurna', 'nocturna', 'mixta']),
  horario_semanal_texto: z.string().max(2500).optional().nullable(),
  bono_manual_usd: z.coerce.number().nonnegative().optional().default(0),
  estado_civil_default: z.string().max(80).optional().nullable(),
  /** Arreglo de pago por trabajador: { [empleado_id]: { semanal_usd, mensual_usd } }. */
  arreglos: z
    .record(
      z.string().uuid(),
      z.object({
        semanal_usd: z.coerce.number().positive().max(ARREGLO_PAGO_MAX_USD).optional().nullable(),
        mensual_usd: z.coerce.number().positive().max(ARREGLO_PAGO_MAX_USD).optional().nullable(),
      }),
    )
    .optional()
    .nullable(),
});

/**
 * POST — genera contratos de trabajo para obreros que ya llenaron el enlace.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  const admin = supabaseAdminForRoute();
  if (!admin.ok) return admin.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const { candidatos, error } = await listarCandidatosContratoMasiva(admin.client, body.proyecto_id);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const byId = new Map(candidatos.map((c) => [c.empleadoId, c]));
  const ids = Array.from(new Set(body.empleado_ids));

  let nomRes = await admin.client.from('ci_config_nomina').select('id,cargo_nombre,cargo_codigo').limit(800);
  if (nomRes.error && /cargo_codigo|42703|schema cache/i.test(nomRes.error.message ?? '')) {
    nomRes = await admin.client.from('ci_config_nomina').select('id,cargo_nombre').limit(800);
  }
  const nominas = ((nomRes.data ?? []) as { id: string; cargo_nombre: string; cargo_codigo?: string | null }[]).map(
    (n) => ({
      id: n.id,
      cargo_nombre: (n.cargo_nombre ?? '').trim() || 'Sin nombre',
      cargo_codigo: n.cargo_codigo ?? null,
    }),
  );

  const resultados: Array<{
    empleado_id: string;
    cedula: string;
    nombre: string;
    ok: boolean;
    id?: string;
    signed_url?: string | null;
    error?: string;
  }> = [];

  for (const empleadoId of ids) {
    const c = byId.get(empleadoId);
    if (!c) {
      resultados.push({
        empleado_id: empleadoId,
        cedula: '',
        nombre: '—',
        ok: false,
        error: 'No está en la obra o no tiene hoja de vida',
      });
      continue;
    }
    const armado = payloadContratoDesdeCandidato(
      c,
      {
        proyectoId: body.proyecto_id,
        configNominaId: body.config_nomina_id,
        fechaIngreso: body.fecha_ingreso,
        jornada: body.jornada_trabajo.toUpperCase(),
        horario: body.horario_semanal_texto,
        bonoUsd: body.bono_manual_usd,
        estadoCivilDefault: body.estado_civil_default,
        arreglos: body.arreglos ?? null,
      },
      nominas,
    );
    if (!armado.ok) {
      resultados.push({
        empleado_id: c.empleadoId,
        cedula: c.cedula,
        nombre: c.nombreCompleto,
        ok: false,
        error: armado.error,
      });
      continue;
    }

    const out = await generarContratoTrabajoObrero(admin.client, armado.payload, {
      createdBy: user.id,
    });
    if (!out.ok) {
      resultados.push({
        empleado_id: c.empleadoId,
        cedula: c.cedula,
        nombre: c.nombreCompleto,
        ok: false,
        error: out.error,
      });
      continue;
    }
    resultados.push({
      empleado_id: c.empleadoId,
      cedula: c.cedula,
      nombre: c.nombreCompleto,
      ok: true,
      id: out.id,
      signed_url: out.signed_url,
    });
  }

  const okCount = resultados.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: okCount === resultados.length,
    generados: okCount,
    fallidos: resultados.length - okCount,
    resultados,
  });
}
