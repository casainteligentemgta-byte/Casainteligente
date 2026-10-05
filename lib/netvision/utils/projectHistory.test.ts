import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProject } from '@/lib/netvision/storage'
import {
  NETVISION_HISTORY_COALESCE_MS,
  NETVISION_HISTORY_MAX,
  cloneProjectSnapshot,
  emptyProjectHistory,
  popProjectHistory,
  pushProjectHistory,
  recordProjectChange,
  redoProjectHistory,
  undoProjectHistory,
} from './projectHistory'

describe('projectHistory', () => {
  it('apila y restaura el último diseño', () => {
    const a = emptyProject({ id: 'a', name: 'uno' })
    const b = { ...a, name: 'dos' }
    let stack = pushProjectHistory([], a)
    stack = pushProjectHistory(stack, b)
    const first = popProjectHistory(stack)
    assert.equal(first.restored?.name, 'dos')
    const second = popProjectHistory(first.rest)
    assert.equal(second.restored?.name, 'uno')
    assert.equal(second.rest.length, 0)
  })

  it('no pasa del tope', () => {
    let stack: ReturnType<typeof emptyProject>[] = []
    for (let i = 0; i < NETVISION_HISTORY_MAX + 5; i++) {
      stack = pushProjectHistory(stack, emptyProject({ id: `p${i}`, name: `n${i}` }))
    }
    assert.equal(stack.length, NETVISION_HISTORY_MAX)
    assert.equal(stack[0]?.name, 'n5')
  })

  it('pop vacío no rompe', () => {
    const { rest, restored } = popProjectHistory([])
    assert.equal(restored, null)
    assert.equal(rest.length, 0)
  })
})

describe('projectHistory · deshacer y rehacer', () => {
  const base = emptyProject({ id: 'p1', name: 'v0' })
  const v = (name: string) => ({ ...base, name })
  const PASO = NETVISION_HISTORY_COALESCE_MS + 50

  it('deshace y rehace en orden', () => {
    let h = emptyProjectHistory('p1')
    h = recordProjectChange(h, v('v0'), v('v1'), 1000)
    h = recordProjectChange(h, v('v1'), v('v2'), 1000 + PASO)
    assert.equal(h.past.length, 2)

    const u1 = undoProjectHistory(h, v('v2'))
    assert.equal(u1.restored?.name, 'v1')
    const u2 = undoProjectHistory(u1.history, v('v1'))
    assert.equal(u2.restored?.name, 'v0')
    assert.equal(u2.history.past.length, 0)
    assert.equal(u2.history.future.length, 2)

    const r1 = redoProjectHistory(u2.history, v('v0'))
    assert.equal(r1.restored?.name, 'v1')
    const r2 = redoProjectHistory(r1.history, v('v1'))
    assert.equal(r2.restored?.name, 'v2')
    assert.equal(r2.history.future.length, 0)
    assert.equal(r2.history.past.length, 2)
  })

  it('un arrastre (cambios seguidos) cuenta como un solo paso', () => {
    let h = emptyProjectHistory('p1')
    let t = 1000
    let prev = v('inicio')
    for (let i = 1; i <= 60; i++) {
      const next = v(`arrastre-${i}`)
      t += 16
      h = recordProjectChange(h, prev, next, t)
      prev = next
    }
    assert.equal(h.past.length, 1)
    const u = undoProjectHistory(h, prev)
    assert.equal(u.restored?.name, 'inicio')
    // Rehacer devuelve el final del arrastre, no un punto intermedio.
    const r = redoProjectHistory(u.history, v('inicio'))
    assert.equal(r.restored?.name, 'arrastre-60')
  })

  it('agregar o quitar elementos seguidos son pasos separados', () => {
    const camara = (id: string) => ({
      id,
      label: id,
      x: 0.5,
      y: 0.5,
      modelId: 'ezviz-h3',
      yawDeg: 0,
      mountHeightM: 3,
    })
    const con = (...ids: string[]) => ({ ...base, cameras: ids.map(camara) })
    let h = emptyProjectHistory('p1')
    // Tres toques rápidos en «+ Cámara» (cada 100 ms).
    h = recordProjectChange(h, con(), con('a'), 1000)
    h = recordProjectChange(h, con('a'), con('a', 'b'), 1100)
    h = recordProjectChange(h, con('a', 'b'), con('a', 'b', 'c'), 1200)
    assert.equal(h.past.length, 3)
    // Mover una enseguida sí se une… al gesto de mover, no al de agregar.
    const movida = { ...con('a', 'b', 'c'), cameras: [{ ...camara('a'), x: 0.1 }, camara('b'), camara('c')] }
    h = recordProjectChange(h, con('a', 'b', 'c'), movida, 1250)
    assert.equal(h.past.length, 3)
    // Borrar enseguida es otro paso.
    h = recordProjectChange(h, movida, con('b', 'c'), 1300)
    assert.equal(h.past.length, 4)
    assert.equal(undoProjectHistory(h, con('b', 'c')).restored?.cameras.length, 3)
  })

  it('cargar otro plano enseguida es un paso propio', () => {
    const planoA = `data:image/png;base64,${'A'.repeat(5000)}`
    const planoB = `data:image/png;base64,${'B'.repeat(5000)}`
    let h = emptyProjectHistory('p1')
    h = recordProjectChange(h, v('v0'), { ...v('v0'), planoUrl: planoA }, 1000)
    h = recordProjectChange(h, { ...v('v0'), planoUrl: planoA }, { ...v('v0'), planoUrl: planoB }, 1050)
    assert.equal(h.past.length, 2)
  })

  it('un cambio después de deshacer es un paso propio y borra lo que quedaba por rehacer', () => {
    let h = emptyProjectHistory('p1')
    h = recordProjectChange(h, v('v0'), v('v1'), 1000)
    const u = undoProjectHistory(h, v('v1'))
    assert.equal(u.history.future.length, 1)
    // Aunque ocurra enseguida, no se une al gesto anterior.
    const h2 = recordProjectChange(u.history, v('v0'), v('otro'), 1010)
    assert.equal(h2.past.length, 1)
    assert.equal(h2.past[0]?.name, 'v0')
    assert.equal(h2.future.length, 0)
    assert.equal(redoProjectHistory(h2, v('otro')).restored, null)
  })

  it('al cambiar de proyecto el historial empieza de cero', () => {
    let h = emptyProjectHistory('p1')
    h = recordProjectChange(h, v('v0'), v('v1'), 1000)
    const otro = emptyProject({ id: 'p2', name: 'otro proyecto' })
    h = recordProjectChange(h, v('v1'), otro, 5000)
    assert.equal(h.projectId, 'p2')
    assert.equal(h.past.length, 0)
    assert.equal(undoProjectHistory(h, otro).restored, null)
  })

  it('deshacer o rehacer sin pasos no cambia nada', () => {
    const h = emptyProjectHistory('p1')
    assert.equal(undoProjectHistory(h, base).restored, null)
    assert.equal(redoProjectHistory(h, base).restored, null)
  })

  it('la copia no duplica el plano y sí aísla el resto', () => {
    const plano = `data:image/png;base64,${'A'.repeat(10_000)}`
    const original = { ...base, planoUrl: plano, cameras: [...base.cameras] }
    const copia = cloneProjectSnapshot(original)
    assert.equal(copia.planoUrl, plano)
    assert.notEqual(copia.cameras, original.cameras)
    assert.deepEqual(copia, original)
  })
})
