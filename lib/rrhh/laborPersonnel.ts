import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';

const CARGO_NOMBRE_POR_CODIGO = new Map(CARGOS_OBREROS.map((c) => [c.codigo, c.nombre]));

/** Obrero disponible para asignación (alineado a `ci_empleados` + cuadrilla). */
export function esObreroDisponible(row: {
  estado?: string | null;
  estatus?: string | null;
  rol_examen?: string | null;
}): boolean {
  if ((row.rol_examen ?? '').trim().toLowerCase() !== 'obrero') return false;
  if ((row.estado ?? '').trim().toLowerCase() !== 'aprobado') return false;
  const es = (row.estatus ?? '').trim().toLowerCase();
  if (es === 'disponible' || es === '') return true;
  return false;
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
