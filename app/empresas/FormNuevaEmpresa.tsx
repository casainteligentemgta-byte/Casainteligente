'use client';

import { useState } from 'react';
import { crearEmpresa } from './actions';

const campos: { name: string; label: string; required?: boolean }[] = [
  { name: 'nombre', label: 'Nombre', required: true },
  { name: 'cif', label: 'CIF / NIF' },
  { name: 'direccion', label: 'Dirección' },
  { name: 'ciudad', label: 'Ciudad' },
  { name: 'codigo_postal', label: 'Código postal' },
  { name: 'telefono', label: 'Teléfono' },
  { name: 'email', label: 'Email' },
];

export default function FormNuevaEmpresa() {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await crearEmpresa(new FormData(e.currentTarget));
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
          + Añadir empresa
        </button>
      ) : (
        <div
          style={{
            padding: '1rem',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
            Nueva empresa
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {campos.map(({ name, label, required: isRequired }) => (
              <label key={name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{label}</span>
                <input
                  name={name}
                  required={!!isRequired}
                  type={name === 'email' ? 'email' : 'text'}
                  style={{
                    padding: '0.4rem 0.5rem',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'inherit',
                  }}
                />
              </label>
            ))}
            {error && <p style={{ color: '#f85149', fontSize: '0.9rem' }}>{error}</p>}
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
                  border: '1px solid var(--border)',
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
