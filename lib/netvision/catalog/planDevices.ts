import type {
  PlanDeviceKind,
  PlanDeviceModel,
  PlanDiscipline,
} from '@/lib/netvision/types'

export const PLAN_DEVICE_CATALOG: PlanDeviceModel[] = [
  {
    id: 'snd-hik-dsqae',
    discipline: 'sonido',
    kind: 'speaker',
    brand: 'Hikvision',
    name: 'DS-QAE altavoz IP',
    rangeM: 10,
    fovDeg: 360,
    priceUsd: 85,
  },
  {
    id: 'snd-mic-amb',
    discipline: 'sonido',
    kind: 'mic',
    brand: 'Casa Inteligente',
    name: 'Micrófono ambiental',
    rangeM: 8,
    fovDeg: 360,
    priceUsd: 35,
  },
  {
    id: 'dom-aqara-m3',
    discipline: 'domotica',
    kind: 'hub',
    brand: 'Aqara',
    name: 'Hub M3',
    rangeM: 15,
    fovDeg: 360,
    priceUsd: 150,
  },
  {
    id: 'dom-aqara-pir',
    discipline: 'domotica',
    kind: 'sensor',
    brand: 'Aqara',
    name: 'Sensor movimiento P1',
    rangeM: 7,
    fovDeg: 170,
    priceUsd: 28,
  },
  {
    id: 'dom-aqara-relay',
    discipline: 'domotica',
    kind: 'relay',
    brand: 'Aqara',
    name: 'Relé T2',
    rangeM: 5,
    fovDeg: 360,
    priceUsd: 32,
  },
  {
    id: 'dom-aqara-keypad',
    discipline: 'domotica',
    kind: 'keypad',
    brand: 'Aqara',
    name: 'Teclado G410',
    rangeM: 4,
    fovDeg: 120,
    priceUsd: 95,
  },
  {
    id: 'alm-ajax-hub',
    discipline: 'alarma',
    kind: 'hub',
    brand: 'Ajax',
    name: 'Hub 2 Plus',
    rangeM: 12,
    fovDeg: 360,
    priceUsd: 220,
  },
  {
    id: 'alm-ajax-pir',
    discipline: 'alarma',
    kind: 'sensor',
    brand: 'Ajax',
    name: 'MotionProtect',
    rangeM: 12,
    fovDeg: 90,
    priceUsd: 68,
  },
  {
    id: 'alm-ajax-door',
    discipline: 'alarma',
    kind: 'contact',
    brand: 'Ajax',
    name: 'DoorProtect',
    rangeM: 1,
    fovDeg: 360,
    priceUsd: 45,
  },
  {
    id: 'alm-ajax-keypad',
    discipline: 'alarma',
    kind: 'keypad',
    brand: 'Ajax',
    name: 'KeyPad',
    rangeM: 3,
    fovDeg: 120,
    priceUsd: 95,
  },
  {
    id: 'snd-ajax-siren',
    discipline: 'alarma',
    kind: 'siren',
    brand: 'Ajax',
    name: 'StreetSiren',
    rangeM: 12,
    fovDeg: 360,
    priceUsd: 120,
  },
  {
    id: 'snd-ezviz-t9c',
    discipline: 'alarma',
    kind: 'siren',
    brand: 'Ezviz',
    name: 'T9C (requiere gateway A3)',
    rangeM: 12,
    fovDeg: 360,
    priceUsd: 54,
  },
  {
    id: 'ele-panel-12',
    discipline: 'electrico',
    kind: 'panel',
    brand: 'Casa Inteligente',
    name: 'Tablero 12 circuitos',
    rangeM: 2,
    fovDeg: 360,
    priceUsd: 180,
  },
  {
    id: 'ele-outlet',
    discipline: 'electrico',
    kind: 'outlet',
    brand: 'Casa Inteligente',
    name: 'Toma 110 V',
    rangeM: 1.5,
    fovDeg: 360,
    priceUsd: 8,
  },
  {
    id: 'ele-light',
    discipline: 'electrico',
    kind: 'light',
    brand: 'Casa Inteligente',
    name: 'Luminaria LED',
    rangeM: 4,
    fovDeg: 360,
    priceUsd: 22,
  },
  {
    id: 'ele-xfrm-12v',
    discipline: 'electrico',
    kind: 'transformer',
    brand: 'Casa Inteligente',
    name: 'Transformador 12 V',
    rangeM: 3,
    fovDeg: 360,
    priceUsd: 45,
  },
]

export const PLAN_KIND_LABEL: Record<PlanDeviceKind, string> = {
  speaker: 'Altavoz',
  siren: 'Sirena',
  mic: 'Micrófono',
  hub: 'Hub',
  sensor: 'Sensor',
  relay: 'Relé',
  keypad: 'Teclado',
  contact: 'Contacto',
  panel: 'Tablero',
  outlet: 'Toma',
  light: 'Luminaria',
  transformer: 'Transformador',
}

export const PLAN_DISCIPLINE_LABEL: Record<PlanDiscipline, string> = {
  sonido: 'Sonido',
  domotica: 'Domótica',
  alarma: 'Alarma',
  electrico: 'Eléctrico',
}

const KIND_PREFIX: Record<PlanDeviceKind, string> = {
  speaker: 'ALT',
  siren: 'SIR',
  mic: 'MIC',
  hub: 'HUB',
  sensor: 'SEN',
  relay: 'REL',
  keypad: 'TEC',
  contact: 'CON',
  panel: 'TAB',
  outlet: 'TOM',
  light: 'LUZ',
  transformer: 'TRA',
}

export function planDevicesByDiscipline(discipline: PlanDiscipline): PlanDeviceModel[] {
  return PLAN_DEVICE_CATALOG.filter((m) => m.discipline === discipline)
}

export function planDeviceKinds(discipline: PlanDiscipline): PlanDeviceKind[] {
  const seen: PlanDeviceKind[] = []
  for (const m of planDevicesByDiscipline(discipline)) {
    if (!seen.includes(m.kind)) seen.push(m.kind)
  }
  return seen
}

export function getPlanDeviceModel(id: string): PlanDeviceModel | undefined {
  return PLAN_DEVICE_CATALOG.find((m) => m.id === id)
}

export function getPlanDeviceModelOrDefault(
  id: string,
  discipline: PlanDiscipline = 'sonido',
): PlanDeviceModel {
  return (
    getPlanDeviceModel(id) ??
    PLAN_DEVICE_CATALOG.find((m) => m.discipline === discipline) ??
    PLAN_DEVICE_CATALOG[0]!
  )
}

export function defaultPlanDeviceId(discipline: PlanDiscipline): string {
  return planDevicesByDiscipline(discipline)[0]!.id
}

export function labelPrefixForPlanKind(kind: PlanDeviceKind): string {
  return KIND_PREFIX[kind]
}

export function planDeviceColor(discipline: PlanDiscipline): string {
  if (discipline === 'sonido') return '#c084fc'
  if (discipline === 'domotica') return '#38bdf8'
  if (discipline === 'alarma') return '#f87171'
  return '#fbbf24'
}
