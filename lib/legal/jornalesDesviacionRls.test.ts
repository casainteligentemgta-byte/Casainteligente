import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql382 = readFileSync(
  join(process.cwd(), 'supabase/migrations/382_ci_jornales_obra_y_desviacion.sql'),
  'utf8',
)
const sql383 = readFileSync(
  join(process.cwd(), 'supabase/migrations/383_seed_demo_jornales_desviacion.sql'),
  'utf8',
)
const sqlCleanup = readFileSync(
  join(process.cwd(), 'supabase/sql/cleanup_seed_demo_jornales_desviacion.sql'),
  'utf8',
)
const apiJornales = readFileSync(
  join(process.cwd(), 'app/api/proyectos/[proyectoId]/jornales/route.ts'),
  'utf8',
)
const apiDesviacion = readFileSync(
  join(process.cwd(), 'app/api/proyectos/[proyectoId]/desviacion/route.ts'),
  'utf8',
)

function bloquePolitica(sql: string, nombre: string): string {
  const re = new RegExp(`CREATE POLICY ${nombre}[\\s\\S]*?;`, 'i')
  const m = sql.match(re)
  assert.ok(m, `falta CREATE POLICY ${nombre}`)
  return m[0]
}

describe('schema jornales / desviación (migración 382)', () => {
  it('crea tablas nuevas y no altera rrhh_asistencias_diarias', () => {
    assert.match(sql382, /create table if not exists public\.ci_jornales_obra_asistencias/)
    assert.match(sql382, /create table if not exists public\.ci_jornales_obra_tarifas/)
    assert.match(sql382, /create table if not exists public\.ci_proyecto_desviacion_config/)
    assert.match(sql382, /constraint ci_jornales_obra_asistencias_unico unique \(proyecto_id, empleado_id, fecha\)/)
    assert.doesNotMatch(sql382, /alter table public\.rrhh_asistencias_diarias/i)
  })

  it('la vista de asistencias es security_invoker', () => {
    assert.match(sql382, /ci_v_jornales_obra_asistencias/)
    assert.match(sql382, /security_invoker\s*=\s*true/)
  })

  it('RLS de jornales usa ci_tiene_permiso_en_entidad por entidad del proyecto', () => {
    for (const nombre of [
      'ci_jornales_obra_tarifas_select',
      'ci_jornales_obra_asistencias_insert',
      'ci_jornales_obra_asistencias_delete',
    ]) {
      const p = bloquePolitica(sql382, nombre)
      assert.match(p, /ci_tiene_permiso_en_entidad\(\s*'equipo\.gestionar'/)
      assert.match(p, /ci_proyectos p where p\.id = proyecto_id/)
    }
  })

  it('revoca anon en tablas salariales', () => {
    assert.match(sql382, /revoke all on public\.ci_jornales_obra_asistencias from anon/i)
    assert.match(sql382, /revoke all on public\.ci_jornales_obra_tarifas from anon/i)
  })
})

describe('APIs de jornales y desviación', () => {
  it('usan el cliente de sesión y no service_role', () => {
    for (const src of [apiJornales, apiDesviacion]) {
      assert.match(src, /requireAlgunPermisoWeb/)
      assert.match(src, /acceso\.supabase/)
      assert.doesNotMatch(src, /createSupabaseAdminOnlyClient/)
      assert.doesNotMatch(src, /createSupabaseAdminClient/)
      assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE/)
    }
  })
})

describe('seed demo y limpieza', () => {
  it('marca cada fila demo y se puede borrar por tag', () => {
    assert.match(sql383, /demo_jornales_desviacion_v1/)
    assert.match(sql383, /\[DEMO\] Instalación CCTV/)
    assert.match(sql383, /\[DEMO\] Automatización de red/)
    assert.match(sql383, /ci_seed_demo_filas/)
    assert.match(sqlCleanup, /demo_jornales_desviacion_v1/)
    assert.match(sqlCleanup, /delete from public\.ci_jornales_obra_asistencias/)
    assert.match(sqlCleanup, /delete from public\.ci_proyectos/)
  })

  it('383 coincide con el schema real de producción', () => {
    assert.match(sql383, /nombre_proyecto/)
    assert.doesNotMatch(sql383, /insert into public\.ci_obra_empleados/i)
    assert.doesNotMatch(sql383, /cargo_codigo, oficio/)
    assert.doesNotMatch(sql383, /email, status/)
  })

  it('cleanup no borra ci_obra_empleados por obra_id = proyecto demo', () => {
    assert.doesNotMatch(sqlCleanup, /obra_id = any \(v_proyectos\)/)
    assert.match(sqlCleanup, /empleado_id = any \(v_empleados\)/)
  })
})

const cargarJornales = readFileSync(
  join(process.cwd(), 'lib/proyectos/jornales/cargarJornalesProyecto.ts'),
  'utf8',
)

describe('roster API de jornales', () => {
  it('no usa ci_obra_empleados.obra_id = proyecto_id como única fuente', () => {
    assert.match(cargarJornales, /unirIdsRosterJornales/)
    assert.match(cargarJornales, /ci_jornales_obra_tarifas/)
    assert.match(cargarJornales, /legacy_obra_id/)
    assert.doesNotMatch(cargarJornales, /\.eq\(['"]obra_id['"], proyectoId\)/)
    assert.doesNotMatch(apiJornales, /listarEmpleadosProyectoEgreso/)
    assert.match(apiJornales, /listarRosterJornalesProyecto/)
  })
})
