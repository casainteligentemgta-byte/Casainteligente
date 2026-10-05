'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import CameraPlacementTool from '@/components/netvision/CameraPlacementTool'
import NetVisionPlanoPrintSheet from '@/components/netvision/NetVisionPlanoPrintSheet'
import { loadProject, peekLocalProject } from '@/lib/netvision/storage'
import { buildCoverageSectors } from '@/lib/netvision/services/coverageCalculator'
import {
  buildCableRoutes,
  withManualCableSegments,
} from '@/lib/netvision/services/cableRoutingEngine'
import { normalizeCotaColor } from '@/lib/netvision/utils/nightPlanoPalette'
import { buildPlanoRotulo } from '@/lib/netvision/utils/planoRotulo'
import {
  loadPlanoPrintPayload,
  sugerirNombrePdfPlano,
  tituloPdfDesdeNombre,
  type PlanoPrintPayload,
} from '@/lib/netvision/utils/planoPrint'
import {
  PLANO_PRINT_TEMAS,
  PLANO_PRINT_TEMA_DEFAULT,
  PLANO_PRINT_TEMA_LABEL,
  PLANO_PRINT_TEMA_PAGE_BG,
  loadPlanoPrintTema,
  savePlanoPrintTema,
  type PlanoPrintTema,
} from '@/lib/netvision/utils/planoPrintTema'
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
  const [tema, setTema] = useState<PlanoPrintTema>(PLANO_PRINT_TEMA_DEFAULT)
  const [pdfNombre, setPdfNombre] = useState('')

  useEffect(() => {
    setTema(loadPlanoPrintTema(search.get('tema')))
  }, [search])

  const elegirTema = (next: PlanoPrintTema) => {
    setTema(next)
    savePlanoPrintTema(next)
  }

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

  useEffect(() => {
    if (!payload) return
    setPdfNombre((prev) => {
      if (prev.trim()) return prev
      return sugerirNombrePdfPlano({
        projectName: payload.rotulo.projectName,
        planoNombre: payload.planoNombre,
      })
    })
  }, [payload])

  useEffect(() => {
    if (!pdfNombre.trim()) return
    const prev = document.title
    document.title = tituloPdfDesdeNombre(pdfNombre)
    return () => {
      document.title = prev
    }
  }, [pdfNombre])

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

  const hasImage = Boolean(payload?.imageDataUrl?.startsWith('data:image/'))
  const pageBg = PLANO_PRINT_TEMA_PAGE_BG[tema]

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
        <label className="flex min-w-[14rem] flex-1 items-center gap-2">
          <span className="shrink-0 text-[12px] font-semibold uppercase tracking-wide text-slate-600">
            Nombre del PDF
          </span>
          <input
            type="text"
            value={pdfNombre}
            onChange={(e) => setPdfNombre(e.target.value)}
            placeholder="Santa sofía baja 2"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
            aria-label="Nombre del archivo PDF"
          />
          <span className="shrink-0 text-sm font-semibold text-slate-500">.pdf</span>
        </label>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
        <div
          role="group"
          aria-label="Tema de la hoja"
          className="flex basis-full flex-wrap items-center gap-2"
        >
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">
            Tema de la hoja
          </span>
          {PLANO_PRINT_TEMAS.map((t) => (
            <button
              key={t}
              type="button"
              data-nv-print-tema={t}
              aria-pressed={tema === t}
              onClick={() => elegirTema(t)}
              className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${
                tema === t
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {PLANO_PRINT_TEMA_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="basis-full text-[12px] text-slate-500">
          El archivo se guarda con el nombre de arriba (por ejemplo Santa sofía
          baja 2.pdf). En iPad: Imprimir / PDF → Guardar en Archivos. Atrás
          vuelve al editor.
        </p>
      </div>

      <div className="mx-auto max-w-[297mm] px-3 py-4 print:max-w-none print:p-0">
        <div className="overflow-hidden rounded-lg shadow-sm print:rounded-none print:shadow-none">
          <NetVisionPlanoPrintSheet
            tema={tema}
            payload={payload}
            livePlano={
              !hasImage && project?.planoUrl ? (
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
              ) : null
            }
          />
        </div>
      </div>

      <style>{`
        /* Líneas de barrido del tema táctico (el plano las tapa). */
        .nv-print-scan {
          background-image: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.22) 0px,
            rgba(0, 0, 0, 0.22) 1px,
            transparent 1px,
            transparent 3px
          );
        }
        /* En tablet/escritorio la hoja se ve con proporción A4 y el plano llena su recuadro. */
        @media (min-width: 640px) {
          .nv-print-sheet { aspect-ratio: 297 / 210; }
          .nv-print-plano { flex: 1 1 0%; min-height: 0; }
          .nv-print-plano > img,
          .nv-print-plano > .nv-print-live {
            position: absolute;
            inset: 1px;
            width: calc(100% - 2px);
            height: calc(100% - 2px);
            max-height: none;
            min-height: 0;
            object-fit: contain;
          }
        }
        /* Hoja a sangre: la página toma el color del tema para que no queden bordes blancos. */
        @page { size: A4 landscape; margin: 0; }
        @media print {
          /* 209 mm: llena una A4 apaisada sin pasar a una segunda página. */
          .nv-print-sheet { aspect-ratio: auto; min-height: 209mm; }
          .nv-print-plano { flex: 1 1 0%; min-height: 0; }
          .nv-print-plano > img,
          .nv-print-plano > .nv-print-live {
            position: absolute;
            inset: 1px;
            width: calc(100% - 2px);
            height: calc(100% - 2px);
            max-height: none;
            min-height: 0;
            object-fit: contain;
          }
          html, body {
            background: ${pageBg} !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .nv-print-toolbar { display: none !important; }
          .nv-plano-print,
          div:has(> .nv-plano-print) {
            background: ${pageBg} !important;
            min-height: 0 !important;
          }
          .nv-print-sheet, .nv-print-sheet * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .nv-print-sheet { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
