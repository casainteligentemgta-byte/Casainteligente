'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const NetVisionPlanoPrintView = dynamic(
  () => import('@/components/netvision/NetVisionPlanoPrintView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        Preparando el plano…
      </div>
    ),
  },
)

export default function NetVisionPlanoImprimirPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
          Preparando el plano…
        </div>
      }
    >
      <NetVisionPlanoPrintView />
    </Suspense>
  )
}
