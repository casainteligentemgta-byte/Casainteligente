import { redirect } from 'next/navigation';

/** Alias legacy → NetVision PRO en el menú inferior. */
export default function PruebaCamaraPage() {
  redirect('/netvision');
}
