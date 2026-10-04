import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ROTULO_COMPANY,
  ROTULO_LOGO_SRC,
  buildPlanoRotulo,
  formatRotuloFecha,
  planoTipoFromBranch,
} from './planoRotulo'

describe('planoRotulo', () => {
  it('el plano CCTV se etiqueta CCTV', () => {
    assert.equal(planoTipoFromBranch('cctv'), 'CCTV')
    assert.equal(planoTipoFromBranch(null), 'CCTV')
    assert.equal(planoTipoFromBranch('sonido'), 'Sonido')
  })

  it('usa el logo oficial junto al nombre de la empresa', () => {
    assert.equal(ROTULO_LOGO_SRC, '/logo-casa-inteligente.png')
  })

  it('arma el rótulo con empresa, fecha y tipo', () => {
    const r = buildPlanoRotulo({
      projectName: 'Villa Altamira',
      branch: 'cctv',
      at: '2026-10-04T15:00:00.000Z',
    })
    assert.equal(r.projectName, 'Villa Altamira')
    assert.equal(r.company, ROTULO_COMPANY)
    assert.equal(r.planType, 'CCTV')
    assert.match(r.dateLabel, /2026/)
    assert.match(r.dateLabel, /octubre/i)
  })

  it('si no hay nombre usa un título de respaldo', () => {
    const r = buildPlanoRotulo({ projectName: '  ' })
    assert.equal(r.projectName, 'Proyecto sin nombre')
  })

  it('formatea la fecha en español de Venezuela', () => {
    const label = formatRotuloFecha(new Date('2026-10-04T12:00:00-04:00'))
    assert.match(label, /04/)
    assert.match(label, /octubre/i)
    assert.match(label, /2026/)
  })
})
