import Link from 'next/link';

export default function MenuPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <Link
        href="/"
        style={{ color: 'var(--muted)', marginBottom: '1rem', display: 'inline-block' }}
      >
        ← Inicio
      </Link>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Menú</h1>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Link
          href="/dispositivos"
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          Dispositivos
        </Link>
      </nav>
    </main>
  );
}
