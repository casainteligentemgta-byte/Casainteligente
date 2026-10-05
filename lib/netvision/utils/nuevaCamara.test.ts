import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { modeloPorDefectoDelProyecto, plantillaNuevaCamara } from './nuevaCamara'

const cam = (
  id: string,
  modelId: string,
  extra: { conexion?: 'cable' | 'wifi' } = {},
) => ({ id, modelId, ...extra })

describe('plantilla de la próxima cámara', () => {
  it('sin cámaras usa el modelo por defecto (Hikvision de catálogo)', () => {
    assert.deepEqual(plantillaNuevaCamara([], null, 'hik-ds2cd2143'), {
      modelId: 'hik-ds2cd2143',
    })
  })

  it('con una cámara elegida copia su modelo y si iba por Wi‑Fi', () => {
    const cams = [cam('a', 'ezviz-h3'), cam('b', 'ezviz-h9c', { conexion: 'wifi' })]
    assert.deepEqual(plantillaNuevaCamara(cams, 'b', 'hik-ds2cd2143'), {
      modelId: 'ezviz-h9c',
      conexion: 'wifi',
    })
    assert.deepEqual(plantillaNuevaCamara(cams, 'a', 'hik-ds2cd2143'), {
      modelId: 'ezviz-h3',
    })
  })

  it('sin elegir, respeta el tipo de la barra; si coincide con la última, copia la conexión', () => {
    const cams = [cam('a', 'ezviz-h3'), cam('b', 'ezviz-h3', { conexion: 'wifi' })]
    assert.deepEqual(plantillaNuevaCamara(cams, null, 'ezviz-h3'), {
      modelId: 'ezviz-h3',
      conexion: 'wifi',
    })
    // El instalador cambió el tipo en la barra: no se pisa con la última.
    assert.deepEqual(plantillaNuevaCamara(cams, null, 'ezviz-h9c'), {
      modelId: 'ezviz-h9c',
    })
  })

  it('al abrir un proyecto siembra el tipo de la última cámara', () => {
    assert.equal(
      modeloPorDefectoDelProyecto([cam('a', 'ezviz-h3'), cam('b', 'ezviz-h9c')], 'hik-ds2cd2143'),
      'ezviz-h9c',
    )
    assert.equal(modeloPorDefectoDelProyecto([], 'hik-ds2cd2143'), 'hik-ds2cd2143')
  })
})
