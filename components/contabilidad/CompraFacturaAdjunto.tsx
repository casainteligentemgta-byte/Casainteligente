'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CompraFacturaImagen from '@/components/contabilidad/CompraFacturaImagen';

type Props = {
  compraId: string;
  tieneDocumento: boolean;
  /** Compras importadas desde CSV pueden adjuntar factura después. */
  puedeAdjuntar?: boolean;
  esRecepcion?: boolean;
  documentApiPath?: string;
  expanded?: boolean;
  onAdjuntado?: (compraId: string) => void;
};

export default function CompraFacturaAdjunto({
  compraId,
  tieneDocumento,
  puedeAdjuntar = false,
  esRecepcion = false,
  documentApiPath,
  expanded = true,
  onAdjuntado,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [adjuntadoLocal, setAdjuntadoLocal] = useState(false);

  const conDocumento = tieneDocumento || adjuntadoLocal;

  const subir = async (file: File) => {
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append('documento', file, file.name);
      const res = await fetch(
        `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`,
        { method: 'POST', body: form },
      );
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo adjuntar el archivo');
      }
      setAdjuntadoLocal(true);
      toast.success('Factura adjuntada');
      onAdjuntado?.(compraId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al adjuntar');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (!expanded) return null;

  if (conDocumento) {
    return (
      <CompraFacturaImagen
        compraId={compraId}
        tieneDocumento
        esRecepcion={esRecepcion}
        documentApiPath={documentApiPath}
        expanded
      />
    );
  }

  if (!puedeAdjuntar) return null;

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '12px',
        borderRadius: '12px',
        border: '1px dashed rgba(88,86,214,0.45)',
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      <p
        style={{
          margin: '0 0 8px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#a5a3ff',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Sin factura adjunta
      </p>
      <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
        Puede subir la imagen o PDF de la factura ahora o más tarde.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
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
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          borderRadius: '10px',
          border: '1px solid rgba(88,86,214,0.5)',
          background: 'rgba(88,86,214,0.2)',
          color: '#e8e7ff',
          fontSize: '12px',
          fontWeight: 800,
          padding: '8px 12px',
          cursor: subiendo ? 'wait' : 'pointer',
        }}
      >
        {subiendo ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
        {subiendo ? 'Subiendo…' : 'Adjuntar imagen o PDF'}
      </button>
    </div>
  );
}
