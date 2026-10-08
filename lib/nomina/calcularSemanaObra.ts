import {
  type ClasePagoObra,
  type OficioReciboLegal,
  type TipoItemNomina,
  DIAS_GARANTIA_PRESTACIONES_POR_CICLO,
  DIAS_UTILIDADES_ANUALES_CCT,
  CICLOS_CUATRO_SEMANAS_POR_ANIO,
  TOPE_ANTICIPO_PRESTACIONES,
  DIAS_JORNADA_SEMANA,
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
  /**
   * Monto pactado en el contrato para este pago (semanal, o mensual si `tipo` es la quinta semana).
   * Si falta o no es válido, se usa el monto por defecto de la clase.
   */
  sobreUsd?: number | null;
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

  const cestaUsdAnclada = tipo === 'semanal' ? cestaSemanalUsdAnclada(ancla) : 0;
  const pisoLegalUsd = round2(salarioBasicoUsd + cestaUsdAnclada);
  /**
   * Cláusula SEXTA del contrato: el bono especial se causa solo con la semana completa.
   * Con una o más faltas se paga el salario de los días (Cl. 8 para los descansos) y el cesta
   * ticket completo, sin bono.
   */
  const semanaCompleta = diasLaborados >= DIAS_JORNADA_SEMANA;
  const totalUsd =
    tipo === 'adelanto_prestaciones'
      ? sobreUsd
      : semanaCompleta
        ? round2(Math.max(sobreUsd, pisoLegalUsd))
        : pisoLegalUsd;
  const aplicaPisoLegal = tipo === 'semanal' && semanaCompleta && totalUsd > sobreUsd + 0.001;
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
      concepto: 'Cesta ticket (incluida en el sobre; anclada al dólar; no salarial)',
      usd: cestaUsd,
      ves: cestaVesDelDia,
      salarial: false,
    });
    if (complementoUsd > 0) {
      lineasLegal.push({
        codigo: 'COMP',
        concepto: 'Bono especial no salarial (Cl. SEXTA del contrato; semana de asistencia completa)',
        usd: complementoUsd,
        ves: complementoVes,
        salarial: false,
      });
    }
    lineasPatio.push({
      codigo: 'SOBRE',
      concepto: semanaCompleta
        ? `Sobre de patio ${clase} — USD ${sobreUsd} (cesta incluida)`
        : `Semana con ${DIAS_JORNADA_SEMANA - diasLaborados} falta(s): salario de los días y cesta ticket, sin bono especial (pactado USD ${sobreUsd})`,
      usd: totalUsd,
      ves: totalVes,
      salarial: false,
    });
  } else {
    // Cl. SÉPTIMA: a) anticipo de prestaciones (hasta 75% de lo acreditado, art. 144 LOTTT);
    // b) anticipo de utilidades (Cl. 48, la parte del ciclo); c) el resto, complemento de alimentación.
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
      concepto: `Compensación Cl. SÉPTIMA: anticipo de prestaciones sociales (art. 144 LOTTT; ${diasAnticipoPrest} días de SB, 75% de lo acreditado según Cl. 50)`,
      usd: prestUsd,
      ves: prestVes,
      salarial: false,
    });
    if (utilUsd > 0) {
      lineasLegal.push({
        codigo: 'UTIL',
        concepto: `Compensación Cl. SÉPTIMA: anticipo de utilidades (Cl. 48; ${diasUtil} días de SB)`,
        usd: utilUsd,
        ves: utilVes,
        salarial: false,
      });
    }
    if (alimUsd > 0) {
      lineasLegal.push({
        codigo: 'ALIM',
        concepto: 'Compensación Cl. SÉPTIMA: complemento voluntario del beneficio de alimentación (no salarial)',
        usd: alimUsd,
        ves: alimVes,
        salarial: false,
      });
    }
    lineasPatio.push({
      codigo: 'ADELANTO',
      concepto: `Compensación cada 4 semanas trabajadas (Cl. SÉPTIMA del contrato) — USD ${sobreUsd}`,
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
    anticipoPrestacionesVes,
  };
}
