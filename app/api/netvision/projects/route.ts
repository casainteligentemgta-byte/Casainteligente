import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rowToProject, type NetVisionProjectRow } from '@/lib/netvision/cloudServer'

export const dynamic = 'force-dynamic'

/** GET — lista proyectos NetVision del usuario autenticado. */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json(
        { ok: false, authenticated: false, error: 'No autenticado' },
        { status: 401 },
      )
    }

    const { data, error } = await supabase
      .from('netvision_projects')
      .select(
        'id, name, description, client_name, plano_nombre, has_plano, payload, updated_at, retention_days, unit_system, currency, distributor_margin_pct, compliance_profile_id',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          authenticated: true,
          error:
            error.message.includes('netvision_projects') || error.code === '42P01'
              ? 'Tabla netvision_projects no disponible. Aplica la migración 274.'
              : error.message,
        },
        { status: 500 },
      )
    }

    const projects = (data ?? []).map((row) => {
      const full = rowToProject(row as NetVisionProjectRow)
      return {
        id: full.id,
        name: full.name,
        updatedAt: full.updatedAt,
        planoNombre: full.planoNombre,
        cameraCount: full.cameras.length,
        networkCount: full.networkNodes.length,
        hasPlano: Boolean((row as { has_plano?: boolean }).has_plano),
        source: 'cloud' as const,
      }
    })

    return NextResponse.json({ ok: true, authenticated: true, projects })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de servidor'
    return NextResponse.json(
      { ok: false, authenticated: false, error: msg },
      { status: 500 },
    )
  }
}
