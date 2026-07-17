'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Camera, Trash2, Upload, Undo2 } from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import { GlassCardMotion } from '@/components/nexus/GlassCard'
import { Mono } from '@/components/nexus/Mono'
import type { VisionCameraPin } from '@/components/nexus/NexusVisionKonvaStage'

const NexusVisionKonvaStage = dynamic(
  () => import('@/components/nexus/NexusVisionKonvaStage'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-[var(--nexus-text-muted)]">
        Cargando editor Konva…
      </div>
    ),
  },
)

type CamaraPin = {
  id: string
  /** 0–1 normalizado sobre el plano */
  x: number
  y: number
  label: string
}

const STORAGE_KEY = 'nexus.vision.architect.v2'

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

async function renderPdfFirstPage(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el canvas del PDF.')
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.92)
}

function normalizeLegacyPin(c: { id: string; x: number; y: number; label: string }): CamaraPin {
  // v1 guardaba 0–100 %; v2 usa 0–1
  const looksPercent = c.x > 1 || c.y > 1
  return {
    id: c.id,
    label: c.label,
    x: looksPercent ? c.x / 100 : c.x,
    y: looksPercent ? c.y / 100 : c.y,
  }
}

export default function NexusVisionArchitectClient() {
  const [planoUrl, setPlanoUrl] = useState<string | null>(null)
  const [planoNombre, setPlanoNombre] = useState('')
  const [camaras, setCamaras] = useState<CamaraPin[]>([])
  const [modoColocar, setModoColocar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(STORAGE_KEY) ??
        sessionStorage.getItem('nexus.vision.architect.v1')
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        planoUrl?: string
        planoNombre?: string
        camaras?: CamaraPin[]
      }
      if (parsed.planoUrl) setPlanoUrl(parsed.planoUrl)
      if (parsed.planoNombre) setPlanoNombre(parsed.planoNombre)
      if (Array.isArray(parsed.camaras)) {
        setCamaras(parsed.camaras.map(normalizeLegacyPin))
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ planoUrl, planoNombre, camaras }),
      )
    } catch {
      /* ignore quota */
    }
  }, [planoUrl, planoNombre, camaras])

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      let url: string
      if (isPdf) {
        url = await renderPdfFirstPage(file)
      } else if (file.type.startsWith('image/')) {
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
          reader.readAsDataURL(file)
        })
      } else {
        throw new Error('Usa una imagen (JPG/PNG/WEBP) o un PDF.')
      }
      setPlanoUrl(url)
      setPlanoNombre(file.name)
      setCamaras([])
      setSelectedId(null)
      setModoColocar(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el plano')
    } finally {
      setLoading(false)
    }
  }, [])

  const pins: VisionCameraPin[] = useMemo(
    () =>
      camaras.map((c) => ({
        id: c.id,
        name: c.label,
        x: c.x,
        y: c.y,
        selected: c.id === selectedId,
      })),
    [camaras, selectedId],
  )

  const onAddAt = (normX: number, normY: number) => {
    if (!modoColocar || !planoUrl) return
    const n = camaras.length + 1
    const pin: CamaraPin = {
      id: uid(),
      x: Math.round(normX * 1000) / 1000,
      y: Math.round(normY * 1000) / 1000,
      label: `CAM-${String(n).padStart(2, '0')}`,
    }
    setCamaras((prev) => [...prev, pin])
    setSelectedId(pin.id)
  }

  const onMove = (id: string, normX: number, normY: number) => {
    setCamaras((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              x: Math.round(normX * 1000) / 1000,
              y: Math.round(normY * 1000) / 1000,
            }
          : c,
      ),
    )
  }

  const quitar = (id: string) => {
    setCamaras((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const limpiarPlano = () => {
    setPlanoUrl(null)
    setPlanoNombre('')
    setCamaras([])
    setSelectedId(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem('nexus.vision.architect.v1')
    } catch {
      /* ignore */
    }
  }

  const resumen = useMemo(
    () =>
      camaras
        .map(
          (c) =>
            `${c.label}: ${(c.x * 100).toFixed(1)}%, ${(c.y * 100).toFixed(1)}%`,
        )
        .join('\n'),
    [camaras],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Architect · Cámaras</h1>
          <p className="mt-1 text-sm text-[var(--nexus-text-muted)]">
            Carga un PDF o imagen del plano y ubica las cámaras en el lienzo Konva.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="glass"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {loading ? 'Cargando…' : 'Cargar PDF / imagen'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {planoUrl ? (
            <Button type="button" variant="glass" onClick={limpiarPlano}>
              <Undo2 className="mr-2 h-4 w-4" />
              Nuevo plano
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <GlassCardMotion className="overflow-hidden p-3 sm:p-4">
          {!planoUrl ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[rgba(0,242,254,0.35)] bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.12),transparent_70%)] px-4 text-center transition hover:border-[rgba(0,242,254,0.55)]"
            >
              <Camera className="h-10 w-10 text-[var(--nexus-cyan)]" />
              <p className="text-sm font-semibold text-white">Sube el plano del inmueble</p>
              <p className="max-w-sm text-xs text-[var(--nexus-text-dim)]">
                PDF (primera página) o imagen JPG/PNG/WEBP. Luego toca el lienzo Konva para
                colocar cada cámara y arrástrala para reposicionar.
              </p>
            </button>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="truncate text-xs text-[var(--nexus-text-muted)]">
                  <Mono>{planoNombre || 'Plano'}</Mono>
                  {' · '}
                  {camaras.length} cámara{camaras.length === 1 ? '' : 's'}
                </p>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--nexus-cyan)]">
                  <input
                    type="checkbox"
                    checked={modoColocar}
                    onChange={(e) => setModoColocar(e.target.checked)}
                  />
                  Modo colocar cámaras
                </label>
              </div>
              <div
                className={`h-[min(62vh,560px)] w-full overflow-hidden rounded-xl border border-[rgba(0,242,254,0.2)] bg-black ${
                  modoColocar ? 'cursor-crosshair' : 'cursor-default'
                }`}
              >
                <NexusVisionKonvaStage
                  backgroundUrl={planoUrl}
                  cameras={pins}
                  onAddAt={onAddAt}
                  onMove={onMove}
                  onSelect={setSelectedId}
                />
              </div>
              <p className="mt-2 text-[11px] text-[var(--nexus-text-dim)]">
                {modoColocar
                  ? 'Toca el plano vacío para agregar. Arrastra un pin para moverlo. Selecciónalo para editar a la derecha.'
                  : 'Modo colocar desactivado — puedes seleccionar y arrastrar pins sin agregar nuevos.'}
              </p>
            </>
          )}
        </GlassCardMotion>

        <GlassCardMotion delay={0.06} className="space-y-3 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
            Cámaras colocadas
          </h2>
          {camaras.length === 0 ? (
            <p className="text-xs text-[var(--nexus-text-dim)]">
              Aún no hay cámaras. Carga un plano y toca donde irán.
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {camaras.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg border px-2.5 py-2 ${
                    selectedId === c.id
                      ? 'border-[var(--nexus-cyan)] bg-[rgba(0,242,254,0.08)]'
                      : 'border-white/10 bg-black/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={c.label}
                      onChange={(e) =>
                        setCamaras((prev) =>
                          prev.map((x) =>
                            x.id === c.id ? { ...x, label: e.target.value } : x,
                          ),
                        )
                      }
                      onFocus={() => setSelectedId(c.id)}
                      className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs font-semibold text-white outline-none focus:border-[var(--nexus-cyan)]"
                    />
                    <button
                      type="button"
                      onClick={() => quitar(c.id)}
                      className="rounded p-1.5 text-red-300 hover:bg-red-500/20"
                      aria-label={`Quitar ${c.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--nexus-text-dim)]">
                    X {(c.x * 100).toFixed(1)}% · Y {(c.y * 100).toFixed(1)}%
                  </p>
                </li>
              ))}
            </ul>
          )}
          {camaras.length > 0 ? (
            <Button
              type="button"
              variant="glass"
              className="w-full"
              onClick={() => {
                void navigator.clipboard?.writeText(resumen)
              }}
            >
              Copiar lista de posiciones
            </Button>
          ) : null}
        </GlassCardMotion>
      </div>
    </div>
  )
}
