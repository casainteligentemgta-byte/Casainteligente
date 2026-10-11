'use client';

import { useState } from 'react';
import { subcategoriasDe } from '@/lib/productos/categoriasCatalogo';
import { useCategoriasCatalogo } from '@/lib/productos/useCategoriasCatalogo';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

const NUEVA_OPCION = '__nueva_categoria__';
const NUEVA_SUB = '__nueva_subcategoria__';

type Props = {
  value: string;
  onChange: (nombre: string) => void;
  /** Subcategoría dentro de la categoría elegida ('' = sin subcategoría). */
  subcategoria?: string;
  onSubcategoriaChange?: (nombre: string) => void;
  inputStyle: React.CSSProperties;
  fieldBox: React.CSSProperties;
  labelStyle: React.CSSProperties;
};

export default function SelectorCategoriaProducto({
  value,
  onChange,
  subcategoria = '',
  onSubcategoriaChange,
  inputStyle,
  fieldBox,
  labelStyle,
}: Props) {
  const { nombres, subcategorias, crear, crearSub } = useCategoriasCatalogo();
  const [modoNuevaSub, setModoNuevaSub] = useState(false);
  const [nombreNuevaSub, setNombreNuevaSub] = useState('');
  const [creandoSub, setCreandoSub] = useState(false);
  const [errorSub, setErrorSub] = useState<string | null>(null);
  const [modoNueva, setModoNueva] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = value && !nombres.some((n) => n.toLowerCase() === value.toLowerCase())
    ? [...nombres, value]
    : nombres;

  const subsDeCategoria = subcategoriasDe({ subcategorias }, value);
  const opcionesSub =
    subcategoria && !subsDeCategoria.some((n) => n.toLowerCase() === subcategoria.toLowerCase())
      ? [...subsDeCategoria, subcategoria]
      : subsDeCategoria;

  const handleSelectSub = (next: string) => {
    if (next === NUEVA_SUB) {
      setModoNuevaSub(true);
      setNombreNuevaSub('');
      setErrorSub(null);
      return;
    }
    setModoNuevaSub(false);
    onSubcategoriaChange?.(next);
  };

  const guardarNuevaSub = async () => {
    setCreandoSub(true);
    setErrorSub(null);
    try {
      const creada = await crearSub(value, nombreNuevaSub);
      onSubcategoriaChange?.(creada);
      setModoNuevaSub(false);
      setNombreNuevaSub('');
    } catch (e) {
      setErrorSub(e instanceof Error ? e.message : 'No se pudo crear la subcategoría');
    } finally {
      setCreandoSub(false);
    }
  };

  const handleSelect = (next: string) => {
    if (next === NUEVA_OPCION) {
      setModoNueva(true);
      setNombreNueva('');
      setError(null);
      return;
    }
    setModoNueva(false);
    setModoNuevaSub(false);
    setErrorSub(null);
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
                color: 'var(--tono-verde)',
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
                border: `1px solid ${tinta(0.15)}`,
                background: 'transparent',
                color: tintaTexto(0.55),
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
        <p style={{ color: 'var(--tono-coral)', fontSize: '12px', fontWeight: 600, margin: '8px 0 0' }}>
          {error}
        </p>
      ) : null}

      {onSubcategoriaChange && value && !modoNueva ? (
        <div style={{ marginTop: '14px' }} data-subcategoria>
          <label style={labelStyle}>Subcategoría</label>
          {!modoNuevaSub ? (
            <select
              value={subcategoria}
              onChange={(e) => handleSelectSub(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="" style={{ color: '#000000' }}>
                Sin subcategoría
              </option>
              {opcionesSub.map((c) => (
                <option key={c} value={c} style={{ color: '#000000' }}>
                  {c}
                </option>
              ))}
              <option value={NUEVA_SUB} style={{ color: '#000000' }}>
                + Nueva subcategoría…
              </option>
            </select>
          ) : (
            <div>
              <input
                type="text"
                value={nombreNuevaSub}
                onChange={(e) => setNombreNuevaSub(e.target.value)}
                placeholder={`Nueva subcategoría de ${value}`}
                disabled={creandoSub}
                autoFocus
                style={inputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void guardarNuevaSub();
                  }
                  if (e.key === 'Escape') {
                    setModoNuevaSub(false);
                    setErrorSub(null);
                  }
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  disabled={creandoSub}
                  onClick={() => void guardarNuevaSub()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'rgba(52,199,89,0.2)',
                    color: 'var(--tono-verde)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: creandoSub ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {creandoSub ? 'Creando…' : 'Crear'}
                </button>
                <button
                  type="button"
                  disabled={creandoSub}
                  onClick={() => {
                    setModoNuevaSub(false);
                    setErrorSub(null);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${tinta(0.15)}`,
                    background: 'transparent',
                    color: tintaTexto(0.55),
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
          {errorSub ? (
            <p style={{ color: 'var(--tono-coral)', fontSize: '12px', fontWeight: 600, margin: '8px 0 0' }}>
              {errorSub}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
