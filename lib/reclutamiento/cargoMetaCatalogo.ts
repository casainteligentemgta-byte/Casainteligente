/**
 * Metadatos de vacante a partir del catálogo de obreros (grupo + texto de cargo).
 * Alineado con `POST /api/recruitment/needs` (cargo_codigo, cargo_nivel, tipo_vacante).
 */
export type TipoVacanteObrero = 'obrero_basico' | 'obrero_especializado';

export function nivelDesdeDepartamento(departamento: string): number | null {
  const m = /^Grupo\s+(\d+)/i.exec(departamento.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;
  return n;
}

/** Extrae código tipo "5.1" del inicio del texto de cargo. */
export function codigoOficioDesdeTextoCargo(cargo: string): string | null {
  const m = /^(\d+)\.(\d+)\b/.exec(cargo.trim());
  return m ? `${m[1]}.${m[2]}` : null;
}

export function tipoVacanteDesdeNivel(nivel: number): TipoVacanteObrero {
  return nivel >= 1 && nivel <= 4 ? 'obrero_basico' : 'obrero_especializado';
}

export function metaDesdeCargoCatalogo(
  departamento: string,
  cargo: string,
):
  | {
      cargoCodigo: string;
      cargoNombre: string;
      cargoNivel: number;
      tipoVacante: TipoVacanteObrero;
    }
  | null {
  const cargoNivel = nivelDesdeDepartamento(departamento);
  const cargoCodigo = codigoOficioDesdeTextoCargo(cargo);
  if (cargoNivel == null || !cargoCodigo) return null;
  return {
    cargoCodigo,
    cargoNombre: cargo.trim(),
    cargoNivel,
    tipoVacante: tipoVacanteDesdeNivel(cargoNivel),
  };
}
