import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLANO_PRINT_TEMA_DEFAULT,
  PLANO_PRINT_TEMA_LABEL,
  PLANO_PRINT_TEMA_PAGE_BG,
  PLANO_PRINT_TEMAS,
  contadorDosDigitos,
  loadPlanoPrintTema,
  parsePlanoPrintTema,
  rotuloFechaDigitos,
} from './planoPrintTema'
import { formatRotuloFecha } from './planoRotulo'

describe('planoPrintTema', () => {
  it('el tema por defecto es el táctico', () => {
    assert.equal(PLANO_PRINT_TEMA_DEFAULT, 'tactico')
    assert.equal(loadPlanoPrintTema(null), 'tactico')
  })

  it('cada tema tiene nombre y color de página', () => {
    for (const t of PLANO_PRINT_TEMAS) {
      assert.ok(PLANO_PRINT_TEMA_LABEL[t])
      assert.match(PLANO_PRINT_TEMA_PAGE_BG[t], /^#[0-9a-f]{6}$/i)
    }
  })

  it('acepta el tema del enlace y descarta valores desconocidos', () => {
    assert.equal(parsePlanoPrintTema('Arcade'), 'arcade')
    assert.equal(parsePlanoPrintTema(' tiempo-real '), 'tiempo-real')
    assert.equal(parsePlanoPrintTema('otro'), null)
    assert.equal(parsePlanoPrintTema(null), null)
    assert.equal(loadPlanoPrintTema('arcade'), 'arcade')
    assert.equal(loadPlanoPrintTema('otro'), 'tactico')
  })

  it('convierte la fecha del rótulo a lectura digital', () => {
    assert.equal(rotuloFechaDigitos('04 de octubre de 2026'), '04.10.2026')
    assert.equal(rotuloFechaDigitos('4 de Enero de 2027'), '04.01.2027')
    assert.equal(rotuloFechaDigitos('Oct 4, 2026'), null)
    assert.equal(rotuloFechaDigitos(''), null)
    // Lo que produce el rótulo real también se convierte.
    assert.equal(
      rotuloFechaDigitos(formatRotuloFecha('2026-10-04T15:00:00.000Z')),
      '04.10.2026',
    )
  })

  it('rellena los contadores a dos dígitos', () => {
    assert.equal(contadorDosDigitos(0), '00')
    assert.equal(contadorDosDigitos(13), '13')
    assert.equal(contadorDosDigitos(129), '129')
    assert.equal(contadorDosDigitos(undefined), '--')
  })
})
