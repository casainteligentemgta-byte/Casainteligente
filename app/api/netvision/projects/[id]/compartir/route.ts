import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tokenDesdeBytes } from '@/lib/netvision/compartir'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteCtx = { params: { id: string } }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

const noAutenticado = () =>
  NextResponse.json(
    { ok: false, authenticated: false, error: 'Inicia sesión para compartir el proyecto.' },
    { status: 401 },
  )

function errorTabla(message: string) {
  return /share_token|shared_at|schema cache/i.test(message)
    ? 'Falta aplicar la migración 327 (enlace del cliente) en la base de datos.'
    : message
}

/** GET — ¿el proyecto está compartido? Devuelve el código si lo está. */
export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const id = params.id?.trim() ?? ''
    const { supabase, user } = await requireUser()
    if (!user?.id) return noAutenticado()
    const { data, error } = await supabase
      .from('netvision_projects')
      .select('share_token, shared_at')
      .eq('user_id', user.id)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: errorTabla(error.message) },
        { status: 500 },
      )
    }
    return NextResponse.json({
      ok: true,
      authenticated: true,
      token: (data?.share_token as string | null) ?? null,
      sharedAt: (data?.shared_at as string | null) ?? null,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: e instanceof Error ? e.message : 'Error de servidor' },
      { status: 500 },
    )
  }
}

/**
 * POST — comparte el proyecto con el cliente. Si ya tenía código lo conserva,
 * así el enlace enviado sigue sirviendo y siempre muestra la última versión.
 */
export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const id = params.id?.trim() ?? ''
    const { supabase, user } = await requireUser()
    if (!user?.id) return noAutenticado()

    const actual = await supabase
      .from('netvision_projects')
      .select('share_token')
      .eq('user_id', user.id)
      .eq('id', id)
      .maybeSingle()
    if (actual.error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: errorTabla(actual.error.message) },
        { status: 500 },
      )
    }
    if (!actual.data) {
      return NextResponse.json(
        {
          ok: false,
          authenticated: true,
          error: 'El proyecto todavía no está guardado en la nube. Guárdalo e inténtalo de nuevo.',
        },
        { status: 404 },
      )
    }
    const previo = actual.data.share_token as string | null
    if (previo) {
      return NextResponse.json({ ok: true, authenticated: true, token: previo })
    }

    // Solo se pone el código si aún no tiene: dos toques seguidos (o dos
    // equipos a la vez) terminan con el mismo enlace, no con uno que se pierde.
    const token = tokenDesdeBytes(new Uint8Array(randomBytes(32)))
    const { error } = await supabase
      .from('netvision_projects')
      .update({ share_token: token, shared_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('id', id)
      .is('share_token', null)
    if (error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: errorTabla(error.message) },
        { status: 500 },
      )
    }
    const final = await supabase
      .from('netvision_projects')
      .select('share_token')
      .eq('user_id', user.id)
      .eq('id', id)
      .maybeSingle()
    const guardado = (final.data?.share_token as string | null | undefined) ?? null
    if (final.error || !guardado) {
      return NextResponse.json(
        {
          ok: false,
          authenticated: true,
          error: final.error ? errorTabla(final.error.message) : 'No se pudo crear el enlace. Inténtalo de nuevo.',
        },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: true, authenticated: true, token: guardado })
  } catch (e) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: e instanceof Error ? e.message : 'Error de servidor' },
      { status: 500 },
    )
  }
}

/** DELETE — deja de compartir: el enlace enviado deja de abrir. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const id = params.id?.trim() ?? ''
    const { supabase, user } = await requireUser()
    if (!user?.id) return noAutenticado()
    const { error } = await supabase
      .from('netvision_projects')
      .update({ share_token: null, shared_at: null })
      .eq('user_id', user.id)
      .eq('id', id)
    if (error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: errorTabla(error.message) },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: true, authenticated: true, token: null })
  } catch (e) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: e instanceof Error ? e.message : 'Error de servidor' },
      { status: 500 },
    )
  }
}
