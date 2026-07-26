import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';
import { buscarCargoEmpleadoComun } from '@/lib/constants/cargosEmpleadosComunes';
import { quitarAcentos } from '@/lib/talento/psique/extraerPalabrasClave';
import type { RolExamenPsique } from '@/lib/talento/psique/recomendarPruebasPsique';

export type TipoPersonalPsique = 'obrero' | 'empleado';

/** Infiere banco de examen a partir del nombre de cargo (heurística local). */
export function rolExamenDesdeNombreCargo(
  cargoNombre: string,
  tipoPersonal: TipoPersonalPsique,
): RolExamenPsique {
  const n = quitarAcentos(cargoNombre.toLowerCase());

  if (tipoPersonal === 'empleado') {
    const hit = buscarCargoEmpleadoComun(cargoNombre);
    if (hit) return hit.rol_examen_sugerido;
    if (n.includes('program') || n.includes('desarroll') || n.includes('software') || n.includes(' ti')) {
      return 'programador';
    }
    if (
      n.includes('dibuj') ||
      n.includes('arquitect') ||
      n.includes('ingenier') ||
      n.includes('topograf') ||
      n.includes('residente') ||
      n.includes('project')
    ) {
      return 'tecnico';
    }
    return 'empleado';
  }

  // Obrero / campo
  if (n.includes('vigilante') || n.includes('seguridad') || n.includes('portero')) {
    return 'vigilante';
  }
  if (
    n.includes('topograf') ||
    n.includes('maestro de obra') ||
    n.includes('capataz') ||
    n.includes('residente') ||
    n.includes('instalador electricomecanico') ||
    n.includes('tecnico')
  ) {
    return 'tecnico';
  }
  return 'obrero';
}

export function etiquetaTipoPersonal(tipo: TipoPersonalPsique): string {
  return tipo === 'obrero' ? 'Obrero (campo / tabulador)' : 'Empleado (oficina)';
}

/** Texto que se envía a Psique (incluye código GOE si aplica). */
export function textoSolicitudDesdeCargo(opts: {
  tipoPersonal: TipoPersonalPsique;
  cargoId: string;
  cargoNombre: string;
}): string {
  if (opts.tipoPersonal === 'obrero') {
    const row = CARGOS_OBREROS.find((c) => c.codigo === opts.cargoId);
    if (row) {
      return `Vacante obrero. Oficio tabulador ${row.codigo} — ${row.nombre}. Nivel ${row.nivel}.`;
    }
  }
  const emp = buscarCargoEmpleadoComun(opts.cargoId) ?? buscarCargoEmpleadoComun(opts.cargoNombre);
  if (emp) {
    return `Vacante empleado oficina. Cargo: ${emp.nombre}. Área: ${emp.area}.`;
  }
  return `Vacante ${opts.tipoPersonal}. Cargo: ${opts.cargoNombre}.`;
}
