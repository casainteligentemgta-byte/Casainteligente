export type AbonoVesRef = {
  monto_recibido: number;
  monto_usd: number;
  tasa_bcv: number | null;
};

export type SaldoFlotanteBimonetario = {
  saldoVes: number;
  usdHoy: number;
  usdCongelado: number;
  tasaCongelada: number;
  tasaHoy: number;
  perdidaUsd: number;
};

function tasaCongeladaPonderada(abonos: AbonoVesRef[]): number | null {
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
 * Compara el poder de compra USD del remanente VES a tasa congelada (abono) vs tasa BCV hoy.
 */
export function calcularSaldoFlotanteBimonetario(
  saldoVes: number,
  tasaHoy: number | null,
  abonosVes: AbonoVesRef[],
): SaldoFlotanteBimonetario | null {
  const ves = Number(saldoVes) || 0;
  const tasa = tasaHoy && tasaHoy > 0 ? tasaHoy : null;
  if (!(ves > 0) || !tasa) return null;

  const tasaCong = tasaCongeladaPonderada(abonosVes) ?? tasa;
  const usdHoy = ves / tasa;
  const usdCongelado = ves / tasaCong;
  const perdidaUsd = Math.max(0, usdCongelado - usdHoy);

  return {
    saldoVes: ves,
    usdHoy,
    usdCongelado,
    tasaCongelada: tasaCong,
    tasaHoy: tasa,
    perdidaUsd,
  };
}
