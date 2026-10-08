import {
  type ClasePagoObra,
  type OficioReciboLegal,
  type TipoItemNomina,
  DIAS_GARANTIA_PRESTACIONES_POR_CICLO,
  DIAS_UTILIDADES_ANUALES_CCT,
  CICLOS_CUATRO_SEMANAS_POR_ANIO,
  TOPE_ANTICIPO_PRESTACIONES,
  COMPLEMENTO_ALIMENTACION_SEMANAL_USD,
  COMPLEMENTO_ALIMENTACION_RECIBO,
  cestaSemanalUsdAnclada,
  diasPagadosClausula8,
  oficioReciboLegal,
  round2,
  semanaAdicionalFijaUsd,
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
  /**
   * Monto pactado en el contrato para este pago (semanal, o mensual si `tipo` es la quinta semana).
   * Si falta o no es válido, se usa el monto por defecto de la clase.
   */
  sobreUsd?: number | null;
  /** Cl. SEXTA c): el complemento de alimentación es potestativo; `false` = no se otorga esta semana. */
  otorgarBono?: boolean;
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
  /** Si la semana llevó el complemento de alimentación (potestativo, independiente de la asistencia). */
  bonoOtorgado: boolean;
  lineasLegal: LineaRecibo[];
  lineasPatio: LineaRecibo[];
  diasGarantiaPrestaciones: number;
  /** Garantía de prestaciones acreditada en el ciclo (Cl. 50). */
  montoGarantiaPrestacionesVes: number;
  /** Parte de la compensación imputada como anticipo de prestaciones (máx. 75% de lo acreditado). */
  anticipoPrestacionesVes: number;
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
  const pactado = Number(input.sobreUsd);
  const sobreUsd = Number.isFinite(pactado) && pactado > 0 ? round2(pactado) : sobreUsdDeClase(clase);

  const salarioBasicoVes = round2(oficio.diarioVes * diasPagados);
  const salarioBasicoUsd = vesAUsd(salarioBasicoVes, tasa);

  const cestaSemanalRef = cestaSemanalUsdAnclada(ancla);
  const cestaUsdAnclada = tipo === 'semanal' ? cestaSemanalRef : 0;
  const pisoLegalUsd = round2(salarioBasicoUsd + cestaUsdAnclada);
  /**
   * Cláusula SEXTA c): el complemento del beneficio de alimentación no depende de la
   * asistencia ni del oficio. Es potestativo con carácter general (`otorgarBono`).
   */
  const complementoOtorgado = input.otorgarBono !== false;
  const complementoSemanalUsd = complementoOtorgado ? COMPLEMENTO_ALIMENTACION_SEMANAL_USD : 0;
  const bonoOtorgado = tipo === 'semanal' && complementoOtorgado;
  let cestaUsd = 0;
  let complementoUsd = 0;
  let totalUsd = 0;
  if (tipo === 'adelanto_prestaciones') {
    /** Cl. SÉPTIMA: 90 USD ayudante / 115 USD clasificado; nace cada 4 semanas y se paga al finiquito. */
    totalUsd = semanaAdicionalFijaUsd(clase);
  } else {
    cestaUsd = cestaUsdAnclada;
    complementoUsd = complementoSemanalUsd;
    totalUsd = round2(salarioBasicoUsd + cestaUsd + complementoUsd);
  }
  const aplicaPisoLegal = false;
  const totalVes = usdAVes(totalUsd, tasa);

  const cestaVesDelDia = usdAVes(cestaUsd, tasa);
  const complementoVes = usdAVes(complementoUsd, tasa);

  const diasGarantia =
    tipo === 'adelanto_prestaciones' ? DIAS_GARANTIA_PRESTACIONES_POR_CICLO : 0;
  const montoGarantiaPrestacionesVes = round2(oficio.diarioVes * diasGarantia);
  let anticipoPrestacionesVes = 0;

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
      concepto: 'Cesta ticket (anclada al dólar; no salarial)',
      usd: cestaUsd,
      ves: cestaVesDelDia,
      salarial: false,
    });
    if (complementoUsd > 0) {
      lineasLegal.push({
        codigo: 'COMP',
        concepto: `${COMPLEMENTO_ALIMENTACION_RECIBO} (Cl. SEXTA c; no salarial)`,
        usd: complementoUsd,
        ves: complementoVes,
        salarial: false,
      });
    }
    lineasPatio.push({
      codigo: 'SOBRE',
      concepto: bonoOtorgado
        ? `Pago semanal ${clase}: salario + cesta ticket + ${COMPLEMENTO_ALIMENTACION_RECIBO.toLowerCase()} (USD ${COMPLEMENTO_ALIMENTACION_SEMANAL_USD})`
        : `Semana sin complemento de alimentación (no otorgado por la entidad de trabajo): salario y cesta ticket`,
      usd: totalUsd,
      ves: totalVes,
      salarial: false,
    });
  } else {
    // Cl. SÉPTIMA (pago al finiquito): a) prestaciones (hasta 75% de lo acreditado);
    // b) utilidades (Cl. 48, la parte del ciclo); c) el resto, complemento de alimentación.
    const diasAnticipoPrest = round2(diasGarantia * TOPE_ANTICIPO_PRESTACIONES);
    const prestVes = round2(Math.min(oficio.diarioVes * diasAnticipoPrest, totalVes));
    anticipoPrestacionesVes = prestVes;
    const prestUsd = vesAUsd(prestVes, tasa);
    const diasUtil = round2(DIAS_UTILIDADES_ANUALES_CCT / CICLOS_CUATRO_SEMANAS_POR_ANIO);
    const utilVes = round2(Math.min(oficio.diarioVes * diasUtil, Math.max(0, totalVes - prestVes)));
    const utilUsd = vesAUsd(utilVes, tasa);
    const alimUsd = round2(Math.max(0, totalUsd - prestUsd - utilUsd));
    const alimVes = usdAVes(alimUsd, tasa);
    lineasLegal.push({
      codigo: 'PREST',
      concepto: `Semana adicional Cl. SÉPTIMA: anticipo de prestaciones sociales (art. 144 LOTTT; ${diasAnticipoPrest} días de SB, 75% de lo acreditado según Cl. 50)`,
      usd: prestUsd,
      ves: prestVes,
      salarial: false,
    });
    if (utilUsd > 0) {
      lineasLegal.push({
        codigo: 'UTIL',
        concepto: `Semana adicional Cl. SÉPTIMA: anticipo de utilidades (Cl. 48; ${diasUtil} días de SB)`,
        usd: utilUsd,
        ves: utilVes,
        salarial: false,
      });
    }
    if (alimUsd > 0) {
      lineasLegal.push({
        codigo: 'ALIM',
        concepto: 'Semana adicional Cl. SÉPTIMA: complemento voluntario del beneficio de alimentación (no salarial)',
        usd: alimUsd,
        ves: alimVes,
        salarial: false,
      });
    }
    lineasPatio.push({
      codigo: 'ADELANTO',
      concepto: `Semana adicional Cl. SÉPTIMA (monto fijo USD ${semanaAdicionalFijaUsd(clase)}; pago al finiquito)`,
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
    sobreUsdPactado: tipo === 'adelanto_prestaciones' ? totalUsd : sobreUsd,
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
    bonoOtorgado,
    lineasLegal,
    lineasPatio,
    diasGarantiaPrestaciones: diasGarantia,
    montoGarantiaPrestacionesVes,
    anticipoPrestacionesVes,
  };
}
