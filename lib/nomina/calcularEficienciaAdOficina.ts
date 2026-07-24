export type FilaHonorarioAd = {
  proyecto_id: string;
  total_abonado_usd: number;
  honorarios_admin_pct: number;
};

export type ResultadoEficienciaAd = {
  honorariosAdUsd: number;
  nominaOficinaUsd: number;
  nominaOficinaVes: number;
  eficiente: boolean;
  deficienciaUsd: number;
  proyectosConAd: number;
  ratioEficienciaPct: number;
};

/** Umbral: nómina oficina ≥ 90% de honorarios AD → congelar descuentos comerciales Nexus. */
export const UMBRAL_BLOQUEO_DESCUENTO_NEXUS = 90;

export function ratioEficienciaAdPct(
  honorariosAdUsd: number,
  nominaOficinaUsd: number,
): number {
  if (!(honorariosAdUsd > 0)) return nominaOficinaUsd > 0 ? 100 : 0;
  return Math.round((nominaOficinaUsd / honorariosAdUsd) * 1000) / 10;
}

export function debeBloquearDescuentosNexus(ratioPct: number): boolean {
  return ratioPct >= UMBRAL_BLOQUEO_DESCUENTO_NEXUS;
}

export function costoMensualCargoVes(
  salarioBase: number,
  factorPrestacional: number,
  cestaticket: number,
): number {
  return salarioBase * factorPrestacional + cestaticket;
}

export function calcularHonorariosAdUsd(filas: FilaHonorarioAd[]): number {
  return filas.reduce((acc, f) => {
    const abonado = Number(f.total_abonado_usd) || 0;
    const pct = Number(f.honorarios_admin_pct) || 0;
    return acc + abonado * (pct / 100);
  }, 0);
}

export function calcularEficienciaAdOficina(
  honorariosAdUsd: number,
  nominaOficinaVes: number,
  tasaBcv: number | null,
): ResultadoEficienciaAd {
  const tasa = tasaBcv && tasaBcv > 0 ? tasaBcv : null;
  const nominaOficinaUsd = tasa ? nominaOficinaVes / tasa : 0;
  const eficiente = tasa !== null && honorariosAdUsd >= nominaOficinaUsd;
  const deficienciaUsd = eficiente ? 0 : Math.max(0, nominaOficinaUsd - honorariosAdUsd);
  const ratioEficienciaPct = ratioEficienciaAdPct(honorariosAdUsd, nominaOficinaUsd);

  return {
    honorariosAdUsd,
    nominaOficinaUsd,
    nominaOficinaVes,
    eficiente,
    deficienciaUsd,
    proyectosConAd: 0,
    ratioEficienciaPct,
  };
}
