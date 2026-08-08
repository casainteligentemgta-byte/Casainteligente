'use client';

import { Files, Loader2, Printer, RefreshCw, ScanLine, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ResultadoEscaneoMasivoItem =
  | { ok: true; archivo: string; obrero: string }
  | { ok: false; archivo: string; error: string };

type Props = {
  proyectoId: string;
  rowsCount: number;
  selectedCount: number;
  algunoSeleccionado: boolean;
  busyPdfLote: boolean;
  loadingLista: boolean;
  importandoEscaneos: boolean;
  resultadosEscaneo: ResultadoEscaneoMasivoItem[] | null;
  onPdfUnico: (abrirParaImprimir: boolean) => void;
  onActualizar: () => void;
  onCargaMasivaEscaneos: () => void;
};

/** Panel de escaneos firmados + toolbar de lista (PDF único / actualizar). */
export default function ContratosExpressListaToolbar({
  proyectoId,
  rowsCount,
  selectedCount,
  algunoSeleccionado,
  busyPdfLote,
  loadingLista,
  importandoEscaneos,
  resultadosEscaneo,
  onPdfUnico,
  onActualizar,
  onCargaMasivaEscaneos,
}: Props) {
  return (
    <>
      <div className="mt-5 rounded-xl border border-violet-500/30 bg-violet-950/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-violet-100">
              <ScanLine className="size-4 text-violet-300" aria-hidden />
              Escaneos firmados
            </p>
            <p className="mt-1 max-w-xl text-xs text-zinc-500">
              Cuando el obrero firme el contrato, suba el PDF o foto escaneada. En lote, nombre cada
              archivo con la cédula (ej.{' '}
              <span className="font-mono text-zinc-400">V-12345678.pdf</span>).
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!proyectoId || importandoEscaneos || rowsCount === 0}
            onClick={onCargaMasivaEscaneos}
            className="border-violet-500/45 bg-violet-950/40 text-violet-100"
          >
            {importandoEscaneos ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-3.5" aria-hidden />
            )}
            <span className="ml-1.5">
              {importandoEscaneos ? 'Cargando…' : 'Carga masiva de escaneos'}
            </span>
          </Button>
        </div>
        {resultadosEscaneo && resultadosEscaneo.length > 0 ? (
          <ul className="mt-3 max-h-40 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10 bg-black/30 text-[11px]">
            {resultadosEscaneo.map((r, idx) => (
              <li
                key={`${r.archivo}-${idx}`}
                className={`px-3 py-1.5 ${r.ok ? 'text-emerald-300/90' : 'text-red-200'}`}
              >
                {r.archivo}
                {r.ok ? ` · ${r.obrero} · OK` : ` · ${r.error}`}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-white">Contratos en esta obra</h2>
        <div className="flex flex-wrap items-center gap-2">
          {rowsCount > 0 ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyPdfLote || !algunoSeleccionado}
                onClick={() => onPdfUnico(false)}
                className="border-emerald-500/45 bg-emerald-950/35 text-emerald-100"
                title="Descargar un solo PDF con los contratos seleccionados"
              >
                {busyPdfLote ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Files className="size-3.5" aria-hidden />
                )}
                <span className="ml-1.5">
                  PDF único{algunoSeleccionado ? ` (${selectedCount})` : ''}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyPdfLote || !algunoSeleccionado}
                onClick={() => onPdfUnico(true)}
                className="border-emerald-500/35 text-emerald-100/90"
                title="Abrir PDF único para imprimir"
              >
                <Printer className="size-3.5" aria-hidden />
                <span className="ml-1.5 hidden sm:inline">Imprimir lote</span>
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingLista || !proyectoId}
            onClick={onActualizar}
            className="border-amber-500/40 text-amber-100"
          >
            <RefreshCw className={`size-3.5 ${loadingLista ? 'animate-spin' : ''}`} aria-hidden />
            <span className="ml-1.5">Actualizar</span>
          </Button>
        </div>
      </div>
    </>
  );
}
