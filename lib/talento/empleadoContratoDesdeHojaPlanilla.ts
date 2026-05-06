import type { HojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';
import type { FuentesContratoObrero } from '@/lib/talento/plantillaContratoObreroCompile';

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export type CiEmpleadoContratoRow = {
  nombre_completo?: string | null;
  nombres?: string | null;
  documento?: string | null;
  cedula?: string | null;
  direccion_habitacion?: string | null;
  direccion_domicilio?: string | null;
  celular?: string | null;
  telefono?: string | null;
  nacionalidad?: string | null;
};

export function parseHojaVidaObrero(raw: unknown): HojaVidaObreroCompleta | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as HojaVidaObreroCompleta;
}

export type EmpleadoContratoFusion = FuentesContratoObrero['empleado'] & {
  /** Solo planilla / columnas; no forma parte de `FuentesContratoObrero.empleado`. */
  nacionalidad: string | null;
};

/**
 * Prioriza `hoja_vida_obrero.datosPersonales` sobre columnas sueltas de `ci_empleados`
 * para nombre, cédula, domicilio y contacto del contrato individual de trabajo.
 */
export function fusionarEmpleadoContratoDesdePlanilla(
  row: CiEmpleadoContratoRow,
  hv: HojaVidaObreroCompleta | null,
): EmpleadoContratoFusion {
  const dp = hv?.datosPersonales;
  const nombreDesdeHoja =
    [dp?.primerNombre, dp?.segundoNombre, dp?.primerApellido, dp?.segundoApellido]
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim() || null;

  const nombre_completo = nombreDesdeHoja ?? str(row.nombre_completo) ?? str(row.nombres);
  const cedula = str(dp?.cedulaIdentidad) ?? str(row.cedula) ?? str(row.documento);
  const documento = str(row.documento) ?? str(row.cedula) ?? str(dp?.cedulaIdentidad);
  const direccion = str(dp?.direccionDomicilio) ?? str(row.direccion_domicilio) ?? str(row.direccion_habitacion);
  const celular = str(dp?.celular) ?? str(row.celular);
  const telefono = str(dp?.telHabitacion) ?? str(row.telefono);
  const nacionalidad = str(dp?.nacionalidad) ?? str(row.nacionalidad);

  return {
    nombre_completo,
    documento,
    cedula,
    direccion,
    celular,
    telefono,
    nacionalidad,
  };
}
