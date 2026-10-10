import { NextResponse } from 'next/server';
import { evaluarObreroPorToken } from '@/lib/talento/evaluarObreroPorToken';
import { esRolEvaluacionExamen } from '@/lib/talento/evaluarSemaforoObrero';
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin';

/**
 * POST — Evaluación automatizada unificada.
 *
 * Flujo obrero/vigilante (FormularioEvaluacion):
 * ```json
 * {
 *   "token": "token_unico_del_obrero",
 *   "rol": "obrero",
 *   "respuestas": {
 *     "obr_01": "A",
 *     "obr_02": "A",
 *     "obr_03": "B",
 *     "obr_04": "A",
 *     "obr_20": "C"
 *   }
 * }
 * ```
 * Claves `obr_01`…`obr_20`; valores `"A"` | `"B"` | `"C"`.
 * Si `respuestas` está vacío → `{ success: true, semaforo: "rojo", statusEvaluacion: "pendiente_regularizar" }`.
 * Con 20 respuestas → semáforo ABC, guardado en `ci_empleados` e invitación marcada usada.
 *
 * programador | empleado | técnico: examen completo vía `/api/talento/examen/submit`.
 * Sin `token` responde 400: no se evalúa a nadie sin su enlace de invitación.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      respuestas?: Record<string, string>;
      rol?: string;
    };

    const token = (body.token ?? '').trim();
    const rolToken = (body.rol ?? '').trim().toLowerCase();
    const respuestasToken = body.respuestas;

    if (token || respuestasToken !== undefined || rolToken) {
      if (!token || !rolToken) {
        return NextResponse.json(
          { error: 'token y rol son requeridos' },
          { status: 400 },
        );
      }

      const respuestas = respuestasToken ?? {};
      if (Object.keys(respuestas).length === 0) {
        return NextResponse.json({
          success: true,
          semaforo: 'rojo',
          statusEvaluacion: 'pendiente_regularizar',
        });
      }

      if (!esRolEvaluacionExamen(rolToken)) {
        return NextResponse.json(
          { error: 'Rol no apto para evaluación automatizada' },
          { status: 400 },
        );
      }

      if (rolToken === 'programador' || rolToken === 'tecnico' || rolToken === 'empleado') {
        return NextResponse.json(
          {
            error:
              'Programador, empleado y técnico deben completar el examen de personalidad + lógica en /talento/examen (submit).',
          },
          { status: 400 },
        );
      }

      const admin = supabaseAdminForRoute();
      if (!admin.ok) return admin.response;

      const out = await evaluarObreroPorToken(admin.client, {
        token,
        rol: rolToken,
        respuestas,
      });

      if ('error' in out) {
        return NextResponse.json({ error: out.error }, { status: out.status });
      }

      return NextResponse.json({
        success: true,
        semaforo: out.semaforo,
        statusEvaluacion: out.statusEvaluacion,
        estado: out.estado,
        motivo: out.motivo,
        resumen: out.resumen,
        id: out.id,
      });
    }

    // Sin token no se evalúa. La forma antigua de este servicio indicaba el expediente por
    // su identificador, sin validar ningún enlace de invitación, y ninguna pantalla la usa:
    // el examen completo se envía por /api/talento/examen/submit, que sí valida la invitación.
    return NextResponse.json(
      {
        error: 'token y rol son requeridos',
        hint: 'El examen de programador, empleado o técnico se presenta en /talento/examen con el enlace de invitación.',
      },
      { status: 400 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
