'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Link2, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';

export type ProcuraVinculoFactura = {
  id: string;
  ticket: string;
  material_txt: string;
  proyecto_id?: string | null;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
};

type FacturaOpcion = {
  id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_rif: string | null;
  fecha: string | null;
  total_amount: number | null;
  moneda: string | null;
  obra: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  procura: ProcuraVinculoFactura | null;
  onVinculada?: () => void;
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF9500]/50 placeholder:text-zinc-600';

function nombreObra(
  v: { nombre?: string } | { nombre?: string }[] | null | undefined,
): string {
  if (!v) return '';
  if (Array.isArray(v)) return v[0]?.nombre?.trim() ?? '';
  return v.nombre?.trim() ?? '';
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export default function VincularFacturaProcuraModal({
  open,
  onClose,
  procura,
  onVinculada,
}: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [soloObra, setSoloObra] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [facturas, setFacturas] = useState<FacturaOpcion[]>([]);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    if (!procura) return;
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (procura.proyecto_id?.trim()) params.set('proyecto_id', procura.proyecto_id.trim());
      params.set('solo_obra', soloObra && procura.proyecto_id ? '1' : '0');
      params.set('limit', '30');

      const res = await fetch(apiUrl(`/api/compras/procuras/buscar-facturas?${params}`), {
        cache: 'no-store',
      });
      const json = (await res.json()) as { facturas?: FacturaOpcion[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al buscar facturas');
      setFacturas(json.facturas ?? []);
      setSeleccionId((prev) =>
        prev && (json.facturas ?? []).some((f) => f.id === prev) ? prev : null,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al buscar');
      setFacturas([]);
    } finally {
      setCargando(false);
    }
  }, [busqueda, procura, soloObra]);

  useEffect(() => {
    if (!open || !procura) return;
    setBusqueda('');
    setSeleccionId(null);
    setSoloObra(Boolean(procura.proyecto_id?.trim()));
  }, [open, procura]);

  useEffect(() => {
    if (!open || !procura) return;
    const t = window.setTimeout(() => void buscar(), open ? 120 : 0);
    return () => window.clearTimeout(t);
  }, [open, procura, buscar]);

  const vincular = async () => {
    if (!procura || !seleccionId) return;
    setVinculando(true);
    try {
      const res = await fetch(apiUrl('/api/compras/procuras/vincular-factura'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procura_id: procura.id,
          contabilidad_compra_id: seleccionId,
        }),
      });
      const json = (await res.json()) as { error?: string; ticket?: string; invoice_number?: string };
      if (!res.ok) throw new Error(json.error ?? 'No se pudo vincular');
      const num = json.invoice_number?.trim();
      toast.success(
        num
          ? `Procura ${json.ticket ?? procura.ticket} vinculada a factura #${num}`
          : `Procura ${json.ticket ?? procura.ticket} vinculada`,
      );
      onVinculada?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al vincular');
    } finally {
      setVinculando(false);
    }
  };

  if (!open || !procura) return null;

  const obra = nombreObra(procura.ci_proyectos);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141418] p-5 shadow-2xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-labelledby="vincular-factura-procura-title"
      >
        <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="h-5 w-5 text-[#FF9500] shrink-0" />
            <div className="min-w-0">
              <h2 id="vincular-factura-procura-title" className="text-base font-bold text-white">
                Vincular factura
              </h2>
              <p className="text-[11px] text-zinc-500 truncate">
                {procura.ticket}
                {obra ? ` · ${obra}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-4 leading-relaxed shrink-0">
          Material:{' '}
          <span className="text-zinc-300">{nombreMaterialProcuraVisible(procura.material_txt)}</span>
          . Elija la factura del cuadro de contabilidad que corresponde a esta procura.
        </p>

        <div className="space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nº factura, proveedor, RIF…"
              className={`${inputClass} pl-9`}
            />
          </div>
          {procura.proyecto_id ? (
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={soloObra}
                onChange={(e) => setSoloObra(e.target.checked)}
                className="rounded border-white/20"
              />
              Solo facturas de la misma obra
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/20">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF9500]" />
              Buscando…
            </div>
          ) : facturas.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500 px-4">
              No hay facturas disponibles
              {soloObra && obra ? ` para ${obra}` : ''}. Pruebe ampliar la búsqueda o desmarque «misma
              obra».
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {facturas.map((f) => {
                const activa = seleccionId === f.id;
                const num = f.invoice_number?.trim() || 'S/N';
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSeleccionId(f.id)}
                      className={`w-full text-left px-3 py-3 transition-colors ${
                        activa ? 'bg-[#FF9500]/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <FileText
                          className={`h-4 w-4 mt-0.5 shrink-0 ${activa ? 'text-[#FF9500]' : 'text-zinc-500'}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">
                            #{num} · {f.supplier_name?.trim() || 'Proveedor'}
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            {fmtFecha(f.fecha)}
                            {f.obra ? ` · ${f.obra}` : ''}
                            {f.total_amount != null
                              ? ` · ${Number(f.total_amount).toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${f.moneda ?? ''}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-zinc-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!seleccionId || vinculando}
            onClick={() => void vincular()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF9500] px-4 py-2.5 text-sm font-black uppercase text-black disabled:opacity-50"
          >
            {vinculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Vincular
          </button>
        </div>
      </div>
    </div>
  );
}
