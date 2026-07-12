/** Motivo de terminación (simulación; efectos indemnizatorios según LOTTT y política interna). */
export type MotivoRetiro =
  | 'renuncia'
  | 'mutuo_acuerdo'
  | 'despido_justificado'
  | 'despido_injustificado'
  | 'transferencia'
  | 'cierre_obra'
  | 'otro';

export interface LiquidacionConstruccionInput {
  fechaIngreso: string;
  fechaEgreso: string;
  /** Salario básico **diario** en VES (último devengado; p. ej. del tabulador por nivel). */
  ultimoSalarioBasicoDiarioVES: number;
  /** Nivel 1–9 solo referencia en el desglose; el monto efectivo es `ultimoSalarioBasicoDiarioVES`. */
  nivelSalario?: number;
  motivoRetiro: MotivoRetiro;
  /** Nombre opcional para el encabezado del finiquito. */
  nombreEmpleado?: string;
}

export interface DesgloseMesServicio {
  anio: number;
  mes: number;
  etiquetaMes: string;
  diasServicioEnMes: number;
  /** Aporte reconocido del mes a la base de prestaciones (referencia). */
  aportePrestacionesReferenciaVES: number;
}

export interface ResultadoLiquidacionConstruccion {
  meta: {
    convencionReferencia: string;
    /** Cl. 12 y 13 del texto GOE 6.752 analizado (16 págs.): índole distinta y transferencia. */
    clausulasContexto: { clausula12: string; clausula13: string };
    vacacionesConvencion: string;
    utilidadesConvencion: string;
    advertenciaLegal: string;
  };
  entrada: {
    fechaIngreso: string;
    fechaEgreso: string;
    diasTotalesServicio: number;
    mesesServicioEquivalente: number;
    ultimoSalarioBasicoDiarioVES: number;
    nivelSalario?: number;
    motivoRetiro: MotivoRetiro;
  };
  prestacionesSociales: {
    descripcion: string;
    desglosePorMes: DesgloseMesServicio[];
    diasAcumuladosConsiderados: number;
    baseCalculoVES: number;
    /** Estimación contractual/LOTTT (revisión por abogado laboral obligatoria). */
    montoPrestacionesSocialesVES: number;
  };
  interesesPrestaciones: {
    descripcion: string;
    tasaAnualSimuladaPorcentaje: number;
    formula: string;
    montoInteresesVES: number;
  };
  vacacionesYBonoVacacional: {
    descripcion: string;
    /** Cl. 47: 17 días hábiles + pago total 80 días de SB (vacaciones + bono vacacional causados en vigencia). */
    diasSalarioVacacionesAnualEquivalente: number;
    proporcionAnual: number;
    montoVES: number;
  };
  utilidades: {
    descripcion: string;
    /** Cl. 48: mínimo 100 días de salario por utilidades causadas en el año (proporcional). */
    diasSalarioUtilidadesMinimoAnual: number;
    proporcionAnual: number;
    montoVES: number;
  };
  indemnizacionYSeverancia: {
    descripcion: string;
    montoVES: number;
  };
  transferenciaClausula13: {
    descripcion: string;
    aplica: boolean;
    nota: string;
    montoEstimadoGastosTrasladoVES: number;
  };
  granTotalVES: number;
  /** Suma de partidas principales (sin duplicar notas informativas). */
  resumenLineas: Array<{ concepto: string; montoVES: number }>;
}
