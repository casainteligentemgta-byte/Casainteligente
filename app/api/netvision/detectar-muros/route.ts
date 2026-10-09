import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geminiGenerateWithDocument, getGeminiApiKey } from '@/lib/gemini/client'
import { ESQUEMA_MUROS_IA, PROMPT_MUROS_IA, resultadoDesdeIa } from '@/lib/netvision/murosIa'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const MODELO = process.env.NETVISION_MUROS_MODEL?.trim() || 'gemini-2.5-flash'
/** ~3 MB de imagen en base64: el editor la manda reducida (1600 px). */
const MAX_BASE64 = 4_000_000

/**
 * POST { imagen: dataURL } — detecta muros, puertas y ventanas en la imagen del plano con IA.
 * Devuelve el mismo resultado que la detección vectorial de PDF (coordenadas 0–1).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 })
  if (!getGeminiApiKey()) {
    return NextResponse.json(
      { error: 'La detección con IA no está configurada (falta GEMINI_API_KEY).' },
      { status: 503 },
    )
  }

  let imagen = ''
  try {
    const body = (await req.json()) as { imagen?: unknown }
    imagen = typeof body.imagen === 'string' ? body.imagen : ''
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imagen)
  if (!m) return NextResponse.json({ error: 'Falta la imagen del plano (JPG, PNG o WEBP).' }, { status: 400 })
  if (m[2]!.length > MAX_BASE64) {
    return NextResponse.json({ error: 'La imagen es demasiado grande.' }, { status: 413 })
  }

  try {
    const texto = await geminiGenerateWithDocument({
      model: MODELO,
      prompt: PROMPT_MUROS_IA,
      mimeType: m[1]!,
      base64: m[2]!,
      temperature: 0,
      maxOutputTokens: 32768,
      responseSchema: ESQUEMA_MUROS_IA,
    })
    let json: unknown = null
    try {
      json = JSON.parse(texto)
    } catch {
      return NextResponse.json(
        { error: 'La IA devolvió una respuesta incompleta. Intenta de nuevo.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true, resultado: resultadoDesdeIa(json), modelo: MODELO })
  } catch (e) {
    console.error('[netvision detectar-muros]', e)
    const msg = e instanceof Error ? e.message : 'No se pudo consultar la IA.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
