/** Texto de ayuda: compras imputan a obra + patrono; cliente CRM es indirecto. */
export function tooltipClienteCrmCompra(opts: {
  clienteCrmNombre?: string | null;
  entidadNombre?: string | null;
}): string {
  const cliente = opts.clienteCrmNombre?.trim();
  if (cliente) {
    return (
      `Cliente CRM: ${cliente}. ` +
      'La compra se registra por obra y patrono (entidad fiscal), no directamente en customers.'
    );
  }
  const entidad = opts.entidadNombre?.trim();
  if (entidad) {
    return (
      `Sin cliente CRM en esta obra. Patrono fiscal: ${entidad}. ` +
      'Las compras usan proyecto_id + entidad_id.'
    );
  }
  return 'Sin cliente CRM ni patrono asignado en la obra.';
}
