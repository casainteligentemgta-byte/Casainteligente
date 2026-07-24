export const ESTADOS_PROCURA = [
  'borrador',
  'solicitada',
  'pendiente_pm',
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
  pendiente_pm: 'Pendiente PM',
  aprobada: 'Aprobada (pend. factura)',
  aprobada_directa: 'Aprobada directa (pend. factura)',
  en_compra: 'Comprada (factura cargada)',
  recibida_parcial: 'Recibida parcial',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
  rechazada: 'Rechazada',
};

export const COLOR_ESTADO_PROCURA: Record<EstadoProcura, string> = {
  borrador: '#8E8E93',
  solicitada: '#5AC8FA',
  pendiente_pm: '#007AFF',
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

/** Solo al vincular factura de compra (purchase_invoice_id). */
export const ESTADOS_PROCURA_SOLO_SISTEMA: readonly EstadoProcura[] = ['en_compra'];

export function etiquetaEstadoProcura(v: string | null | undefined): string {
  const p = parseEstadoProcura(v);
  return p ? ETIQUETAS[p] : String(v ?? '—');
}

/** Espejo TS de ci_procura_transicion_estado_valida (D-09). */
export function transicionEstadoProcuraValida(
  estadoAnterior: string | null | undefined,
  estadoNuevo: string | null | undefined,
): boolean {
  const ant = parseEstadoProcura(estadoAnterior);
  const nue = parseEstadoProcura(estadoNuevo);
  if (!ant || !nue) return false;
  if (ant === nue) return true;

  const permitidas: Record<EstadoProcura, readonly EstadoProcura[]> = {
    borrador: ['solicitada', 'cancelada'],
    solicitada: ['pendiente_pm', 'aprobada', 'aprobada_directa', 'en_compra', 'rechazada', 'cancelada'],
    pendiente_pm: ['aprobada', 'rechazada', 'cancelada'],
    aprobada: ['en_compra', 'recibida', 'recibida_parcial', 'rechazada', 'cancelada'],
    aprobada_directa: ['en_compra', 'cancelada'],
    en_compra: ['recibida_parcial', 'recibida', 'cancelada'],
    recibida_parcial: ['recibida', 'en_compra', 'cancelada'],
    recibida: ['cancelada'],
    rechazada: [],
    cancelada: [],
  };

  return permitidas[ant].includes(nue);
}
