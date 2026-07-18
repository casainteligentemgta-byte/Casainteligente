import { getCameraModelOrDefault } from '@/lib/netvision/catalog/cameras'
import { getNetworkModelOrDefault } from '@/lib/netvision/catalog/network'
import type { CableRoute } from '@/lib/netvision/types'
import type { NetVisionProject } from '@/lib/netvision/types'
import { bimPhaseForElementType } from '@/lib/netvision/utils/bimHelpers'

export type BimElement = {
  globalId: string
  type: string
  bimPhase: 'design' | 'cabling' | 'equipment' | 'documentation'
  label: string
  x: number
  y: number
  z: number
  parameters: Record<string, string | number | boolean>
}

export type BimPackage = {
  format: 'netvision-bim-package'
  version: 1
  note: string
  projectName: string
  phases: string[]
  views: string[]
  elements: BimElement[]
  cables: {
    id: string
    from: string
    to: string
    type: string
    lengthM: number
    bimPhase: 'cabling'
  }[]
  ifcLite: {
    schema: 'IFC4-lite'
    entities: { type: string; id: string; name: string; props: Record<string, unknown> }[]
  }
  sharedParametersCsv: string
  dynamoScript: string
}

/** Paquete BIM exportable (IFC-lite JSON + CSV + Dynamo). No genera .RVT nativo en browser. */
export function buildBimPackage(
  project: NetVisionProject,
  cableRoutes: CableRoute[] = [],
): BimPackage {
  const elements: BimElement[] = []

  for (const c of project.cameras) {
    const m = getCameraModelOrDefault(c.modelId)
    elements.push({
      globalId: c.id,
      type: 'IfcSensor.Camera',
      bimPhase: bimPhaseForElementType('camera'),
      label: c.label,
      x: c.x,
      y: c.y,
      z: c.mountHeightM,
      parameters: {
        Brand: m.brand,
        Model: m.name,
        FOV_deg: m.fovDeg,
        PoE_W: m.poeWatts,
        Bitrate_Mbps: m.bitrateMbps,
        Yaw_deg: c.yawDeg,
        MountHeight_m: c.mountHeightM,
        NV_SKU: m.id,
      },
    })
  }

  for (const n of project.networkNodes ?? []) {
    const m = getNetworkModelOrDefault(n.modelId, n.kind)
    const type =
      n.kind === 'ap'
        ? 'IfcOutlet.Data'
        : n.kind === 'nvr'
          ? 'IfcUnitaryEquipment.NVR'
          : 'IfcElectricDistributionBoard'
    elements.push({
      globalId: n.id,
      type,
      bimPhase: bimPhaseForElementType(n.kind === 'ap' ? 'switch' : n.kind === 'nvr' ? 'switch' : 'switch'),
      label: n.label,
      x: n.x,
      y: n.y,
      z: 0,
      parameters: {
        Kind: n.kind,
        Brand: m.brand,
        Model: m.name,
        PoE_Budget_W: m.poeBudgetW,
        PoE_Ports: m.poePorts,
        Ports: m.ports,
        WifiChannel: n.wifiChannel ?? 0,
        NV_SKU: m.id,
      },
    })
  }

  // Etiquetas documentación
  for (const el of elements) {
    elements.push({
      globalId: `tag-${el.globalId}`,
      type: 'IfcAnnotation',
      bimPhase: 'documentation',
      label: `TAG-${el.label}`,
      x: el.x,
      y: el.y,
      z: el.z + 0.3,
      parameters: { HostId: el.globalId, Text: el.label },
    })
  }

  const cables = cableRoutes.map((r) => ({
    id: r.id,
    from: r.fromId,
    to: r.toId,
    type: r.type,
    lengthM: r.routeM,
    bimPhase: 'cabling' as const,
  }))

  const ifcLite = {
    schema: 'IFC4-lite' as const,
    entities: [
      ...elements.map((e) => ({
        type: e.type,
        id: e.globalId,
        name: e.label,
        props: { ...e.parameters, bimPhase: e.bimPhase, x: e.x, y: e.y, z: e.z },
      })),
      ...cables.map((c) => ({
        type: 'IfcCableSegment',
        id: c.id,
        name: `${c.from}→${c.to}`,
        props: { cableType: c.type, lengthM: c.lengthM, bimPhase: c.bimPhase },
      })),
    ],
  }

  const sharedParametersCsv = buildSharedParametersCsv(elements, cables)
  const dynamoScript = buildDynamoScriptTemplate()

  return {
    format: 'netvision-bim-package',
    version: 1,
    note: 'Materializar .RVT vía worker Railway + add-in/Dynamo Revit. Este paquete es IFC-lite + parámetros.',
    projectName: project.name || project.planoNombre || 'NetVision Project',
    phases: ['design', 'cabling', 'equipment', 'documentation'],
    views: [
      'Planta equipos',
      'Isométrica cableado',
      'Planta subterránea',
      'Schedule equipos',
      'Schedule cables',
    ],
    elements,
    cables,
    ifcLite,
    sharedParametersCsv,
    dynamoScript,
  }
}

function buildSharedParametersCsv(
  elements: BimElement[],
  cables: { id: string; type: string; lengthM: number; from: string; to: string }[],
): string {
  const header = 'ElementId,Category,Parameter,Value,BimPhase'
  const rows: string[] = []
  for (const e of elements) {
    Array.from(Object.entries(e.parameters)).forEach(([k, v]) => {
      rows.push(`${e.globalId},${e.type},${k},${String(v)},${e.bimPhase}`)
    })
  }
  for (const c of cables) {
    rows.push(`${c.id},IfcCableSegment,CableType,${c.type},cabling`)
    rows.push(`${c.id},IfcCableSegment,Length_m,${c.lengthM},cabling`)
    rows.push(`${c.id},IfcCableSegment,From,${c.from},cabling`)
    rows.push(`${c.id},IfcCableSegment,To,${c.to},cabling`)
  }
  return [header, ...rows].join('\n')
}

function buildDynamoScriptTemplate(): string {
  return `# NetVision Pro — Dynamo pseudo-script (Python node)
# Importar JSON del paquete BIM y validar distancias / crear wires

import clr
# clr.AddReference('RevitNodes')  # en Dynamo/Revit

cámaras = [e for e in elements if e['type'] == 'IfcSensor.Camera']
switches = [e for e in elements if 'DistributionBoard' in e['type'] or e['parameters'].get('Kind') == 'switch']

warnings = []
for camera in cámaras:
    # Distancia al switch más cercano (en metros de proyecto)
    nearest = min(switches, key=lambda s: distance(camera, s)) if switches else None
    if nearest is None:
        warnings.append((camera['label'], 'Sin switch'))
        continue
    distancia = distance(camera, nearest)
    if distancia > 100:
        warnings.append((camera['label'], f'Distancia {distancia:.1f}m excede 100m'))
    else:
        # CreateWire(camera, nearest, 'CAT6A', distancia)
        pass

OUT = warnings
`
}

export function downloadBimPackageZipLike(pkg: BimPackage) {
  // Entrega como JSON único + archivos auxiliares vía descargas separadas
  const main = {
    ...pkg,
    sharedParametersCsv: undefined,
    dynamoScript: undefined,
  }
  downloadText(
    'netvision-bim-package.json',
    JSON.stringify({ ...main, sharedParametersCsv: pkg.sharedParametersCsv }, null, 2),
    'application/json',
  )
  downloadText('netvision-shared-parameters.csv', pkg.sharedParametersCsv, 'text/csv')
  downloadText('netvision-dynamo.py', pkg.dynamoScript, 'text/x-python')
  downloadText(
    'netvision-ifc-lite.json',
    JSON.stringify(pkg.ifcLite, null, 2),
    'application/json',
  )
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
