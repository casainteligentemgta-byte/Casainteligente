/**
 * Parsea ubicaciones compartidas (WhatsApp, Google/Apple Maps, geo:, lat/lng)
 * para fijar GPS y etiqueta de proyecto.
 */

export type UbicacionCompartidaOk = {
  ok: true;
  lat: number;
  lng: number;
  /** Texto sugerido para `ubicacion_texto` (si se pudo inferir). */
  label?: string;
  fuente: 'coords' | 'geo' | 'google_maps' | 'apple_maps' | 'query_text';
};

export type UbicacionCompartidaErr = {
  ok: false;
  error: string;
};

export type UbicacionCompartidaResult = UbicacionCompartidaOk | UbicacionCompartidaErr;

const LAT_RE = /^-?([1-8]?\d(\.\d+)?|90(\.0+)?)$/;
const LNG_RE = /^-?(1[0-7]\d(\.\d+)?|[1-9]?\d(\.\d+)?|180(\.0+)?)$/;

function isFiniteCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function pairFromStrings(a: string, b: string): { lat: number; lng: number } | null {
  const lat = Number(a);
  const lng = Number(b);
  if (!isFiniteCoord(lat, lng)) return null;
  // Heurística: si el primero parece longitud típica VE (|x|>40) y el segundo latitud, no invertir.
  // Mantener orden lat,lng estándar.
  if (!LAT_RE.test(a.trim()) || !LNG_RE.test(b.trim())) {
    // Aún aceptar si están en rango geográfico
    if (!isFiniteCoord(lat, lng)) return null;
  }
  return { lat, lng };
}

function decodeMaybe(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/** Extrae primer par lat,lng de un texto libre. */
function extractLatLngPair(raw: string): { lat: number; lng: number } | null {
  const t = raw.trim();
  // 10.48, -66.90 | 10.48;-66.90 | 10.48 -66.90
  const m = t.match(
    /(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/,
  );
  if (!m) return null;
  return pairFromStrings(m[1]!, m[2]!);
}

function parseGeoUri(raw: string): UbicacionCompartidaResult | null {
  const m = raw.trim().match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[;?].*)?$/i);
  if (!m) return null;
  const pair = pairFromStrings(m[1]!, m[2]!);
  if (!pair) return { ok: false, error: 'Coordenadas geo: fuera de rango.' };
  return { ok: true, ...pair, fuente: 'geo' };
}

function tryUrl(raw: string): URL | null {
  const t = raw.trim();
  try {
    if (/^https?:\/\//i.test(t)) return new URL(t);
    if (/^(maps\.app\.goo\.gl|goo\.gl|maps\.google\.|google\.[^/]+\/maps|maps\.apple\.com)/i.test(t)) {
      return new URL(`https://${t}`);
    }
  } catch {
    return null;
  }
  return null;
}

function labelFromQuery(q: string | null): string | undefined {
  if (!q) return undefined;
  const t = decodeMaybe(q).trim();
  if (!t) return undefined;
  // Si la query ya es solo coordenadas, no usarla como etiqueta escrita
  if (extractLatLngPair(t)) return undefined;
  if (t.length < 3 || t.length > 280) return undefined;
  return t;
}

function parseGoogleOrAppleMapsUrl(u: URL): UbicacionCompartidaResult | null {
  const host = u.hostname.toLowerCase();
  const isGoogle =
    host.includes('google.') ||
    host === 'goo.gl' ||
    host === 'maps.app.goo.gl' ||
    host.endsWith('goo.gl');
  const isApple = host.includes('apple.com') || host.includes('maps.apple');

  if (!isGoogle && !isApple) return null;

  const fuente = isApple ? 'apple_maps' : 'google_maps';

  // Path: /maps/@lat,lng,zoom  o /maps/place/.../@lat,lng
  const at = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const pair = pairFromStrings(at[1]!, at[2]!);
    if (pair) {
      const qLabel =
        labelFromQuery(u.searchParams.get('q')) ||
        labelFromQuery(u.searchParams.get('query')) ||
        labelFromQuery(u.searchParams.get('address'));
      return { ok: true, ...pair, label: qLabel, fuente };
    }
  }

  // !3dLAT!4dLNG (data param de Google)
  const data = `${u.pathname}${u.search}${u.hash}`;
  const bang = data.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bang) {
    const pair = pairFromStrings(bang[1]!, bang[2]!);
    if (pair) return { ok: true, ...pair, fuente };
  }

  // ll=lat,lng (Apple) | q=lat,lng | query= | center=
  for (const key of ['ll', 'q', 'query', 'center', 'sll', 'daddr', 'saddr', 'destination']) {
    const v = u.searchParams.get(key);
    if (!v) continue;
    const pair = extractLatLngPair(decodeMaybe(v));
    if (pair) {
      const qLabel =
        labelFromQuery(u.searchParams.get('q')) ||
        labelFromQuery(u.searchParams.get('query')) ||
        labelFromQuery(u.searchParams.get('address'));
      return {
        ok: true,
        ...pair,
        label: qLabel,
        fuente,
      };
    }
    const asLabel = labelFromQuery(v);
    if (asLabel && (key === 'q' || key === 'query' || key === 'address')) {
      // Sin coords: caller puede geocodificar
      return {
        ok: false,
        error: `LINK_QUERY:${asLabel}`,
      };
    }
  }

  // Coordenadas sueltas en toda la URL
  const anyPair = extractLatLngPair(decodeMaybe(`${u.pathname}?${u.search}`));
  if (anyPair) return { ok: true, ...anyPair, fuente };

  if (host === 'maps.app.goo.gl' || host === 'goo.gl' || host.endsWith('app.goo.gl')) {
    return {
      ok: false,
      error: 'SHORT_URL',
    };
  }

  return {
    ok: false,
    error: 'No encontré coordenadas en el enlace de Maps. Prueba «Abrir» el link, copiar la URL larga o pegar lat, lng.',
  };
}

/**
 * Interpreta texto pegado (enlace Maps, geo:, o coordenadas).
 * Si el resultado es solo una dirección sin coords, `error` empieza por `LINK_QUERY:` + texto.
 * Si es link corto sin resolver, `error === 'SHORT_URL'`.
 */
export function parseUbicacionCompartida(raw: string): UbicacionCompartidaResult {
  const t = (raw ?? '').trim();
  if (!t) return { ok: false, error: 'Pega un enlace de Maps, geo: o coordenadas (lat, lng).' };

  const geo = parseGeoUri(t);
  if (geo) return geo;

  // URL en cualquier parte del mensaje (WhatsApp a veces manda texto + link)
  const urlMatch = t.match(/https?:\/\/[^\s<>"']+/i);
  const urlCandidate = urlMatch?.[0] ?? t;
  const u = tryUrl(urlCandidate);
  if (u) {
    const mapped = parseGoogleOrAppleMapsUrl(u);
    if (mapped) return mapped;
  }

  const pair = extractLatLngPair(t);
  if (pair) return { ok: true, ...pair, fuente: 'coords' };

  // Texto de dirección sin coords → el caller puede geocodificar con Nominatim
  if (t.length >= 5 && !/^https?:\/\//i.test(t) && !/maps\.|goo\.gl/i.test(t)) {
    return { ok: false, error: `LINK_QUERY:${t}` };
  }

  return {
    ok: false,
    error:
      'No reconocí la ubicación. Pega un link de Google/Apple Maps, geo:lat,lng o coordenadas (ej. 10.48, -66.90).',
  };
}

/** True si el host suele requerir seguir redirecciones en servidor. */
export function esUrlCortaMapas(raw: string): boolean {
  const t = (raw ?? '').trim();
  const urlMatch = t.match(/https?:\/\/[^\s<>"']+/i);
  const candidate = urlMatch?.[0] ?? t;
  try {
    const u = tryUrl(candidate);
    if (!u) return false;
    const h = u.hostname.toLowerCase();
    return h === 'maps.app.goo.gl' || h === 'goo.gl' || h.endsWith('.app.goo.gl');
  } catch {
    return false;
  }
}
