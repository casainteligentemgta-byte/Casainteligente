import type { ObraData, Partida as PartidaPresupuesto } from '@/components/proyectos/PresupuestoPorCapitulos';

export type PartidaPresupuestoFuente = {
  id: string;
  codigo_partida: string;
  descripcion: string;
  unidad: string;
  cantidad_presupuestada: number;
  precio_unitario_estimado: number;
  capitulo_codigo?: string | null;
  capitulo_descripcion?: string | null;
};

export type ProyectoPresupuestoMeta = {
  nombre?: string | null;
  ubicacion_texto?: string | null;
  obra_ubicacion?: string | null;
  obra_cliente?: string | null;
  codigo_lulo?: string | null;
};

export function etiquetaCapituloPartida(p: PartidaPresupuestoFuente): string {
  const desc = String(p.capitulo_descripcion ?? '').trim();
  const cod = String(p.capitulo_codigo ?? '').trim();
  if (desc && cod) return `${cod} — ${desc}`;
  return desc || cod || 'GENERAL';
}

export function partidasToPresupuestoReporte(partidas: PartidaPresupuestoFuente[]): PartidaPresupuesto[] {
  return partidas.map((p) => ({
    id: p.id,
    codigo_covenin: String(p.codigo_partida ?? '').trim(),
    descripcion: String(p.descripcion ?? '').trim(),
    unidad: String(p.unidad ?? 'UND').trim() || 'UND',
    cantidad: Number(p.cantidad_presupuestada ?? 0),
    precio_unitario: Number(p.precio_unitario_estimado ?? 0),
    capitulo: etiquetaCapituloPartida(p),
  }));
}

export function buildObraDataPresupuesto(
  partidas: PartidaPresupuestoFuente[],
  proyecto: ProyectoPresupuestoMeta | null | undefined,
  proyectoNombre?: string | null,
  proyectoId?: string,
): ObraData {
  const nombre =
    String(proyecto?.nombre ?? proyectoNombre ?? '').trim() || 'Obra sin nombre';
  const ubicacion =
    String(proyecto?.obra_ubicacion ?? proyecto?.ubicacion_texto ?? '').trim() || '—';
  const propietario = String(proyecto?.obra_cliente ?? '').trim() || '—';
  const contrato =
    String(proyecto?.codigo_lulo ?? '').trim() ||
    (proyectoId ? `PROY-${proyectoId.slice(0, 8).toUpperCase()}` : '—');

  return {
    nombre_obra: nombre,
    ubicacion,
    propietario,
    contrato_nro: contrato,
    fecha: new Date().toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    partidas: partidasToPresupuestoReporte(partidas),
  };
}
