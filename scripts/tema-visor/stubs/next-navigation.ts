const estado = (globalThis as any).__VISOR__ ?? { params: {}, pathname: '/', search: '' };
export function useRouter() {
  return { push() {}, replace() {}, back() {}, refresh() {}, prefetch() {} };
}
export function useParams() { return (globalThis as any).__VISOR__?.params ?? {}; }
export function usePathname() { return (globalThis as any).__VISOR__?.pathname ?? '/'; }
// Siempre el mismo objeto: las pantallas lo usan como dependencia de sus efectos.
let parametros: URLSearchParams | null = null;
export function useSearchParams() {
  if (!parametros) parametros = new URLSearchParams((globalThis as any).__VISOR__?.search ?? '');
  return parametros;
}
export function redirect() {}
export function notFound() {}
