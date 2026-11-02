import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql374 = readFileSync(
  join(process.cwd(), 'supabase/migrations/374_salarios_solo_roles_y_vistas_invoker.sql'),
  'utf8',
)
const sql380 = readFileSync(
  join(process.cwd(), 'supabase/migrations/380_ci_empleados_rls_por_entidad.sql'),
  'utf8',
)
const sql381 = readFileSync(
  join(process.cwd(), 'supabase/migrations/381_ci_insumos_select_authenticated.sql'),
  'utf8',
)

function bloquePolitica(sql: string, nombre: string): string {
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
      const using = bloquePolitica(sql374, nombre)
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

describe('RLS de ci_empleados por entidad (migración 380)', () => {
  it('define ci_tiene_permiso_en_entidad con super_admin global y match de entidad_id', () => {
    assert.match(sql380, /ci_tiene_permiso_en_entidad\(p_permiso text, p_entidad_id uuid\)/)
    assert.match(sql380, /ur\.rol = 'super_admin'::public\.ci_rol_sistema/)
    assert.match(sql380, /ur\.entidad_id = p_entidad_id/)
    assert.match(sql380, /equipo\.gestionar/)
  })

  it('las políticas authenticated usan el helper por entidad y conservan los nombres de 376', () => {
    for (const nombre of [
      'ci_empleados_select_equipo',
      'ci_empleados_update_equipo',
      'ci_empleados_delete_equipo',
    ] as const) {
      const using = bloquePolitica(sql380, nombre)
      assert.match(using, /ci_tiene_permiso_en_entidad\('equipo\.gestionar', entidad_id\)/)
    }
    assert.match(
      sql380,
      /WITH CHECK \(public\.ci_tiene_permiso_en_entidad\('equipo\.gestionar', entidad_id\)\)/,
    )
    assert.match(sql380, /ci_empleados_insert_con_enlace|no se tocan/i)
  })
})

describe('vista insumos (migración 381)', () => {
  it('concede SELECT autenticado y política USING true en ci_insumos', () => {
    assert.match(sql381, /GRANT SELECT ON TABLE public\.ci_insumos TO authenticated/)
    const using = bloquePolitica(sql381, 'ci_insumos_select_auth')
    assert.match(using.trim(), /^true$/i)
    assert.doesNotMatch(sql381, /FOR INSERT|FOR UPDATE|FOR DELETE|TO anon/)
  })
})
