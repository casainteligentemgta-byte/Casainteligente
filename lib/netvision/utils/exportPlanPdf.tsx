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
  /** Data URL PNG/JPEG del Stage Konva */
  imageDataUrl: string
  projectName: string
  planoNombre?: string
  cameraCount?: number
  networkCount?: number
  structureCount?: number
  /** Fecha ISO o texto ya formateado */
  generatedAt?: string
  filename?: string
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
    marginBottom: 12,
  },
  brand: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#67e8f9',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f8fafc',
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: '#94a3b8',
    marginBottom: 2,
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
  footer: {
    marginTop: 10,
    fontSize: 8,
    color: '#64748b',
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
          <Text style={styles.brand}>NetVision Pro</Text>
          <Text style={styles.title}>{props.projectName || 'Proyecto sin nombre'}</Text>
          <Text style={styles.meta}>
            Plano: {props.planoNombre?.trim() || '—'}
            {counts ? ` · ${counts}` : ''}
          </Text>
          <Text style={styles.meta}>Generado: {when}</Text>
        </View>
        <View style={styles.imageWrap}>
          <Image src={props.imageDataUrl} style={styles.image} />
        </View>
        <Text style={styles.footer}>
          Casa Inteligente · casainteligente.company · Exportación del plano NetVision
        </Text>
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

/** Genera y descarga un PDF A4 apaisado con la captura del plano. */
export async function downloadNetVisionPlanPdf(
  input: NetVisionPlanPdfInput,
): Promise<void> {
  if (!input.imageDataUrl?.startsWith('data:image/')) {
    throw new Error('No hay imagen del plano para exportar.')
  }
  const node = createElement(NetVisionPlanPdfDoc, input)
  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob()
  const filename =
    input.filename?.trim() ||
    `${safeFilename(input.projectName || 'netvision-plano')}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
