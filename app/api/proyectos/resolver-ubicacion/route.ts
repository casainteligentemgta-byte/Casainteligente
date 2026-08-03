import { NextResponse } from 'next/server';
import {
  esUrlCortaMapas,
  parseUbicacionCompartida,
} from '@/lib/proyectos/parseUbicacionCompartida';

export const runtime = 'nodejs';

/**
 * POST { texto: string }
 * Resuelve ubicación pegada; si es link corto de Maps, sigue redirecciones en servidor.
 */
export async function POST(req: Request) {
  let texto = '';
  try {
    const body = (await req.json()) as { texto?: unknown };
    texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!texto) {
    return NextResponse.json({ error: 'Falta el texto pegado' }, { status: 400 });
  }

  let resolvedText = texto;
  if (esUrlCortaMapas(texto)) {
    const urlMatch = texto.match(/https?:\/\/[^\s<>"']+/i);
    const shortUrl = urlMatch?.[0] ?? texto;
    try {
      const res = await fetch(shortUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'CasaInteligenteUbicacion/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(12_000),
      });
      const finalUrl = res.url || shortUrl;
      resolvedText = finalUrl;
      // A veces el HTML aún tiene el destino en meta refresh / canonical
      if (!parseUbicacionCompartida(finalUrl).ok) {
        const html = await res.text().catch(() => '');
        const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
        const og = html.match(/property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
        const metaUrl = canon?.[1] || og?.[1];
        if (metaUrl) resolvedText = metaUrl;
      }
    } catch {
      return NextResponse.json(
        {
          error:
            'No pude abrir el link corto. Ábrelo en el navegador, copia la URL larga de Maps y pégala de nuevo.',
        },
        { status: 422 },
      );
    }
  }

  const parsed = parseUbicacionCompartida(resolvedText);
  if (parsed.ok) {
    return NextResponse.json({
      ok: true,
      lat: parsed.lat,
      lng: parsed.lng,
      label: parsed.label ?? null,
      fuente: parsed.fuente,
      resolved_url: resolvedText !== texto ? resolvedText : null,
    });
  }

  if (parsed.error.startsWith('LINK_QUERY:')) {
    const q = parsed.error.slice('LINK_QUERY:'.length).trim();
    return NextResponse.json({
      ok: false,
      needs_geocode: true,
      query: q,
      error: null,
    });
  }

  if (parsed.error === 'SHORT_URL') {
    return NextResponse.json(
      {
        error:
          'El link corto no devolvió coordenadas. Copia la URL completa de Google Maps y pégala otra vez.',
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ error: parsed.error }, { status: 422 });
}
