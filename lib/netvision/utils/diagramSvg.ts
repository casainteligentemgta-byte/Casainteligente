import type { DiagramModel } from '@/lib/netvision/services/diagramBuilder'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Genera SVG del diagrama unifilar (export / vista). */
export function diagramToSvg(model: DiagramModel): string {
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height + 28}" viewBox="0 0 ${model.width} ${model.height + 28}">`,
  )
  parts.push(`<rect width="100%" height="100%" fill="#0b1220"/>`)
  parts.push(
    `<text x="20" y="22" fill="#94a3b8" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12">${esc(model.title)}</text>`,
  )

  const yOff = 8

  // Edges under nodes
  for (const e of model.edges) {
    const a = model.nodes.find((n) => n.id === e.fromId)
    const b = model.nodes.find((n) => n.id === e.toId)
    if (!a || !b) continue
    const x1 = a.x + a.w / 2
    const y1 = a.y + a.h + yOff
    const x2 = b.x + b.w / 2
    const y2 = b.y + yOff
    const midY = (y1 + y2) / 2
    const stroke = e.warn ? '#f87171' : '#64748b'
    parts.push(
      `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`,
    )
    parts.push(
      `<text x="${(x1 + x2) / 2}" y="${midY - 4}" fill="${e.warn ? '#fca5a5' : '#94a3b8'}" font-size="9" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif">${esc(e.label)}</text>`,
    )
  }

  for (const n of model.nodes) {
    const x = n.x
    const y = n.y + yOff
    parts.push(
      `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="8" fill="${n.color}" fill-opacity="0.22" stroke="${n.color}" stroke-width="1.5"/>`,
    )
    parts.push(
      `<text x="${x + n.w / 2}" y="${y + 18}" fill="#f8fafc" font-size="11" font-weight="600" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif">${esc(n.label)}</text>`,
    )
    parts.push(
      `<text x="${x + n.w / 2}" y="${y + 34}" fill="#cbd5e1" font-size="9" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif">${esc(n.subtitle)}</text>`,
    )
  }

  parts.push(`</svg>`)
  return parts.join('')
}

export function downloadSvg(filename: string, svg: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadSvgAsPng(filename: string, svg: string, scale = 2) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth * scale
    canvas.height = img.naturalHeight * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.drawImage(img, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo rasterizar el SVG'))
    img.src = src
  })
}
