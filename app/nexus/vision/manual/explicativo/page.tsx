import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import NetVisionManualNav from '@/components/netvision/NetVisionManualNav'
import NetVisionManualView from '@/components/netvision/NetVisionManualView'

export const metadata: Metadata = {
  title: 'Manual explicativo · NetVision Pro',
  description:
    'Manual explicativo de NetVision Pro: CCTV, redes, cableado, canalizaciones, normativas y BIM.',
}

export default function NetVisionExplicativeManualPage() {
  const markdown = fs.readFileSync(
    path.join(process.cwd(), 'docs/NETVISION-PRO-MANUAL.md'),
    'utf8',
  )

  return (
    <div className="space-y-4">
      <NetVisionManualNav active="explicativo" />
      <NetVisionManualView markdown={markdown} />
    </div>
  )
}
