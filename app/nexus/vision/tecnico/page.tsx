import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NetVisionTecnicoChat from '@/components/netvision/NetVisionTecnicoChat'

export const metadata: Metadata = {
  title: 'Técnico IA · NetVision Pro',
  description:
    'Técnico de dispositivos con IA: cámaras, grabadores, PoE y redes, con el catálogo de NetVision.',
}

export default function NetVisionTecnicoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        href="/nexus/vision"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--nexus-cyan)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a NetVision Pro
      </Link>
      <NetVisionTecnicoChat />
    </div>
  )
}
