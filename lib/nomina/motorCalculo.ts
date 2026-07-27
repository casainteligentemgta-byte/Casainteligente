import { SALARIO_BASICO_DIARIO_VES_POR_NIVEL } from './tabuladorSalariosConstruccion2023';
import { CESTATICKET_SEMANAL_USD } from './cestaticketLegalUsd';

// Parámetros de Ley de Trabajo / Construcción en Venezuela
const TASA_SSO = 0.04;
const TASA_SPF = 0.005;
const TASA_FAOV = 0.01;

export type InputCalculoRecibo = {
  empleadoId: string;
  cargo: string;
  nivelTabulador: number; // 1 a 9
  diasLaborados: number; // 0 a 5, 6
  metaIntegralSemanalUsd: number; // Ej. $100 (El bono acordado en el contrato)
  tasaBcv: number;
};

export type ResultadoCalculoRecibo = {
  salario_base_bs: number;
  dia_descanso_bs: number;
  sso_bs: number;
  spf_bs: number;
  faov_bs: number;
  total_deducciones_ley_bs: number;
  salario_neto_ley_bs: number;
  cestaticket_bs: number;
  equivalente_meta_bs: number;
  bono_complementario_bs: number;
  total_neto_pagado_bs: number;
  total_neto_pagado_usd: number;
};

/**
 * Motor de cálculo oficial de nómina de construcción.
 * Calcula las deducciones de ley basadas en el tabulador en bolívares,
 * y luego rellena la diferencia con un "Bono Complementario" 
 * para alcanzar la Meta en USD pactada con el trabajador.
 */
export function calcularReciboSemanal(input: InputCalculoRecibo): ResultadoCalculoRecibo {
  const { nivelTabulador, diasLaborados, metaIntegralSemanalUsd, tasaBcv } = input;
  
  // Validaciones
  if (tasaBcv <= 0) throw new Error("La tasa BCV debe ser mayor a 0");
  
  // 1. Salario Base según Tabulador
  // El índice del array empieza en 0, el nivel empieza en 1
  const salarioDiario = SALARIO_BASICO_DIARIO_VES_POR_NIVEL[(nivelTabulador || 1) - 1] || SALARIO_BASICO_DIARIO_VES_POR_NIVEL[0];
  
  // Si trabajó la jornada completa (ej. 5 o 6 días), se le paga 1 día adicional de descanso (Domingo)
  // Por simplicidad del MVP, asumiremos que se le paga proporcional o completo. 
  // Aquí usamos la fórmula: días trabajados + 1 día de descanso (si días > 0)
  const diaDescanso = diasLaborados > 0 ? salarioDiario : 0;
  const salarioBaseSemanalBs = Number(((salarioDiario * diasLaborados) + diaDescanso).toFixed(2));
  
  // 2. Deducciones Legales
  const sso = Number((salarioBaseSemanalBs * TASA_SSO).toFixed(2));
  const spf = Number((salarioBaseSemanalBs * TASA_SPF).toFixed(2));
  const faov = Number((salarioBaseSemanalBs * TASA_FAOV).toFixed(2));
  const deduccionesLey = Number((sso + spf + faov).toFixed(2));
  
  const salarioNetoLeyBs = Number((salarioBaseSemanalBs - deduccionesLey).toFixed(2));
  
  // 3. Cestaticket
  // El cestaticket mensual oficial es $40. A la semana se calculan $10 proporcionales a los días.
  // Asumimos semana laboral de 5 días hábiles.
  const proporcionCesta = Math.min(diasLaborados / 5, 1);
  const cestaUsd = CESTATICKET_SEMANAL_USD * proporcionCesta;
  const cestaBs = Number((cestaUsd * tasaBcv).toFixed(2));
  
  // 4. Bono Complementario (Para llegar a la meta en USD)
  const metaIntegralBs = Number((metaIntegralSemanalUsd * tasaBcv).toFixed(2));
  
  let bonoComplementarioBs = metaIntegralBs - salarioNetoLeyBs - cestaBs;
  
  // Si el cálculo legal + cesta ya supera la meta, no hay bono
  if (bonoComplementarioBs < 0) {
    bonoComplementarioBs = 0;
  }
  bonoComplementarioBs = Number(bonoComplementarioBs.toFixed(2));
  
  // 5. Total Final a Pagar (Debe dar casi exacto a la meta_integral * tasa)
  const totalNetoPagadoBs = Number((salarioNetoLeyBs + cestaBs + bonoComplementarioBs).toFixed(2));
  const totalNetoPagadoUsd = Number((totalNetoPagadoBs / tasaBcv).toFixed(2));

  return {
    salario_base_bs: salarioBaseSemanalBs,
    dia_descanso_bs: Number(diaDescanso.toFixed(2)),
    sso_bs: sso,
    spf_bs: spf,
    faov_bs: faov,
    total_deducciones_ley_bs: deduccionesLey,
    salario_neto_ley_bs: salarioNetoLeyBs,
    cestaticket_bs: cestaBs,
    equivalente_meta_bs: metaIntegralBs,
    bono_complementario_bs: bonoComplementarioBs,
    total_neto_pagado_bs: totalNetoPagadoBs,
    total_neto_pagado_usd: totalNetoPagadoUsd
  };
}
