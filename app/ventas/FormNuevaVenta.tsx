'use client';

import { useState } from 'react';
import type { Empresa } from '@/types/empresa';
import type { Persona } from '@/types/persona';
import type { Producto } from '@/types/producto';
import { crearVenta } from './actions';

interface Props {
  empresas: Empresa[];
  personas: Persona[];
  productos: Producto[];
}

function nombrePersona(p: Persona) {
  return [p.nombre, p.apellidos].filter(Boolean).join(' ') || p.nombre;
}

export default function FormNuevaVenta({ empresas, personas, productos }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await crearVenta(new FormData(e.currentTarget));
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar venta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Nueva venta sencilla</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Cliente (empresa o persona)</span>
          <select
            name="cliente_ref"
            required
            style={{
              padding: '0.4rem 0.5rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'inherit',
            }}
          >
            <option value="">Selecciona cliente…</option>
            {empresas.length > 0 && (
              <optgroup label="Empresas">
                {empresas.map((e) => (
                  <option key={`empresa:${e.id}`} value={`empresa:${e.id}`}>
                    {e.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            {personas.length > 0 && (
              <optgroup label="Personas">
                {personas.map((p) => (
                  <option key={`persona:${p.id}`} value={`persona:${p.id}`}>
                    {nombrePersona(p)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Producto</span>
          <select
            name="producto_id"
            required
            style={{
              padding: '0.4rem 0.5rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'inherit',
            }}
          >
            <option value="">Selecciona producto…</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({Number(p.precio).toFixed(2)})
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Cantidad</span>
          <input
            name="cantidad"
            required
            type="number"
            step="0.001"
            min="0.001"
            defaultValue="1"
            style={{
              padding: '0.4rem 0.5rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'inherit',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Precio unitario (se puede ajustar)
          </span>
          <input
            name="precio_unitario"
            required
            type="number"
            step="0.01"
            min="0"
            style={{
              padding: '0.4rem 0.5rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'inherit',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Notas</span>
          <textarea
            name="notas"
            rows={2}
            style={{
              padding: '0.4rem 0.5rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
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
            {enviando ? 'Guardando…' : 'Guardar venta'}
          </button>
        </div>
      </form>
    </section>
  );
}

