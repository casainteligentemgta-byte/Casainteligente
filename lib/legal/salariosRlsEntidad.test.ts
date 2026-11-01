import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/374_salarios_solo_roles_y_vistas_invoker.sql'),
  'utf8',
)

function bloquePolitica(nombre: string): string {
  const re = new RegExp(
    `CREATE POLICY ${nombre}[\\s\\S]*?USING \\(([\\s\\S]*?)\\);`,
    'm',
  )
  const m = sql.match(re)
  assert.ok(m, `falta CREATE POLICY ${nombre}`)
  return m[1]
}

describe('RLS de salarios y beneficios (migración 374)', () => {
  for (const nombre of [
    'ci_labor_salary_history_select_roles',
    'ci_labor_benefit_configs_select_roles',
  ] as const) {
    it(`${nombre} acota entidad_admin/director/rrhh a su entidad y deja global a super_admin`, () => {
      const using = bloquePolitica(nombre)
      assert.match(using, /get_auth_user_context\(\)/)
      assert.match(using, /uc\.out_entidad_id/)
      assert.match(using, /super_admin/)
      assert.match(using, /entidad_admin/)
      assert.match(using, /director/)
      assert.match(using, /rrhh/)
      assert.match(using, /ci_empleados/)
      assert.match(using, /e\.entidad_id/)
      assert.match(using, /worker_id/)
      assert.doesNotMatch(
        using,
        /out_rol::text IN \('super_admin', 'entidad_admin', 'director', 'rrhh'\)/,
      )
    })
  }
})
