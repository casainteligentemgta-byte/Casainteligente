import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { apiRequiereSesion } from '../supabase/rutasAcceso'

/**
 * Una ruta que usa la llave de servidor (service role) se salta las reglas de la base:
 * si además es de personal (pide sesión), tiene que comprobar el permiso de quien llama.
 * Sin esto, cualquier cuenta —también la de un obrero o una de prueba— podría usarla.
 */
const USA_LLAVE_SERVIDOR =
  /supabaseAdminForRoute|createSupabaseAdminClient|createSupabaseAdminOnlyClient|SUPABASE_SERVICE_ROLE|resolveSupabaseServiceRoleKey|telegramSupabaseAdmin/

/** Rutas que usan la llave de servidor sin pedir permiso, a propósito. */
const EXCEPCIONES = new Set([
  // Solo responde si el propio usuario tiene acceso al módulo legal (lo calcula, no expone datos).
  '/api/legal/acceso',
])

const COMPRUEBA_PERMISO =
  /requireAlgunPermisoWeb|requirePermisoWeb|requireCcoAcceso|requireAccesoFlota|requireAccesoLegal|exigirUsuarioSistemaTelegram|actorTienePermiso|resolverActorWeb|CRON_SECRET/

describe('rutas de servidor con control de permiso', () => {
  it('toda ruta de personal que usa la llave de servidor comprueba el permiso', () => {
    const raiz = join(process.cwd(), 'app', 'api')
    const sinControl: string[] = []
    let revisadas = 0
    const recorrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name)
        if (e.isDirectory()) recorrer(ruta)
        else if (/^route\.(ts|tsx|js)$/.test(e.name)) {
          const url = '/api/' + relative(raiz, dir).split(sep).join('/')
          if (!apiRequiereSesion(url.replace(/\[[^\]]+\]/g, 'abc'))) continue
          const codigo = readFileSync(ruta, 'utf8')
          if (!USA_LLAVE_SERVIDOR.test(codigo)) continue
          revisadas += 1
          if (!COMPRUEBA_PERMISO.test(codigo) && !EXCEPCIONES.has(url)) sinControl.push(url)
        }
      }
    }
    recorrer(raiz)
    assert.ok(revisadas > 50, `se esperaban más de 50 rutas de servidor y se encontraron ${revisadas}`)
    assert.deepEqual(sinControl.sort(), [], 'agregue requirePermisoWeb / requireAlgunPermisoWeb / requireCcoAcceso')
  })
})
