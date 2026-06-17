import { redirect } from 'next/navigation';

/** Flujo antiguo de procurement bloqueado → recepción en tránsito. */
export default function ProcurementPage() {
  redirect('/almacen/recepcion?tab=transito');
}
