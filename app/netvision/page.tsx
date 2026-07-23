import { redirect } from 'next/navigation';

/**
 * Alias del menú inferior → NetVision Pro completo (CCTV, Red, Muros, Cable, Sub, Norm, Ajustes).
 * Antes apuntaba a un panel reducido (solo espectro de cámara).
 */
export default function NetVisionPage() {
  redirect('/nexus/vision');
}
