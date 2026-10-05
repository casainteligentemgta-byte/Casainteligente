/**
 * Acceso a Supabase (desde el navegador, con la sesión del usuario) para crear
 * un presupuesto de Ventas a partir de la lista de materiales de NetVision.
 */
import { createClient } from '@/lib/supabase/client'
import type {
  PresupuestoVentas,
  ProductoVenta,
} from '@/lib/netvision/presupuesto'

export type ClientePresupuesto = {
  id: string
  nombre: string | null
  rif: string | null
}

export type DatosPresupuesto = {
  autenticado: boolean
  clientes: ClientePresupuesto[]
  productos: ProductoVenta[]
  /** clave del renglón → id de producto (enlaces recordados). */
  enlaces: Record<string, number>
  error?: string
}

/** Sin la columna `imagen`: puede traer fotos incrustadas muy pesadas. */
const COLUMNAS_PRODUCTO =
  'id,external_id,nombre,categoria,marca,modelo,descripcion,costo,precio,utilidad,cantidad,image_url'

const TABLA_ENLACES = 'netvision_producto_enlaces'

export async function cargarDatosPresupuesto(): Promise<DatosPresupuesto> {
  const vacio: DatosPresupuesto = { autenticado: false, clientes: [], productos: [], enlaces: {} }
  let supabase: ReturnType<typeof createClient>
  try {
    supabase = createClient()
  } catch (e) {
    return { ...vacio, error: e instanceof Error ? e.message : 'Supabase no está configurado.' }
  }
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return vacio

    const [clientes, productos, enlaces] = await Promise.all([
      supabase
        .from('customers')
        .select('id,nombre,rif')
        .order('nombre', { ascending: true, nullsFirst: false }),
      supabase.from('products').select(COLUMNAS_PRODUCTO).order('nombre', { ascending: true }),
      supabase.from(TABLA_ENLACES).select('sku,product_id'),
    ])
    if (clientes.error) return { ...vacio, autenticado: true, error: clientes.error.message }
    if (productos.error) return { ...vacio, autenticado: true, error: productos.error.message }

    const mapa: Record<string, number> = {}
    // Si la tabla de enlaces aún no existe, se sigue sin enlaces recordados.
    if (!enlaces.error && Array.isArray(enlaces.data)) {
      for (const fila of enlaces.data as { sku?: unknown; product_id?: unknown }[]) {
        if (typeof fila.sku === 'string' && typeof fila.product_id === 'number') {
          mapa[fila.sku] = fila.product_id
        }
      }
    }
    return {
      autenticado: true,
      clientes: (clientes.data ?? []) as ClientePresupuesto[],
      productos: (productos.data ?? []) as unknown as ProductoVenta[],
      enlaces: mapa,
    }
  } catch (e) {
    return { ...vacio, error: e instanceof Error ? e.message : 'No se pudo consultar Ventas.' }
  }
}

export type ResultadoBorrador =
  | { ok: true; id: string; enlacesGuardados: boolean }
  | { ok: false; error: string }

/** Crea el presupuesto como borrador («no enviado») y recuerda los enlaces. */
export async function crearBorradorPresupuesto(args: {
  cliente: ClientePresupuesto
  presupuesto: PresupuestoVentas
  notas: string
  enlaces: { sku: string; product_id: number }[]
}): Promise<ResultadoBorrador> {
  let supabase: ReturnType<typeof createClient>
  try {
    supabase = createClient()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Supabase no está configurado.' }
  }
  try {
    const { data, error } = await supabase
      .from('budgets')
      .insert([
        {
          customer_id: args.cliente.id,
          customer_name: (args.cliente.nombre ?? '').trim() || 'Sin nombre',
          customer_rif: (args.cliente.rif ?? '').trim(),
          items: args.presupuesto.items,
          subtotal: args.presupuesto.subtotal,
          total_cost: args.presupuesto.total_cost,
          total_profit: args.presupuesto.total_profit,
          margin_pct: args.presupuesto.margin_pct,
          notes: args.notas,
          show_zelle: true,
          status: 'no_enviado',
        },
      ])
      .select('id')
      .single()
    if (error || !data) {
      return { ok: false, error: error?.message ?? 'No se pudo crear el presupuesto.' }
    }
    let enlacesGuardados = true
    if (args.enlaces.length > 0) {
      const res = await supabase
        .from(TABLA_ENLACES)
        .upsert(
          args.enlaces.map((e) => ({ ...e, updated_at: new Date().toISOString() })),
          { onConflict: 'sku' },
        )
      enlacesGuardados = !res.error
    }
    return { ok: true, id: String((data as { id: unknown }).id), enlacesGuardados }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo crear el presupuesto.' }
  }
}
