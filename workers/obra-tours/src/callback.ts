import type { WorkerCallbackBody } from './types.js';

const MAX_ATTEMPTS = 4;

export async function postCallback(
  callbackUrl: string,
  token: string,
  body: WorkerCallbackBody,
): Promise<void> {
  let lastErr = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Obra-Tours-Token': token,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      lastErr = `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 240)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  throw new Error(`Callback falló tras ${MAX_ATTEMPTS} intentos: ${lastErr}`);
}
