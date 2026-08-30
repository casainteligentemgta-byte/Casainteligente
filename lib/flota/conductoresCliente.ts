'use client';

import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import type { CrearConductorInput, FlotaConductor } from '@/lib/flota/conductores';

/** Cliente: POST a /api/flota/conductores (crearConductor del servidor). */
export async function crearConductor(data: CrearConductorInput): Promise<FlotaConductor> {
  const res = await fetch(apiUrl('/api/flota/conductores'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await parseFetchJson<FlotaConductor & { error?: string }>(res);
  if (!res.ok) throw new Error(formatApiErrorBody(json));
  return json;
}
