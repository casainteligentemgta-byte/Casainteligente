import type { TipoRecepcionCampo } from '@/lib/almacen/recepcionCampoTypes';

/** Foto y proveedor son obligatorios en nota de entrega (web y API). */
export function validarRequisitosNotaEntrega(params: {
  tipo: TipoRecepcionCampo | string;
  proveedorNombre?: string | null;
  soportePath?: string | null;
}): string | null {
  if (params.tipo !== 'nota_entrega') return null;
  if (!String(params.proveedorNombre ?? '').trim()) {
    return 'Indique el proveedor de la nota de entrega.';
  }
  if (!String(params.soportePath ?? '').trim()) {
    return 'Adjunte la foto de la nota de entrega.';
  }
  return null;
}
