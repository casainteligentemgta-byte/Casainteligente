import { redirect } from 'next/navigation';

/** Legacy → hub único de almacén. */
export default function TrazabilidadLegacyPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  qs.set('cuadro', 'trazabilidad');
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    qs.set(k, Array.isArray(v) ? v[0] : v);
  }
  redirect(`/almacen?${qs.toString()}`);
}
