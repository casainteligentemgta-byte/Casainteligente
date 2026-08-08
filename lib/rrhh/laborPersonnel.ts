import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';
import { esAptoParaAsignar } from '@/lib/rrhh/empleadoEstados';

const CARGO_NOMBRE_POR_CODIGO = new Map(CARGOS_OBREROS.map((c) => [c.codigo, c.nombre]));

/** Obrero disponible para asignación (alineado a `ci_empleados` + cuadrilla). */
export function esObreroDisponible(row: {
  estado?: string | null;
  estatus?: string | null;
  status?: string | null;
  rol_examen?: string | null;
}): boolean {
  return esAptoParaAsignar(row);
}

export function coincideEspecialidad(
  specialtyCodigo: string,
  row: { cargo_codigo?: string | null; cargo_nombre?: string | null },
): boolean {
  const cod = (specialtyCodigo ?? '').trim();
  if (!cod) return false;
  if ((row.cargo_codigo ?? '').trim() === cod) return true;
  const nom = (row.cargo_nombre ?? '').trim().toUpperCase();
  const ref = (CARGO_NOMBRE_POR_CODIGO.get(cod) ?? '').trim().toUpperCase();
  if (ref && nom === ref) return true;
  return false;
}
