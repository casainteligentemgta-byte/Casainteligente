/**
 * Carga de listas de distribuidor 2026 (Siemon, Acceso-Alarma) en Productos.
 * Costo = lista USD, precio = costo, utilidad = 0. No se inventa margen.
 * Empareja por marca + modelo (sin distinguir mayúsculas ni espacios).
 */

export type ItemCatalogoDistribuidor = {
  marca: string
  modelo: string
  nombre: string
  categoria: string
  costo: number
  estatus: string
  descripcion: string
}

export type ProductoExistenteCatalogo = {
  id: number
  marca: string | null
  modelo: string | null
}

export type PlanCargaCatalogo = {
  actualizar: Array<{ id: number; item: ItemCatalogoDistribuidor }>
  crear: ItemCatalogoDistribuidor[]
}

export function claveCatalogo(marca: string | null | undefined, modelo: string | null | undefined): string {
  return `${(marca ?? '').trim().toLowerCase()}::${(modelo ?? '').trim().toLowerCase()}`
}

export function mismaMarcaCatalogo(rowMarca: string | null | undefined, marca: string): boolean {
  const m = (rowMarca ?? '').trim().toLowerCase()
  return m === '' || m === marca.trim().toLowerCase()
}

export function payloadCatalogoDistribuidor(item: ItemCatalogoDistribuidor): Record<string, string | number> {
  return {
    nombre: item.nombre,
    categoria: item.categoria,
    marca: item.marca,
    modelo: item.modelo,
    descripcion: item.descripcion,
    descripcion2: `Lista distribuidor 2026 · ${item.estatus}`,
    costo: item.costo,
    precio: item.costo,
    utilidad: 0,
  }
}

export function planearCargaCatalogo(
  items: ItemCatalogoDistribuidor[],
  existentes: ProductoExistenteCatalogo[],
): PlanCargaCatalogo {
  const byKey = new Map<string, ProductoExistenteCatalogo[]>()
  for (const row of existentes) {
    const modelo = String(row.modelo ?? '')
    if (!modelo.trim()) continue
    const k = claveCatalogo(row.marca, modelo)
    const lista = byKey.get(k) ?? []
    lista.push(row)
    byKey.set(k, lista)
    if (!(row.marca ?? '').trim()) {
      const vacia = claveCatalogo('', modelo)
      if (vacia !== k) {
        const extra = byKey.get(vacia) ?? []
        extra.push(row)
        byKey.set(vacia, extra)
      }
    }
  }

  const actualizar: PlanCargaCatalogo['actualizar'] = []
  const crear: ItemCatalogoDistribuidor[] = []
  const idsUsados = new Set<number>()

  for (const item of items) {
    const candidatos = [
      ...(byKey.get(claveCatalogo(item.marca, item.modelo)) ?? []),
      ...(byKey.get(claveCatalogo('', item.modelo)) ?? []),
    ]
    const ids: number[] = []
    for (const row of candidatos) {
      if (idsUsados.has(row.id)) continue
      if (!mismaMarcaCatalogo(row.marca, item.marca)) continue
      if (ids.includes(row.id)) continue
      ids.push(row.id)
    }
    if (ids.length > 0) {
      for (const id of ids) {
        idsUsados.add(id)
        actualizar.push({ id, item })
      }
    } else {
      crear.push(item)
    }
  }

  return { actualizar, crear }
}
