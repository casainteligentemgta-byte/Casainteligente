'use client';

import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import {
  exportarReporteClienteExcel,
  REPORTE_CLIENTE_HEADERS,
  type ReporteClienteFila,
} from '@/lib/contabilidad/reporteClienteCompras';
import { exportarReporteClientePdf } from '@/lib/contabilidad/reporteClientePrintHtml';
import type { ComprasExportScope } from '@/lib/contabilidad/comprasExportShare';
import { formatearBs, formatearTasaBcv, formatearUsd } from '@/lib/contabilidad/comprasMontos';

type Props = {
  open: boolean;
  filas: ReporteClienteFila[];
  scope: ComprasExportScope;
  subtitulo?: string;
  onClose: () => void;
};

export default function ReporteClienteComprasModal({
  open,
  filas,
  scope,
  subtitulo,
  onClose,
}: Props) {
  if (!open) return null;

  const exportarExcel = () => {
    exportarReporteClienteExcel(filas, scope);
  };

  const exportarPdf = () => {
    try {
      exportarReporteClientePdf(filas, { subtitulo });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo abrir el PDF');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reporte-cliente-titulo"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0A0A0F] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" aria-hidden />
              <h2 id="reporte-cliente-titulo" className="text-lg font-bold text-white">
                Reporte Cliente
              </h2>
            </div>
            {subtitulo ? (
              <p className="mt-1 text-xs text-zinc-500">{subtitulo}</p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-400">
              {filas.length} factura{filas.length === 1 ? '' : 's'} · una fila por factura · máx. 3
              artículos en columna
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 py-3 sm:px-4">
          {filas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No hay facturas para el reporte con los filtros actuales.
            </p>
          ) : (
            <table className="w-full min-w-[880px] border-collapse text-left text-xs text-zinc-200">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  {REPORTE_CLIENTE_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2.5 font-bold uppercase tracking-wide text-zinc-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((row, i) => (
                  <tr
                    key={`${row.factura}-${row.fecha}-${i}`}
                    className="border-b border-white/[0.06] align-top hover:bg-white/[0.03]"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5">{row.fecha || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-white">
                      {row.factura || '—'}
                    </td>
                    <td className="max-w-[160px] px-3 py-2.5" title={row.proveedor}>
                      {row.proveedor || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.rif || '—'}</td>
                    <td className="min-w-[180px] max-w-[260px] px-3 py-2.5">
                      {row.articulosLista.length ? (
                        <div className="flex flex-col gap-1">
                          {row.articulosLista.map((art, j) => (
                            <div
                              key={`${row.factura}-art-${j}`}
                              className={
                                j > 0
                                  ? 'border-t border-dashed border-white/10 pt-1 leading-snug text-zinc-300'
                                  : 'leading-snug text-zinc-300'
                              }
                            >
                              {art}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {row.totalArticulos.toLocaleString('es-VE')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatearBs(row.montoTotalBs)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-emerald-300">
                      {formatearUsd(row.montoUsd)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-zinc-400">
                      {row.tasaBcv != null ? formatearTasaBcv(row.tasaBcv) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={!filas.length}
            onClick={exportarPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/45 bg-violet-500/15 px-4 py-2 text-xs font-bold text-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileText size={14} />
            Ver PDF
          </button>
          <button
            type="button"
            disabled={!filas.length}
            onClick={exportarExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} />
            Excel
          </button>
        </div>
      </div>
    </div>
  );
}
