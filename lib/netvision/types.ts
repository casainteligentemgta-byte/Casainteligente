/** Tipos canónicos NetVision Pro (Fase 1+). */

export type CameraBrand = 'Hikvision' | 'Axis' | 'Uniview' | 'Dahua'

export type CameraModel = {
  id: string
  brand: CameraBrand
  name: string
  formFactor: 'dome' | 'bullet' | 'ptz'
  fovDeg: number
  rangeDayM: number
  rangeNightM: number
  resolution: string
  bitrateMbps: number
  poeWatts: number
  priceUsd: number
}

export type DesignCamera = {
  id: string
  label: string
  /** 0–1 normalizado sobre el plano */
  x: number
  y: number
  modelId: string
  /** Orientación en grados (0 = este, sentido antihorario en canvas Y-down se ajusta en renderer) */
  yawDeg: number
  mountHeightM: number
}

export type ScaleCalibration = {
  /** metros por unidad normalizada en X (ancho del plano = 1) */
  metersPerNormX: number
  /** metros por unidad normalizada en Y */
  metersPerNormY: number
  calibrated: boolean
}

export type NetworkNodeKind = 'switch' | 'ap' | 'nvr' | 'injector'

export type NetworkDeviceModel = {
  id: string
  kind: NetworkNodeKind
  brand: string
  name: string
  /** Puertos PoE (switch/injector) o 0 */
  poePorts: number
  /** Presupuesto PoE total Watts */
  poeBudgetW: number
  /** Potencia que consume el propio equipo (AP/NVR) */
  drawWatts: number
  /** Alcance WiFi útil estimado (m) — solo AP */
  wifiRangeM: number
  band: 'none' | '2.4' | '5' | 'dual'
  ports: number
  priceUsd: number
}

export type DesignNetworkNode = {
  id: string
  label: string
  kind: NetworkNodeKind
  modelId: string
  x: number
  y: number
  /** Canal WiFi asignado (AP) */
  wifiChannel?: number
  /** IDs de cámaras asignadas a este switch/injector (PoE) */
  linkedCameraIds: string[]
}

export type NetVisionProject = {
  version: 1
  planoUrl: string | null
  planoNombre: string
  cameras: DesignCamera[]
  networkNodes: DesignNetworkNode[]
  scale: ScaleCalibration
  retentionDays: number
  complianceProfileId: string
}

export type ValidationLevel = 'ERROR' | 'WARNING' | 'INFO'

export type ValidationResult = {
  level: ValidationLevel
  code: string
  message: string
  solution: string
  cameraId?: string
  nodeId?: string
}

export type CoverageSector = {
  cameraId: string
  cx: number
  cy: number
  radiusNorm: number
  startAngleRad: number
  endAngleRad: number
  mode: 'day' | 'night'
}

export type BomLine = {
  sku: string
  category: 'camera' | 'nvr' | 'storage' | 'poe' | 'accessory' | 'network' | 'wifi'
  description: string
  qty: number
  unitUsd: number
  totalUsd: number
}

export type BomSummary = {
  lines: BomLine[]
  subtotalByCategory: Record<string, number>
  totalUsd: number
  totalPoeWatts: number
  totalBandwidthMbps: number
  storageTb: number
  nvrChannels: number
}

export type ProjectCable = {
  id: string
  type: 'CAT5E' | 'CAT6' | 'CAT6A' | 'FIBER' | 'COAX'
  length: number
  certified: boolean
  fromId: string
  toId: string
}

export type ProjectDesign = {
  cables: ProjectCable[]
  powerElements: { id: string; x: number; y: number }[]
  cameras: DesignCamera[]
}

export type Conduit = {
  id: string
  area: number
  cables: { id: string; area: number }[]
}
