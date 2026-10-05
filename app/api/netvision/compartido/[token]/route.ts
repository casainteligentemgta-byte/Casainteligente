import { NextResponse } from 'next/server'
import { rowToProject, type NetVisionProjectRow } from '@/lib/netvision/cloudServer'
import {
  NETVISION_PLANOS_BUCKET,
  esTokenCompartir,
  proyectoParaCliente,
  rutaPlanoNube,
  tienePlanoAparte,
} from '@/lib/netvision/compartir'
import { supabaseAdminForRoute } from '@/lib/talento/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteCtx = { params: { token: string } }

/** Una hora: suficiente para abrir la vista; al recargar se firma otra. */
const PLANO_URL_SEGUNDOS = 60 * 60

/**
 * GET — proyecto compartido con el cliente (público, solo lectura).
 * El código secreto del enlace es la única llave; no requiere sesión.
 */
export async function GET(_req: Request, { params }: RouteCtx) {
  const token = params.token?.trim() ?? ''
  if (!esTokenCompartir(token)) {
    return NextResponse.json({ ok: false, error: 'Enlace no válido.' }, { status: 404 })
  }
  const admin = supabaseAdminForRoute()
  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: 'El enlace no está disponible en este momento.' },
      { status: 503 },
    )
  }
  try {
    const { data, error } = await admin.client
      .from('netvision_projects')
      .select('*')
      .eq('share_token', token)
      .maybeSingle()
    if (error) {
      console.error('[netvision compartido]', error.message)
      return NextResponse.json(
        { ok: false, error: 'El enlace no está disponible en este momento.' },
        { status: 500 },
      )
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'Este enlace ya no está disponible. Pide uno nuevo a tu instalador.' },
        { status: 404 },
      )
    }
    const row = data as unknown as NetVisionProjectRow
    const project = proyectoParaCliente(rowToProject(row))

    // El plano grande vive en Storage: se entrega con una URL firmada temporal.
    // Solo si el proyecto dice tener plano: si se le quitó, no se entrega el viejo.
    let planoSignedUrl: string | null = null
    if (tienePlanoAparte(project)) {
      const firmado = await admin.client.storage
        .from(NETVISION_PLANOS_BUCKET)
        .createSignedUrl(rutaPlanoNube(row.user_id, row.id), PLANO_URL_SEGUNDOS)
      planoSignedUrl = firmado.data?.signedUrl ?? null
    }

    return NextResponse.json(
      { ok: true, project, planoSignedUrl, updatedAt: row.updated_at },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[netvision compartido]', e)
    return NextResponse.json(
      { ok: false, error: 'El enlace no está disponible en este momento.' },
      { status: 500 },
    )
  }
}
