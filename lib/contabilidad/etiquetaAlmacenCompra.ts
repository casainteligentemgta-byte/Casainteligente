/** Texto de la columna almacén en el cuadro de compras. */
export function etiquetaAlmacenIngresoCompra(opts: {
  ubicacionNombre?: string | null;
  ubicacionDestinoId?: string | null;
  proyectoNombre?: string | null;
  imputacionEntidad?: boolean;
}): { texto: string; pendienteIngreso: boolean } {
  const nombre = String(opts.ubicacionNombre ?? '').trim();
  if (nombre) return { texto: nombre, pendienteIngreso: false };
  if (opts.imputacionEntidad) return { texto: '—', pendienteIngreso: false };
  if (String(opts.proyectoNombre ?? '').trim()) {
    return { texto: 'Pendiente ingreso', pendienteIngreso: true };
  }
  return { texto: '—', pendienteIngreso: false };
}
