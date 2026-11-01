import { apiUrl } from '@/lib/http/apiUrl';

export const ASEGURAR_UBICACION_OBRA_API = '/api/almacen/ubicaciones/asegurar-obra';

type AsegurarUbicacionObraRes = {
  ok?: boolean;
  id?: string;
  error?: string;
};

/**
 * Cliente: asegura inv_ubicaciones tipo obra vía API autenticada (service_role en el servidor).
 * No llama ci_asegurar_ubicacion_obra desde el navegador (EXECUTE revocado a authenticated/anon).
 */
export async function asegurarUbicacionObraCliente(
  proyectoId: string,
  nombreObra: string,
): Promise<string> {
  const pid = proyectoId?.trim();
  if (!pid) {
    throw new Error('Proyecto no indicado; no se puede crear ubicación de obra.');
  }

  const nombre = nombreObra?.trim() || 'Obra';
  const res = await fetch(apiUrl(ASEGURAR_UBICACION_OBRA_API), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ proyecto_id: pid, nombre }),
  });

  let data: AsegurarUbicacionObraRes = {};
  try {
    data = (await res.json()) as AsegurarUbicacionObraRes;
  } catch {
    /* respuesta no JSON */
  }

  if (!res.ok || !data.id) {
    throw new Error(data.error || 'No se pudo asegurar ubicación de obra.');
  }
  return String(data.id);
}
