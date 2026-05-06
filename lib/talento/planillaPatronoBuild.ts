import { domicilioPatronoParaEntidad } from '@/lib/talento/patronoDomicilioReglas';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';
import type { RegistroMercantilCi, RepresentanteMercantilCi } from '@/types/ci-entidad';

function trimStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function parseRegistroMercantil(raw: unknown): RegistroMercantilCi {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as RegistroMercantilCi) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as RegistroMercantilCi;
  return {};
}

function primerRepresentante(
  rm: RegistroMercantilCi,
  columnas: { nombre: string; cedula: string; cargo: string },
): RepresentanteMercantilCi {
  const arr = rm.representantes;
  const fromJson =
    Array.isArray(arr) && arr[0] && typeof arr[0] === 'object' && !Array.isArray(arr[0])
      ? (arr[0] as RepresentanteMercantilCi)
      : {};
  return {
    ...fromJson,
    nombre: trimStr(fromJson.nombre) || trimStr(columnas.nombre) || undefined,
    cedula: trimStr(fromJson.cedula) || trimStr(columnas.cedula) || undefined,
    cargo: trimStr(fromJson.cargo) || trimStr(columnas.cargo) || undefined,
  };
}

/**
 * Campos del patrono exigidos en la planilla de empleo (criterio Gaceta / referencia legal),
 * a partir de `ci_entidades` + nombre de proyecto.
 */
export function planillaPatronoDesdeEntidadRow(input: {
  nombre: string | null | undefined;
  nombre_legal?: string | null | undefined;
  rif: string | null | undefined;
  domicilio_fiscal?: string | null | undefined;
  direccion_fiscal?: string | null | undefined;
  rep_legal_nombre?: string | null | undefined;
  rep_legal_cedula?: string | null | undefined;
  rep_legal_cargo?: string | null | undefined;
  registro_mercantil?: unknown;
  proyectoNombre?: string | null | undefined;
}): PlanillaPatronoCampos {
  const rm = parseRegistroMercantil(input.registro_mercantil);
  const rep = primerRepresentante(rm, {
    nombre: trimStr(input.rep_legal_nombre),
    cedula: trimStr(input.rep_legal_cedula),
    cargo: trimStr(input.rep_legal_cargo),
  });
  const domEmpresa =
    trimStr(
      domicilioPatronoParaEntidad({
        nombre_legal: input.nombre_legal,
        nombre: input.nombre,
        domicilio_fiscal: input.domicilio_fiscal,
        direccion_fiscal: input.direccion_fiscal,
        registro_mercantil: input.registro_mercantil,
      }) ?? '',
    ) || trimStr(input.direccion_fiscal);

  return {
    entidadNombre: trimStr(input.nombre),
    entidadRif: trimStr(input.rif),
    proyectoNombre: trimStr(input.proyectoNombre),
    representanteNombreApellido: trimStr(rep.nombre),
    representanteCi: trimStr(rep.cedula),
    representanteEdad: trimStr(rep.edad),
    representanteEstadoCivil: trimStr(rep.estado_civil),
    representanteCargo: trimStr(rep.cargo),
    representanteNacionalidad: trimStr(rep.nacionalidad),
    empresaDomicilio: domEmpresa,
  };
}
