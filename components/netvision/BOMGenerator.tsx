'use client'

import type { BomSummary } from '@/lib/netvision/types'
import { Mono } from '@/components/nexus/Mono'
import { Button } from '@/components/nexus/ui/button'
import { bomToCsv, downloadCsv } from '@/lib/netvision/utils/exporters'

type Props = {
  bom: BomSummary
  retentionDays: number
  onRetentionChange: (days: number) => void
}

export default function BOMGenerator({ bom, retentionDays, onRetentionChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--nexus-text-muted)]">
          BOM / Specs
        </h2>
        <label className="flex items-center gap-2 text-[11px] text-[var(--nexus-text-dim)]">
          Retención
          <input
            type="number"
            min={1}
            max={365}
            value={retentionDays}
            onChange={(e) => onRetentionChange(Number(e.target.value) || 30)}
            className="w-14 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-xs text-white"
          />
          días
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="PoE" value={`${bom.totalPoeWatts.toFixed(1)} W`} />
        <Stat label="Ancho de banda" value={`${bom.totalBandwidthMbps.toFixed(1)} Mbps`} />
        <Stat label="Storage" value={`${bom.storageTb} TB`} />
        <Stat label="Canales NVR" value={String(bom.nvrChannels)} />
      </div>

      {bom.lines.length === 0 ? (
        <p className="text-xs text-[var(--nexus-text-dim)]">Coloca cámaras para generar el BOM.</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-auto text-[11px]">
          {bom.lines.map((l) => (
            <li
              key={`${l.sku}-${l.description}`}
              className="flex justify-between gap-2 border-b border-white/5 py-1 text-[var(--nexus-text-muted)]"
            >
              <span className="min-w-0 truncate">
                <Mono className="text-[10px] text-[var(--nexus-cyan)]">{l.qty}×</Mono> {l.description}
              </span>
              <span className="shrink-0 text-white">${l.totalUsd.toFixed(0)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm font-semibold text-white">
        Total <Mono>${bom.totalUsd.toFixed(2)}</Mono>
      </p>

      <Button
        type="button"
        variant="glass"
        className="w-full"
        disabled={bom.lines.length === 0}
        onClick={() => downloadCsv('netvision-bom.csv', bomToCsv(bom))}
      >
        Exportar BOM (CSV)
      </Button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
      <p className="text-[10px] uppercase text-[var(--nexus-text-dim)]">{label}</p>
      <p className="font-semibold text-white">
        <Mono>{value}</Mono>
      </p>
    </div>
  )
}
