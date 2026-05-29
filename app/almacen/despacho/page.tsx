import DespachoInventarioClient from './DespachoInventarioClient';
import { Suspense } from 'react';

export const metadata = {
  title: 'Despacho a obra | Almacén',
};

export default function DespachoInventarioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-zinc-500 text-sm">Cargando…</div>}>
      <DespachoInventarioClient />
    </Suspense>
  );
}
