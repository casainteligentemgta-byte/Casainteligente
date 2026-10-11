'use client';

import { usePreferenciaTema } from './usePreferenciaTema';

/**
 * Mantiene el tema al día en todas las pantallas (si el teléfono pasa de claro a oscuro,
 * o si se cambia la preferencia en otra pestaña). No pinta nada.
 */
export default function TemaSync() {
  usePreferenciaTema();
  return null;
}
