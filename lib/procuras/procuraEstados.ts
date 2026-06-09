export const ESTADOS_PROCURA = [
  'borrador',
  'solicitada',
  'aprobada',
  'aprobada_directa',
  'en_compra',
  'recibida_parcial',
  'recibida',
  'cancelada',
  'rechazada',
] as const;

export type EstadoProcura = (typeof ESTADOS_PROCURA)[number];

const ETIQUETAS: Record<EstadoProcura, string> = {
  borrador: 'Borrador',
  solicitada: 'Pendiente',
  aprobada: 'Aprobada',
  aprobada_directa: 'Aprobada directa',
  en_compra: 'Comprada',
  recibida_parcial: 'Recibida parcial',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
  rechazada: 'Rechazada',
};

export const COLOR_ESTADO_PROCURA: Record<EstadoProcura, string> = {
  borrador: '#8E8E93',
  solicitada: '#5AC8FA',
  aprobada: '#34C759',
  aprobada_directa: '#30D158',
  en_compra: '#FF9500',
  recibida_parcial: '#FFD60A',
  recibida: '#30D158',
  cancelada: '#636366',
  rechazada: '#FF3B30',
};

export function parseEstadoProcura(v: unknown): EstadoProcura | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return (ESTADOS_PROCURA as readonly string[]).includes(s) ? (s as EstadoProcura) : null;
}

export function etiquetaEstadoProcura(v: string | null | undefined): string {
  const p = parseEstadoProcura(v);
  return p ? ETIQUETAS[p] : String(v ?? '—');
}
