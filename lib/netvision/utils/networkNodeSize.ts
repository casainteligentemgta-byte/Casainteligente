import type { DesignNetworkNode, NetworkNodeKind } from '@/lib/netvision/types'

/** Mitad del icono como fracción del ancho del plano (coords 0–1). */
export const NETWORK_PLAN_SIZE_MIN = 0.003
export const NETWORK_PLAN_SIZE_MAX = 0.05

/** Defaults por tipo: switch/injector más compactos que NVR/AP. */
export const DEFAULT_NETWORK_PLAN_SIZE: Record<NetworkNodeKind, number> = {
  switch: 0.006,
  injector: 0.006,
  nvr: 0.008,
  ap: 0.008,
}

export function defaultNetworkPlanSize(kind: NetworkNodeKind): number {
  return DEFAULT_NETWORK_PLAN_SIZE[kind] ?? DEFAULT_NETWORK_PLAN_SIZE.switch
}

export function clampNetworkPlanSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NETWORK_PLAN_SIZE.switch
  return Math.min(
    NETWORK_PLAN_SIZE_MAX,
    Math.max(NETWORK_PLAN_SIZE_MIN, value),
  )
}

/** Resuelve el tamaño del nodo (mitad del lado, normalizado al ancho del plano). */
export function resolveNetworkPlanSize(
  node: Pick<DesignNetworkNode, 'kind' | 'planSizeNorm'>,
): number {
  return clampNetworkPlanSize(
    typeof node.planSizeNorm === 'number'
      ? node.planSizeNorm
      : defaultNetworkPlanSize(node.kind),
  )
}

/**
 * Mitad del icono en píxeles del canvas, acotada para hit-target usable.
 * @param planSizeNorm mitad del lado / ancho del plano
 * @param drawW ancho dibujado del plano en px
 */
export function networkNodeHalfPx(
  planSizeNorm: number,
  drawW: number,
  opts?: { minPx?: number; maxPx?: number },
): number {
  const minPx = opts?.minPx ?? 4
  const maxPx = opts?.maxPx ?? 48
  const raw = clampNetworkPlanSize(planSizeNorm) * Math.max(drawW, 1)
  return Math.min(maxPx, Math.max(minPx, raw))
}

/** Lado completo del icono como % del ancho del plano (para UI). */
export function networkPlanSizePct(planSizeNorm: number): number {
  return Math.round(clampNetworkPlanSize(planSizeNorm) * 2 * 1000) / 10
}

export function planSizeNormFromPct(pctOfPlanWidth: number): number {
  return clampNetworkPlanSize(pctOfPlanWidth / 200)
}
