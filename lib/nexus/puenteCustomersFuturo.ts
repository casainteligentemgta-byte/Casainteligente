/**
 * Especificación del puente futuro Nexus → CRM construcción.
 * Sin implementación de sync; ver docs/NEXUS-HOME.md.
 */

export type NexusClientType = 'person' | 'organization';

/** Campos mínimos para mapear nexus_clients → customers (futuro). */
export type NexusClientPuenteInput = {
  id: string;
  type: NexusClientType;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
};

export type CustomerPuentePayload = {
  customer_type: 'natural' | 'juridico';
  nombre: string;
  razon_social?: string | null;
  email?: string | null;
  telefono?: string | null;
  movil?: string | null;
  rif?: string | null;
  status: 'activo';
};

/**
 * Mapeo propuesto para `scripts/sync-nexus-clients-to-customers.mjs` (no existe aún).
 * Deduplicar por RIF o email antes de INSERT en customers.
 */
export function mapearNexusClientAPayloadCustomer(
  row: NexusClientPuenteInput,
): CustomerPuentePayload {
  const display = row.displayName.trim() || 'Sin nombre';
  if (row.type === 'organization') {
    return {
      customer_type: 'juridico',
      nombre: display,
      razon_social: display,
      email: row.email?.trim() || null,
      telefono: row.phone?.trim() || null,
      movil: row.phone?.trim() || null,
      rif: row.taxId?.trim() || null,
      status: 'activo',
    };
  }
  return {
    customer_type: 'natural',
    nombre: display,
    email: row.email?.trim() || null,
    telefono: row.phone?.trim() || null,
    movil: row.phone?.trim() || null,
    rif: row.taxId?.trim() || null,
    status: 'activo',
  };
}
