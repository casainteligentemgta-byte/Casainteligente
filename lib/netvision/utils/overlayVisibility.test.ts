/**
 * Ejecutar: npx tsx --test lib/netvision/utils/overlayVisibility.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type {
  DesignCamera,
  DesignPlanDevice,
} from '@/lib/netvision/types'
import { ALL_SCENARIOS_ID } from './cameraScenarios'
import {
  overlaySystemFromBranch,
  visibleCameras,
  visiblePlanDevices,
  visibleNetworkNodes,
  visibleInfraDevices,
  showOverlayWifi,
  showOverlaySound,
} from './overlayVisibility'

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

const dev = (
  id: string,
  discipline: DesignPlanDevice['discipline'],
): DesignPlanDevice => ({
  id,
  label: id,
  x: 0.3,
  y: 0.3,
  discipline,
  kind: discipline === 'sonido' ? 'speaker' : 'sensor',
  modelId: 'm',
})

describe('overlayVisibility', () => {
  const cameras = [cam('c1'), cam('c2', 'perimetro')]
  const devices = [dev('s1', 'sonido'), dev('d1', 'domotica'), dev('a1', 'alarma')]

  it('Solo CCTV muestra un escenario; Todos los escenarios deja las cámaras', () => {
    const soloPrincipal = visibleCameras(cameras, {
      vista: 'solo',
      system: 'cctv',
      scenarioId: 'principal',
    })
    assert.deepEqual(
      soloPrincipal.map((c) => c.id),
      ['c1'],
    )
    const todosCctv = visibleCameras(cameras, {
      vista: 'solo',
      system: 'cctv',
      scenarioId: ALL_SCENARIOS_ID,
    })
    assert.equal(todosCctv.length, 2)
  })

  it('Solo domótica oculta cámaras y deja sus equipos', () => {
    assert.equal(
      visibleCameras(cameras, {
        vista: 'solo',
        system: 'domotica',
        scenarioId: 'principal',
      }).length,
      0,
    )
    const vis = visiblePlanDevices(devices, { vista: 'solo', system: 'domotica' })
    assert.deepEqual(
      vis.map((d) => d.id),
      ['d1'],
    )
  })

  it('Todas enciende cámaras y todos los sistemas del PDF', () => {
    const cams = visibleCameras(cameras, {
      vista: 'todas',
      system: 'cctv',
      scenarioId: 'principal',
    })
    assert.equal(cams.length, 2)
    assert.equal(
      visiblePlanDevices(devices, { vista: 'todas', system: 'cctv' }).length,
      3,
    )
  })

  it('Alarma y red solo aparecen en su capa o con Todas', () => {
    const alarma = visiblePlanDevices(devices, { vista: 'solo', system: 'alarma' })
    assert.deepEqual(
      alarma.map((d) => d.id),
      ['a1'],
    )
    const nodes = [
      {
        id: 'ap',
        x: 0.1,
        y: 0.1,
        kind: 'ap' as const,
        modelId: 'ap',
        label: 'AP',
        linkedCameraIds: [],
      },
    ]
    assert.equal(
      visibleNetworkNodes(nodes, { vista: 'solo', system: 'cctv' }).length,
      0,
    )
    assert.equal(
      visibleNetworkNodes(nodes, { vista: 'solo', system: 'internet' }).length,
      1,
    )
    assert.equal(
      visibleInfraDevices(
        [{ id: 'r', x: 0.1, y: 0.1, kind: 'rack', modelId: 'rack', label: 'R' }],
        {
          vista: 'solo',
          system: 'domotica',
        },
      ).length,
      0,
    )
  })

  it('en muros/cable (tool) se ve todo para trazar sobre el plano', () => {
    assert.equal(
      visibleCameras(cameras, {
        vista: 'solo',
        system: 'tool',
        scenarioId: 'principal',
      }).length,
      2,
    )
    assert.equal(
      visiblePlanDevices(devices, { vista: 'solo', system: 'tool' }).length,
      3,
    )
  })

  it('WiFi y sonido siguen la capa activa', () => {
    assert.equal(showOverlayWifi({ vista: 'solo', system: 'cctv' }), false)
    assert.equal(showOverlayWifi({ vista: 'solo', system: 'internet' }), true)
    assert.equal(showOverlaySound({ vista: 'todas', system: 'cctv' }), true)
    assert.equal(overlaySystemFromBranch('alarma'), 'alarma')
    assert.equal(overlaySystemFromBranch('muros'), 'tool')
  })
})
