'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

export type DocumentoCompraRef = {
  compra_id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  fecha: string | null;
};

/** Abre la factura o nota de entrega de una compra en una pestaña nueva. */
export async function abrirDocumentoCompra(compraId: string): Promise<void> {
  // La pestaña se abre antes del await para que el navegador no la bloquee.
  const ventana = window.open('', '_blank');
  try {
    const res = await fetch(
      `/api/almacen/lo-comprado/documento?compra_id=${encodeURIComponent(compraId)}`,
      { cache: 'no-store' },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
    if (!res.ok || !json.ok || !json.url) {
      throw new Error(json.error ?? 'No se pudo abrir el documento.');
    }
    if (ventana) ventana.location.href = json.url;
    else window.open(json.url, '_blank');
  } catch (e) {
    ventana?.close();
    throw e;
  }
}

export function etiquetaDocumentoCompra(d: DocumentoCompraRef): string {
  const num = d.invoice_number ? `#${d.invoice_number}` : 'Ver';
  return d.supplier_name ? `${num} · ${d.supplier_name}` : num;
}

export default function BotonVerDocumentoCompra({
  documento,
  onError,
}: {
  documento: DocumentoCompraRef;
  onError?: (mensaje: string) => void;
}) {
  const [abriendo, setAbriendo] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setAbriendo(true);
        try {
          await abrirDocumentoCompra(documento.compra_id);
        } catch (e) {
          onError?.(e instanceof Error ? e.message : 'No se pudo abrir el documento.');
        } finally {
          setAbriendo(false);
        }
      }}
      disabled={abriendo}
      title={`Ver factura o nota de entrega${documento.fecha ? ` del ${documento.fecha}` : ''}`}
      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-zinc-200 hover:border-emerald-400/40 hover:text-emerald-300 disabled:opacity-50"
    >
      {abriendo ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
      {etiquetaDocumentoCompra(documento)}
    </button>
  );
}
