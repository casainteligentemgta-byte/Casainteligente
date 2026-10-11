import { NextResponse } from 'next/server';
import { consultarPrecioProveedor, type FetchMinimo } from '@/lib/productos/precioProveedorWeb';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/**
 * Lee el precio de un producto en la web de su proveedor.
 *
 * Pide sesión (el middleware cierra toda ruta de /api que no esté en la lista de abiertas).
 * Solo abre páginas de producto de los proveedores admitidos: ver
 * `lib/productos/precioProveedorWeb.ts`.
 */
export async function POST(req: Request) {
  let url = '';
  try {
    const cuerpo = (await req.json()) as { url?: unknown };
    url = typeof cuerpo.url === 'string' ? cuerpo.url : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'Falta el enlace.' }, { status: 400 });
  }

  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 12_000);
  try {
    const resultado = await consultarPrecioProveedor(url, fetch as unknown as FetchMinimo, corte.signal);
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 422 });
  } finally {
    clearTimeout(reloj);
  }
}
