/**
 * Marca y textos del documento de presupuesto.
 * Edita aquí para que pantalla (/ventas/preview) e impresión (/api/budgets/.../pdf) queden alineados.
 */
export const PRESUPUESTO_BRAND = {
  nombreLegal: 'CASA INTELIGENTE, C.A.',
  tagline: 'Ingeniería para el confort de tu Familia.',
  /** RIF de la empresa */
  rifEmpresa: 'J-407035258',
  /** Texto bajo el logo en documentos */
  subtituloDocumento: 'Presupuesto formal',
  /** Vigencia estándar (texto legal corto) */
  vigenciaDias: 3,
  condicionesDefault: `Los precios tienen una vigencia de 3 días hábiles salvo indicación contraria.
El cliente debe abonar el porcentaje acordado según contrato; el saldo al finalizar el trabajo.`,
  zelle: {
    email: 'casainteligentemgta@gmail.com',
    telefonos: ['0412-2117270', '0414-7937270'],
  },
  /** Colores documento “pantalla” (oscuro, tipo app) */
  pantalla: {
    fondoPagina: '#0A0A0F',
    tarjeta: 'linear-gradient(160deg, #111118 0%, #0D0D14 100%)',
    acento: '#007AFF',
    total: '#34C759',
    textoPrincipal: '#FFFFFF',
    textoSecundario: 'rgba(255,255,255,0.45)',
  },
  /** Colores documento “impresión / PDF ligero” (papel) */
  impresion: {
    fondo: '#ffffff',
    texto: '#0f172a',
    textoMuted: '#64748b',
    borde: '#e2e8f0',
    acento: '#0062CC',
    barraTabla: '#f1f5f9',
  },
} as const;

export function textoMetodosPago(): string {
  const { email, telefonos } = PRESUPUESTO_BRAND.zelle;
  return `Zelle: ${email} · ${telefonos.join(' · ')}`;
}
