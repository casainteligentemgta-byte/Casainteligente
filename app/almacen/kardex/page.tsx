import { redirect } from 'next/navigation';

/** Kardex unificado en Trazabilidad (ledger inv_movimientos). */
export default function KardexRedirectPage() {
  redirect('/almacen/trazabilidad?vista=kardex');
}
