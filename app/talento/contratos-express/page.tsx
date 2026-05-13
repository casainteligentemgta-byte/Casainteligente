import Link from 'next/link';
import { ContratosExpressListaTalento } from './ContratosExpressListaTalento';

export const metadata = {
  title: 'Contratos express | Talento',
};

export default function TalentoContratosExpressListPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 pb-28">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-xs">
        <Link href="/talento" className="text-zinc-500 hover:text-zinc-300">
          ← Talento
        </Link>
        <Link href="/talento/admin/contratos/fast-create" className="text-amber-500/90 hover:text-amber-400">
          Nuevo express
        </Link>
        <Link href="/talento/admin/contratos" className="text-zinc-500 hover:text-zinc-300">
          Contratos dinámicos
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Contratos express (sin registro)</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Listado de filas en <code className="text-zinc-500">ci_contratos_express</code>. Desde el proyecto (Solicitados)
        también puedes gestionar enlaces y borrados.
      </p>
      <ContratosExpressListaTalento />
    </div>
  );
}
