/** Enruta pin→nombre: recta si no se cruza; si no, quiebres a 90° (movibles). */

export type LeaderBox = {
  id: string
  pinX: number
  pinY: number
  x: number
  y: number
  w: number
  h: number
}

export type LeaderElbow = { x: number; y: number }

export type LeaderLayout = {
  id: string
  x: number
  y: number
  w: number
  h: number
  points: number[]
  mode: 'straight' | 'ortho' | 'custom'
}

const PAD = 12
const LANE = 14
const ESCAPE = 18
const PIN_CLEAR = 16

type Rect = { x: number; y: number; w: number; h: number }

export type Seg = { x0: number; y0: number; x1: number; y1: number }

export function boxesOverlap(a: Rect, b: Rect, pad = PAD): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  )
}

function expand(box: Rect, pad: number): Rect {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }
}

function hHits(y: number, x0: number, x1: number, box: Rect): boolean {
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  return y >= box.y && y <= box.y + box.h && hi >= box.x && lo <= box.x + box.w
}

function vHits(x: number, y0: number, y1: number, box: Rect): boolean {
  const lo = Math.min(y0, y1)
  const hi = Math.max(y0, y1)
  return x >= box.x && x <= box.x + box.w && hi >= box.y && lo <= box.y + box.h
}

/** Recorte Liang–Barsky: el segmento cruza el rectángulo. */
function lineHitsRect(x0: number, y0: number, x1: number, y1: number, box: Rect): boolean {
  const minX = box.x
  const minY = box.y
  const maxX = box.x + box.w
  const maxY = box.y + box.h
  let t0 = 0
  let t1 = 1
  const dx = x1 - x0
  const dy = y1 - y0
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-8) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  return (
    clip(-dx, x0 - minX) &&
    clip(dx, maxX - x0) &&
    clip(-dy, y0 - minY) &&
    clip(dy, maxY - y0) &&
    t1 >= t0
  )
}

export function polylineToSegs(points: number[]): Seg[] {
  const out: Seg[] = []
  for (let i = 0; i + 3 < points.length; i += 2) {
    const x0 = points[i]!
    const y0 = points[i + 1]!
    const x1 = points[i + 2]!
    const y1 = points[i + 3]!
    if (Math.abs(x0 - x1) < 0.5 && Math.abs(y0 - y1) < 0.5) continue
    out.push({ x0, y0, x1, y1 })
  }
  return out
}

export function polylineHitsBox(points: number[], box: Rect, pad = 4): boolean {
  const b = expand(box, pad)
  for (const s of polylineToSegs(points)) {
    if (Math.abs(s.y0 - s.y1) < 0.5) {
      if (hHits(s.y0, s.x0, s.x1, b)) return true
    } else if (Math.abs(s.x0 - s.x1) < 0.5) {
      if (vHits(s.x0, s.y0, s.y1, b)) return true
    } else if (lineHitsRect(s.x0, s.y0, s.x1, s.y1, b)) {
      return true
    }
  }
  return false
}

export function segsCollinearOverlap(a: Seg, b: Seg, minOverlap = 2): boolean {
  const horiz =
    Math.abs(a.y0 - a.y1) < 0.5 &&
    Math.abs(b.y0 - b.y1) < 0.5 &&
    Math.abs(a.y0 - b.y0) < 1
  const vert =
    Math.abs(a.x0 - a.x1) < 0.5 &&
    Math.abs(b.x0 - b.x1) < 0.5 &&
    Math.abs(a.x0 - b.x0) < 1
  if (horiz) {
    const a0 = Math.min(a.x0, a.x1)
    const a1 = Math.max(a.x0, a.x1)
    const b0 = Math.min(b.x0, b.x1)
    const b1 = Math.max(b.x0, b.x1)
    return Math.min(a1, b1) - Math.max(a0, b0) > minOverlap
  }
  if (vert) {
    const a0 = Math.min(a.y0, a.y1)
    const a1 = Math.max(a.y0, a.y1)
    const b0 = Math.min(b.y0, b.y1)
    const b1 = Math.max(b.y0, b.y1)
    return Math.min(a1, b1) - Math.max(a0, b0) > minOverlap
  }
  const ax = a.x1 - a.x0
  const ay = a.y1 - a.y0
  const bx = b.x1 - b.x0
  const by = b.y1 - b.y0
  const al = Math.hypot(ax, ay)
  const bl = Math.hypot(bx, by)
  if (al < 2 || bl < 2) return false
  const parallel = Math.abs(ax * by - ay * bx) / (al * bl) < 0.12
  if (!parallel) return false
  const dist = Math.abs((a.x0 - b.x0) * by - (a.y0 - b.y0) * bx) / bl
  if (dist > 5) return false
  const proj = (x: number, y: number) => ((x - a.x0) * ax + (y - a.y0) * ay) / al
  const a0 = 0
  const a1 = al
  const b0 = proj(b.x0, b.y0)
  const b1 = proj(b.x1, b.y1)
  return Math.min(a1, Math.max(b0, b1)) - Math.max(a0, Math.min(b0, b1)) > minOverlap
}

export function polylinesOverlap(a: number[], b: number[]): boolean {
  for (const sa of polylineToSegs(a)) {
    for (const sb of polylineToSegs(b)) {
      if (segsCollinearOverlap(sa, sb)) return true
    }
  }
  return false
}

function pinRect(box: LeaderBox): Rect {
  return {
    x: box.pinX - PIN_CLEAR,
    y: box.pinY - PIN_CLEAR,
    w: PIN_CLEAR * 2,
    h: PIN_CLEAR * 2,
  }
}

export function separateLeaderBoxes(
  boxes: LeaderBox[],
  pinnedIds: ReadonlySet<string> = new Set(),
): LeaderBox[] {
  const next = boxes.map((b) => ({ ...b }))
  for (let pass = 0; pass < 28; pass++) {
    let moved = false
    for (let i = 0; i < next.length; i++) {
      const a = next[i]!
      if (!pinnedIds.has(a.id) && boxesOverlap(a, pinRect(a), 8)) {
        const preferLeft = a.x + a.w / 2 < a.pinX
        a.x = preferLeft ? a.pinX - a.w - 22 : a.pinX + 22
        a.y = a.pinY - a.h - 18
        moved = true
      }
      for (let j = 0; j < next.length; j++) {
        if (i === j) continue
        const b = next[j]!
        if (!boxesOverlap(a, b)) continue
        const movable = !pinnedIds.has(b.id) ? b : !pinnedIds.has(a.id) ? a : null
        const other = movable === b ? a : b
        if (!movable) continue
        const options = [
          { x: movable.x, y: other.y + other.h + PAD },
          { x: movable.x, y: other.y - movable.h - PAD },
          { x: other.x + other.w + PAD, y: movable.y },
          { x: other.x - movable.w - PAD, y: movable.y },
        ]
        let best = options[0]!
        let bestScore = Infinity
        for (const opt of options) {
          const trial = { ...movable, ...opt }
          let hits = 0
          if (boxesOverlap(trial, pinRect(trial), 8)) hits += 3
          for (const o of next) {
            if (o.id === trial.id) continue
            if (boxesOverlap(trial, o)) hits += 1
          }
          const dist = Math.abs(opt.x - movable.x) + Math.abs(opt.y - movable.y)
          const score = hits * 1000 + dist
          if (score < bestScore) {
            bestScore = score
            best = opt
          }
        }
        if (movable.x !== best.x || movable.y !== best.y) {
          movable.x = best.x
          movable.y = best.y
          moved = true
        }
      }
    }
    if (!moved) break
  }
  return next
}

export function attachPoint(box: LeaderBox, yBias = 0): { x: number; y: number } {
  const midY = Math.min(
    box.y + box.h - 6,
    Math.max(box.y + 6, box.y + box.h / 2 + yBias),
  )
  if (box.pinX <= box.x + box.w / 2) return { x: box.x, y: midY }
  return { x: box.x + box.w, y: midY }
}

export function simplify(points: number[]): number[] {
  if (points.length < 6) return points
  const out = [points[0]!, points[1]!]
  for (let i = 2; i + 1 < points.length; i += 2) {
    const x = points[i]!
    const y = points[i + 1]!
    const px = out[out.length - 2]!
    const py = out[out.length - 1]!
    if (Math.abs(x - px) < 0.5 && Math.abs(y - py) < 0.5) continue
    if (out.length >= 4) {
      const ox = out[out.length - 4]!
      const oy = out[out.length - 3]!
      const colH = Math.abs(oy - py) < 0.5 && Math.abs(py - y) < 0.5
      const colV = Math.abs(ox - px) < 0.5 && Math.abs(px - x) < 0.5
      if (colH || colV) {
        out[out.length - 2] = x
        out[out.length - 1] = y
        continue
      }
    }
    out.push(x, y)
  }
  return out
}

export function elbowsFromPoints(points: number[]): LeaderElbow[] {
  const out: LeaderElbow[] = []
  for (let i = 2; i + 3 < points.length; i += 2) {
    out.push({ x: points[i]!, y: points[i + 1]! })
  }
  return out
}

export function pointsFromElbows(
  box: LeaderBox,
  elbows: readonly LeaderElbow[],
): number[] {
  const attach = attachPoint(box)
  const raw = [box.pinX, box.pinY]
  for (const e of elbows) raw.push(e.x, e.y)
  raw.push(attach.x, attach.y)
  return simplify(raw)
}

/** Quiebre a 90° pasando por un punto que mueve el operador. */
export function orthoViaPoint(
  pin: LeaderElbow,
  via: LeaderElbow,
  attach: LeaderElbow,
): number[] {
  const hvh = simplify([
    pin.x,
    pin.y,
    via.x,
    pin.y,
    via.x,
    attach.y,
    attach.x,
    attach.y,
  ])
  const vhv = simplify([
    pin.x,
    pin.y,
    pin.x,
    via.y,
    attach.x,
    via.y,
    attach.x,
    attach.y,
  ])
  const preferH = Math.abs(via.x - pin.x) >= Math.abs(via.y - pin.y)
  return preferH ? hvh : vhv
}

function hitsForeignChip(points: number[], selfId: string, obstacles: LeaderBox[]): boolean {
  return obstacles.some((o) => o.id !== selfId && polylineHitsBox(points, o, 4))
}

function reservedConflict(points: number[], reserved: number[][]): boolean {
  return reserved.some((other) => polylinesOverlap(points, other))
}

function tryRoute(
  box: LeaderBox,
  fanX: number,
  fanY: number,
  attach: { x: number; y: number },
): number[] {
  return orthoViaPoint({ x: box.pinX, y: box.pinY }, { x: fanX, y: fanY }, attach)
}

export function polylineIsOrtho(points: number[]): boolean {
  for (const s of polylineToSegs(points)) {
    if (Math.abs(s.x0 - s.x1) >= 0.5 && Math.abs(s.y0 - s.y1) >= 0.5) return false
  }
  return true
}

function routeOrtho(
  box: LeaderBox,
  channel: number,
  obstacles: LeaderBox[],
  reserved: number[][],
): number[] {
  const dirXPreferred = box.x + box.w / 2 >= box.pinX ? 1 : -1
  const dirYPreferred = box.y + box.h / 2 >= box.pinY ? 1 : -1
  let fallback = tryRoute(
    box,
    box.pinX + dirXPreferred * (22 + channel * LANE),
    box.pinY + dirYPreferred * (ESCAPE + channel * 6),
    attachPoint(box),
  )

  for (let attachBias = 0; attachBias <= 4; attachBias++) {
    const yBias = ((attachBias % 2 === 0 ? 1 : -1) * Math.ceil(attachBias / 2)) * 6
    const attach = attachPoint(box, yBias)
    const dirX = attach.x >= box.pinX ? 1 : -1
    const dirY = attach.y >= box.pinY ? 1 : -1
    for (const ySign of [dirY, -dirY] as const) {
      for (const xSign of [dirX, -dirX] as const) {
        for (let fy = 0; fy < 16; fy++) {
          const fanY = box.pinY + ySign * (ESCAPE + fy * LANE)
          for (let fx = 0; fx < 16; fx++) {
            const fanX = box.pinX + xSign * (22 + (channel + fx) * LANE)
            const pts = tryRoute(box, fanX, fanY, attach)
            if (hitsForeignChip(pts, box.id, obstacles)) continue
            if (reservedConflict(pts, reserved)) continue
            return pts
          }
        }
      }
    }
  }
  return fallback
}

export function layoutCameraLeaders(
  boxes: LeaderBox[],
  opts?: {
    pinnedIds?: readonly string[]
    customElbows?: Readonly<Record<string, readonly LeaderElbow[]>>
  },
): LeaderLayout[] {
  const pinned = new Set(opts?.pinnedIds ?? [])
  const custom = opts?.customElbows ?? {}
  const placed = separateLeaderBoxes(boxes, pinned)
  const order = [...placed].sort(
    (a, b) => a.pinY - b.pinY || a.pinX - b.pinX || a.id.localeCompare(b.id),
  )
  const channelOf = new Map(order.map((b, i) => [b.id, i]))
  const reserved: number[][] = []
  const byId = new Map<string, LeaderLayout>()
  for (const box of order) {
    const elbows = custom[box.id]
    let points: number[]
    let mode: LeaderLayout['mode']
    if (elbows && elbows.length > 0) {
      points = pointsFromElbows(box, elbows)
      mode = 'custom'
    } else {
      const attach = attachPoint(box)
      const straight = [box.pinX, box.pinY, attach.x, attach.y]
      const blocked =
        hitsForeignChip(straight, box.id, placed) || reservedConflict(straight, reserved)
      if (!blocked) {
        points = straight
        mode = 'straight'
      } else {
        points = routeOrtho(box, channelOf.get(box.id) ?? 0, placed, reserved)
        mode = 'ortho'
      }
    }
    reserved.push(points)
    byId.set(box.id, {
      id: box.id,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      points,
      mode,
    })
  }
  return placed.map((box) => byId.get(box.id)!)
}
