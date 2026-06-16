import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Movimientos de almacén | Casa Inteligente',
};

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

/** Redirige al cuadro unificado en /almacen (vista movimientos por defecto). */
export default function MovimientosAlmacenPage({ searchParams }: PageProps) {
  const qs = new URLSearchParams();
  qs.set('cuadro', 'movimientos');

  for (const [key, raw] of Object.entries(searchParams)) {
    const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const value of values) {
      if (key === 'vista') {
        qs.set('movVista', value);
      } else if (key !== 'cuadro') {
        qs.set(key, value);
      }
    }
  }

  const query = qs.toString();
  redirect(query ? `/almacen?${query}` : '/almacen?cuadro=movimientos');
}
