import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import { adviseCameraLinks } from '@/lib/netvision/services/poeAnalyzer'
import { recommendCableType } from '@/lib/netvision/services/cableCalculator'
import type {
  DesignCamera,
  DesignNetworkNode,
  ScaleCalibration,
} from '@/lib/netvision/types'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'

export type DiagramNodeKind = 'camera' | 'switch' | 'ap' | 'nvr' | 'injector' | 'core'

export type DiagramNode = {
  id: string
  kind: DiagramNodeKind
  label: string
  subtitle: string
  /** posición layout en px del diagrama */
  x: number
  y: number
  w: number
  h: number
  color: string
}

export type DiagramEdge = {
  id: string
  fromId: string
  toId: string
  label: string
  warn: boolean
}

export type DiagramModel = {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  width: number
  height: number
  title: string
}

const COLORS: Record<DiagramNodeKind, string> = {
  core: '#64748b',
  nvr: '#fbbf24',
  switch: '#a78bfa',
  injector: '#fb7185',
  ap: '#34d399',
  camera: '#22d3ee',
}

const NODE_W = 120
const NODE_H = 44
const H_GAP = 28
const V_GAP = 72
const PAD = 40

function nodeBox(
  id: string,
  kind: DiagramNodeKind,
  label: string,
  subtitle: string,
): Omit<DiagramNode, 'x' | 'y'> {
  return { id, kind, label, subtitle, w: NODE_W, h: NODE_H, color: COLORS[kind] }
}

/**
 * Construye un diagrama unifilar jerárquico a partir del diseño.
 * Se regenera en cascada al cambiar cámaras/nodos/escala.
 */
export function buildDiagramModel(
  cameras: DesignCamera[],
  networkNodes: DesignNetworkNode[],
  scale: ScaleCalibration,
  planoNombre = '',
): DiagramModel {
  const nvrs = networkNodes.filter((n) => n.kind === 'nvr')
  const switches = networkNodes.filter((n) => n.kind === 'switch')
  const injectors = networkNodes.filter((n) => n.kind === 'injector')
  const aps = networkNodes.filter((n) => n.kind === 'ap')
  const poeNodes = [...switches, ...nvrs, ...injectors]

  const links = adviseCameraLinks(cameras, networkNodes, scale)

  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []

  // Capas
  type LayerItem = { id: string; box: Omit<DiagramNode, 'x' | 'y'> }
  const layers: LayerItem[][] = [[], [], [], []]

  // Capa 0: NVR o CORE virtual
  if (nvrs.length > 0) {
    for (const n of nvrs) {
      const m = getNetworkModelOrDefault(n.modelId, 'nvr')
      layers[0]!.push({
        id: n.id,
        box: nodeBox(n.id, 'nvr', n.label, `${m.ports}p · ${m.poeBudgetW}W`),
      })
    }
  } else if (poeNodes.length > 0 || cameras.length > 0) {
    layers[0]!.push({
      id: '__core__',
      box: nodeBox('__core__', 'core', 'CORE', 'red / uplink'),
    })
  }

  // Capa 1: switches + injectors
  for (const n of [...switches, ...injectors]) {
    const m = getNetworkModelOrDefault(n.modelId, n.kind)
    layers[1]!.push({
      id: n.id,
      box: nodeBox(
        n.id,
        n.kind,
        n.label,
        `${m.poePorts} PoE · ${m.poeBudgetW}W`,
      ),
    })
  }

  // Capa 2: APs
  for (const n of aps) {
    const m = getNetworkModelOrDefault(n.modelId, 'ap')
    layers[2]!.push({
      id: n.id,
      box: nodeBox(
        n.id,
        'ap',
        n.label,
        n.wifiChannel != null ? `ch ${n.wifiChannel}` : `${m.wifiRangeM}m`,
      ),
    })
  }

  // Capa 3: cámaras
  for (const c of cameras) {
    const m = getCameraModelOrDefault(c.modelId)
    layers[3]!.push({
      id: c.id,
      box: nodeBox(c.id, 'camera', c.label, `${m.poeWatts}W · ${m.bitrateMbps}Mb`),
    })
  }

  // Layout horizontal por capa
  let maxW = PAD * 2
  let y = PAD
  for (const layer of layers) {
    if (layer.length === 0) continue
    const layerW = layer.length * NODE_W + (layer.length - 1) * H_GAP
    maxW = Math.max(maxW, layerW + PAD * 2)
    let x = PAD
    // centrar capa
    const offset = Math.max(0, (maxW - layerW - PAD * 2) / 2)
    x += offset
    for (const item of layer) {
      nodes.push({ ...item.box, x, y })
      x += NODE_W + H_GAP
    }
    y += NODE_H + V_GAP
  }

  // Recentrar capas con width final
  const width = Math.max(maxW, 480)
  const byLayerY = new Map<number, DiagramNode[]>()
  for (const n of nodes) {
    const list = byLayerY.get(n.y) ?? []
    list.push(n)
    byLayerY.set(n.y, list)
  }
  for (const [, list] of Array.from(byLayerY.entries())) {
    const layerW = list.length * NODE_W + (list.length - 1) * H_GAP
    let x = (width - layerW) / 2
    list.sort((a, b) => a.x - b.x)
    for (const n of list) {
      n.x = x
      x += NODE_W + H_GAP
    }
  }

  const height = Math.max(y - V_GAP + PAD, 280)
  const idSet = new Set(nodes.map((n) => n.id))

  // Edges: core/NVR → switches
  const topIds = layers[0]!.map((l) => l.id)
  const swIds = layers[1]!.map((l) => l.id)
  for (const sw of swIds) {
    const parent = topIds[0]
    if (parent && parent !== sw) {
      edges.push({
        id: `e-${parent}-${sw}`,
        fromId: parent,
        toId: sw,
        label: 'uplink',
        warn: false,
      })
    }
  }

  // APs → nearest switch/nvr
  for (const ap of aps) {
    let best: DesignNetworkNode | null = null
    let bestD = Infinity
    for (const p of poeNodes) {
      const d = distMeters(
        ap.x,
        ap.y,
        p.x,
        p.y,
        scale.metersPerNormX,
        scale.metersPerNormY,
      )
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    const toId = best?.id ?? topIds[0]
    if (toId && idSet.has(ap.id) && idSet.has(toId)) {
      const cable = recommendCableType(best ? bestD : 0)
      edges.push({
        id: `e-${toId}-${ap.id}`,
        fromId: toId,
        toId: ap.id,
        label: best ? `${bestD.toFixed(0)}m ${cable}` : 'PoE',
        warn: best != null && bestD > 100,
      })
    }
  }

  // Cámaras → PoE node
  for (const link of links) {
    const toId = link.nearestNodeId ?? topIds[0]
    if (!toId || !idSet.has(link.cameraId) || !idSet.has(toId)) continue
    edges.push({
      id: `e-${toId}-${link.cameraId}`,
      fromId: toId,
      toId: link.cameraId,
      label: link.nearestNodeId
        ? `${link.distanceM}m ${link.cableType}`
        : 'sin PoE',
      warn: link.needsInjector || link.distanceM > 90,
    })
  }

  // Si hay cámaras sin capa 1 y solo core, edges core→cam ya cubiertos vía nearestNodeId null → core

  return {
    nodes,
    edges,
    width,
    height,
    title: planoNombre ? `Unifilar · ${planoNombre}` : 'Diagrama unifilar NetVision',
  }
}
