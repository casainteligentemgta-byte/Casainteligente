/** Tipos canónicos NetVision Pro (Fase 1+). */

export type CameraBrand =
  | 'Hikvision'
  | 'Axis'
  | 'Uniview'
  | 'Dahua'
  | 'Sony'
  | 'Ezviz'
  | 'Aqara'

/** Lente adicional (cámaras Dual / multi-óptica). */
export type CameraLens = {
  id: string
  label: string
  fovDeg: number
  rangeDayM: number
  rangeNightM: number
}

export type CameraModel = {
  id: string
  brand: CameraBrand
  name: string
  formFactor: 'dome' | 'bullet' | 'ptz'
  fovDeg: number
  rangeDayM: number
  rangeNightM: number
  /** Si hay ≥2, el plano dibuja un espectro/cono por lente. */
  lenses?: CameraLens[]
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
  /** Orientación en grados (0 = este; en canvas Y-down crece en sentido horario) */
  yawDeg: number
  mountHeightM: number
  /** Apertura FOV en grados (override del catálogo). Si falta, usa el modelo. */
  fovDeg?: number
  /** Alcance de visión en metros (override día/noche del catálogo). */
  rangeM?: number
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

/** Material constructivo que afecta visión / WiFi / sonido. */
export type StructureMaterialId =
  | 'drywall'
  | 'block'
  | 'glass'
  | 'window'
  | 'door'

export type StructureMaterial = {
  id: StructureMaterialId
  label: string
  kind: 'wall_drywall' | 'wall_block' | 'glass' | 'window' | 'door'
  /** Si true, corta el FOV de la cámara */
  blocksVision: boolean
  wifiLossDb: number
  soundLossDb: number
  color: string
  dash: number[] | null
}

/** Segmento de muro / vidrio / ventana en el plano (coords 0–1). */
export type DesignStructure = {
  id: string
  label: string
  materialId: StructureMaterialId
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Tramo de canalización subterránea dibujado a mano en el plano (2 puntos). */
export type DesignUndergroundSegment = {
  id: string
  label: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Sistema de visualización de unidades (cálculos internos siempre en metros). */
export type UnitSystem = 'metric' | 'imperial' | 'mixed'

export type NetVisionCurrency = 'USD' | 'VES' | 'EUR'

export type NetVisionProjectIndexEntry = {
  id: string
  name: string
  updatedAt: string
  planoNombre: string
  cameraCount: number
  networkCount: number
}

export type NetVisionProject = {
  version: 1 | 2
  id: string
  name: string
  description?: string
  client?: string
  updatedAt: string
  unitSystem: UnitSystem
  currency: NetVisionCurrency
  /** Margen distribuidor sobre subtotal BOM (0–100). */
  distributorMarginPct: number
  planoUrl: string | null
  planoNombre: string
  cameras: DesignCamera[]
  networkNodes: DesignNetworkNode[]
  structures: DesignStructure[]
  /** Tramos subterráneos dibujados en el plano (además de los derivados de cable ≥ 8 m). */
  undergroundSegments: DesignUndergroundSegment[]
  /** Cables dibujados en el plano (además de rutas auto cámara→PoE). */
  cableSegments: DesignCableSegment[]
  /**
   * Quiebres (waypoints intermedios) de rutas auto cámara/AP→PoE.
   * Clave: `${fromId}__${toId}` — sin extremos (siguen al equipo).
   */
  cableRouteOverrides: Record<string, { x: number; y: number }[]>
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
  /** Identificador de lente (wide/tele…) en cámaras Dual. */
  lensId?: string
  cx: number
  cy: number
  radiusNorm: number
  startAngleRad: number
  endAngleRad: number
  mode: 'day' | 'night'
  /** Polígono FOV recortado por muros opacos (incluye el centro). */
  polygon?: { x: number; y: number }[]
}

/** Semáforo de cobertura CCTV (alcance relativo). */
export type VisionBand = 'green' | 'yellow' | 'red'

/** Celda de mapa de calor (WiFi, sonido o visión). */
export type SpectrumCell = {
  x: number
  y: number
  w: number
  h: number
  /** 0 = sin cobertura, 1 = excelente */
  strength: number
  /** Banda semáforo (solo espectro de visión). */
  band?: VisionBand
}

export type BomCategory =
  | 'camera'
  | 'nvr'
  | 'storage'
  | 'poe'
  | 'accessory'
  | 'network'
  | 'wifi'
  | 'cable'
  | 'connector'
  | 'conduit'

export type BomLine = {
  sku: string
  category: BomCategory
  description: string
  qty: number
  unitUsd: number
  totalUsd: number
}

export type CableType =
  | 'CAT5E'
  | 'CAT6'
  | 'CAT6A'
  | 'FIBER'
  | 'COAX'
  | 'AUDIO'
  | 'POWER_12V'

/** Cable dibujado a mano en el plano (2 puntos + tipo). */
export type DesignCableSegment = {
  id: string
  label: string
  type: CableType
  x1: number
  y1: number
  x2: number
  y2: number
}

export type CableRoute = {
  id: string
  fromId: string
  toId: string
  fromLabel: string
  toLabel: string
  /** puntos normalizados de la polilínea (ruta ortogonal) */
  points: { x: number; y: number }[]
  straightM: number
  routeM: number
  type: CableType
  certified: boolean
  warn: boolean
  warning: string | null
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
  type: CableType
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
