import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  projectToRowFields,
  rowToProject,
  type NetVisionProjectRow,
} from '@/lib/netvision/cloudServer'
import { projectFromPartial } from '@/lib/netvision/storage'
import type { NetVisionProject } from '@/lib/netvision/types'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: { id: string } }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** GET — un proyecto completo. */
export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const id = params.id?.trim() ?? ''
    const { supabase, user } = await requireUser()
    if (!user?.id) {
      return NextResponse.json(
        { ok: false, authenticated: false, error: 'No autenticado' },
        { status: 401 },
      )
    }

    const { data, error } = await supabase
      .from('netvision_projects')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: error.message },
        { status: 500 },
      )
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: 'Proyecto no encontrado' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      project: rowToProject(data as NetVisionProjectRow),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de servidor'
    return NextResponse.json(
      { ok: false, authenticated: false, error: msg },
      { status: 500 },
    )
  }
}

/** PUT — upsert proyecto. */
export async function PUT(req: Request, { params }: RouteCtx) {
  try {
    const id = params.id?.trim() ?? ''
    const { supabase, user } = await requireUser()
    if (!user?.id) {
      return NextResponse.json(
        { ok: false, authenticated: false, error: 'No autenticado' },
        { status: 401 },
      )
    }

    const body = (await req.json()) as { project?: Partial<NetVisionProject> }
    if (!body.project || typeof body.project !== 'object') {
      return NextResponse.json(
        { ok: false, authenticated: true, error: 'Falta project' },
        { status: 400 },
      )
    }

    const project = projectFromPartial({ ...body.project, id }, id)
    const fields = projectToRowFields(project)

    const { data, error } = await supabase
      .from('netvision_projects')
      .upsert(
        {
          user_id: user.id,
          ...fields,
        },
        { onConflict: 'user_id,id' },
      )
      .select('*')
      .maybeSingle()

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

    return NextResponse.json({
      ok: true,
      authenticated: true,
      project: data ? rowToProject(data as NetVisionProjectRow) : project,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de servidor'
    return NextResponse.json(
      { ok: false, authenticated: false, error: msg },
      { status: 500 },
    )
  }
}

/** DELETE — elimina proyecto en la nube. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const id = params.id?.trim() ?? ''
    const { supabase, user } = await requireUser()
    if (!user?.id) {
      return NextResponse.json(
        { ok: false, authenticated: false, error: 'No autenticado' },
        { status: 401 },
      )
    }

    const { error } = await supabase
      .from('netvision_projects')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, authenticated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de servidor'
    return NextResponse.json(
      { ok: false, authenticated: false, error: msg },
      { status: 500 },
    )
  }
}
