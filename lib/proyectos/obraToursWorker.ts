import type { WorkerReconstruccionRequest } from '@/lib/proyectos/obraTours';

/**
 * Encola reconstrucción en el worker GPU.
 * Si no hay `OBRA_TOURS_WORKER_URL`, deja el job en `encolado` (modo stub local).
 */
export async function encolarReconstruccionTour(
  req: WorkerReconstruccionRequest,
): Promise<{ ok: true; stub: boolean } | { ok: false; error: string }> {
  const base = process.env.OBRA_TOURS_WORKER_URL?.trim();
  if (!base) {
    return { ok: true, stub: true };
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/v1/reconstruct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.OBRA_TOURS_WORKER_TOKEN
          ? { Authorization: `Bearer ${process.env.OBRA_TOURS_WORKER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        error: `Worker respondió ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      };
    }
    return { ok: true, stub: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de red al contactar worker';
    return { ok: false, error: msg };
  }
}

export function callbackUrlTours(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/proyectos/tours/worker-callback`;
}

export function nuevoCallbackToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}
