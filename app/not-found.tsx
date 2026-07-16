import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <h1 className="text-2xl font-bold text-[var(--label-primary)]">Página no encontrada</h1>
      <p className="text-sm text-[var(--label-secondary)]">La ruta que buscas no existe o fue movida.</p>
      <Link
        href="/"
        className="rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0062CC]"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
