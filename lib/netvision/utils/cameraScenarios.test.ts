/**
 * Ejecutar: npx tsx --test lib/netvision/utils/cameraScenarios.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DesignCamera } from '@/lib/netvision/types'
import { projectFromPartial } from '@/lib/netvision/storage'
import {
  ALL_SCENARIOS_ID,
  PRINCIPAL_SCENARIO_ID,
  addCameraScenario,
  cameraScenarioId,
  camerasOfScenario,
  ensureCameraScenarios,
  removeCameraScenario,
  renameCameraScenario,
} from './cameraScenarios'

const cam = (id: string, scenarioId?: string): DesignCamera => ({
  id,
  label: id,
  x: 0.2,
  y: 0.2,
  modelId: 'm',
  yawDeg: 0,
  mountHeightM: 2.5,
  ...(scenarioId ? { scenarioId } : {}),
})

describe('cameraScenarios', () => {
  it('cámaras sin id van a Principal', () => {
    assert.equal(cameraScenarioId({}), PRINCIPAL_SCENARIO_ID)
    assert.equal(cameraScenarioId({ scenarioId: '  ' }), PRINCIPAL_SCENARIO_ID)
    assert.equal(cameraScenarioId({ scenarioId: 'perimetro' }), 'perimetro')
  })

  it('siempre deja Principal y crea los ids que ya usan las cámaras', () => {
    const list = ensureCameraScenarios(
      [{ id: 'perimetro', name: 'Perímetro' }],
      [cam('a'), cam('b', 'noche')],
    )
    assert.equal(list[0]!.id, PRINCIPAL_SCENARIO_ID)
    assert.ok(list.some((s) => s.id === 'perimetro' && s.name === 'Perímetro'))
    assert.ok(list.some((s) => s.id === 'noche'))
  })

  it('agrega un escenario con nombre siguiente', () => {
    const { scenarios, added } = addCameraScenario(
      [{ id: PRINCIPAL_SCENARIO_ID, name: 'Principal' }],
    )
    assert.equal(added.name, 'Escenario 2')
    assert.equal(scenarios.length, 2)
  })

  it('al borrar un escenario las cámaras vuelven a Principal', () => {
    const { scenarios, cameras } = removeCameraScenario(
      [
        { id: PRINCIPAL_SCENARIO_ID, name: 'Principal' },
        { id: 'perimetro', name: 'Perímetro' },
      ],
      [cam('a', 'perimetro'), cam('b')],
      'perimetro',
    )
    assert.equal(scenarios.length, 1)
    assert.equal(cameraScenarioId(cameras[0]!), PRINCIPAL_SCENARIO_ID)
    assert.equal(cameras[1]!.scenarioId, undefined)
  })

  it('no borra Principal', () => {
    const { scenarios } = removeCameraScenario(
      [{ id: PRINCIPAL_SCENARIO_ID, name: 'Principal' }],
      [cam('a')],
      PRINCIPAL_SCENARIO_ID,
    )
    assert.equal(scenarios[0]!.id, PRINCIPAL_SCENARIO_ID)
  })

  it('renombra y filtra por escenario o todos', () => {
    const renamed = renameCameraScenario(
      [
        { id: PRINCIPAL_SCENARIO_ID, name: 'Principal' },
        { id: 'p', name: 'P' },
      ],
      'p',
      'Perímetro',
    )
    assert.equal(renamed.find((s) => s.id === 'p')!.name, 'Perímetro')
    const cams = [cam('a', 'p'), cam('b')]
    assert.equal(camerasOfScenario(cams, 'p').length, 1)
    assert.equal(camerasOfScenario(cams, ALL_SCENARIOS_ID).length, 2)
  })

  it('al cargar un proyecto viejo crea Principal y pasa sirenas a alarma', () => {
    const p = projectFromPartial({
      id: 'p',
      cameras: [cam('c1', 'perimetro')],
      planDevices: [
        {
          id: 's1',
          label: 'SIR-01',
          x: 0.2,
          y: 0.2,
          discipline: 'sonido',
          kind: 'siren',
          modelId: 'snd-ezviz-t9c',
        },
      ],
    })
    assert.ok(p.cameraScenarios.some((s) => s.id === PRINCIPAL_SCENARIO_ID))
    assert.ok(p.cameraScenarios.some((s) => s.id === 'perimetro'))
    assert.equal(p.cameras[0]!.scenarioId, 'perimetro')
    assert.equal(p.planDevices[0]!.discipline, 'alarma')
  })
})
