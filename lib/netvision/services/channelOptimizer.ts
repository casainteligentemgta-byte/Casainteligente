import type { DesignNetworkNode } from '@/lib/netvision/types'
import type { ScaleCalibration } from '@/lib/netvision/types'
import { distMeters } from '@/lib/netvision/utils/geometryHelpers'

/** Canales 2.4 GHz no solapados típicos. */
const CH_24 = [1, 6, 11]
/** Subset de canales 5 GHz “limpios” para asignación heurística. */
const CH_5 = [36, 40, 44, 48, 149, 153, 157, 161]

/**
 * Asigna canales a APs minimizando vecinos cercanos en el mismo canal.
 * Usa banda dual: preferencia 5 GHz; alterna 2.4 si hay muchos APs.
 */
export function optimizeApChannels(
  nodes: DesignNetworkNode[],
  scale: ScaleCalibration,
): DesignNetworkNode[] {
  const aps = nodes.filter((n) => n.kind === 'ap')
  if (aps.length === 0) return nodes

  const assigned = new Map<string, number>()
  // Orden: más céntricos / primero por label estable
  const ordered = [...aps].sort((a, b) => a.label.localeCompare(b.label))

  for (const ap of ordered) {
    const pool = ordered.length <= 4 ? CH_5 : [...CH_5, ...CH_24]
    let bestCh = pool[0]!
    let bestScore = Infinity

    for (const ch of pool) {
      let score = 0
      for (const other of ordered) {
        if (other.id === ap.id) continue
        const och = assigned.get(other.id)
        if (och === undefined) continue
        if (och !== ch) continue
        const d = distMeters(
          ap.x,
          ap.y,
          other.x,
          other.y,
          scale.metersPerNormX,
          scale.metersPerNormY,
        )
        // Penalizar fuerte si están cerca en mismo canal
        score += d < 1 ? 1000 : 100 / d
      }
      if (score < bestScore) {
        bestScore = score
        bestCh = ch
      }
    }
    assigned.set(ap.id, bestCh)
  }

  return nodes.map((n) =>
    n.kind === 'ap' && assigned.has(n.id)
      ? { ...n, wifiChannel: assigned.get(n.id) }
      : n,
  )
}

export function channelBandLabel(channel: number | undefined): string {
  if (channel == null) return '—'
  if (CH_24.includes(channel)) return `2.4 GHz ch ${channel}`
  return `5 GHz ch ${channel}`
}
