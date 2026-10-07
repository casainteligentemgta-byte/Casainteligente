'use client'

import type { ClientePresupuestoSnapshot } from '@/lib/netvision/types'
import { formatoMonto } from '@/lib/netvision/utils/moneda'

function fechaOferta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Props = {
  oferta: ClientePresupuestoSnapshot
  compact?: boolean
}

/** Tabla de inversión para la vista cliente (sin costos ni margen). */
export default function NetVisionClientePresupuesto({ oferta, compact }: Props) {
  const { moneda, tasaCambio, renglones, subtotalUsd, nota, publicadoAt } = oferta
  const monto = (usd: number) => formatoMonto(usd, moneda, tasaCambio)
  const fecha = fechaOferta(publicadoAt)

  return (
    <section
      data-nv-cliente-inversion
      className={`flex min-h-0 flex-col border border-[#2e7d54] bg-[#0b1a14] ${compact ? 'p-2.5' : 'p-3'}`}
    >
      <header className="shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5fbf8a]">
          Inversión
        </p>
        {fecha ? (
          <p className="mt-0.5 text-[11px] text-[#a9e8c4]">Oferta del {fecha}. No cambia sola si el plano se edita.</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-[#a9e8c4]">Oferta congelada al compartir el enlace.</p>
        )}
      </header>
      <div className="mt-2 min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px] text-[#d6ffe5]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-[#5fbf8a]">
              <th className="pb-1.5 pr-2 font-semibold">Ítem</th>
              <th className="pb-1.5 pr-2 text-right font-semibold">Cant.</th>
              <th className="pb-1.5 pr-2 text-right font-semibold">Unitario</th>
              <th className="pb-1.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {renglones.map((r, i) => (
              <tr key={`${r.descripcion}-${i}`} className="border-t border-[#2e7d54]/70">
                <td className="py-1.5 pr-2 leading-snug">{r.descripcion}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.qty}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{monto(r.unitUsd)}</td>
                <td className="py-1.5 text-right tabular-nums font-semibold">
                  {monto(r.qty * r.unitUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="mt-2 shrink-0 border-t border-[#2e7d54] pt-2">
        <p className="flex items-baseline justify-between gap-2 text-[#d6ffe5]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5fbf8a]">
            Total
          </span>
          <span data-nv-cliente-inversion-total className="text-xl font-bold tabular-nums">
            {monto(subtotalUsd)}
          </span>
        </p>
        {moneda !== 'USD' && tasaCambio != null ? (
          <p className="mt-0.5 text-[10px] text-[#a9e8c4]">
            Montos en {moneda === 'VES' ? 'bolívares' : 'euros'} (tasa {tasaCambio} por $).
          </p>
        ) : null}
        {nota ? <p className="mt-1.5 text-[11px] leading-snug text-[#a9e8c4]">{nota}</p> : null}
      </footer>
    </section>
  )
}
