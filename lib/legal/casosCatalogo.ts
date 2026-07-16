export const LEGAL_TIPOS_CASO = [
  { value: 'obra_contrato', label: 'Obra · contrato' },
  { value: 'obra_reclamo', label: 'Obra · reclamo / conflicto' },
  { value: 'laboral', label: 'Laboral' },
  { value: 'proveedor', label: 'Proveedor / compras' },
  { value: 'civil', label: 'Civil' },
  { value: 'mercantil', label: 'Mercantil' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'externo', label: 'Externo (despacho)' },
  { value: 'otro', label: 'Otro' },
] as const;

export const LEGAL_AMBITOS = [
  { value: 'obra', label: 'Obra (Casa Inteligente)' },
  { value: 'despacho', label: 'Despacho general' },
  { value: 'externo', label: 'Caso externo' },
] as const;

export const LEGAL_ESTADOS = [
  { value: 'abierto', label: 'Abierto' },
  { value: 'en_gestion', label: 'En gestión' },
  { value: 'espera_tercero', label: 'Espera de tercero' },
  { value: 'audiencia', label: 'Audiencia / acto' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'archivado', label: 'Archivado' },
  { value: 'cancelado', label: 'Cancelado' },
] as const;

export const LEGAL_PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
] as const;

export const LEGAL_TIPOS_ACTUACION = [
  { value: 'nota', label: 'Nota' },
  { value: 'llamada', label: 'Llamada' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'escrito', label: 'Escrito / diligencia' },
  { value: 'audiencia', label: 'Audiencia' },
  { value: 'notificacion', label: 'Notificación' },
  { value: 'documento', label: 'Documento adjunto' },
  { value: 'otro', label: 'Otro' },
] as const;

export function etiquetaDe<T extends { value: string; label: string }>(
  lista: readonly T[],
  value: string,
): string {
  return lista.find((x) => x.value === value)?.label ?? value;
}
