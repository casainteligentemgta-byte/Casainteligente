'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ExternalLink, ImageIcon, Loader2 } from 'lucide-react';
import { esImagenMimeFactura, esPdfMimeFactura } from '@/lib/contabilidad/facturaDocumentoMime';

type Props = {
  compraId: string;
  /** Si false, muestra aviso de recepción sin foto guardada. */
  tieneDocumento?: boolean;
  esRecepcion?: boolean;
  /** Ruta API alternativa (p. ej. factura pendiente Telegram). */
  documentApiPath?: string;
  /** Solo carga y muestra cuando es true (p. ej. tras pulsar el título). */
  expanded?: boolean;
  /** Alto máximo de la miniatura (px). Por defecto 220. */
  maxHeight?: number;
  /** miniatura = thumbnail en formularios; visor = lightbox a viewport. */
  variant?: 'miniatura' | 'visor';
};

export default function CompraFacturaImagen({
  compraId,
  tieneDocumento = true,
  esRecepcion = false,
  documentApiPath,
  expanded = true,
  maxHeight = 220,
  variant = 'miniatura',
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [parts, setParts] = useState<Array<{ url: string; mimeType?: string | null; fileName?: string | null }>>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint =
    documentApiPath?.trim() ||
    `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`;

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUrl(null);
    setParts([]);
    try {
      const res = await fetch(endpoint);
      const data = (await res.json()) as {
        url?: string;
        mimeType?: string | null;
        error?: string;
        code?: string;
        parts?: Array<{ url?: string; mimeType?: string | null; fileName?: string | null }>;
      };
      if (!res.ok || !data.url) {
        throw new Error(
          data.error ||
            (data.code === 'SIN_DOCUMENTO_STORAGE'
              ? 'No hay imagen guardada para esta compra.'
              : data.code === 'ARCHIVO_NO_EN_BUCKET'
                ? 'El comprobante no está en Storage. Puede registrar la compra igual; vuelva a adjuntar la foto si la necesita.'
                : 'No se pudo cargar la factura.'),
        );
      }
      setUrl(data.url);
      setMimeType(data.mimeType ?? null);
      const extra = (data.parts ?? []).filter((p): p is { url: string; mimeType?: string | null; fileName?: string | null } =>
        Boolean(p?.url),
      );
      setParts(extra.length ? extra : [{ url: data.url, mimeType: data.mimeType }]);
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

  const visor = variant === 'visor';
  const esImagen = esImagenMimeFactura(mimeType, url);
  const esPdf = esPdfMimeFactura(mimeType);

  const imgMiniatura: CSSProperties = {
    display: 'block',
    width: '100%',
    maxWidth: '320px',
    maxHeight: `${maxHeight}px`,
    objectFit: 'contain',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
    cursor: 'zoom-in',
  };

  const imgVisor: CSSProperties = {
    display: 'block',
    margin: '0 auto',
    width: 'auto',
    height: 'auto',
    maxWidth: '100%',
    maxHeight: 'min(78dvh, calc(100vh - 5.5rem))',
    objectFit: 'contain',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
  };

  const iframeVisor: CSSProperties = {
    display: 'block',
    width: '100%',
    height: 'min(78dvh, calc(100vh - 5.5rem))',
    border: 'none',
    borderRadius: '8px',
    background: '#fff',
  };

  const linkDoc: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#a5a3ff',
    fontSize: '12px',
    fontWeight: 800,
    textDecoration: 'none',
  };

  return (
    <div
      style={
        visor
          ? { width: '100%', minHeight: 80 }
          : {
              marginTop: '10px',
              borderRadius: '12px',
              border: '1px solid rgba(88,86,214,0.35)',
              background: 'rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }
      }
    >
      {visor ? null : (
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
      )}

      <div style={{ padding: visor ? 0 : '10px 12px' }}>
        {loading ? (
          <p
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: visor ? 'center' : 'flex-start',
              gap: '8px',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '12px',
              margin: visor ? '24px 0' : 0,
            }}
          >
            <Loader2 size={16} className="animate-spin" />
            Cargando…
          </p>
        ) : error ? (
          <p
            style={{
              color: '#FF6B6B',
              fontSize: '12px',
              fontWeight: 600,
              margin: visor ? '24px 0' : 0,
              textAlign: visor ? 'center' : 'left',
            }}
          >
            {error}
          </p>
        ) : url && esImagen ? (
          visor ? (
            <div>
              {(parts.length > 1 ? parts : [{ url, mimeType }]).map((p, i) => (
                <div key={p.url} style={{ marginTop: i === 0 ? 0 : 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Factura de compra ${i + 1}`} style={imgVisor} />
                </div>
              ))}
              <p style={{ margin: '10px 0 0', textAlign: 'center' }}>
                <a href={url} target="_blank" rel="noopener noreferrer" style={linkDoc}>
                  <ExternalLink size={14} />
                  Abrir en pestaña nueva
                </a>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(parts.length > 1 ? parts : [{ url, mimeType }]).map((p, i) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Abrir parte ${i + 1} en tamaño completo`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`Factura de compra ${i + 1}`}
                    style={imgMiniatura}
                  />
                  {parts.length > 1 ? (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.45)',
                        marginTop: 4,
                      }}
                    >
                      Parte {i + 1} de {parts.length}
                    </span>
                  ) : null}
                </a>
              ))}
            </div>
          )
        ) : url && esPdf && visor ? (
          <div>
            <iframe src={url} title="Documento de factura" style={iframeVisor} />
            <p style={{ margin: '10px 0 0', textAlign: 'center' }}>
              <a href={url} target="_blank" rel="noopener noreferrer" style={linkDoc}>
                <ExternalLink size={14} />
                Abrir documento de factura
              </a>
            </p>
          </div>
        ) : url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...linkDoc, color: '#5856D6' }}>
            <ExternalLink size={14} />
            Abrir documento de factura
          </a>
        ) : null}
      </div>
    </div>
  );
}
