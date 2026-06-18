import type { EstadoLogisticaCompra } from '@/lib/contabilidad/estadoLogisticaCompra';

/** Texto de la columna almacén en el cuadro de compras. */
export function etiquetaAlmacenIngresoCompra(opts: {
  ubicacionNombre?: string | null;
  ubicacionDestinoId?: string | null;
  proyectoNombre?: string | null;
  imputacionEntidad?: boolean;
  yaIngresadoAlmacen?: boolean;
  estadoLogistica?: EstadoLogisticaCompra | null;
}): { texto: string; pendienteIngreso: boolean } {
  const nombre = String(opts.ubicacionNombre ?? '').trim();
  if (nombre) return { texto: nombre, pendienteIngreso: false };
  if (opts.imputacionEntidad) return { texto: '—', pendienteIngreso: false };

  const ingresado =
    opts.yaIngresadoAlmacen ||
    opts.estadoLogistica === 'en_almacen' ||
    opts.estadoLogistica === 'en_almacen_parcial';

  if (ingresado) {
    const proy = String(opts.proyectoNombre ?? '').trim();
    return {
      texto: proy ? `Ingresado · ${proy}` : 'Ingresado en almacén',
      pendienteIngreso: false,
    };
  }

  if (String(opts.proyectoNombre ?? '').trim()) {
    return { texto: 'Pendiente ingreso', pendienteIngreso: true };
  }
  return { texto: '—', pendienteIngreso: false };
}
