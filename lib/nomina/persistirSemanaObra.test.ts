import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { guardarPeriodoNomina } from './persistirSemanaObra'

type Fila = Record<string, unknown>

/** Base en memoria con lo justo de la API de Supabase que usa la nómina. */
function baseFalsa() {
  const tablas: Record<string, Fila[]> = {
    ci_nomina_obra_periodos: [],
    ci_nomina_obra_items: [],
    ci_nomina_obra_adelantos: [],
    ci_prestaciones_saldo: [],
  }
  let serie = 0
  const claves: Record<string, string[]> = {
    ci_nomina_obra_periodos: ['proyecto_id', 'semana_inicio'],
    ci_nomina_obra_items: ['periodo_id', 'empleado_id', 'tipo'],
    ci_nomina_obra_adelantos: ['item_id'],
    ci_prestaciones_saldo: ['empleado_id', 'proyecto_id'],
  }
  const from = (nombre: string) => {
    let op: 'select' | 'upsert' | 'delete' = 'select'
    let carga: Fila[] = []
    const filtros: ((f: Fila) => boolean)[] = []
    const pasa = (f: Fila) => filtros.every((x) => x(f))
    const correr = () => {
      const filas = tablas[nombre]!
      if (op === 'upsert') {
        const salida: Fila[] = []
        for (const nueva of carga) {
          const k = claves[nombre]!
          const vieja = filas.find((f) => k.every((c) => f[c] === nueva[c]))
          if (vieja) {
            Object.assign(vieja, nueva)
            salida.push(vieja)
          } else {
            const fila = { id: `id-${++serie}`, ...nueva }
            filas.push(fila)
            salida.push(fila)
          }
        }
        return { data: salida, error: null }
      }
      if (op === 'delete') {
        const quitar = filas.filter(pasa)
        tablas[nombre] = filas.filter((f) => !pasa(f))
        if (nombre === 'ci_nomina_obra_items') {
          const ids = quitar.map((f) => f.id)
          tablas.ci_nomina_obra_adelantos = tablas.ci_nomina_obra_adelantos!.filter((a) => ids.indexOf(a.item_id) < 0)
        }
        return { data: null, error: null }
      }
      let vista = filas.filter(pasa)
      if (nombre === 'ci_nomina_obra_items') {
        vista = vista.map((f) => ({ ...f, periodo: tablas.ci_nomina_obra_periodos!.find((p) => p.id === f.periodo_id) }))
      }
      return { data: vista, error: null }
    }
    const uno = () => {
      const r = correr()
      return { data: (r.data as Fila[] | null)?.[0] ?? null, error: null }
    }
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), api),
      in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.indexOf(f[c]) >= 0), api),
      upsert: (filas: Fila | Fila[]) => ((op = 'upsert'), (carga = Array.isArray(filas) ? filas : [filas]), api),
      delete: () => ((op = 'delete'), api),
      single: () => Promise.resolve(uno()),
      maybeSingle: () => Promise.resolve(uno()),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(correr()).then(ok, ko),
    }
    return api
  }
  return { db: { from } as unknown as SupabaseClient, tablas }
}

const SEMANA = (n: number) => `2026-0${Math.floor((n - 1) / 4) + 6}-${String(1 + ((n - 1) % 4) * 7).padStart(2, '0')}`
const obrero = (id: string) => ({ empleado_id: id, clase: 'ayudante' as const, dias_laborados: 5 })
const guardar = (db: SupabaseClient, semana: string, ids: string[]) =>
  guardarPeriodoNomina(db, { proyectoId: 'obra-1', semanaInicio: semana, tasaBcvPago: 100, tasaAnclaCestaBcv: 100, items: ids.map(obrero) })

test('la cuarta semana causa el derecho a la semana adicional pero no la paga', async () => {
  const { db, tablas } = baseFalsa()
  for (let n = 1; n <= 3; n++) await guardar(db, SEMANA(n), ['a'])
  const cuarta = await guardar(db, SEMANA(4), ['a'])
  assert.equal(cuarta.previews[0]?.toca_adelanto, true)
  assert.equal(cuarta.previews[0]?.adelanto, null)
  assert.equal(cuarta.item_ids['a:adelanto_prestaciones'], undefined)
  assert.equal(tablas.ci_nomina_obra_items!.filter((i) => i.tipo === 'adelanto_prestaciones').length, 0)
  assert.equal(tablas.ci_nomina_obra_items!.filter((i) => i.periodo_id === cuarta.periodo_id).length, 1)
})

test('quien sale de la semana se quita', async () => {
  const { db, tablas } = baseFalsa()
  for (let n = 1; n <= 4; n++) await guardar(db, SEMANA(n), ['a', 'b'])
  const cuarta = await guardar(db, SEMANA(4), ['b'])
  const items = tablas.ci_nomina_obra_items!.filter((i) => i.periodo_id === cuarta.periodo_id)
  const de = (emp: string) => items.filter((i) => i.empleado_id === emp).map((i) => i.tipo).sort()
  assert.deepEqual(de('b'), ['semanal'])
  assert.deepEqual(de('a'), [])
})

test('un ítem histórico de semana adicional no se borra al volver a guardar', async () => {
  const { db, tablas } = baseFalsa()
  const primera = await guardar(db, SEMANA(1), ['a'])
  tablas.ci_nomina_obra_items!.push({
    id: 'hist-adelanto',
    periodo_id: primera.periodo_id,
    empleado_id: 'a',
    tipo: 'adelanto_prestaciones',
  })
  await guardar(db, SEMANA(1), ['a'])
  assert.ok(tablas.ci_nomina_obra_items!.some((i) => i.id === 'hist-adelanto'))
})
