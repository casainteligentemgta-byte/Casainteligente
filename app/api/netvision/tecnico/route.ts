import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { responderPreguntaTecnico } from '@/lib/netvision/tecnico'
import { TECNICO_PREGUNTA_MIN, normalizarPregunta } from '@/lib/netvision/tecnicoContexto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** POST { pregunta, historial? } — técnico de dispositivos (IA). Requiere sesión. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Debe iniciar sesión para consultar al técnico.' },
        { status: 401 },
      )
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const pregunta = normalizarPregunta(body.pregunta)
    if (pregunta.length < TECNICO_PREGUNTA_MIN) {
      return NextResponse.json(
        { ok: false, error: 'Escribe una pregunta más específica.' },
        { status: 400 },
      )
    }

    const result = await responderPreguntaTecnico(pregunta, body.historial)
    return NextResponse.json({ ok: true, pregunta, ...result })
  } catch (error) {
    console.error('[api netvision tecnico]', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo responder la pregunta.',
      },
      { status: 500 },
    )
  }
}
