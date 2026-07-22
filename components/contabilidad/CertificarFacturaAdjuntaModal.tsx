'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';
import type {
  DecisionCertificarFactura,
  DisparidadFacturaAdjunta,
  ResultadoComparacionFactura,
} from '@/lib/contabilidad/certificarFacturaAdjunta';

export type OcrAdjuntarResult = {
  ok: true;
  extracted: ExtractedPurchaseInvoice;
  items_count: number;
  certificacion: ResultadoComparacionFactura;
  requiere_confirmacion: boolean;
  requiere_numero_factura?: boolean;
  requiere_rif?: boolean;
  aplicado?: {
    items: number;
    decision: 'mantener_cco';
    invoice_number?: string;
    supplier_rif?: string;
  } | null;
};

type Props = {
  open: boolean;
  compraId: string;
  fileName?: string | null;
  ocr: OcrAdjuntarResult;
  onClose: () => void;
  onAplicado: (info: {
    decision: DecisionCertificarFactura;
    items: number;
    invoice_number?: string;
    supplier_rif?: string;
  }) => void;
};

export default function CertificarFacturaAdjuntaModal({
  open,
  compraId,
  fileName,
  ocr,
  onClose,
  onAplicado,
}: Props) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierRif, setSupplierRif] = useState('');

  const disparidades = ocr.certificacion.disparidades ?? [];
  const itemsCount = ocr.items_count ?? 0;
  const faltaNumero =
    Boolean(ocr.requiere_numero_factura || ocr.certificacion.requiere_numero_factura);
  const faltaRif = Boolean(ocr.requiere_rif || ocr.certificacion.requiere_rif);
  const soloDatosFiscales = disparidades.length === 0 && (faltaNumero || faltaRif);
  const ocrTrajoNumero = Boolean(ocr.certificacion.invoice_number_factura?.trim());
  const ocrTrajoRif = Boolean(ocr.certificacion.supplier_rif_factura?.trim());

  useEffect(() => {
    if (!open) return;
    setInvoiceNumber(
      String(ocr.certificacion.invoice_number_factura ?? ocr.extracted.invoice_number ?? '').trim(),
    );
    setSupplierRif(
      String(ocr.certificacion.supplier_rif_factura ?? ocr.extracted.supplier_rif ?? '').trim(),
    );
    setError(null);
    setGuardando(false);
  }, [open, ocr]);

  const aplicar = async (decision: DecisionCertificarFactura) => {
    const nro = invoiceNumber.trim();
    const rif = supplierRif.trim();
    if (!nro) {
      setError('Indique el número de factura (leído de la factura o cargado a mano).');
      return;
    }
    if (!rif) {
      setError('Indique el RIF del proveedor (leído de la factura o cargado a mano).');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document/certificar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            extracted: {
              ...ocr.extracted,
              invoice_number: nro,
              supplier_rif: rif,
            },
            invoice_number: nro,
            supplier_rif: rif,
            confirmar_fecha_anomala: true,
          }),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: number;
        decision?: DecisionCertificarFactura;
        invoice_number?: string;
        supplier_rif?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo aplicar la certificación');
      }
      onAplicado({
        decision: data.decision || decision,
        items: data.items ?? itemsCount,
        invoice_number: data.invoice_number || nro,
        supplier_rif: data.supplier_rif || rif,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al certificar');
    } finally {
      setGuardando(false);
    }
  };

  const puedeAplicar = itemsCount > 0 && Boolean(invoiceNumber.trim()) && Boolean(supplierRif.trim());

  return (
    <Dialog open={open} onOpenChange={(v) => (!v && !guardando ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-amber-800/60 bg-zinc-950 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            {soloDatosFiscales ? 'Datos fiscales de la factura' : 'Disparidad factura vs CCO'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {soloDatosFiscales
              ? 'Complete el número de factura y/o el RIF si el OCR no los leyó. No se usan el correlativo CCO-V4 ni el placeholder SIN-RIF del CSV.'
              : `La factura adjunta${fileName ? ` («${fileName}»)` : ''} no coincide con la cabecera o el monto del egreso importado desde el CSV. Elija cómo certificar.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Nº de factura {ocrTrajoNumero ? '(OCR — editable)' : '(cargar a mano)'}
            </span>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej. 00-123456 o control fiscal"
              disabled={guardando}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              RIF {ocrTrajoRif ? '(OCR — editable)' : '(cargar a mano)'}
            </span>
            <input
              type="text"
              value={supplierRif}
              onChange={(e) => setSupplierRif(e.target.value)}
              placeholder="Ej. J-12345678-9"
              disabled={guardando}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
            />
            <span className="block text-[11px] text-zinc-500">
              Nº y RIF deben salir de la factura o escribirse a mano (no CCO-V4 / SIN-RIF del CSV).
            </span>
          </label>

          {disparidades.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-zinc-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Campo</th>
                    <th className="px-3 py-2 font-semibold">CCO (CSV)</th>
                    <th className="px-3 py-2 font-semibold">Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {disparidades.map((d: DisparidadFacturaAdjunta) => (
                    <tr key={d.campo} className="border-t border-zinc-800">
                      <td className="px-3 py-2 font-medium text-amber-200">{d.etiqueta}</td>
                      <td className="px-3 py-2 text-zinc-300">{d.valor_cco}</td>
                      <td className="px-3 py-2 text-zinc-100">{d.valor_factura}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {disparidades[0]?.detalle ? (
            <p className="text-xs leading-relaxed text-zinc-500">{disparidades[0].detalle}</p>
          ) : null}

          <div className="flex items-start gap-2 rounded-lg border border-sky-900/50 bg-sky-950/40 px-3 py-2 text-sm text-sky-100">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <span>
              OCR detectó <strong>{itemsCount}</strong> ítem(s) en la factura
              {itemsCount > 0
                ? ' (descripción, cantidad y precio). Se cargarán al confirmar.'
                : '. Sin líneas legibles no se podrán importar ítems.'}
            </span>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <button
            type="button"
            disabled={guardando}
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            Solo adjuntar
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {soloDatosFiscales || disparidades.length === 0 ? (
              <button
                type="button"
                disabled={guardando || !puedeAplicar}
                onClick={() => void aplicar('mantener_cco')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Certificar e importar ítems
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={guardando || !puedeAplicar}
                  onClick={() => void aplicar('mantener_cco')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Mantener CCO + ítems
                </button>
                <button
                  type="button"
                  disabled={guardando || !puedeAplicar}
                  onClick={() => void aplicar('usar_factura')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Usar datos factura
                </button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
