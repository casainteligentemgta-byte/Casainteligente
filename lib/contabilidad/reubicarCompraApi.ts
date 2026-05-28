export type ReubicarCompraBody = {
  proyecto_id: string;
  ubicacion_destino_id: string;
  nombre_obra?: string;
};

export type ReubicarCompraResponse = {
  ok: boolean;
  purchaseInvoiceId?: string | null;
  compraId?: string | null;
  stockMovido?: boolean;
  error?: string;
};

export async function reubicarCompra(
  compraId: string,
  body: ReubicarCompraBody,
): Promise<ReubicarCompraResponse> {
  const res = await fetch(
    `/api/contabilidad/compras/${encodeURIComponent(compraId)}/reubicar`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json()) as ReubicarCompraResponse;
  if (!res.ok) throw new Error(data.error || 'No se pudo reubicar la compra');
  return data;
}

export async function reubicarCompraCanal(
  pendienteId: string,
  body: ReubicarCompraBody,
): Promise<void> {
  const res = await fetch(
    `/api/facturas-canal/pendientes/${encodeURIComponent(pendienteId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: body.proyecto_id,
        ubicacion_destino_id: body.ubicacion_destino_id,
      }),
    },
  );
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error || 'No se pudo guardar ubicación');
}
