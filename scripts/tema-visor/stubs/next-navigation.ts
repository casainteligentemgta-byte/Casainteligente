const estado = (globalThis as any).__VISOR__ ?? { params: {}, pathname: '/', search: '' };
export function useRouter() {
  return { push() {}, replace() {}, back() {}, refresh() {}, prefetch() {} };
}
export function useParams() { return (globalThis as any).__VISOR__?.params ?? {}; }
export function usePathname() { return (globalThis as any).__VISOR__?.pathname ?? '/'; }
export function useSearchParams() { return new URLSearchParams((globalThis as any).__VISOR__?.search ?? ''); }
export function redirect() {}
export function notFound() {}
