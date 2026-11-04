import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const m399 = readFileSync(
  join(process.cwd(), 'supabase/migrations/399_386b_tasa_bcv_fallback_sin_demo.sql'),
  'utf8',
)
const m400 = readFileSync(
  join(process.cwd(), 'supabase/migrations/400_revocar_anon_datos_sensibles.sql'),
  'utf8',
)

describe('migración 399: fallback BCV sin demo ni 36.5', () => {
  it('recrea el fallback y no inventa 36.5', () => {
    assert.match(m399, /ci_tasa_bcv_compra_fallback/)
    assert.match(m399, /not ilike 'DEMO-%'/)
    assert.match(m399, /contabilidad_compras/)
    assert.match(m399, /purchase_invoices/)
    assert.doesNotMatch(m399, /36\.5/)
    assert.doesNotMatch(m399, /update\s+public\.(contabilidad_compras|purchase_invoices)/i)
  })
})

describe('migración 400: revoca anon en datos sensibles', () => {
  it('cierra salarios y nómina al público y no toca el expediente del candidato', () => {
    assert.match(m400, /revoke all on table public\.ci_labor_salary_history from anon/i)
    assert.match(m400, /revoke all on table public\.ci_nomina_items from anon/i)
    assert.match(m400, /grant select on table public\.products_lectura to authenticated/i)
    assert.doesNotMatch(m400, /revoke all on table public\.ci_empleados/i)
    assert.doesNotMatch(m400, /revoke all on table public\.ci_hojas_vida/i)
    assert.doesNotMatch(m400, /update\s+public\./i)
    assert.doesNotMatch(m400, /delete\s+from\s+public\./i)
  })
})
