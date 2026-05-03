'use server'

import { createClient } from '@/lib/supabase/server'
import { Project, ProjectStatus } from '@/types'

const MOCK_PROJECTS: Project[] = [
    {
        id: '1',
        name: 'Instalación Villa Sol',
        status: 'Pendiente',
        budget: { id: 'b1', sale_price: 15000, cost_price: 10000 },
        description: 'Sistema de iluminación inteligente y seguridad'
    },
    {
        id: '2',
        name: 'Automatización Penthouse',
        status: 'En Progreso',
        budget: { id: 'b2', sale_price: 8000, cost_price: 7000 }, // Ejemplo de bajo margen
        description: 'Automatización completa del hogar'
    },
    {
        id: '3',
        name: 'Actualización Seguridad Oficina',
        status: 'Completado',
        budget: { id: 'b3', sale_price: 5000, cost_price: 2500 },
        description: 'CCTV y Control de Acceso'
    }
]

export async function getProjects(): Promise<{ data: Project[] | null, error: any }> {
    // Si no hay credenciales de Supabase configuradas, devuelve datos simulados (mock)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn("Faltan credenciales de Supabase. Devolviendo datos de prueba.")
        return { data: MOCK_PROJECTS, error: null }
    }

    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*, budget:budgets(*)')

        if (error) {
            console.error('Error de Supabase:', error)
            // Fallback a datos simulados en caso de error para demostración
            return { data: MOCK_PROJECTS, error: null }
        }

        // budgets usa subtotal/total_cost; la UI (ProjectCard) espera sale_price/cost_price
        const mapped = (data ?? []).map((row: Record<string, unknown>) => {
            const b = row.budget as Record<string, unknown> | null | undefined
            const sale = (row.sale_price as number | undefined) ?? (b?.subtotal as number | undefined) ?? (b?.sale_price as number | undefined) ?? 0
            const cost = (row.cost_price as number | undefined) ?? (b?.total_cost as number | undefined) ?? (b?.cost_price as number | undefined) ?? 0
            const budgetId = (row.budget_id as string | undefined) ?? (b?.id as string | undefined)
            return {
                ...row,
                budget: b
                    ? {
                        id: String(b.id ?? budgetId ?? ''),
                        sale_price: Number(sale),
                        cost_price: Number(cost),
                    }
                    : sale > 0 || cost > 0
                      ? { id: budgetId ?? '', sale_price: Number(sale), cost_price: Number(cost) }
                      : undefined,
            } as Project
        })

        return { data: mapped, error: null }
    } catch (e) {
        return { data: MOCK_PROJECTS, error: null }
    }
}

export async function updateProjectStatus(projectId: string, newStatus: ProjectStatus) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.log(`[MOCK] Proyecto ${projectId} actualizado a ${newStatus}`)
        return { error: null }
    }

    const supabase = await createClient()

    const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId)

    return { error }
}
