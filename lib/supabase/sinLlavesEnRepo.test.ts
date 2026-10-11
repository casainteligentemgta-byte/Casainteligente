import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * El repositorio es público. Una llave «service_role» de Supabase escrita en cualquier
 * archivo deja leer y cambiar toda la base saltándose los permisos. Esta prueba recorre
 * los archivos versionados y falla si aparece una.
 */
const PATRON_JWT = 'eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}'

function archivosConJwt(): string[] {
  try {
    return execFileSync('git', ['grep', '-lE', PATRON_JWT, '--', '.'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  } catch (e) {
    // git grep termina con código 1 cuando no encuentra nada.
    if ((e as { status?: number }).status === 1) return []
    throw e
  }
}

function rolDeJwt(token: string): string | null {
  try {
    const cuerpo = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { role?: string }
    return cuerpo.role ?? null
  } catch {
    return null
  }
}

describe('llaves en el repositorio', () => {
  it('ningún archivo versionado trae una llave de servicio de Supabase ni una llave nueva secreta', () => {
    const conLlaveDeServicio: string[] = []
    for (const archivo of archivosConJwt()) {
      const texto = readFileSync(archivo, 'utf8')
      const tokens = texto.match(new RegExp(PATRON_JWT, 'g')) ?? []
      if (tokens.some((t) => rolDeJwt(t) === 'service_role')) conLlaveDeServicio.push(archivo)
    }
    assert.deepEqual(conLlaveDeServicio, [], 'hay llaves service_role escritas en el repositorio')

    let conSecretaNueva: string[] = []
    try {
      conSecretaNueva = execFileSync('git', ['grep', '-lE', 'sb_secret_[A-Za-z0-9_-]{16,}', '--', '.'], {
        encoding: 'utf8',
      })
        .split('\n')
        .filter(Boolean)
    } catch (e) {
      if ((e as { status?: number }).status !== 1) throw e
    }
    assert.deepEqual(conSecretaNueva, [], 'hay llaves sb_secret_ escritas en el repositorio')
  })
})
