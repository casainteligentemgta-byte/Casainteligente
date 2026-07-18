import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import NetVisionManualNav from '@/components/netvision/NetVisionManualNav'
import NetVisionManualView from '@/components/netvision/NetVisionManualView'

export const metadata: Metadata = {
  title: 'Guía instaladores · NetVision Pro',
  description:
    'Guía rápida técnica para instaladores: conversiones, cables, PoE, normas, cajetines y canalizaciones.',
}

export default function NetVisionInstallerGuidePage() {
  const markdown = fs.readFileSync(
    path.join(process.cwd(), 'docs/NETVISION-PRO-INSTALLER-GUIDE.md'),
    'utf8',
  )

  return (
    <div className="space-y-4">
      <NetVisionManualNav active="instaladores" />
      <NetVisionManualView markdown={markdown} />
    </div>
  )
}
