/**
 * Destino del enlace «Lista de contratos express» en /talento.
 *
 * Por defecto apunta al deployment de preview donde sigue existiendo la ruta legacy
 * `/talento/admin/contratos/fast-list`. Para otro host o ruta, define en `.env.local`:
 * `NEXT_PUBLIC_TALENTO_EXPRESS_LIST_URL` (URL completa, sin barra final).
 */
const DEFAULT_LIST_URL =
  'https://casainteligente-8wejbwru1-luis-vicente-mata-ortizs-projects.vercel.app/talento/admin/contratos/fast-list';

export function hrefListaContratosExpress(): string {
  const fromEnv =
    typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_TALENTO_EXPRESS_LIST_URL ?? '').trim() : '';
  const raw = fromEnv || DEFAULT_LIST_URL;
  return raw.replace(/\/$/, '');
}
