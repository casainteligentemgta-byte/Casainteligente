import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

type ResultadoConteo = {
  ok: boolean;
  total: number;
  error?: string;
};

/**
 * Cuenta filas usando `id` (más fiable que `*` con head en PostgREST).
 */
async function contar(tabla: string): Promise<ResultadoConteo> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from(tabla)
      .select('id', { count: 'exact', head: true });

    if (error) {
      return { ok: false, total: 0, error: error.message };
    }
    return { ok: true, total: count ?? 0 };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Error al conectar con Supabase';
    return { ok: false, total: 0, error: msg };
  }
}

export default async function DashboardPage() {
  const [empresas, personas, productos, ventas] = await Promise.all([
    contar('empresas'),
    contar('personas'),
    contar('productos'),
    contar('ventas'),
  ]);

  const stats = [
    {
      label: 'Empresas',
      value: empresas.total,
      ok: empresas.ok,
      error: empresas.error,
      href: '/empresas',
      hint: 'Clientes jurídicos',
    },
    {
      label: 'Personas',
      value: personas.total,
      ok: personas.ok,
      error: personas.error,
      href: '/personas',
      hint: 'Clientes físicos',
    },
    {
      label: 'Productos',
      value: productos.total,
      ok: productos.ok,
      error: productos.error,
      href: '/productos',
      hint: 'Catálogo',
    },
    {
      label: 'Ventas',
      value: ventas.total,
      ok: ventas.ok,
      error: ventas.error,
      href: '/ventas',
      hint: 'Registro de ventas',
    },
  ];

  const primerError = stats.find((s) => !s.ok && s.error)?.error;
  const hayFallo = stats.some((s) => !s.ok);

  const accesos = [
    { label: 'Clientes', href: '/clientes', desc: 'Personas y empresas' },
    { label: 'Productos', href: '/productos', desc: 'Catálogo y precios' },
    { label: 'Ventas', href: '/ventas', desc: 'Nuevas ventas y listado' },
  ];

  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Dashboard — Casa Inteligente
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
            Resumen de clientes, productos y ventas.
          </p>
        </div>
        <Link
          href="/"
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            color: 'inherit',
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          ← Inicio
        </Link>
      </div>

      {hayFallo && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: 'rgba(248, 81, 73, 0.12)',
            border: '1px solid rgba(248, 81, 73, 0.4)',
            borderRadius: '8px',
            fontSize: '0.9rem',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
            No se pudieron cargar todos los conteos
          </strong>
          {primerError && (
            <p style={{ marginBottom: '0.5rem', wordBreak: 'break-word' }}>
              <code style={{ fontSize: '0.85rem' }}>{primerError}</code>
            </p>
          )}
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--muted)' }}>
            <li>
              En <strong>.env.local</strong> (raíz del proyecto):{' '}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
              deben ser los de Supabase → <strong>Project Settings → API</strong> (mismo proyecto donde
              ejecutaste el SQL).
            </li>
            <li>
              Sin comillas alrededor de los valores; sin espacios extra al final de la línea.
            </li>
            <li>
              Tras cambiar <code>.env.local</code>, reinicia <code>npm run dev</code>.
            </li>
            <li>
              Comprueba en Supabase → <strong>Table Editor</strong> que existan las tablas:{' '}
              <code>empresas</code>, <code>personas</code>, <code>productos</code>, <code>ventas</code>.
            </li>
            <li>
              Si el error es <code>TypeError: fetch failed</code>, suele ser <strong>red o firewall</strong>, no
              las tablas. Lee en el repo: <code>docs/ERROR-FETCH-FAILED-SUPABASE.md</code>.
            </li>
          </ul>
        </div>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          Resumen
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              style={{
                padding: '1rem',
                background: 'var(--surface)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                {!s.ok ? '—' : s.value}
              </div>
              <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{s.label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                {s.hint}
              </div>
              {!s.ok && s.error && (
                <div style={{ fontSize: '0.75rem', color: '#f85149', marginTop: '0.35rem' }}>
                  {s.error}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          Accesos rápidos
        </h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {accesos.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: 'var(--surface)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontWeight: 600 }}>{a.label}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{a.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
