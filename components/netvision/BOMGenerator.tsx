'use client'

import { useEffect, useState } from 'react'
import type { BomSummary, NetVisionCurrency, ZanjaModo } from '@/lib/netvision/types'
import NetVisionPresupuestoModal from '@/components/netvision/NetVisionPresupuestoModal'
import NetVisionZanjaModo from '@/components/netvision/NetVisionZanjaModo'
import { Mono } from '@/components/nexus/Mono'
import { Button } from '@/components/nexus/ui/button'
import {
  bomMarginTotal,
  bomToCsv,
  bomToExcelXml,
  downloadCsv,
  downloadExcelXml,
} from '@/lib/netvision/utils/exporters'
import {
  etiquetaTasa,
  faltaTasa,
  formatoMonto,
  monedaEfectiva,
  normalizarTasa,
} from '@/lib/netvision/utils/moneda'

type Props = {
  bom: BomSummary
  retentionDays: number
  onRetentionChange: (days: number) => void
  projectName: string
  currency: NetVisionCurrency
  /** Tasa de cambio del proyecto (unidades de la moneda por 1 USD). */
  tasaCambio?: number
  onTasaChange?: (tasa: number | undefined) => void
  distributorMarginPct: number
  onMarginChange: (pct: number) => void
  /** Zanja: solo se cobra si se elige «cobrar». */
  zanjaModo?: ZanjaModo
  /** Metros de canalización subterránea del plano. */
  zanjaMetros?: number
  onZanjaModo?: (modo: ZanjaModo) => void
  /** Cliente escrito en el proyecto (se propone al crear el presupuesto). */
  projectClient?: string
}

export default function BOMGenerator({
  bom,
  retentionDays,
  onRetentionChange,
  projectName,
  currency,
  tasaCambio,
  onTasaChange,
  distributorMarginPct,
  onMarginChange,
  zanjaModo = 'no_cobrar',
  zanjaMetros = 0,
  onZanjaModo,
  projectClient = '',
}: Props) {
  const [presupuestoAbierto, setPresupuestoAbierto] = useState(false)
  const { marginUsd, totalWithMarginUsd } = bomMarginTotal(bom, distributorMarginPct)
  // Los precios base están en dólares: se convierten solo si hay tasa.
  const monto = (usd: number, decimales = 2) => formatoMonto(usd, currency, tasaCambio, decimales)
  const moneda = monedaEfectiva(currency, tasaCambio)
  const sinTasa = faltaTasa(currency, tasaCambio)
  const [tasaTexto, setTasaTexto] = useState(tasaCambio ? String(tasaCambio) : '')
  const [tasaMsg, setTasaMsg] = useState<string | null>(null)
  useEffect(() => {
    setTasaTexto(tasaCambio ? String(tasaCambio) : '')
  }, [tasaCambio, currency])

  const usarTasaBcv = async () => {
    setTasaMsg('Consultando la tasa del BCV…')
    try {
      const res = await fetch('/api/finanzas/bcv-tasa', { cache: 'no-store' })
      const data = (await res.json()) as {
        fecha?: string
        tasa_bcv_ves_por_usd?: unknown
        fuente?: string
      }
      const tasa = normalizarTasa(data?.tasa_bcv_ves_por_usd)
      // «fallback» es un valor de relleno del sistema, no la tasa real: no se usa.
      if (!res.ok || tasa == null || data.fuente === 'fallback') {
        setTasaMsg('No se pudo consultar la tasa del BCV. Escríbela a mano.')
        return
      }
      onTasaChange?.(tasa)
      const origen =
        data.fuente === 'ci_config_nomina'
          ? 'configuración de nómina'
          : data.fuente === 'env'
            ? 'configuración del sistema'
            : 'BCV'
      setTasaMsg(`Tasa ${tasa} del ${data.fecha ?? 'día'} (${origen}). Puedes corregirla.`)
    } catch {
      setTasaMsg('No se pudo consultar la tasa del BCV. Escríbela a mano.')
    }
  }
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
              <span className="shrink-0 text-white">{monto(l.totalUsd, 0)}</span>
            </li>
          ))}
        </ul>
      )}

      {zanjaMetros > 0 && onZanjaModo ? (
        <NetVisionZanjaModo modo={zanjaModo} metros={zanjaMetros} onChange={onZanjaModo} />
      ) : null}

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

      {currency !== 'USD' ? (
        <div
          data-nv-tasa={sinTasa ? 'falta' : 'ok'}
          className={`space-y-1.5 rounded-md border p-2 text-[11px] ${
            sinTasa ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/10 bg-black/20'
          }`}
        >
          <label className="flex items-center justify-between gap-2 text-[var(--nexus-text-dim)]">
            Tasa de cambio ({etiquetaTasa(currency)})
            <input
              data-nv-tasa-input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={tasaTexto}
              placeholder="0.00"
              onChange={(e) => {
                setTasaTexto(e.target.value)
                setTasaMsg(null)
                if (e.target.value.trim() === '') {
                  onTasaChange?.(undefined)
                  return
                }
                const t = normalizarTasa(e.target.value)
                if (t != null) onTasaChange?.(t)
              }}
              onBlur={() => setTasaTexto(tasaCambio ? String(tasaCambio) : '')}
              className="min-h-9 w-24 rounded border border-white/15 bg-black/40 px-2 text-right text-xs font-semibold text-white"
            />
          </label>
          {currency === 'VES' ? (
            <button
              type="button"
              data-nv-tasa-bcv
              onClick={() => void usarTasaBcv()}
              className="min-h-9 rounded-md border border-white/15 px-2.5 font-semibold text-[var(--nexus-cyan)]"
            >
              Usar la tasa BCV de hoy
            </button>
          ) : null}
          <p className={sinTasa ? 'text-amber-50' : 'text-[var(--nexus-text-dim)]'}>
            {tasaMsg ??
              (sinTasa
                ? `Los precios están en dólares. Escribe la tasa para verlos en ${currency}; mientras tanto se muestran en dólares.`
                : 'Los precios base están en dólares y se convierten con esta tasa.')}
          </p>
        </div>
      ) : null}

      <div className="space-y-0.5 text-sm">
        <p className="flex justify-between text-[var(--nexus-text-muted)]">
          <span>Subtotal</span>
          <Mono>{monto(bom.totalUsd)}</Mono>
        </p>
        <p className="flex justify-between text-[var(--nexus-text-muted)]">
          <span>Margen ({distributorMarginPct}%)</span>
          <Mono>{monto(marginUsd)}</Mono>
        </p>
        <p className="flex justify-between font-semibold text-white">
          <span>Total {moneda}</span>
          <span data-nv-bom-total>
            <Mono>{monto(totalWithMarginUsd)}</Mono>
          </span>
        </p>
        {moneda !== 'USD' ? (
          <p className="flex justify-between text-[11px] text-[var(--nexus-text-dim)]">
            <span>Equivale en dólares</span>
            <Mono>{formatoMonto(totalWithMarginUsd, 'USD', null)}</Mono>
          </p>
        ) : null}
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
                tasa: tasaCambio,
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
                tasa: tasaCambio,
              }),
            )
          }
        >
          Excel
        </Button>
      </div>

      <div data-nv-crear-presupuesto>
        <Button
          type="button"
          className="w-full"
          disabled={bom.lines.length === 0}
          onClick={() => setPresupuestoAbierto(true)}
        >
          Crear presupuesto en Ventas
        </Button>
      </div>

      {presupuestoAbierto ? (
        <NetVisionPresupuestoModal
          bom={bom}
          projectName={projectName}
          projectClient={projectClient}
          margenPct={distributorMarginPct}
          onClose={() => setPresupuestoAbierto(false)}
        />
      ) : null}
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
