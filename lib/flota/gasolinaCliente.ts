'use client';

import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import type { ExtraccionFacturaGasolina } from '@/lib/flota/extractFacturaGasolina';
import type { FlotaGasolina, RegistrarGasolinaInput } from '@/lib/flota/gasolina';

/** Cliente: POST a /api/flota/gasolina (registrarGasolina del servidor). */
export async function registrarGasolina(data: RegistrarGasolinaInput): Promise<FlotaGasolina> {
  const res = await fetch(apiUrl('/api/flota/gasolina'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await parseFetchJson<FlotaGasolina & { error?: string }>(res);
  if (!res.ok) throw new Error(formatApiErrorBody(json));
  return json;
}

export type LecturaFacturaGasolina = ExtraccionFacturaGasolina & {
  ok?: boolean;
  factura_url?: string | null;
  error?: string;
};

/** Cliente: foto/PDF → OCR de ticket de gasolina. */
export async function leerFacturaGasolina(file: File): Promise<LecturaFacturaGasolina> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(apiUrl('/api/flota/gasolina/ocr'), {
    method: 'POST',
    credentials: 'include',
    body,
  });
  const json = await parseFetchJson<LecturaFacturaGasolina>(res);
  if (!res.ok) throw new Error(formatApiErrorBody(json));
  return json;
}
