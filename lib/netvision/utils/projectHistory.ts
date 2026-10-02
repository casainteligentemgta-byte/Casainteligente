import type { NetVisionProject } from '@/lib/netvision/types'

export const NETVISION_HISTORY_MAX = 24

export function cloneProjectSnapshot(project: NetVisionProject): NetVisionProject {
  return JSON.parse(JSON.stringify(project)) as NetVisionProject
}

export function pushProjectHistory(
  stack: NetVisionProject[],
  snapshot: NetVisionProject,
  max = NETVISION_HISTORY_MAX,
): NetVisionProject[] {
  const next = [...stack, cloneProjectSnapshot(snapshot)]
  if (next.length <= max) return next
  return next.slice(next.length - max)
}

export function popProjectHistory(stack: NetVisionProject[]): {
  rest: NetVisionProject[]
  restored: NetVisionProject | null
} {
  if (stack.length === 0) return { rest: stack, restored: null }
  const rest = stack.slice(0, -1)
  return { rest, restored: stack[stack.length - 1]! }
}
