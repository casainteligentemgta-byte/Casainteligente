'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProductImage } from '@/lib/supabase/product-media';
import { TABLA_PRODUCTOS } from '@/lib/productos/tablaProductos';
import { tinta } from '@/lib/tema/tinta';

type Props = {
  productId: number;
  onUploaded: (url: string) => void;
  /** Botones chicos para la fila del catálogo. */
  compacto?: boolean;
};

/**
 * Subida rápida de foto (galería o cámara trasera en el móvil).
 * No inventa imágenes: solo guarda la que elige el usuario.
 */
export default function SubirFotoProducto({ productId, onUploaded, compacto = false }: Props) {
  const supabase = createClient();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setSubiendo(true);
    const { url, error: err } = await uploadProductImage(supabase, file);
    if (err || !url) {
      setSubiendo(false);
      setError(err || 'No se pudo subir la foto.');
      return;
    }
    const { error: upd } = await supabase.from(TABLA_PRODUCTOS).update({ imagen: url }).eq('id', productId);
    setSubiendo(false);
    if (upd) {
      setError(upd.message);
      return;
    }
    onUploaded(url);
  }

  const btn: React.CSSProperties = compacto
    ? {
        padding: '6px 10px',
        borderRadius: '8px',
        border: `1px solid ${tinta(0.15)}`,
        background: tinta(0.06),
        color: 'var(--label-primary)',
        fontSize: '11px',
        fontWeight: 700,
        cursor: subiendo ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        opacity: subiendo ? 0.6 : 1,
      }
    : {
        padding: '10px 14px',
        borderRadius: '10px',
        border: `1px solid ${tinta(0.15)}`,
        background: tinta(0.06),
        color: 'var(--label-primary)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: subiendo ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        opacity: subiendo ? 0.6 : 1,
      };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: compacto ? '6px' : '10px', alignItems: 'center' }}>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          void onFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          void onFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <button type="button" disabled={subiendo} onClick={() => galleryRef.current?.click()} style={btn}>
        {subiendo ? 'Subiendo…' : compacto ? '📁 Foto' : '📁 Elegir archivo'}
      </button>
      <button type="button" disabled={subiendo} onClick={() => cameraRef.current?.click()} style={btn}>
        {compacto ? '📷' : '📷 Cámara'}
      </button>
      {error ? (
        <span style={{ fontSize: '11px', color: 'var(--tono-coral)', fontWeight: 600 }}>{error}</span>
      ) : null}
    </div>
  );
}
