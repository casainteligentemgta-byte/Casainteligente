import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { Persona } from '@/types/persona';
import FormNuevaPersona from './FormNuevaPersona';

export default async function PersonasPage() {
  let personas: Persona[] = [];
  let error: string | null = null;

  try {
    const supabase = createClient(cookies());
    const { data, error: supaError } = await supabase
      .from('personas')
      .select(
        'id, nombre, apellidos, documento, direccion, ciudad, codigo_postal, telefono, email, creado_en, actualizado_en',
      )
      .order('nombre');

    if (supaError) error = supaError.message;
    else if (data) personas = data as Persona[];
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error al conectar con Supabase';
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <Link
        href="/clientes"
        style={{ color: 'var(--muted)', marginBottom: '1rem', display: 'inline-block' }}
      >
        ← Clientes
      </Link>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Personas</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.95rem' }}>
        Clientes físicos (personas naturales).
      </p>

      {error && (
        <p style={{ color: '#f85149', marginTop: '0.5rem' }}>
          No se pudo cargar: {error}. Ejecuta en Supabase el SQL de{' '}
          <code>supabase/migrations/005_personas.sql</code>.
        </p>
      )}

      {!error && (
        <>
          <FormNuevaPersona />

          {personas.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No hay personas. Añade una con el botón superior.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Nombre
                    </th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Apellidos
                    </th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Documento
                    </th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Ciudad
                    </th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Teléfono
                    </th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{p.nombre}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>
                        {p.apellidos ?? '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>
                        {p.documento ?? '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>
                        {p.ciudad ?? '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>
                        {p.telefono ?? '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>
                        {p.email ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
