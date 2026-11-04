/** Asignar / devolver herramienta a obra (`ci_proyecto_equipos`). */

export type EstadoHerramientaObra = 'disponible' | 'en_obra';

export function estadoHerramientaObra(row: {
  proyecto_id?: string | null;
  fecha_devolucion?: string | null;
}): EstadoHerramientaObra {
  const proyecto = String(row.proyecto_id ?? '').trim();
  const devuelta = String(row.fecha_devolucion ?? '').trim();
  if (proyecto && !devuelta) return 'en_obra';
  return 'disponible';
}

export function etiquetaEstadoHerramienta(estado: EstadoHerramientaObra): string {
  return estado === 'en_obra' ? 'En obra' : 'Disponible';
}

export function payloadAsignarHerramienta(args: {
  proyectoId: string;
  fechaAsignacion?: string;
  costoDiario?: number | null;
}): Record<string, unknown> {
  const proyectoId = args.proyectoId.trim();
  if (!proyectoId) throw new Error('Elige la obra a la que va la herramienta.');
  const fecha = (args.fechaAsignacion ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const row: Record<string, unknown> = {
    proyecto_id: proyectoId,
    fecha_asignacion: fecha,
    fecha_devolucion: null,
  };
  if (args.costoDiario != null && Number.isFinite(args.costoDiario) && args.costoDiario >= 0) {
    row.costo_diario = Math.round(args.costoDiario * 10000) / 10000;
  }
  return row;
}

export function payloadDevolverHerramienta(args?: { fechaDevolucion?: string }): Record<string, unknown> {
  const fecha = (args?.fechaDevolucion ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  return { fecha_devolucion: fecha };
}

export function parseCostoDiario(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/,/g, '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10000) / 10000;
}
