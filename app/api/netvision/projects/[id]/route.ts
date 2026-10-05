import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  projectToRowFields,
  rowToProject,
  type NetVisionProjectRow,
} from '@/lib/netvision/cloudServer'
import { NETVISION_PLANOS_BUCKET, rutaPlanoNube } from '@/lib/netvision/compartir'
import {
  decidirGuardado,
  leerBaseDePeticion,
  mismoContenido,
  type ConflictoNube,
} from '@/lib/netvision/sincronizacion'
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

function errorDeTabla(error: { message: string; code?: string }): string {
  return error.message.includes('netvision_projects') || error.code === '42P01'
    ? 'Tabla netvision_projects no disponible. Aplica la migración 274.'
    : error.message
}

function respuestaConflicto(remoto: NetVisionProjectRow) {
  const proyecto = rowToProject(remoto)
  const conflict: ConflictoNube = {
    updatedAt: remoto.updated_at,
    name: proyecto.name,
    cameras: proyecto.cameras.length,
  }
  return NextResponse.json(
    {
      ok: false,
      authenticated: true,
      conflict,
      error: 'La nube tiene otra versión de este proyecto. No se sobrescribió.',
    },
    { status: 409 },
  )
}

/**
 * PUT — guarda el proyecto sin pisar trabajo ajeno.
 * El navegador envía la versión de la nube de la que partió (`base`). Si la
 * nube ya está en otra versión y el diseño es distinto, responde 409 con un
 * resumen de lo que hay en la nube; `force` sobrescribe (lo decide el usuario).
 */
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

    const body = (await req.json()) as {
      project?: Partial<NetVisionProject>
      base?: unknown
      force?: unknown
    }
    if (!body.project || typeof body.project !== 'object') {
      return NextResponse.json(
        { ok: false, authenticated: true, error: 'Falta project' },
        { status: 400 },
      )
    }

    const project = projectFromPartial({ ...body.project, id }, id)
    const fields = projectToRowFields(project)
    const forzar = body.force === true

    const actual = await supabase
      .from('netvision_projects')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', id)
      .maybeSingle()
    if (actual.error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: errorDeTabla(actual.error) },
        { status: 500 },
      )
    }
    const remoto = (actual.data as NetVisionProjectRow | null) ?? null

    const decision = decidirGuardado({
      remotoUpdatedAt: remoto?.updated_at ?? null,
      base: leerBaseDePeticion(body.base),
      forzar,
      mismoContenido: remoto ? mismoContenido(rowToProject(remoto), project) : false,
    })

    if (decision === 'conflicto' && remoto) return respuestaConflicto(remoto)

    if (decision === 'sin_cambios' && remoto) {
      return NextResponse.json({
        ok: true,
        authenticated: true,
        project: rowToProject(remoto),
      })
    }

    if (decision === 'crear') {
      const creado = await supabase
        .from('netvision_projects')
        .insert({ user_id: user.id, ...fields })
        .select('*')
        .maybeSingle()
      if (creado.error) {
        // Otro equipo lo creó en este mismo instante: se trata como conflicto.
        if (creado.error.code === '23505') {
          const otra = await supabase
            .from('netvision_projects')
            .select('*')
            .eq('user_id', user.id)
            .eq('id', id)
            .maybeSingle()
          if (otra.data) return respuestaConflicto(otra.data as NetVisionProjectRow)
        }
        return NextResponse.json(
          { ok: false, authenticated: true, error: errorDeTabla(creado.error) },
          { status: 500 },
        )
      }
      return NextResponse.json({
        ok: true,
        authenticated: true,
        project: creado.data ? rowToProject(creado.data as NetVisionProjectRow) : project,
      })
    }

    // Actualizar: solo si la nube sigue en la versión que se acaba de leer
    // (si otro equipo guardó entre la lectura y este guardado, no se pisa).
    let consulta = supabase
      .from('netvision_projects')
      .update(fields)
      .eq('user_id', user.id)
      .eq('id', id)
    if (!forzar && remoto) consulta = consulta.eq('updated_at', remoto.updated_at)
    const guardado = await consulta.select('*')
    if (guardado.error) {
      return NextResponse.json(
        { ok: false, authenticated: true, error: errorDeTabla(guardado.error) },
        { status: 500 },
      )
    }
    const fila = (guardado.data as NetVisionProjectRow[] | null)?.[0] ?? null
    if (!fila) {
      const otra = await supabase
        .from('netvision_projects')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', id)
        .maybeSingle()
      if (otra.data) return respuestaConflicto(otra.data as NetVisionProjectRow)
      return NextResponse.json(
        { ok: false, authenticated: true, error: 'El proyecto ya no existe en la nube.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      project: rowToProject(fila),
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

    // El plano del proyecto en Storage ya no tiene dueño: se borra también.
    await supabase.storage
      .from(NETVISION_PLANOS_BUCKET)
      .remove([rutaPlanoNube(user.id, id)])
      .catch(() => undefined)

    return NextResponse.json({ ok: true, authenticated: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de servidor'
    return NextResponse.json(
      { ok: false, authenticated: false, error: msg },
      { status: 500 },
    )
  }
}
