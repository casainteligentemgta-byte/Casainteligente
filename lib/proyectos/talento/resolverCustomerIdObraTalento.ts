/**
 * `ci_proyectos.customer_id` es NOT NULL en producción. El alta de obra talento
 * no puede mandar null: se usa el cliente elegido, el del presupuesto o el de
 * la entidad. Si ninguno existe, el caller debe crear un cliente mínimo.
 */

export function resolverCustomerIdObraTalento(args: {
  clienteId?: string | null;
  presupuestoCustomerId?: string | null;
  entidadCustomerId?: string | null;
}): string | null {
  for (const raw of [args.clienteId, args.presupuestoCustomerId, args.entidadCustomerId]) {
    const id = String(raw ?? '').trim();
    if (id) return id;
  }
  return null;
}

export function payloadClienteMinimoObraTalento(nombreObra: string): Record<string, unknown> {
  const n = nombreObra.trim() || 'Obra talento';
  return {
    nombre: n,
    tipo: 'juridico',
    status: 'activo',
  };
}
