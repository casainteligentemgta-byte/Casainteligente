'use client'

import { useMemo } from 'react'
import { Button } from '@/components/nexus/ui/button'
import { buildDiagramModel } from '@/lib/netvision/services/diagramBuilder'
import {
  diagramToSvg,
  downloadSvg,
  downloadSvgAsPng,
} from '@/lib/netvision/utils/diagramSvg'
import type {
  DesignCamera,
  DesignNetworkNode,
  ScaleCalibration,
} from '@/lib/netvision/types'

type Props = {
  cameras: DesignCamera[]
  networkNodes: DesignNetworkNode[]
  scale: ScaleCalibration
  planoNombre: string
  onSelectNode?: (id: string) => void
  /** Si true, ocupa el área principal del editor */
  expanded?: boolean
}

export default function DiagramGenerator({
  cameras,
  networkNodes,
  scale,
  planoNombre,
  onSelectNode,
  expanded = false,
}: Props) {
  const model = useMemo(
    () => buildDiagramModel(cameras, networkNodes, scale, planoNombre),
    [cameras, networkNodes, scale, planoNombre],
  )
  const svg = useMemo(() => diagramToSvg(model), [model])

  const empty = cameras.length === 0 && networkNodes.length === 0

  return (
    <div className={`space-y-3 ${expanded ? 'h-full' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
            Diagrama unifilar
          </h2>
          <p className="text-[11px] text-[var(--nexus-text-dim)]">
            Se actualiza en cascada al mover equipos · {model.nodes.length} nodos ·{' '}
            {model.edges.length} enlaces
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="glass"
            className="text-[11px]"
            disabled={empty}
            onClick={() => downloadSvg('netvision-unifilar.svg', svg)}
          >
            SVG
          </Button>
          <Button
            type="button"
            variant="glass"
            className="text-[11px]"
            disabled={empty}
            onClick={() => void downloadSvgAsPng('netvision-unifilar.png', svg)}
          >
            PNG
          </Button>
        </div>
      </div>

      {empty ? (
        <p className="rounded-lg border border-dashed border-white/15 px-3 py-8 text-center text-xs text-[var(--nexus-text-dim)]">
          Coloca cámaras o nodos de red para generar el esquema técnico.
        </p>
      ) : (
        <div
          className={`overflow-auto rounded-xl border border-[rgba(0,242,254,0.2)] bg-[#0b1220] ${
            expanded ? 'h-[min(62vh,560px)]' : 'max-h-[420px]'
          }`}
        >
          <div
            className="min-w-full p-2"
            // SVG interactivo: click en nodos vía overlay HTML absolutos
            style={{ position: 'relative', width: model.width, minHeight: model.height + 28 }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: svg }}
              className="pointer-events-none"
            />
            {onSelectNode
              ? model.nodes
                  .filter((n) => n.id !== '__core__')
                  .map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      title={n.label}
                      aria-label={`Seleccionar ${n.label}`}
                      onClick={() => onSelectNode(n.id)}
                      className="absolute rounded-lg border border-transparent hover:border-white/50 focus:border-[var(--nexus-cyan)] focus:outline-none"
                      style={{
                        left: n.x,
                        top: n.y + 8,
                        width: n.w,
                        height: n.h,
                      }}
                    />
                  ))
              : null}
          </div>
        </div>
      )}

      {!empty ? (
        <ul className="flex flex-wrap gap-2 text-[10px] text-[var(--nexus-text-dim)]">
          <Legend color="#22d3ee" label="Cámara" />
          <Legend color="#a78bfa" label="Switch" />
          <Legend color="#34d399" label="AP" />
          <Legend color="#fbbf24" label="NVR" />
          <Legend color="#fb7185" label="Injector" />
        </ul>
      ) : null}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </li>
  )
}
