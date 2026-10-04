'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import CameraPlacementTool from '@/components/netvision/CameraPlacementTool'
import NetVisionCompanyMark from '@/components/netvision/NetVisionCompanyMark'
import { loadProject, peekLocalProject } from '@/lib/netvision/storage'
import { buildCoverageSectors } from '@/lib/netvision/services/coverageCalculator'
import {
  buildCableRoutes,
  withManualCableSegments,
} from '@/lib/netvision/services/cableRoutingEngine'
import { normalizeCotaColor } from '@/lib/netvision/utils/nightPlanoPalette'
import { buildPlanoRotulo } from '@/lib/netvision/utils/planoRotulo'
import {
  buildPlanoPrintMeta,
  loadPlanoPrintPayload,
  type PlanoPrintPayload,
} from '@/lib/netvision/utils/planoPrint'
import type { NetVisionProject } from '@/lib/netvision/types'

function loadPrintProject(id: string | null): NetVisionProject | null {
  if (id) return peekLocalProject(id) ?? loadProject()
  try {
    return loadProject()
  } catch {
    return null
  }
}

function payloadFromProject(
  project: NetVisionProject,
  branch?: string | null,
): PlanoPrintPayload {
  return {
    v: 1,
    projectId: project.id,
    returnHref: '/nexus/vision',
    imageDataUrl: '',
    rotulo: buildPlanoRotulo({
      projectName: project.name,
      branch: branch || 'cctv',
    }),
    planoNombre: project.planoNombre,
    cameraCount: project.cameras.length,
    networkCount: project.networkNodes.length,
    structureCount: (project.structures ?? []).length,
  }
}

export default function NetVisionPlanoPrintView() {
  const search = useSearchParams()
  const router = useRouter()
  const [payload, setPayload] = useState<PlanoPrintPayload | null>(null)
  const [project, setProject] = useState<NetVisionProject | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = search.get('id')
    const stored = loadPlanoPrintPayload(id)
    const loaded = loadPrintProject(id)
    setProject(loaded)
    if (stored?.rotulo) {
      setPayload(stored)
    } else if (loaded) {
      setPayload(payloadFromProject(loaded, search.get('rama')))
    } else {
      setPayload(null)
    }
    setReady(true)
  }, [search])

  const sectors = useMemo(() => {
    if (!project) return []
    return buildCoverageSectors(
      project.cameras,
      project.scale,
      'day',
      project.structures ?? [],
    )
  }, [project])

  const cableRoutes = useMemo(() => {
    if (!project) return []
    return withManualCableSegments(
      buildCableRoutes(
        project.cameras,
        project.networkNodes,
        project.scale,
        project.cableRouteOverrides ?? {},
      ),
      project.cableSegments ?? [],
      project.scale,
    )
  }, [project])

  const meta = payload ? buildPlanoPrintMeta(payload) : ''
  const hasImage = Boolean(payload?.imageDataUrl?.startsWith('data:image/'))

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(payload?.returnHref || '/nexus/vision')
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        Preparando el plano…
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">No hay un plano para imprimir.</p>
        <p className="mt-2">
          Vuelve al editor, abre el proyecto y pulsa <strong>PDF</strong> otra vez.
        </p>
        <button
          type="button"
          onClick={goBack}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
      </div>
    )
  }

  return (
    <div className="nv-plano-print min-h-dvh bg-slate-200 text-slate-900">
      <div className="nv-print-toolbar print:hidden sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Atrás
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
        <p className="basis-full text-[12px] text-slate-500">
          En iPad: pulsa Imprimir / PDF y elige Guardar en Archivos. Atrás vuelve al editor.
        </p>
      </div>

      <div className="mx-auto max-w-[297mm] px-3 py-4 print:max-w-none print:p-0">
        <article className="nv-print-sheet overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <header className="border-b border-slate-300 px-5 py-3 text-center">
            <h1 className="text-lg font-bold uppercase tracking-[0.12em] text-slate-900 sm:text-xl">
              {payload.rotulo.projectName}
            </h1>
            {meta ? (
              <p className="mt-1 text-[12px] text-slate-600">{meta}</p>
            ) : null}
          </header>

          <div className="min-h-[42vh] bg-white print:min-h-0">
            {hasImage ? (
              <img
                src={payload.imageDataUrl}
                alt={payload.rotulo.projectName}
                className="mx-auto block h-auto max-h-[70vh] w-full object-contain print:max-h-[78vh]"
              />
            ) : project?.planoUrl ? (
              <div className="h-[min(70vh,720px)] min-h-[320px] print:h-[70vh]">
                <CameraPlacementTool
                  backgroundUrl={project.planoUrl}
                  invertBackground={Boolean(project.planoInvertido)}
                  invertOptions={{
                    cotaColor: normalizeCotaColor(project.planoCotaColor),
                    grosorMuro: project.planoGrosorMuro,
                  }}
                  wallStrokeGrosor={project.planoGrosorMuro}
                  cameras={project.cameras}
                  networkNodes={project.networkNodes}
                  planDevices={project.planDevices}
                  structures={project.structures}
                  sectors={sectors}
                  wifiCircles={[]}
                  linkLines={[]}
                  cableRoutes={cableRoutes}
                  selectedId={null}
                  placeMode={false}
                  showFov
                  visionOpacity={0.28}
                  showWifi={false}
                  showLinks={false}
                  showCableRoutes
                  showStructures
                  readOnly
                  onAddAt={() => undefined}
                  onMove={() => undefined}
                  metersPerNormX={project.scale.metersPerNormX}
                  metersPerNormY={project.scale.metersPerNormY}
                  onSelect={() => undefined}
                  showZoomOverlay={false}
                />
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-600">
                No hay captura del plano. Pulsa Atrás y vuelve a exportar el PDF.
              </p>
            )}
          </div>

          <footer className="grid grid-cols-3 items-center gap-2 border-t border-slate-300 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-700 sm:text-xs">
            <NetVisionCompanyMark
              company={payload.rotulo.company}
              size={32}
              className="text-slate-800"
            />
            <span className="truncate text-center">{payload.rotulo.dateLabel}</span>
            <span className="truncate text-right text-cyan-800">
              {payload.rotulo.planType}
            </span>
          </footer>
        </article>
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; }
          .nv-print-toolbar { display: none !important; }
          .nv-plano-print { background: #fff !important; }
          .nv-print-sheet { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
