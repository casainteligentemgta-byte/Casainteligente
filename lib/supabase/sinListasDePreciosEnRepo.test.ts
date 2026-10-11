import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * El repositorio es público. Las listas de precios del proveedor (con sus costos) no van
 * aquí: se suben desde Productos → «Importar lista de precios», con la sesión del dueño.
 * En octubre de 2026 llegaron a estar versionadas tres listas en JSON y SQL; esta prueba
 * falla si vuelve a entrar algo parecido.
 */
function versionados(...patrones: string[]): string[] {
  return execFileSync('git', ['ls-files', '--', ...patrones], { encoding: 'utf8' }).split('\n').filter(Boolean)
}

/** Renglones que parecen «producto con precio»: una inserción en products o un «"costo": 12.34». */
function renglonesConCosto(texto: string): number {
  const enJson = texto.match(/"(costo|precio|precio_usd|cost|price)"\s*:\s*\d/gi)?.length ?? 0
  const enSql = /insert\s+into\s+(public\.)?products/i.test(texto) ? (texto.match(/\d+\.\d{2}\b/g)?.length ?? 0) : 0
  return enJson + enSql
}

describe('listas de precios en el repositorio', () => {
  it('no hay carpetas de listas de proveedor', () => {
    assert.deepEqual(versionados('data/productos', 'supabase/sql_copy'), [])
  })

  it('ningún JSON, CSV o SQL versionado trae un catálogo con costos', () => {
    const sospechosos: string[] = []
    for (const archivo of versionados('*.json', '*.csv', '*.sql')) {
      if (archivo.startsWith('node_modules/') || archivo === 'package-lock.json') continue
      // Migraciones de esquema y datos de planos (NetVision) no son listas de proveedor.
      if (archivo.startsWith('data/netvision/')) continue
      let texto = ''
      try {
        texto = readFileSync(archivo, 'utf8')
      } catch {
        continue
      }
      if (renglonesConCosto(texto) >= 15) sospechosos.push(archivo)
    }
    assert.deepEqual(sospechosos, [], 'parece una lista de precios de proveedor; no debe ir al repositorio')
  })
})
