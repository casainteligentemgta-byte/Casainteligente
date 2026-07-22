'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { FileUp, Eye, Loader2 } from 'lucide-react';
import CertificarFacturaAdjuntaModal, {
  type OcrAdjuntarResult,
} from '@/components/contabilidad/CertificarFacturaAdjuntaModal';
import {
  adjuntarFacturaConOcr,
  esOcrAdjuntarOk,
} from '@/lib/contabilidad/adjuntarFacturaConOcrClient';

type Props = {
  compraId: string;
  tieneDocumento: boolean;
  fileName?: string | null;
  /** Filas agrupadas o no-compra: solo lectura. */
  puedeAdjuntar?: boolean;
  onAdjuntado?: (compraId: string, fileName: string) => void;
};

/** Celda LINK FACTURA del cuadro egresos CCO: ver documento real o adjuntar y enlazar al egreso. */
export default function EgresoFacturaCell({
  compraId,
  tieneDocumento,
  fileName,
  puedeAdjuntar = true,
  onAdjuntado,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState(false);
  const [localName, setLocalName] = useState<string | null>(null);
  const [ocrPendiente, setOcrPendiente] = useState<OcrAdjuntarResult | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const conDocumento = tieneDocumento || localDoc;

  const verDocumento = async () => {
    setAbriendo(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`,
        { cache: 'no-store' },
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'No hay factura adjunta para este egreso.');
      }
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al abrir factura');
    } finally {
      setAbriendo(false);
    }
  };

  const subir = async (file: File) => {
    setSubiendo(true);
    setError(null);
    setInfo(null);
    try {
      const data = await adjuntarFacturaConOcr(compraId, file);
      if (!data.ok) {
        throw new Error(data.error || 'No se pudo adjuntar la factura');
      }
      setLocalDoc(true);
      setLocalName(data.fileName || file.name);
      onAdjuntado?.(compraId, data.fileName || file.name);

      if (esOcrAdjuntarOk(data.ocr)) {
        if (data.ocr.requiere_confirmacion) {
          setOcrPendiente(data.ocr);
          const faltaFiscal =
            data.ocr.requiere_numero_factura ||
            data.ocr.certificacion.requiere_numero_factura ||
            data.ocr.requiere_rif ||
            data.ocr.certificacion.requiere_rif;
          setInfo(
            faltaFiscal
              ? 'Factura adjuntada. Confirme nº de factura y RIF.'
              : 'Factura adjuntada. Revise las disparidades con el CCO.',
          );
        } else if (data.ocr.aplicado) {
          const nro = data.ocr.aplicado.invoice_number
            ? ` · Nº ${data.ocr.aplicado.invoice_number}`
            : '';
          const rif = data.ocr.aplicado.supplier_rif
            ? ` · RIF ${data.ocr.aplicado.supplier_rif}`
            : '';
          setInfo(`Certificada: ${data.ocr.aplicado.items} ítem(s)${nro}${rif}.`);
        } else if (data.ocr.items_count === 0) {
          setInfo('Factura adjuntada. OCR sin ítems legibles.');
        } else {
          setInfo('Factura adjuntada y cabecera CCO certificada.');
        }
      } else if (data.ocr && 'error' in data.ocr) {
        setInfo(`Factura adjuntada. OCR: ${data.ocr.error}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al adjuntar');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 108 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {conDocumento ? (
          <button
            type="button"
            onClick={() => void verDocumento()}
            disabled={abriendo}
            title={localName || fileName ? `Abrir ${localName || fileName}` : 'Abrir factura'}
            style={btnVer}
          >
            {abriendo ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            Ver
          </button>
        ) : (
          <span style={{ color: '#94A3B8', fontWeight: 700, fontSize: 11 }}>None</span>
        )}
        {puedeAdjuntar ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              disabled={subiendo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subir(f);
              }}
            />
            <button
              type="button"
              disabled={subiendo}
              onClick={() => inputRef.current?.click()}
              title={
                conDocumento
                  ? 'Reemplazar factura, certificar cabecera CCO e importar ítems'
                  : 'Cargar factura, certificar cabecera CCO e importar ítems'
              }
              style={btnAdj}
            >
              {subiendo ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
              {subiendo ? 'Leyendo…' : conDocumento ? 'Cambiar' : 'Adjuntar'}
            </button>
          </>
        ) : null}
      </div>
      {error ? (
        <span style={{ color: '#B91C1C', fontSize: 10, whiteSpace: 'normal', maxWidth: 180 }}>
          {error}
        </span>
      ) : null}
      {info && !error ? (
        <span style={{ color: '#0369A1', fontSize: 10, whiteSpace: 'normal', maxWidth: 180 }}>
          {info}
        </span>
      ) : null}

      {ocrPendiente ? (
        <CertificarFacturaAdjuntaModal
          open
          compraId={compraId}
          fileName={localName || fileName}
          ocr={ocrPendiente}
          onClose={() => setOcrPendiente(null)}
          onAplicado={({ items, decision, invoice_number, supplier_rif }) => {
            setOcrPendiente(null);
            const nro = invoice_number ? ` · Nº ${invoice_number}` : '';
            const rif = supplier_rif ? ` · RIF ${supplier_rif}` : '';
            setInfo(
              decision === 'usar_factura'
                ? `Actualizado con factura: ${items} ítem(s)${nro}${rif}.`
                : `CCO conservado + ${items} ítem(s)${nro}${rif}.`,
            );
            onAdjuntado?.(compraId, localName || fileName || 'factura');
          }}
        />
      ) : null}
    </div>
  );
}

const btnVer: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: 'none',
  background: 'transparent',
  color: '#1D4ED8',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};

const btnAdj: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: '1px solid #BFDBFE',
  background: '#EFF6FF',
  color: '#1E40AF',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 6,
};
