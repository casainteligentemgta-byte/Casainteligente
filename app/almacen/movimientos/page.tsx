import dynamic from 'next/dynamic';

const MovimientosInventarioClient = dynamic(() => import('./MovimientosInventarioClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#050508] text-white p-4 md:p-6 pb-24 flex items-center justify-center">
      <p className="text-sm text-zinc-500">Cargando movimientos…</p>
    </div>
  ),
});

export const metadata = {
  title: 'Movimientos de almacén | Casa Inteligente',
};

export default function MovimientosAlmacenPage() {
  return <MovimientosInventarioClient />;
}
