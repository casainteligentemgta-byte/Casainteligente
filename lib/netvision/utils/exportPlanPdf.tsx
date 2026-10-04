import { createElement } from 'react'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'

export type NetVisionPlanPdfInput = {
  /** Data URL PNG/JPEG del Stage Konva (ya puede traer el rótulo). */
  imageDataUrl: string
  projectName: string
  planoNombre?: string
  cameraCount?: number
  networkCount?: number
  structureCount?: number
  /** Fecha ISO o texto ya formateado */
  generatedAt?: string
  filename?: string
  company?: string
  planType?: string
  logoSrc?: string
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 28,
    backgroundColor: '#0b1220',
    color: '#e2e8f0',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f8fafc',
    marginBottom: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  meta: {
    fontSize: 9,
    color: '#94a3b8',
    marginBottom: 2,
    textAlign: 'center',
  },
  footerRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '34%',
  },
  logo: {
    width: 18,
    height: 18,
    borderRadius: 3,
    marginRight: 6,
  },
  footerCell: {
    fontSize: 9,
    color: '#cbd5e1',
    textTransform: 'uppercase',
  },
  footerType: {
    fontSize: 10,
    color: '#67e8f9',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  imageWrap: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
})

function NetVisionPlanPdfDoc(props: NetVisionPlanPdfInput) {
  const when =
    props.generatedAt ??
    new Date().toLocaleString('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  const counts = [
    props.cameraCount != null ? `${props.cameraCount} cámaras` : null,
    props.networkCount != null ? `${props.networkCount} red` : null,
    props.structureCount != null ? `${props.structureCount} estructuras` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Document
      title={`NetVision Pro — ${props.projectName}`}
      author="Casa Inteligente · NetVision Pro"
      subject="Plano de diseño CCTV / redes"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{props.projectName || 'Proyecto sin nombre'}</Text>
          {counts || props.planoNombre?.trim() ? (
            <Text style={styles.meta}>
              {props.planoNombre?.trim() ? `Plano: ${props.planoNombre.trim()}` : ''}
              {counts ? `${props.planoNombre?.trim() ? ' · ' : ''}${counts}` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.imageWrap}>
          <Image src={props.imageDataUrl} style={styles.image} />
        </View>
        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            {props.logoSrc ? (
              <Image src={props.logoSrc} style={styles.logo} />
            ) : null}
            <Text style={styles.footerCell}>
              {props.company || 'Casa Inteligente C.A.'}
            </Text>
          </View>
          <Text style={styles.footerCell}>{when}</Text>
          <Text style={styles.footerType}>{props.planType || 'CCTV'}</Text>
        </View>
      </Page>
    </Document>
  )
}

function safeFilename(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\-_.\s]+/gi, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return base || 'netvision-plano'
}

function prefersOpenInsteadOfDownload(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

async function fetchLogoDataUrl(): Promise<string | undefined> {
  if (typeof fetch === 'undefined') return undefined
  try {
    const res = await fetch('/logo-casa-inteligente.png')
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

/** Genera y descarga un PDF A4 apaisado. En iPad no abre un blob (queda en blanco). */
export async function downloadNetVisionPlanPdf(
  input: NetVisionPlanPdfInput,
): Promise<void> {
  if (!input.imageDataUrl?.startsWith('data:image/')) {
    throw new Error('No hay imagen del plano para exportar.')
  }
  if (prefersOpenInsteadOfDownload()) {
    throw new Error(
      'En iPad el PDF se abre con Imprimir / PDF en la página de vista previa.',
    )
  }
  const logoSrc = input.logoSrc ?? (await fetchLogoDataUrl())
  const node = createElement(NetVisionPlanPdfDoc, { ...input, logoSrc })
  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob()
  const filename =
    input.filename?.trim() ||
    `${safeFilename(input.projectName || 'netvision-plano')}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
