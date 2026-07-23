'use client'

import type { BomSummary, NetVisionCurrency } from '@/lib/netvision/types'
import { Mono } from '@/components/nexus/Mono'
import { Button } from '@/components/nexus/ui/button'
import {
  bomMarginTotal,
  bomToCsv,
  bomToExcelXml,
  currencySymbol,
  downloadCsv,
  downloadExcelXml,
} from '@/lib/netvision/utils/exporters'

type Props = {
  bom: BomSummary
  retentionDays: number
  onRetentionChange: (days: number) => void
  projectName: string
  currency: NetVisionCurrency
  distributorMarginPct: number
  onMarginChange: (pct: number) => void
}

export default function BOMGenerator({
  bom,
  retentionDays,
  onRetentionChange,
  projectName,
  currency,
  distributorMarginPct,
  onMarginChange,
}: Props) {
  const sym = currencySymbol(currency)
  const { marginUsd, totalWithMarginUsd } = bomMarginTotal(bom, distributorMarginPct)
  const fileBase = (projectName || 'netvision')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40)

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
                <Mono className="text-[10px] text-[var(--nexus-cyan)]">{l.qty}×</Mono>{' '}
                {l.description}
              </span>
              <span className="shrink-0 text-white">
                {sym}
                {l.totalUsd.toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--nexus-text-dim)]">
        Margen distribuidor
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            value={distributorMarginPct}
            onChange={(e) => onMarginChange(Number(e.target.value) || 0)}
            className="w-14 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-xs text-white"
          />
          %
        </span>
      </label>

      <div className="space-y-0.5 text-sm">
        <p className="flex justify-between text-[var(--nexus-text-muted)]">
          <span>Subtotal</span>
          <Mono>
            {sym}
            {bom.totalUsd.toFixed(2)}
          </Mono>
        </p>
        <p className="flex justify-between text-[var(--nexus-text-muted)]">
          <span>Margen ({distributorMarginPct}%)</span>
          <Mono>
            {sym}
            {marginUsd.toFixed(2)}
          </Mono>
        </p>
        <p className="flex justify-between font-semibold text-white">
          <span>Total {currency}</span>
          <Mono>
            {sym}
            {totalWithMarginUsd.toFixed(2)}
          </Mono>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="glass"
          className="w-full"
          disabled={bom.lines.length === 0}
          onClick={() =>
            downloadCsv(
              `${fileBase}-bom.csv`,
              bomToCsv(bom, {
                marginPct: distributorMarginPct,
                currency,
                projectName,
              }),
            )
          }
        >
          CSV
        </Button>
        <Button
          type="button"
          variant="glass"
          className="w-full"
          disabled={bom.lines.length === 0}
          onClick={() =>
            downloadExcelXml(
              `${fileBase}-bom.xls`,
              bomToExcelXml(bom, {
                projectName: projectName || 'NetVision',
                marginPct: distributorMarginPct,
                currency,
              }),
            )
          }
        >
          Excel
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
      <p className="text-[10px] uppercase text-[var(--nexus-text-dim)]">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  )
}
