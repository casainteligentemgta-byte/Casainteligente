import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Empresa } from '@/types/empresa';
import FormNuevaEmpresa from './FormNuevaEmpresa';

export default async function EmpresasPage() {
  let empresas: Empresa[] = [];
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const { data, err } = await supabase
      .from('empresas')
      .select('id, nombre, cif, direccion, ciudad, codigo_postal, telefono, email, creado_en, actualizado_en')
      .order('nombre');

    if (err) error = err.message;
    else if (data) empresas = data as Empresa[];
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error al conectar con Supabase';
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <Link
        href="/"
        style={{ color: 'var(--muted)', marginBottom: '1rem', display: 'inline-block' }}
      >
        ← Inicio
      </Link>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Empresas</h1>

      {error && (
        <p style={{ color: '#f85149', marginTop: '0.5rem' }}>
          No se pudo cargar: {error}. Ejecuta en Supabase el SQL de{' '}
          <code>supabase/migrations/002_empresas.sql</code>.
        </p>
      )}

      {!error && (
        <>
          <FormNuevaEmpresa />

          {empresas.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No hay empresas. Añade una con el botón superior.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Nombre</th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>CIF</th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Dirección</th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Ciudad</th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Teléfono</th>
                    <th style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{e.nombre}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>{e.cif ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>{e.direccion ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>{e.ciudad ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>{e.telefono ?? '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--muted)' }}>{e.email ?? '—'}</td>
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
