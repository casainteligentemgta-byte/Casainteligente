/** Rótulo de plano: proyecto arriba; logo + empresa a la izquierda y fecha a la derecha. */

export const ROTULO_COMPANY = 'Casa Inteligente C.A.'
export const ROTULO_LOGO_SRC = '/logo-casa-inteligente.png'

export const PLANO_TIPO_POR_RAMA = {
  cctv: 'CCTV',
  sonido: 'Sonido',
  internet: 'Internet',
  domotica: 'Domótica',
  electrico: 'Eléctrico',
  muros: 'Muros',
  cable: 'Cable',
  sub: 'Subterráneo',
  norm: 'Normativa',
  ajustes: 'Ajustes',
} as const

export type PlanoRotuloRama = keyof typeof PLANO_TIPO_POR_RAMA

export type PlanoRotuloInfo = {
  projectName: string
  company: string
  dateLabel: string
  planType: string
}

export function planoTipoFromBranch(branch: string | null | undefined): string {
  if (!branch) return PLANO_TIPO_POR_RAMA.cctv
  const key = branch.toLowerCase() as PlanoRotuloRama
  return PLANO_TIPO_POR_RAMA[key] ?? PLANO_TIPO_POR_RAMA.cctv
}

export function formatRotuloFecha(at: Date | string = new Date()): string {
  const d = typeof at === 'string' ? new Date(at) : at
  const valid = d instanceof Date && Number.isFinite(d.getTime()) ? d : new Date()
  return valid.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function buildPlanoRotulo(opts: {
  projectName?: string | null
  branch?: string | null
  at?: Date | string
  company?: string
}): PlanoRotuloInfo {
  const name = opts.projectName?.trim() || 'Proyecto sin nombre'
  return {
    projectName: name,
    company: opts.company?.trim() || ROTULO_COMPANY,
    dateLabel: formatRotuloFecha(opts.at),
    planType: planoTipoFromBranch(opts.branch),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la captura del plano.'))
    img.src = src
  })
}

async function loadLogoOptional(): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(ROTULO_LOGO_SRC)
  } catch {
    return null
  }
}

/** Enmarca la captura con el rótulo para PNG / PDF. */
export async function composePlanoRotuloImage(
  imageDataUrl: string,
  rotulo: PlanoRotuloInfo,
  opts?: { night?: boolean },
): Promise<string> {
  if (typeof document === 'undefined') return imageDataUrl
  const img = await loadImage(imageDataUrl)
  const night = opts?.night ?? true
  const ink = night ? '#f8fafc' : '#0b1220'
  const muted = night ? '#94a3b8' : '#334155'
  const paper = night ? '#05080d' : '#f4f1ea'
  const line = night ? 'rgba(103,232,249,0.55)' : 'rgba(15,23,42,0.35)'
  const band = Math.max(36, Math.round(img.width * 0.045))
  const pad = Math.max(10, Math.round(img.width * 0.012))
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height + band * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return imageDataUrl
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, band)
  ctx.strokeStyle = line
  ctx.lineWidth = Math.max(2, Math.round(img.width * 0.003))
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
  ctx.beginPath()
  ctx.moveTo(pad, band)
  ctx.lineTo(canvas.width - pad, band)
  ctx.moveTo(pad, canvas.height - band)
  ctx.lineTo(canvas.width - pad, canvas.height - band)
  ctx.stroke()

  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(band * 0.42)}px system-ui, sans-serif`
  ctx.fillText(rotulo.projectName.toUpperCase(), canvas.width / 2, band / 2, canvas.width - pad * 2)

  ctx.fillStyle = muted
  ctx.font = `600 ${Math.round(band * 0.32)}px system-ui, sans-serif`
  const footerY = canvas.height - band / 2
  const col = canvas.width / 2
  const logo = await loadLogoOptional()
  const logoSize = Math.round(band * 0.7)
  let companyX = pad
  if (logo) {
    const logoY = Math.round(footerY - logoSize / 2)
    ctx.drawImage(logo, pad, logoY, logoSize, logoSize)
    companyX = pad + logoSize + Math.max(6, Math.round(pad * 0.45))
  }
  ctx.textAlign = 'left'
  ctx.fillText(rotulo.company, companyX, footerY, Math.max(24, col - (companyX - pad) - 4))
  ctx.textAlign = 'right'
  ctx.fillText(rotulo.dateLabel, canvas.width - pad, footerY, col - pad)

  return canvas.toDataURL('image/jpeg', 0.92)
}
