import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Dispositivo } from '@/types/dispositivo';

/**
 * Página de listado de dispositivos desde Supabase.
 * Si la tabla no existe, muestra instrucciones para ejecutar el SQL.
 */
export default async function DispositivosPage() {
  let dispositivos: Dispositivo[] = [];
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error: err } = await supabase
      .from('dispositivos')
      .select('id, nombre, tipo, habitacion, encendido, creado_en, actualizado_en')
      .order('nombre');

    if (err) {
      error = err.message;
    } else if (data) {
      dispositivos = data as Dispositivo[];
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error al conectar con Supabase';
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <Link
        href="/"
        style={{ color: 'var(--muted)', marginBottom: '1rem', display: 'inline-block' }}
      >
        ← Inicio
      </Link>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        Dispositivos
      </h1>

      {error && (
        <section
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <p style={{ color: '#f85149', marginBottom: '0.5rem' }}>
            No se pudo cargar la lista: {error}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Si aún no creaste la tabla, abre Supabase → SQL Editor y ejecuta el
            contenido de <code>supabase/migrations/001_dispositivos.sql</code>.
            Asegúrate de tener <code>.env.local</code> con la URL y la anon key
            de tu proyecto.
          </p>
        </section>
      )}

      {!error && dispositivos.length === 0 && (
        <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>
          No hay dispositivos. Añade datos en Supabase (Table Editor) o ejecuta
          el SQL de ejemplo en <code>supabase/migrations/001_dispositivos.sql</code>.
        </p>
      )}

      {!error && dispositivos.length > 0 && (
        <ul
          style={{
            marginTop: '1rem',
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {dispositivos.map((d) => (
            <li
              key={d.id}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--surface)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>
                <strong>{d.nombre}</strong>
                {d.habitacion && (
                  <span style={{ color: 'var(--muted)', marginLeft: '0.5rem' }}>
                    — {d.habitacion}
                  </span>
                )}
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                  textTransform: 'capitalize',
                }}
              >
                {d.tipo}
                {' · '}
                {d.encendido ? (
                  <span style={{ color: 'var(--success)' }}>Encendido</span>
                ) : (
                  <span>Apagado</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
