export type AbonoVesRef = {
  monto_recibido: number;
  monto_usd: number;
  tasa_bcv: number | null;
};

export const UMBRAL_PERDIDA_CRITICA_USD = 1;

export type AuditoriaFluctuacionCambiaria = {
  tasaActualEfectiva: number;
  valorOriginalUsd: number;
  valorActualUsd: number;
  perdidaPorFluctuacion: number;
  esPerdidaCritica: boolean;
};

export type SaldoFlotanteBimonetario = {
  saldoVes: number;
  usdHoy: number;
  usdCongelado: number;
  tasaCongelada: number;
  tasaHoy: number;
  tasaActualEfectiva: number;
  perdidaUsd: number;
  esPerdidaCritica: boolean;
};

export function tasaCongeladaDesdeAbonos(abonos: AbonoVesRef[]): number | null {
  const validos = abonos.filter(
    (a) => Number(a.monto_recibido) > 0 && Number(a.tasa_bcv) > 0,
  );
  if (!validos.length) return null;
  const ves = validos.reduce((s, a) => s + Number(a.monto_recibido), 0);
  const usd = validos.reduce((s, a) => s + Number(a.monto_usd), 0);
  if (!(usd > 0)) return null;
  return ves / usd;
}

/**
 * Compara el poder de compra USD del remanente VES a tasa congelada vs tasa BCV efectiva.
 * Si la API BCV no responde, usa la tasa histórica como fallback (contingencia Pampatar).
 */
export function calcularAuditoriaFluctuacionCambiaria(
  saldoVesFondo: number,
  tasaOriginalAbono: number,
  tasaBcvHoy: number | null | undefined,
  umbralPerdidaUsd = UMBRAL_PERDIDA_CRITICA_USD,
): AuditoriaFluctuacionCambiaria {
  const ves = Number(saldoVesFondo) || 0;
  const tasaOrig = tasaOriginalAbono > 0 ? tasaOriginalAbono : 1;
  const tasaActualEfectiva =
    tasaBcvHoy != null && tasaBcvHoy > 0 ? tasaBcvHoy : tasaOrig;

  const valorOriginalUsd = ves / tasaOrig;
  const valorActualUsd = ves / tasaActualEfectiva;
  const perdidaPorFluctuacion = Math.max(0, valorOriginalUsd - valorActualUsd);

  return {
    tasaActualEfectiva,
    valorOriginalUsd,
    valorActualUsd,
    perdidaPorFluctuacion,
    esPerdidaCritica: perdidaPorFluctuacion > umbralPerdidaUsd,
  };
}

/**
 * Compara el poder de compra USD del remanente VES a tasa congelada (abono) vs tasa BCV hoy.
 */
export function calcularSaldoFlotanteBimonetario(
  saldoVes: number,
  tasaHoy: number | null,
  abonosVes: AbonoVesRef[],
): SaldoFlotanteBimonetario | null {
  const ves = Number(saldoVes) || 0;
  if (!(ves > 0)) return null;

  const tasaCong =
    tasaCongeladaDesdeAbonos(abonosVes) ?? (tasaHoy && tasaHoy > 0 ? tasaHoy : null);
  if (!tasaCong) return null;

  const audit = calcularAuditoriaFluctuacionCambiaria(ves, tasaCong, tasaHoy);

  return {
    saldoVes: ves,
    usdHoy: audit.valorActualUsd,
    usdCongelado: audit.valorOriginalUsd,
    tasaCongelada: tasaCong,
    tasaHoy: audit.tasaActualEfectiva,
    tasaActualEfectiva: audit.tasaActualEfectiva,
    perdidaUsd: audit.perdidaPorFluctuacion,
    esPerdidaCritica: audit.esPerdidaCritica,
  };
}
