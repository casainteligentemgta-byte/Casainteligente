'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, ImageIcon, Loader2 } from 'lucide-react';

type Props = {
  compraId: string;
  /** Si false, muestra aviso de recepción sin foto guardada. */
  tieneDocumento?: boolean;
  esRecepcion?: boolean;
  /** Ruta API alternativa (p. ej. factura pendiente Telegram). */
  documentApiPath?: string;
  /** Solo carga y muestra cuando es true (p. ej. tras pulsar el título). */
  expanded?: boolean;
};

export default function CompraFacturaImagen({
  compraId,
  tieneDocumento = true,
  esRecepcion = false,
  documentApiPath,
  expanded = true,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint =
    documentApiPath?.trim() ||
    `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`;

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUrl(null);
    try {
      const res = await fetch(endpoint);
      const data = (await res.json()) as {
        url?: string;
        mimeType?: string | null;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(
          data.error ||
            (data.code === 'SIN_DOCUMENTO_STORAGE'
              ? 'No hay imagen guardada para esta compra.'
              : 'No se pudo cargar la factura.'),
        );
      }
      setUrl(data.url);
      setMimeType(data.mimeType ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar imagen');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!expanded || !tieneDocumento || !compraId.trim()) {
      if (!expanded) setLoading(false);
      return;
    }
    void cargar();
  }, [cargar, compraId, tieneDocumento, expanded]);

  if (!expanded) return null;

  if (!tieneDocumento) {
    if (!esRecepcion) return null;
    return (
      <div
        style={{
          marginTop: '10px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.25)',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: '#a5a3ff' }}>FACTURA IMAGEN</strong>
          <p style={{ margin: '6px 0 0' }}>
            Recepción de mercancía sin foto en Storage. Al finalizar la captura adjunte la imagen
            (cámara, fototeca del celular o archivos/PDF) antes de pulsar FINALIZAR.
          </p>
        </div>
    );
  }

  const esImagen = mimeType?.startsWith('image/') || (!mimeType && url != null);

  return (
    <div
      style={{
        marginTop: '10px',
        borderRadius: '12px',
        border: '1px solid rgba(88,86,214,0.35)',
        background: 'rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}
    >
      <p
        style={{
          padding: '8px 12px',
          margin: 0,
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#a5a3ff',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <ImageIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
        FACTURA IMAGEN
        {esRecepcion ? (
          <span
            style={{
              display: 'block',
              fontSize: 9,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.35)',
              marginTop: 2,
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            Foto tomada en recepción de mercancía
          </span>
        ) : null}
      </p>

      <div style={{ padding: '10px 12px' }}>
        {loading ? (
          <p
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '12px',
              margin: 0,
            }}
          >
            <Loader2 size={16} className="animate-spin" />
            Cargando…
          </p>
        ) : error ? (
          <p style={{ color: '#FF6B6B', fontSize: '12px', fontWeight: 600, margin: 0 }}>{error}</p>
        ) : url && esImagen ? (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir factura en tamaño completo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Factura de compra"
              style={{
                display: 'block',
                width: '100%',
                maxWidth: '320px',
                maxHeight: '220px',
                objectFit: 'contain',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                cursor: 'zoom-in',
              }}
            />
          </a>
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#5856D6',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} />
            Abrir documento de factura
          </a>
        ) : null}
      </div>
    </div>
  );
}
