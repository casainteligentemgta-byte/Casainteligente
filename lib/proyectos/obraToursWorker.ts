import type { WorkerReconstruccionRequest } from '@/lib/proyectos/obraTours';

export type EncolarReconstruccionResult =
  | { ok: true; stub: boolean; worker_status?: number; worker_body?: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Encola reconstrucción en el worker GPU/CPU.
 * Si no hay `OBRA_TOURS_WORKER_URL`, deja el job en modo stub local.
 */
export async function encolarReconstruccionTour(
  req: WorkerReconstruccionRequest,
): Promise<EncolarReconstruccionResult> {
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
      signal: AbortSignal.timeout(30_000),
    });

    let worker_body: Record<string, unknown> | undefined;
    const text = await res.text().catch(() => '');
    if (text) {
      try {
        worker_body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        worker_body = { raw: text.slice(0, 300) };
      }
    }

    // 200/202 = aceptado (el worker procesa en background)
    if (!res.ok) {
      return {
        ok: false,
        error: `Worker respondió ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      };
    }

    return {
      ok: true,
      stub: false,
      worker_status: res.status,
      worker_body,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de red al contactar worker';
    return { ok: false, error: msg };
  }
}

/** Ping opcional del worker (health). */
export async function healthCheckObraToursWorker(): Promise<{
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}> {
  const base = process.env.OBRA_TOURS_WORKER_URL?.trim();
  if (!base) {
    return { ok: false, error: 'OBRA_TOURS_WORKER_URL no configurada' };
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(8_000),
      headers: {
        ...(process.env.OBRA_TOURS_WORKER_TOKEN
          ? { Authorization: `Bearer ${process.env.OBRA_TOURS_WORKER_TOKEN}` }
          : {}),
      },
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body: body ?? undefined };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error de red',
    };
  }
}

export function callbackUrlTours(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/proyectos/tours/worker-callback`;
}

export function nuevoCallbackToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}
