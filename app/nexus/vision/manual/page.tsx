import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import NetVisionManualView from '@/components/netvision/NetVisionManualView'

export const metadata: Metadata = {
  title: 'Manual · NetVision Pro',
  description:
    'Manual explicativo de NetVision Pro: CCTV, redes, cableado, canalizaciones, normativas y BIM.',
}

export default function NetVisionManualPage() {
  const markdown = fs.readFileSync(
    path.join(process.cwd(), 'docs/NETVISION-PRO-MANUAL.md'),
    'utf8',
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/nexus/vision"
          className="inline-flex items-center gap-2 text-sm text-[var(--nexus-cyan)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a NetVision Pro
        </Link>
      </div>
      <NetVisionManualView markdown={markdown} />
    </div>
  )
}
