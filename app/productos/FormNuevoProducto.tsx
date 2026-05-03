'use client';

import { useState } from 'react';
import { crearProducto } from './actions';

export default function FormNuevoProducto() {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await crearProducto(new FormData(e.currentTarget));
      setAbierto(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section style={{ marginBottom: '1.5rem' }}>
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + Añadir producto
        </button>
      ) : (
        <div
          style={{
            padding: '1rem',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
            Nuevo producto
          </h2>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Nombre</span>
              <input
                name="nombre"
                required
                style={{
                  padding: '0.4rem 0.5rem',
                  background: 'var(--bg)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'inherit',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Precio</span>
              <input
                name="precio"
                required
                type="number"
                step="0.01"
                min="0"
                style={{
                  padding: '0.4rem 0.5rem',
                  background: 'var(--bg)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'inherit',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Descripción</span>
              <textarea
                name="descripcion"
                rows={3}
                style={{
                  padding: '0.4rem 0.5rem',
                  background: 'var(--bg)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>

            {error && (
              <p style={{ color: '#f85149', fontSize: '0.9rem' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={enviando}
                style={{
                  padding: '0.4rem 0.75rem',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: enviando ? 'not-allowed' : 'pointer',
                }}
              >
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                style={{
                  padding: '0.4rem 0.75rem',
                  background: 'transparent',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

