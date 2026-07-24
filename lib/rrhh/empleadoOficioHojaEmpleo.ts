import {
  parseHojaVidaObreroJson,
  type HojaVidaObreroCompleta,
} from '@/lib/talento/hojaVidaObreroCompleta';

/** Rutas donde RRHH o Admin pueden editar el oficio en la hoja de empleo. */
export function puedeEditarOficioHojaEmpleoStaff(returnPath: string | null | undefined): boolean {
  const p = (returnPath ?? '').trim();
  if (!p.startsWith('/') || p.startsWith('//')) return false;
  return p.startsWith('/rrhh') || p.startsWith('/talento/admin');
}

export function buildEmpleadoUpdateOficioHojaEmpleo(
  hojaRaw: unknown,
  cargoUOficio: string,
): {
  hoja_vida_obrero: HojaVidaObreroCompleta;
  cargo_nombre: string | null;
  rol_buscado: string | null;
  cargo: string | null;
} {
  const label = cargoUOficio.trim();
  const hoja = parseHojaVidaObreroJson(hojaRaw);
  hoja.contratacion.cargoUOficio = label;
  return {
    hoja_vida_obrero: hoja,
    cargo_nombre: label || null,
    rol_buscado: label || null,
    cargo: label || null,
  };
}
