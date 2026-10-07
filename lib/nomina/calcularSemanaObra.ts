import {
  type ClasePagoObra,
  type OficioReciboLegal,
  type TipoItemNomina,
  DIAS_GARANTIA_PRESTACIONES_POR_CICLO,
  cestaSemanalUsdAnclada,
  diasPagadosClausula8,
  oficioReciboLegal,
  round2,
  sobreUsdDeClase,
} from '@/lib/nomina/reglasPagoObra';

export type CalcularSemanaObraInput = {
  clase: ClasePagoObra;
  tipo: TipoItemNomina;
  diasLaborados: number;
  tasaBcvPago: number;
  tasaAnclaCestaBcv: number;
  cargoCodigo?: string | null;
  cargoNombre?: string | null;
};

export type LineaRecibo = {
  codigo: string;
  concepto: string;
  usd: number;
  ves: number;
  salarial: boolean;
};

export type ResultadoSemanaObra = {
  clase: ClasePagoObra;
  tipo: TipoItemNomina;
  oficio: OficioReciboLegal;
  diasLaborados: number;
  diasPagados: number;
  tasaBcvPago: number;
  tasaAnclaCestaBcv: number;
  sobreUsdPactado: number;
  salarioBasicoVes: number;
  salarioBasicoUsd: number;
  cestaUsdAnclada: number;
  cestaVesDelDia: number;
  complementoUsd: number;
  complementoVes: number;
  pisoLegalUsd: number;
  totalUsd: number;
  totalVes: number;
  aplicaPisoLegal: boolean;
  lineasLegal: LineaRecibo[];
  lineasPatio: LineaRecibo[];
  diasGarantiaPrestaciones: number;
  montoGarantiaPrestacionesVes: number;
};

function vesAUsd(ves: number, tasa: number): number {
  if (!Number.isFinite(tasa) || tasa <= 0) return 0;
  return round2(ves / tasa);
}

function usdAVes(usd: number, tasa: number): number {
  if (!Number.isFinite(tasa) || tasa <= 0) return 0;
  return round2(usd * tasa);
}

export function calcularSemanaObra(input: CalcularSemanaObraInput): ResultadoSemanaObra {
  const clase = input.clase;
  const tipo = input.tipo;
  const tasa = Number(input.tasaBcvPago);
  const ancla = Number(input.tasaAnclaCestaBcv);
  if (!Number.isFinite(tasa) || tasa <= 0) {
    throw new Error('Indica la tasa BCV del día de pago.');
  }
  if (!Number.isFinite(ancla) || ancla <= 0) {
    throw new Error('Falta la tasa BCV de anclaje de la cesta (homologación).');
  }

  const oficio = oficioReciboLegal(clase, input.cargoCodigo, input.cargoNombre);
  const diasLaborados = Math.max(0, Math.min(5, Math.floor(Number(input.diasLaborados) || 0)));
  const diasPagados = tipo === 'adelanto_prestaciones' ? 0 : diasPagadosClausula8(diasLaborados);
  const sobreUsd = sobreUsdDeClase(clase);

  const salarioBasicoVes = round2(oficio.diarioVes * diasPagados);
  const salarioBasicoUsd = vesAUsd(salarioBasicoVes, tasa);

  const cestaUsdAnclada = tipo === 'semanal' ? cestaSemanalUsdAnclada(ancla) : 0;
  const pisoLegalUsd = round2(salarioBasicoUsd + cestaUsdAnclada);
  const totalUsd = tipo === 'adelanto_prestaciones' ? sobreUsd : round2(Math.max(sobreUsd, pisoLegalUsd));
  const aplicaPisoLegal = tipo === 'semanal' && totalUsd > sobreUsd + 0.001;
  const totalVes = usdAVes(totalUsd, tasa);

  let cestaUsd = 0;
  let complementoUsd = 0;
  if (tipo === 'semanal') {
    const restoTrasBasico = round2(Math.max(0, totalUsd - salarioBasicoUsd));
    cestaUsd = round2(Math.min(cestaUsdAnclada, restoTrasBasico));
    complementoUsd = round2(Math.max(0, totalUsd - salarioBasicoUsd - cestaUsd));
  }

  const cestaVesDelDia = usdAVes(cestaUsd, tasa);
  const complementoVes = usdAVes(complementoUsd, tasa);

  const diasGarantia =
    tipo === 'adelanto_prestaciones' ? DIAS_GARANTIA_PRESTACIONES_POR_CICLO : 0;
  const montoGarantiaPrestacionesVes = round2(oficio.diarioVes * diasGarantia);

  const lineasLegal: LineaRecibo[] = [];
  const lineasPatio: LineaRecibo[] = [];

  if (tipo === 'semanal') {
    lineasLegal.push({
      codigo: 'SB',
      concepto: `Salario básico tabulador ${oficio.codigo} ${oficio.denominacion} (${diasPagados} días × Bs. ${oficio.diarioVes.toFixed(2)})`,
      usd: salarioBasicoUsd,
      ves: salarioBasicoVes,
      salarial: true,
    });
    lineasLegal.push({
      codigo: 'CESTA',
      concepto: 'Cesta ticket (incluida en el sobre; anclada al dólar; no salarial)',
      usd: cestaUsd,
      ves: cestaVesDelDia,
      salarial: false,
    });
    if (complementoUsd > 0) {
      lineasLegal.push({
        codigo: 'COMP',
        concepto: 'Complemento hasta el sobre pactado (inflación; cesta ya desglosada)',
        usd: complementoUsd,
        ves: complementoVes,
        salarial: false,
      });
    }
    lineasPatio.push({
      codigo: 'SOBRE',
      concepto: `Sobre de patio ${clase} — USD ${sobreUsd} (cesta incluida)`,
      usd: totalUsd,
      ves: totalVes,
      salarial: false,
    });
  } else {
    const prestVes = Math.min(montoGarantiaPrestacionesVes, totalVes);
    const prestUsd = vesAUsd(prestVes, tasa);
    const restoUsd = round2(Math.max(0, totalUsd - prestUsd));
    const restoVes = usdAVes(restoUsd, tasa);
    lineasLegal.push({
      codigo: 'PREST',
      concepto: `Adelanto de garantía de prestaciones (art. 144 LOTTT / Cl. 50: ${diasGarantia} días de SB)`,
      usd: prestUsd,
      ves: prestVes,
      salarial: true,
    });
    if (restoUsd > 0) {
      lineasLegal.push({
        codigo: 'CCT',
        concepto: 'Resto de la quinta semana a cuenta de beneficios convencionales (vacaciones, utilidades y demás; sin cesta duplicada)',
        usd: restoUsd,
        ves: restoVes,
        salarial: false,
      });
    }
    lineasPatio.push({
      codigo: 'ADELANTO',
      concepto: `Quinta semana (cada 4 trabajadas) — USD ${sobreUsd}`,
      usd: totalUsd,
      ves: totalVes,
      salarial: false,
    });
  }

  return {
    clase,
    tipo,
    oficio,
    diasLaborados,
    diasPagados,
    tasaBcvPago: tasa,
    tasaAnclaCestaBcv: ancla,
    sobreUsdPactado: sobreUsd,
    salarioBasicoVes,
    salarioBasicoUsd,
    cestaUsdAnclada: cestaUsd,
    cestaVesDelDia,
    complementoUsd,
    complementoVes,
    pisoLegalUsd,
    totalUsd,
    totalVes,
    aplicaPisoLegal,
    lineasLegal,
    lineasPatio,
    diasGarantiaPrestaciones: diasGarantia,
    montoGarantiaPrestacionesVes,
  };
}
