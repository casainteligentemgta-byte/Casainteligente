import { redirect } from 'next/navigation';

/** La vista previa pasó a la pantalla real con datos vivos. */
export default function VistaPreviaCcoRedirect() {
  redirect('/contabilidad/cco');
}
