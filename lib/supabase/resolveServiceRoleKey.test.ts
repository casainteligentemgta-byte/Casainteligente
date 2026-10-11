import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSupabaseServiceRoleKey, tipoLlaveSupabase } from './resolveServiceRoleKey'

const VARIABLES = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'] as const
const original = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]))

function poner(valores: Partial<Record<(typeof VARIABLES)[number], string>>) {
  for (const v of VARIABLES) {
    if (valores[v] === undefined) delete process.env[v]
    else process.env[v] = valores[v]
  }
}

afterEach(() => {
  for (const v of VARIABLES) {
    if (original[v] === undefined) delete process.env[v]
    else process.env[v] = original[v]
  }
})

describe('llave del servidor', () => {
  it('la llave secreta nueva manda sobre la antigua', () => {
    poner({ SUPABASE_SECRET_KEY: ' sb_secret_nueva ', SUPABASE_SERVICE_ROLE_KEY: 'antigua.jwt.firma' })
    assert.equal(resolveSupabaseServiceRoleKey(), 'sb_secret_nueva')
  })

  it('sin la nueva sigue usando la antigua; quitar la nueva deshace el cambio', () => {
    poner({ SUPABASE_SERVICE_ROLE_KEY: 'antigua.jwt.firma' })
    assert.equal(resolveSupabaseServiceRoleKey(), 'antigua.jwt.firma')
    poner({ SUPABASE_SECRET_KEY: '   ', SUPABASE_SERVICE_ROLE_KEY: 'antigua.jwt.firma' })
    assert.equal(resolveSupabaseServiceRoleKey(), 'antigua.jwt.firma')
  })

  it('sin ninguna devuelve vacío', () => {
    poner({})
    assert.equal(resolveSupabaseServiceRoleKey(), '')
  })

  it('dice la clase de llave sin revelar su valor', () => {
    assert.equal(tipoLlaveSupabase('sb_secret_abc'), 'nueva')
    assert.equal(tipoLlaveSupabase('sb_publishable_abc'), 'nueva')
    assert.equal(tipoLlaveSupabase('eyJhbGciOi.xxx.yyy'), 'antigua')
    assert.equal(tipoLlaveSupabase(''), 'ausente')
    assert.equal(tipoLlaveSupabase(undefined), 'ausente')
  })
})
