import { redirect } from 'next/navigation';

/** Atajo: mismo contenido que /ventas/preview?demo=1 */
export default function PresupuestoDemoPage() {
  redirect('/ventas/preview?demo=1');
}
