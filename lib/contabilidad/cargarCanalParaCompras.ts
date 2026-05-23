import type { CanalPendienteParaLista } from '@/lib/contabilidad/mapCanalPendienteCompra';

export type ResultadoCanalCompras = {
  pendientes: CanalPendienteParaLista[];
  error: string | null;
};

/** Lista facturas Telegram (incluye confirmadas) vía API con service role. */
export async function cargarCanalParaCompras(): Promise<ResultadoCanalCompras> {
  try {
    const res = await fetch('/api/facturas-canal/pendientes?para=lista_compras', {
      cache: 'no-store',
    });
    const json = (await res.json()) as {
      pendientes?: CanalPendienteParaLista[];
      error?: string;
      hint?: string;
    };
    if (!res.ok) {
      const msg =
        json.error ||
        (res.status === 503
          ? 'Servidor sin SUPABASE_SERVICE_ROLE_KEY (Vercel → Environment Variables).'
          : `Error ${res.status} al cargar canal Telegram.`);
      return { pendientes: [], error: json.hint ? `${msg} ${json.hint}` : msg };
    }
    return { pendientes: json.pendientes ?? [], error: null };
  } catch (e) {
    return {
      pendientes: [],
      error: e instanceof Error ? e.message : 'No se pudo conectar con el canal Telegram.',
    };
  }
}
