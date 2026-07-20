'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { FileUp, Eye, Loader2 } from 'lucide-react';

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
    try {
      const form = new FormData();
      form.append('documento', file, file.name);
      const res = await fetch(
        `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`,
        { method: 'POST', body: form },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string; fileName?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo adjuntar la factura');
      }
      setLocalDoc(true);
      onAdjuntado?.(compraId, data.fileName || file.name);
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
            title={fileName ? `Abrir ${fileName}` : 'Abrir factura'}
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
                  ? 'Reemplazar factura enlazada a este egreso'
                  : 'Cargar factura y enlazarla a este egreso'
              }
              style={btnAdj}
            >
              {subiendo ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
              {conDocumento ? 'Cambiar' : 'Adjuntar'}
            </button>
          </>
        ) : null}
      </div>
      {error ? (
        <span style={{ color: '#B91C1C', fontSize: 10, whiteSpace: 'normal', maxWidth: 160 }}>
          {error}
        </span>
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
