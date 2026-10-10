import {
  esFechaIso,
  hoyCaracas,
  type PeriodoRendicion,
  type VersionRendicion,
} from '@/lib/contabilidad/cco/rendicionHonorarios';

export type ParametrosRendicion = {
  proyectoId: string | null;
  periodo: PeriodoRendicion;
  fecha: string;
  version: VersionRendicion;
};

/** Lee ?proyecto=&periodo=semana|mes|obra&fecha=YYYY-MM-DD&version=interna|cliente */
export function leerParametrosRendicion(url: string): ParametrosRendicion {
  const q = new URL(url).searchParams;
  const periodo = q.get('periodo');
  const fecha = q.get('fecha')?.trim() ?? '';
  return {
    proyectoId: q.get('proyecto')?.trim() || null,
    periodo: periodo === 'semana' || periodo === 'obra' ? periodo : 'mes',
    fecha: esFechaIso(fecha) ? fecha : hoyCaracas(),
    version: q.get('version') === 'cliente' ? 'cliente' : 'interna',
  };
}
