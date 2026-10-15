import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rachaQuintaSemana, type SemanaDelTrabajador } from './reglasPagoObra'
import { previewItemsNomina } from './persistirSemanaObra'

/** Lunes de la semana n, contando desde el lunes 1 de junio de 2026. */
const L = (n: number) => new Date(Date.UTC(2026, 5, 1 + (n - 1) * 7)).toISOString().slice(0, 10)
const semanas = (dias: number[], desde = 1): SemanaDelTrabajador[] =>
  dias.map((d, i) => ({ semanaInicio: L(desde + i), dias: d }))

describe('Cl. SÉPTIMA: una quinta cada 4 semanas seguidas', () => {
  it('la cuarta semana seguida causa la quinta', () => {
    const r = rachaQuintaSemana(semanas([5, 5, 5]), L(4), 5)
    assert.deepEqual(r, { racha: 4, faltan: 4, tocaEstaSemana: true, quintasAcumuladas: 1 })
  })

  it('y así cada cuatro: 8 seguidas son 2 quintas, 12 son 3', () => {
    assert.equal(rachaQuintaSemana(semanas([5, 5, 5, 5, 5, 5, 5]), L(8), 5).quintasAcumuladas, 2)
    const doce = rachaQuintaSemana(semanas(Array(11).fill(5)), L(12), 5)
    assert.equal(doce.quintasAcumuladas, 3)
    assert.equal(doce.tocaEstaSemana, true)
  })

  it('una semana con menos de 3 días corta la racha; lo ya causado se conserva', () => {
    // 4 seguidas (1 quinta), una floja, 3 seguidas: aún no hay segunda.
    const r = rachaQuintaSemana(semanas([5, 5, 5, 5, 2, 5, 5]), L(8), 5)
    assert.deepEqual(r, { racha: 3, faltan: 1, tocaEstaSemana: false, quintasAcumuladas: 1 })
  })

  it('3 días cuenta como semana trabajada (regla de los descansos)', () => {
    assert.equal(rachaQuintaSemana(semanas([3, 3, 3]), L(4), 3).tocaEstaSemana, true)
  })

  it('una semana sin nómina guardada también corta la racha', () => {
    // Semanas 1 a 3 trabajadas, la 4 no aparece, la 5 sí.
    const r = rachaQuintaSemana(semanas([5, 5, 5]), L(5), 5)
    assert.equal(r.racha, 1)
    assert.equal(r.quintasAcumuladas, 0)
  })

  it('esta semana floja deja la racha en cero', () => {
    const r = rachaQuintaSemana(semanas([5, 5, 5]), L(4), 2)
    assert.deepEqual(r, { racha: 0, faltan: 4, tocaEstaSemana: false, quintasAcumuladas: 0 })
  })

  it('es del trabajador: suma obras distintas y los días de la misma semana', () => {
    const hist: SemanaDelTrabajador[] = [
      { semanaInicio: L(1), dias: 5 }, // obra A
      { semanaInicio: L(2), dias: 5 }, // obra B
      { semanaInicio: L(3), dias: 2 }, // obra A, 2 días…
      { semanaInicio: L(3), dias: 2 }, // …y obra B, 2 días: 4 en la semana, cuenta
    ]
    assert.equal(rachaQuintaSemana(hist, L(4), 5).tocaEstaSemana, true)
  })

  it('al recalcular una semana vieja no cuentan las posteriores', () => {
    const r = rachaQuintaSemana(semanas([5, 5, 5, 5, 5, 5]), L(2), 5)
    assert.equal(r.racha, 2)
    assert.equal(r.quintasAcumuladas, 0)
  })

  it('sin historial es la primera semana', () => {
    assert.deepEqual(rachaQuintaSemana([], L(1), 5), { racha: 1, faltan: 3, tocaEstaSemana: false, quintasAcumuladas: 0 })
  })
})

describe('previewItemsNomina con historial', () => {
  const item = (dias: number) => ({ empleado_id: 'a', clase: 'ayudante' as const, dias_laborados: dias })
  it('trae racha, lo que falta y las quintas acumuladas', () => {
    const [p] = previewItemsNomina({
      items: [item(5)],
      historialPorEmpleado: { a: semanas([5, 5, 5, 5, 5, 5, 5]) },
      semanaInicio: L(8),
      tasaBcvPago: 100,
      tasaAnclaCestaBcv: 100,
    })
    assert.equal(p!.toca_adelanto, true)
    assert.equal(p!.racha, 8)
    assert.equal(p!.semanas_trabajadas_previas, 7)
    assert.equal(p!.quintas_acumuladas, 2)
    assert.equal(p!.faltan_para_quinta, 4)
    assert.equal(p!.adelanto, null)
  })
  it('semanas sueltas, no seguidas, ya no causan la quinta', () => {
    const [p] = previewItemsNomina({
      items: [item(5)],
      historialPorEmpleado: { a: semanas([5, 1, 5, 1, 5]) },
      semanaInicio: L(6),
      tasaBcvPago: 100,
      tasaAnclaCestaBcv: 100,
    })
    assert.equal(p!.toca_adelanto, false)
    assert.equal(p!.racha, 2)
    assert.equal(p!.quintas_acumuladas, 0)
  })
})
