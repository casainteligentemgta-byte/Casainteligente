/**
 * Búsqueda de causas en TSJ vía Google Custom Search (site:tsj.gob.ve).
 * Sin API keys retorna [] para no tumbar demos/producción.
 */

export type TsjSearchHit = {
  titulo: string | null;
  enlace: string | null;
  resumen: string | null;
};

export type TsjSearchResult = {
  items: TsjSearchHit[];
  simulated: boolean;
  query: string;
};

type CseItem = {
  title?: string;
  link?: string;
  snippet?: string;
};

type CseResponse = {
  items?: CseItem[];
  error?: { message?: string };
};

export async function buscarCausasTsj(params: {
  criterio: string;
  apiKey?: string | null;
  cseId?: string | null;
}): Promise<TsjSearchResult> {
  const criterio = params.criterio.trim();
  if (!criterio) {
    return { items: [], simulated: false, query: '' };
  }

  const apiKey = (params.apiKey ?? process.env.GOOGLE_API_KEY ?? '').trim();
  const cseId = (params.cseId ?? process.env.GOOGLE_CSE_ID ?? '').trim();
  const query = `site:tsj.gob.ve "${criterio}"`;

  if (!apiKey || !cseId) {
    return { items: [], simulated: true, query };
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', query);

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  const data = (await res.json()) as CseResponse;

  if (!res.ok) {
    const msg = data.error?.message || `HTTP ${res.status}`;
    throw new Error(`Búsqueda TSJ falló: ${msg}`);
  }

  const items = (data.items ?? []).map((i) => ({
    titulo: i.title ?? null,
    enlace: i.link ?? null,
    resumen: i.snippet ?? null,
  }));

  return { items, simulated: false, query };
}
