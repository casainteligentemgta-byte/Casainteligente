'use client';

import Link from 'next/link';
import { ExternalLink, FileImage, X } from 'lucide-react';
import CompraFacturaImagen from '@/components/contabilidad/CompraFacturaImagen';

export type FacturaProcuraVista = {
  compraId: string;
  ticket: string;
  invoiceNumber?: string | null;
  tieneDocumento?: boolean;
};

type Props = {
  open: boolean;
  factura: FacturaProcuraVista | null;
  onClose: () => void;
};

export default function VerFacturaProcuraModal({ open, factura, onClose }: Props) {
  if (!open || !factura) return null;

  const num = factura.invoiceNumber?.trim();
  const tituloFactura = num ? (num.startsWith('#') ? num : `#${num}`) : 'Factura vinculada';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141418] p-5 shadow-2xl max-h-[92vh] flex flex-col"
        role="dialog"
        aria-labelledby="ver-factura-procura-title"
      >
        <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileImage className="h-5 w-5 text-[#a5a3ff] shrink-0" />
            <div className="min-w-0">
              <h2 id="ver-factura-procura-title" className="text-base font-bold text-white truncate">
                {tituloFactura}
              </h2>
              <p className="text-[11px] text-zinc-500 truncate">{factura.ticket}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <CompraFacturaImagen
            compraId={factura.compraId}
            expanded
            tieneDocumento={factura.tieneDocumento !== false}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[120px] rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-zinc-400 hover:text-white"
          >
            Cerrar
          </button>
          <Link
            href={`/contabilidad/compras?compra=${encodeURIComponent(factura.compraId)}`}
            className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border border-[#5856D6]/35 bg-[#5856D6]/10 px-4 py-2.5 text-sm font-bold text-[#a5a3ff] hover:bg-[#5856D6]/20"
          >
            <ExternalLink className="h-4 w-4" />
            Cuadro compras
          </Link>
        </div>
      </div>
    </div>
  );
}
