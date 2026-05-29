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
};

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

  return {
    honorariosAdUsd,
    nominaOficinaUsd,
    nominaOficinaVes,
    eficiente,
    deficienciaUsd,
    proyectosConAd: 0,
  };
}
