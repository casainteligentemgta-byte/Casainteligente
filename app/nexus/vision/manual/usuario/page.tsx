import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import NetVisionManualNav from '@/components/netvision/NetVisionManualNav'
import NetVisionManualView from '@/components/netvision/NetVisionManualView'

export const metadata: Metadata = {
  title: 'Cómo manejar NetVision · NetVision Pro',
  description:
    'Guía paso a paso para manejar NetVision Pro: plano, CCTV, red, cableado, validación y exportación.',
}

export default function NetVisionUserManualPage() {
  const markdown = fs.readFileSync(
    path.join(process.cwd(), 'docs/NETVISION-PRO-USER-MANUAL.md'),
    'utf8',
  )

  return (
    <div className="space-y-4">
      <NetVisionManualNav active="usuario" />
      <NetVisionManualView markdown={markdown} />
    </div>
  )
}
