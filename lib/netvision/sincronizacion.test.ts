import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProject, projectFromPartial } from '@/lib/netvision/storage'
import {
  TOLERANCIA_BASE_MS,
  baseVigente,
  decidirGuardado,
  leerBaseDePeticion,
  mismoContenido,
} from './sincronizacion'

const T0 = '2026-10-01T10:00:00.000Z'
const T0_PG = '2026-10-01T10:00:00+00:00'
const T1 = '2026-10-03T18:30:00.000Z'

describe('sincronización · una copia vieja no pisa la nube', () => {
  it('compara el diseño sin importar la fecha ni el orden de las claves', () => {
    const a = emptyProject({ id: 'p', name: 'Casa' })
    const b = { ...JSON.parse(JSON.stringify(a)), updatedAt: T1 }
    assert.equal(mismoContenido(a, b), true)
    const invertido = Object.fromEntries(Object.entries(a).reverse())
    assert.equal(mismoContenido(a, invertido), true)
    assert.equal(mismoContenido(a, { ...a, name: 'Otra' }), false)
    assert.equal(mismoContenido(a, { ...a, cameras: [{ id: 'c1' }] }), false)
    // Lo que guarda la nube, al leerlo de vuelta, es el mismo diseño.
    assert.equal(mismoContenido(projectFromPartial(JSON.parse(JSON.stringify(a)), 'p'), a), true)
    // Una fecha dentro de una cámara sí es contenido.
    assert.equal(
      mismoContenido({ cameras: [{ updatedAt: 'x' }] }, { cameras: [{ updatedAt: 'y' }] }),
      false,
    )
  })

  it('base exacta: solo vale si la nube sigue en esa versión', () => {
    assert.equal(baseVigente({ updatedAt: T0, exacta: true }, T0), true)
    // Postgres devuelve la misma fecha con otro formato.
    assert.equal(baseVigente({ updatedAt: T0_PG, exacta: true }, T0), true)
    assert.equal(baseVigente({ updatedAt: T0, exacta: true }, T1), false)
    // Ni siquiera una base «más nueva»: exacta es exacta.
    assert.equal(baseVigente({ updatedAt: T1, exacta: true }, T0), false)
    assert.equal(baseVigente(null, T0), false)
    assert.equal(baseVigente({ updatedAt: 'no-es-fecha', exacta: true }, T0), false)
  })

  it('base aproximada: vale si la copia es tan nueva como la nube (con margen)', () => {
    const haceUnMinuto = new Date(Date.parse(T1) - 60_000).toISOString()
    const haceDiezMin = new Date(Date.parse(T1) - 10 * 60_000).toISOString()
    assert.equal(baseVigente({ updatedAt: T1, exacta: false }, T1), true)
    assert.equal(baseVigente({ updatedAt: haceUnMinuto, exacta: false }, T1), true)
    assert.equal(baseVigente({ updatedAt: haceDiezMin, exacta: false }, T1), false)
    assert.equal(baseVigente({ updatedAt: T0, exacta: false }, T1), false)
    assert.equal(TOLERANCIA_BASE_MS, 120_000)
  })

  it('decide: crear, actualizar, nada que subir o conflicto', () => {
    const exacta = (updatedAt: string) => ({ updatedAt, exacta: true })
    // No existe en la nube.
    assert.equal(decidirGuardado({ remotoUpdatedAt: null, base: null, mismoContenido: false }), 'crear')
    // Este equipo partió de la versión que hay en la nube.
    assert.equal(decidirGuardado({ remotoUpdatedAt: T0, base: exacta(T0), mismoContenido: false }), 'actualizar')
    // La nube cambió desde otro equipo: no se pisa.
    assert.equal(decidirGuardado({ remotoUpdatedAt: T1, base: exacta(T0), mismoContenido: false }), 'conflicto')
    // Copia vieja abierta en un equipo que nunca sincronizó con este control.
    assert.equal(
      decidirGuardado({ remotoUpdatedAt: T1, base: { updatedAt: T0, exacta: false }, mismoContenido: false }),
      'conflicto',
    )
    assert.equal(decidirGuardado({ remotoUpdatedAt: T1, base: null, mismoContenido: false }), 'conflicto')
    // Mismo diseño: no importa la base.
    assert.equal(decidirGuardado({ remotoUpdatedAt: T1, base: exacta(T0), mismoContenido: true }), 'sin_cambios')
    // El usuario eligió conservar su copia.
    assert.equal(
      decidirGuardado({ remotoUpdatedAt: T1, base: exacta(T0), mismoContenido: false, forzar: true }),
      'actualizar',
    )
    // Navegador con la app anterior (no envía base): se comporta como antes.
    assert.equal(decidirGuardado({ remotoUpdatedAt: T1, base: undefined, mismoContenido: false }), 'actualizar')
  })

  it('lee la base que envía el navegador', () => {
    assert.deepEqual(leerBaseDePeticion({ updatedAt: T0, exacta: true }), { updatedAt: T0, exacta: true })
    assert.deepEqual(leerBaseDePeticion({ updatedAt: T0 }), { updatedAt: T0, exacta: false })
    assert.equal(leerBaseDePeticion(undefined), undefined)
    assert.equal(leerBaseDePeticion('x'), undefined)
    assert.equal(leerBaseDePeticion(null), null)
    assert.equal(leerBaseDePeticion({ updatedAt: 'ayer' }), null)
  })
})
