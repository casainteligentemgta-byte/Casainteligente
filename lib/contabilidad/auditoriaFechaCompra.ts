/** Umbrales para detectar fechas de factura sospechosas (OCR o captura manual). */
export const UMBRAL_FECHA_ADVERTENCIA_DIAS = 90;
export const UMBRAL_FECHA_CRITICO_DIAS = 365;

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

  if (dias < -7) {
    return {
      nivel: 'critico',
      fecha,
      diasDesdeHoy: dias,
      mensaje: `La fecha (${fecha}) está en el futuro. Revise el OCR o corrija manualmente.`,
    };
  }

  if (abs >= UMBRAL_FECHA_CRITICO_DIAS) {
    const cuando = dias > 0 ? `hace ${abs} días` : `dentro de ${abs} días`;
    return {
      nivel: 'critico',
      fecha,
      diasDesdeHoy: dias,
      mensaje: `Fecha muy alejada de hoy (${cuando}). Confirme explícitamente antes de registrar.`,
    };
  }

  if (abs >= UMBRAL_FECHA_ADVERTENCIA_DIAS) {
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
