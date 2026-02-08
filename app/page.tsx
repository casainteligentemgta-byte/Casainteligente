import MenuDropdown from './components/MenuDropdown';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '1.5rem',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>
        Casa Inteligente
      </h1>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <MenuDropdown />
      </nav>
    </main>
  );
}
