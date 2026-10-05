import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DesignCamera, DesignNetworkNode } from '@/lib/netvision/types'
import {
  camarasCableadas,
  conexionCamara,
  conexionesModelo,
  contarSplittersPoe,
  getCameraModelOrDefault,
  splitterDeCamara,
} from '@/lib/netvision/catalog/cameras'
import { buildBom } from './bandwidthCalculator'
import { buildCableBomLines } from './cableCalculator'
import { buildCableRoutes } from './cableRoutingEngine'
import { dimensionarGrabacion } from './dimensionamiento'
import { analyzePoeBudget, autoAssignCamerasToPoe } from './poeAnalyzer'

const scale = { metersPerNormX: 40, metersPerNormY: 40, calibrated: true }
const cam = (id: string, modelId: string, extra: Partial<DesignCamera> = {}): DesignCamera => ({
  id,
  label: id.toUpperCase(),
  x: 0.2,
  y: 0.2,
  modelId,
  yawDeg: 0,
  mountHeightM: 3,
  ...extra,
})
const sw: DesignNetworkNode = {
  id: 'sw-1',
  label: 'SW-01',
  x: 0.8,
  y: 0.2,
  kind: 'switch',
  modelId: 'sw-poe-8',
  linkedCameraIds: [],
}

describe('conexión de la cámara · cable de red o Wi‑Fi', () => {
  it('cada modelo declara cómo se puede conectar', () => {
    assert.deepEqual(conexionesModelo(getCameraModelOrDefault('ezviz-h3')), ['cable', 'wifi'])
    assert.deepEqual(conexionesModelo(getCameraModelOrDefault('ezviz-h4-poe')), ['cable'])
    assert.deepEqual(conexionesModelo(getCameraModelOrDefault('ezviz-bc1c')), ['bateria'])
    assert.deepEqual(conexionesModelo(getCameraModelOrDefault('aqara-g3')), ['wifi'])
  })

  it('usa la de ficha hasta que el instalador elige otra', () => {
    assert.equal(conexionCamara(cam('a', 'ezviz-h3')), 'cable')
    assert.equal(conexionCamara(cam('a', 'ezviz-h3', { conexion: 'wifi' })), 'wifi')
    assert.equal(conexionCamara(cam('a', 'ezviz-h4')), 'wifi')
    assert.equal(conexionCamara(cam('a', 'ezviz-h4', { conexion: 'cable' })), 'cable')
  })

  it('ignora una elección que el modelo no admite', () => {
    // Solo PoE: no puede ir por Wi‑Fi aunque el dato viejo lo diga.
    assert.equal(conexionCamara(cam('a', 'ezviz-h4-poe', { conexion: 'wifi' })), 'cable')
    // Solo batería: no se puede cablear.
    assert.equal(conexionCamara(cam('a', 'ezviz-bc1c', { conexion: 'cable' })), 'bateria')
  })

  it('por Wi‑Fi no lleva cable, puerto, adaptador ni canal del grabador', () => {
    const porCable = cam('a', 'ezviz-h3')
    const porWifi = cam('b', 'ezviz-h3', { conexion: 'wifi', x: 0.3 })
    const camaras = [porCable, porWifi]

    assert.deepEqual(camarasCableadas(camaras).map((c) => c.id), ['a'])
    assert.equal(splitterDeCamara(porCable), 12)
    assert.equal(splitterDeCamara(porWifi), null)
    assert.equal(contarSplittersPoe(camaras), 1)

    const rutas = buildCableRoutes(camaras, [sw], scale)
    assert.deepEqual(rutas.map((r) => r.fromId), ['a'])

    const nodos = autoAssignCamerasToPoe(camaras, [sw], scale)
    assert.deepEqual(nodos[0]!.linkedCameraIds, ['a'])
    const poe = analyzePoeBudget(camaras, nodos)
    assert.equal(poe.rows[0]!.usedPorts, 1)

    const bom = buildBom(camaras, 30, [sw], rutas)
    const linea = (sku: string) => bom.lines.find((l) => l.sku === sku)
    // Las dos cámaras se compran; solo una lleva adaptador y cable.
    assert.equal(linea('ezviz-h3')!.qty, 2)
    assert.equal(linea('POE-SPLITTER-12V')!.qty, 1)
    const cable = buildCableBomLines(rutas).find((l) => l.sku.startsWith('CABLE-'))!
    assert.ok(Math.abs(cable.qty - rutas[0]!.routeM) < 0.11)

    const grab = dimensionarGrabacion(camaras, [], [], 30)
    assert.equal(grab.camaras, 1)
    assert.ok(grab.avisos.some((a) => /Wi.Fi/.test(a.texto)))
  })

  it('todas por Wi‑Fi: no pide grabador, switch PoE ni cable', () => {
    const camaras = [cam('a', 'ezviz-h3', { conexion: 'wifi' }), cam('b', 'aqara-g3')]
    assert.deepEqual(buildCableRoutes(camaras, [sw], scale), [])
    const poe = analyzePoeBudget(camaras, [])
    assert.ok(!poe.validations.some((v) => v.code === 'POE-000'))
    const bom = buildBom(camaras, 30, [], [])
    assert.ok(!bom.lines.some((l) => l.category === 'nvr' || /disco|hdd/i.test(l.description)))
    assert.ok(!bom.lines.some((l) => l.sku.startsWith('POE-SPLITTER')))
  })
})
