'use client';

import { useEffect, useState } from 'react';
import { Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';

type Sugerencia = {
  recepcionId: string;
  puntaje: number;
  motivos: string[];
};

type Props = {
  open: boolean;
  purchaseInvoiceId: string | null;
  ticket: string;
  onClose: () => void;
  onEnlazada?: () => void;
};

/**
 * Sugiere recepciones de campo para una compra de Procura. La IA/regla propone;
 * la persona confirma con el botón "Enlazar" de cada sugerencia.
 */
export default function EnlazarRecepcionCampoModal({
  open,
  purchaseInvoiceId,
  ticket,
  onClose,
  onEnlazada,
}: Props) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compraId, setCompraId] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [enlazando, setEnlazando] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !purchaseInvoiceId) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    setSugerencias([]);
    void (async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/compras/procuras/enlace-frm?purchase_invoice_id=${encodeURIComponent(purchaseInvoiceId)}`),
          { cache: 'no-store' },
        );
        const json = (await res.json()) as {
          error?: string;
          contabilidad_compra_id?: string;
          sugerencias?: Sugerencia[];
        };
        if (!vivo) return;
        if (!res.ok) {
          setError(json.error ?? 'No se pudieron cargar las sugerencias.');
          return;
        }
        setCompraId(json.contabilidad_compra_id ?? null);
        setSugerencias(json.sugerencias ?? []);
      } catch {
        if (vivo) setError('Error de conexión al cargar las sugerencias.');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [open, purchaseInvoiceId]);

  if (!open) return null;

  const enlazar = async (recepcionId: string) => {
    if (!compraId) return;
    setEnlazando(recepcionId);
    try {
      const res = await fetch(apiUrl('/api/compras/procuras/enlace-frm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recepcion_id: recepcionId, contabilidad_compra_id: compraId }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error ?? 'No se pudo enlazar.');
        return;
      }
      toast.success('Nota de campo enlazada. El stock no se duplicará.');
      onEnlazada?.();
      onClose();
    } catch {
      toast.error('Error de conexión al enlazar.');
    } finally {
      setEnlazando(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enlazar-frm-titulo"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0A0A0F] shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-[#FF9500]" aria-hidden />
              <h2 id="enlazar-frm-titulo" className="text-base font-bold text-white">
                Enlazar nota de campo
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Procura {ticket}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {cargando ? (
            <p className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando notas de campo…
            </p>
          ) : error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : sugerencias.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay notas de campo sugeridas para esta compra: misma ubicación y proveedor, sin factura de canal.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sugerencias.map((s) => (
                <li key={s.recepcionId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">Coincidencia {s.puntaje}%</span>
                    <button
                      type="button"
                      disabled={enlazando !== null}
                      onClick={() => void enlazar(s.recepcionId)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#FF9500]/45 bg-[#FF9500]/15 px-3 py-1.5 text-xs font-bold text-[#FFB84D] disabled:opacity-40"
                    >
                      {enlazando === s.recepcionId ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Enlazar
                    </button>
                  </div>
                  <ul className="mt-2 list-disc pl-4 text-xs text-zinc-400">
                    {s.motivos.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
