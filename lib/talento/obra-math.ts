/**
 * Penalización por retraso: días hábiles de retraso × tarifa diaria configurada en obra.
 */
export function diasRetraso(fechaEntregaPrometida: Date, hoy: Date = new Date()): number {
  const e = new Date(fechaEntregaPrometida);
  e.setHours(0, 0, 0, 0);
  const n = new Date(hoy);
  n.setHours(0, 0, 0, 0);
  const diffMs = n.getTime() - e.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function penalizacionRetrasoUsd(
  fechaEntregaPrometida: Date,
  penalizacionDiariaUsd: number,
  hoy: Date = new Date(),
): number {
  const d = diasRetraso(fechaEntregaPrometida, hoy);
  return d * Math.max(0, penalizacionDiariaUsd);
}

export type CierreObraInput = {
  precioVentaUsd: number;
  sumaMaterialesUsd: number;
  honorariosEmpleadoUsd: number;
  multasEmpleadoUsd: number;
};

/**
 * Margen neto estimado del proyecto al cierre:
 * ingreso − materiales − (honorarios − multas aplicadas al empleado).
 * Las multas reducen lo que la empresa paga al empleado, mejorando el margen.
 */
export function margenNetoProyecto(c: CierreObraInput): number {
  const pagoNetoEmpleado = Math.max(0, c.honorariosEmpleadoUsd - c.multasEmpleadoUsd);
  return c.precioVentaUsd - c.sumaMaterialesUsd - pagoNetoEmpleado;
}
