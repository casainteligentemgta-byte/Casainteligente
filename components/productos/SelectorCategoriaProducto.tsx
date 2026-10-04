'use client';

import { useState } from 'react';
import { useCategoriasCatalogo } from '@/lib/productos/useCategoriasCatalogo';

const NUEVA_OPCION = '__nueva_categoria__';

type Props = {
  value: string;
  onChange: (nombre: string) => void;
  inputStyle: React.CSSProperties;
  fieldBox: React.CSSProperties;
  labelStyle: React.CSSProperties;
};

export default function SelectorCategoriaProducto({
  value,
  onChange,
  inputStyle,
  fieldBox,
  labelStyle,
}: Props) {
  const { nombres, crear } = useCategoriasCatalogo();
  const [modoNueva, setModoNueva] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = value && !nombres.some((n) => n.toLowerCase() === value.toLowerCase())
    ? [...nombres, value]
    : nombres;

  const handleSelect = (next: string) => {
    if (next === NUEVA_OPCION) {
      setModoNueva(true);
      setNombreNueva('');
      setError(null);
      return;
    }
    setModoNueva(false);
    onChange(next);
  };

  const guardarNueva = async () => {
    setCreando(true);
    setError(null);
    try {
      const creada = await crear(nombreNueva);
      onChange(creada);
      setModoNueva(false);
      setNombreNueva('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la categoría');
    } finally {
      setCreando(false);
    }
  };

  return (
    <div style={fieldBox}>
      <label style={labelStyle}>Categoría</label>
      {!modoNueva ? (
        <select
          value={value}
          onChange={(e) => handleSelect(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="" style={{ color: '#000000' }}>
            Sin categoría
          </option>
          {opciones.map((c) => (
            <option key={c} value={c} style={{ color: '#000000' }}>
              {c}
            </option>
          ))}
          <option value={NUEVA_OPCION} style={{ color: '#000000' }}>
            + Nueva categoría…
          </option>
        </select>
      ) : (
        <div>
          <input
            type="text"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            placeholder="Nombre de la categoría"
            disabled={creando}
            autoFocus
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void guardarNueva();
              }
              if (e.key === 'Escape') {
                setModoNueva(false);
                setError(null);
              }
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              disabled={creando}
              onClick={() => void guardarNueva()}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'rgba(52,199,89,0.2)',
                color: '#34C759',
                fontSize: '13px',
                fontWeight: 700,
                cursor: creando ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {creando ? 'Creando…' : 'Crear'}
            </button>
            <button
              type="button"
              disabled={creando}
              onClick={() => {
                setModoNueva(false);
                setError(null);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p style={{ color: '#FF8A80', fontSize: '12px', fontWeight: 600, margin: '8px 0 0' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
