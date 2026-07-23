import { redirect } from 'next/navigation';

/** Alias legacy → NetVision Pro completo. */
export default function PruebaCamaraPage() {
  redirect('/nexus/vision');
}
