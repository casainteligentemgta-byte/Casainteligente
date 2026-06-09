/** Umbrales para detectar fechas de factura sospechosas (OCR o captura manual). */
export const UMBRAL_FECHA_ADVERTENCIA_DIAS = 90;
export const UMBRAL_FECHA_CRITICO_DIAS = 365;
export const UMBRAL_FECHA_FUTURO_CRITICO_DIAS = 7;

export type UmbralesFechaCompra = {
  advertenciaDias: number;
  criticoDias: number;
  futuroCriticoDias: number;
};

export const UMBRALES_FECHA_COMPRA_DEFAULT: UmbralesFechaCompra = {
  advertenciaDias: UMBRAL_FECHA_ADVERTENCIA_DIAS,
  criticoDias: UMBRAL_FECHA_CRITICO_DIAS,
  futuroCriticoDias: UMBRAL_FECHA_FUTURO_CRITICO_DIAS,
};

export type NivelAlertaFechaCompra = 'ok' | 'advertencia' | 'critico';

export type AuditoriaFechaCompra = {
  nivel: NivelAlertaFechaCompra;
  fecha: string;
  /** Positivo = pasado; negativo = futuro. */
  diasDesdeHoy: number;
  mensaje: string;
};

function parseFechaIso(fecha: string): Date | null {
  const s = String(fecha ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function diasEntre(fecha: Date, ref: Date): number {
  const ms = ref.getTime() - fecha.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function auditoriaFechaCompra(
  fechaIso: string,
  refDate: Date = new Date(),
  umbrales: UmbralesFechaCompra = UMBRALES_FECHA_COMPRA_DEFAULT,
): AuditoriaFechaCompra {
  const fecha = String(fechaIso ?? '').trim().slice(0, 10);
  const parsed = parseFechaIso(fecha);
  if (!parsed) {
    return {
      nivel: 'critico',
      fecha,
      diasDesdeHoy: 0,
      mensaje: 'La fecha de la factura no es válida. Use formato AAAA-MM-DD.',
    };
  }

  const ref = new Date(
    Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate(), 12),
  );
  const dias = diasEntre(parsed, ref);
  const abs = Math.abs(dias);

  if (dias < -umbrales.futuroCriticoDias) {
    return {
      nivel: 'critico',
      fecha,
      diasDesdeHoy: dias,
      mensaje: `La fecha (${fecha}) está en el futuro. Revise el OCR o corrija manualmente.`,
    };
  }

  if (abs >= umbrales.criticoDias) {
    const cuando = dias > 0 ? `hace ${abs} días` : `dentro de ${abs} días`;
    return {
      nivel: 'critico',
      fecha,
      diasDesdeHoy: dias,
      mensaje: `Fecha muy alejada de hoy (${cuando}). Confirme explícitamente antes de registrar.`,
    };
  }

  if (abs >= umbrales.advertenciaDias) {
    const cuando = dias > 0 ? `hace ${abs} días` : `dentro de ${abs} días`;
    return {
      nivel: 'advertencia',
      fecha,
      diasDesdeHoy: dias,
      mensaje: `La fecha (${fecha}) dista ${cuando} del día de hoy. Verifique que sea correcta.`,
    };
  }

  return {
    nivel: 'ok',
    fecha,
    diasDesdeHoy: dias,
    mensaje: '',
  };
}

export class FechaCompraAnomalaError extends Error {
  readonly audit: AuditoriaFechaCompra;

  constructor(audit: AuditoriaFechaCompra) {
    super(audit.mensaje || 'Fecha de factura no permitida sin confirmación.');
    this.name = 'FechaCompraAnomalaError';
    this.audit = audit;
  }
}

export function exigeConfirmacionFechaAnomala(audit: AuditoriaFechaCompra): boolean {
  return audit.nivel === 'critico';
}

/** Usa el nivel persistido en BD cuando existe; si no, lo calcula desde la fecha. */
export function auditoriaFechaCompraAlmacenada(
  fechaIso: string,
  alertaAlmacenada?: NivelAlertaFechaCompra | null,
  refDate?: Date,
  umbrales?: UmbralesFechaCompra,
): AuditoriaFechaCompra {
  const audit = auditoriaFechaCompra(fechaIso, refDate, umbrales);
  if (alertaAlmacenada === 'advertencia' || alertaAlmacenada === 'critico') {
    return { ...audit, nivel: alertaAlmacenada };
  }
  return audit;
}

export type MetaAlertaFechaCompra = {
  nivel: NivelAlertaFechaCompra;
  mensaje: string;
  requiereVerificacion: boolean;
  verificada: boolean;
};

export function fechaAnomalaRequiereAtencion(nivel: NivelAlertaFechaCompra): boolean {
  return nivel === 'critico' || nivel === 'advertencia';
}

export function claseBlinkFechaCompra(nivel: NivelAlertaFechaCompra): string | null {
  if (nivel === 'critico') return 'compras-fecha-critica-blink';
  if (nivel === 'advertencia') return 'compras-fecha-advertencia-blink';
  return null;
}

export function etiquetaFechaAnomalaCorta(nivel: NivelAlertaFechaCompra): string {
  if (nivel === 'critico') return 'Fecha crítica';
  if (nivel === 'advertencia') return 'Fecha advertencia';
  return '';
}

export function metaAlertaFechaCompra(input: {
  fecha: string;
  alertaAlmacenada?: NivelAlertaFechaCompra | null;
  fechaConfirmadaManual?: boolean | null;
  refDate?: Date;
  umbrales?: UmbralesFechaCompra;
}): MetaAlertaFechaCompra {
  const audit = auditoriaFechaCompraAlmacenada(
    input.fecha,
    input.alertaAlmacenada,
    input.refDate,
    input.umbrales,
  );
  const verificada =
    Boolean(input.fechaConfirmadaManual) && fechaAnomalaRequiereAtencion(audit.nivel);
  return {
    nivel: audit.nivel,
    mensaje: audit.mensaje,
    requiereVerificacion: fechaAnomalaRequiereAtencion(audit.nivel) && !verificada,
    verificada,
  };
}
