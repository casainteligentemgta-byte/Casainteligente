/**
 * Validador impositivo bajo límites LOCAPTEM (tasas registrales/municipales).
 * Natural: T ≤ 10 × TCMMV · Jurídica: T ≤ 500 × TCMMV
 */

export type LocaptemValidacion = {
  es_valido: boolean;
  limite_legal_bs: number;
  sobreprecio_bs: number;
  status: string;
  limite_tcmmv: number;
  tcmmv_bcv: number;
};

export function validarTasaTimbreLocaptem(params: {
  esPersonaJuridica: boolean;
  montoCobradoBs: number;
  tcmmvBcv: number;
}): LocaptemValidacion {
  const tcmmv = Number(params.tcmmvBcv);
  const monto = Number(params.montoCobradoBs);
  if (!Number.isFinite(tcmmv) || tcmmv <= 0) {
    throw new Error('tcmmv_bcv debe ser un número positivo');
  }
  if (!Number.isFinite(monto) || monto < 0) {
    throw new Error('monto_cobrado_bs debe ser un número ≥ 0');
  }

  const limiteTcmmv = params.esPersonaJuridica ? 500 : 10;
  const limiteLegalBs = limiteTcmmv * tcmmv;
  const exceso = Math.max(0, monto - limiteLegalBs);

  return {
    es_valido: monto <= limiteLegalBs,
    limite_legal_bs: round2(limiteLegalBs),
    sobreprecio_bs: round2(exceso),
    status:
      exceso === 0
        ? 'CUMPLIMIENTO: Dentro del límite.'
        : 'ALERTA: Cobro excede límite de la LOCAPTEM.',
    limite_tcmmv: limiteTcmmv,
    tcmmv_bcv: round2(tcmmv),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
