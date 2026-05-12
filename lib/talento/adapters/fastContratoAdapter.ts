import type {
  ConfigNominaContratoPdf,
  ContratoObreroDetallePdf,
  ContratoObreroPdfStructuredProps,
  EmpleadoContratoPdf,
  EntidadContratoPdf,
  ParametrosContratoPdf,
} from '@/lib/talento/ContratoObreroPdfStructured';
import { textoPuntoEncuentroTransporteClausulaSex } from '@/lib/talento/puntoEncuentroTransporteClausulaSex';

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Payload típico de un flujo “rápido” (API / preview) hacia el PDF estructurado. */
export type FastContratoObreroPayload = {
  obrero_nombre?: string | null;
  obrero_cedula?: string | null;
  obrero_direccion?: string | null;
  obrero_nacionalidad?: string | null;
  obrero_estado_civil?: string | null;
  oficio_nombre?: string | null;
  /** Número o texto ya consolidado en USD (cláusula SEXTA / ingreso integral). */
  ingreso_total_consolidado_usd?: number | string | null;
  objeto_contrato?: string | null;
  /** ISO `YYYY-MM-DD` preferido para firma / ingreso. */
  fecha_firma_iso?: string | null;
  fecha_ingreso_iso?: string | null;
};

/** Fila o parcial compatible con `ci_entidades`. */
export type EntidadContratoLike = Partial<EntidadContratoPdf> & Record<string, unknown>;

/** Fila o parcial compatible con `ci_proyectos`. */
export type ProyectoContratoLike = {
  nombre?: string | null;
  punto_encuentro_transporte_contrato?: string | null;
  obra_ubicacion?: string | null;
  ubicacion_texto?: string | null;
} & Record<string, unknown>;

export type MapeoFastContratoPdf = {
  empleado: Partial<EmpleadoContratoPdf>;
  entidad: EntidadContratoPdf;
  parametros: Partial<ParametrosContratoPdf>;
  contrato: ContratoObreroDetallePdf | null;
  configNomina: Partial<ConfigNominaContratoPdf>;
};

function entidadDesdeLike(row: EntidadContratoLike | null | undefined): EntidadContratoPdf {
  if (!row || typeof row !== 'object') return {};
  return {
    nombre_legal: str(row.nombre_legal) || undefined,
    nombre: str(row.nombre) || undefined,
    rif: str(row.rif) || undefined,
    domicilio_fiscal: str(row.domicilio_fiscal) || undefined,
    direccion_fiscal: str(row.direccion_fiscal) || undefined,
    municipio_fiscal: str(row.municipio_fiscal) || undefined,
    estado_fiscal: str(row.estado_fiscal) || undefined,
    representante_legal: str(row.representante_legal) || undefined,
    rep_legal_nombre: str(row.rep_legal_nombre) || undefined,
    rep_legal_cedula: str(row.rep_legal_cedula) || undefined,
    rep_legal_cargo: str(row.rep_legal_cargo) || undefined,
    rep_legal_nacionalidad: str(row.rep_legal_nacionalidad) || undefined,
    rep_legal_estado_civil: str(row.rep_legal_estado_civil) || undefined,
    rm_oficina: str(row.rm_oficina) || undefined,
    rm_fecha: str(row.rm_fecha) || undefined,
    rm_numero: str(row.rm_numero) || undefined,
    rm_tomo: str(row.rm_tomo) || undefined,
  };
}

function proyectoLugarPrestacion(p: ProyectoContratoLike | null | undefined): string | null {
  if (!p || typeof p !== 'object') return null;
  const u = str(p.obra_ubicacion) || str(p.ubicacion_texto);
  return u || null;
}

/**
 * Mapea datos “rápidos” + `ci_entidades` + `ci_proyectos` a fragmentos compatibles con {@link ContratoObreroPdfStructuredProps}.
 * No incluye `laboral`: el PDF espera `empleado`, `entidad`, `parametros`, `contrato`, `configNomina`.
 */
export function mapearDataFastAPdf(
  dataFast: FastContratoObreroPayload,
  entidad: EntidadContratoLike | null | undefined,
  proyecto: ProyectoContratoLike | null | undefined,
): MapeoFastContratoPdf {
  const nombreObrero = str(dataFast.obrero_nombre);
  const cedula = str(dataFast.obrero_cedula);
  const dir = str(dataFast.obrero_direccion);

  const ingresoRaw = dataFast.ingreso_total_consolidado_usd;
  let ingresoTxt: string | null = null;
  if (ingresoRaw != null && ingresoRaw !== '') {
    const n = typeof ingresoRaw === 'number' ? ingresoRaw : Number.parseFloat(String(ingresoRaw).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) {
      ingresoTxt = `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} USD`;
    } else {
      ingresoTxt = String(ingresoRaw).trim();
    }
  }

  const fechaIso = str(dataFast.fecha_firma_iso) || str(dataFast.fecha_ingreso_iso) || null;

  const puntoRaw = proyecto && typeof proyecto === 'object' ? proyecto.punto_encuentro_transporte_contrato : null;
  const puntoSex = textoPuntoEncuentroTransporteClausulaSex(
    typeof puntoRaw === 'string' ? puntoRaw : puntoRaw == null ? undefined : String(puntoRaw),
  );

  const obraNombre = proyecto && typeof proyecto === 'object' ? str(proyecto.nombre) : '';
  const lugar = proyectoLugarPrestacion(proyecto);

  return {
    empleado: {
      nombres: nombreObrero || undefined,
      nombre_completo: nombreObrero || undefined,
      cedula: cedula || undefined,
      documento: cedula || undefined,
      direccion_domicilio: dir || undefined,
      direccion_habitacion: dir || undefined,
      nacionalidad: str(dataFast.obrero_nacionalidad) || undefined,
      estado_civil: str(dataFast.obrero_estado_civil) || undefined,
      cargo_nombre: str(dataFast.oficio_nombre) || undefined,
    },
    entidad: entidadDesdeLike(entidad),
    parametros: {
      fechaIngreso: fechaIso,
      fechaFirmaContratoIso: fechaIso,
      ingresoSemanalConsolidadoUsdTexto: ingresoTxt,
      textoPuntoEncuentroTransporteSex: puntoSex,
    },
    contrato: {
      objeto_contrato: str(dataFast.objeto_contrato) || undefined,
      lugar_prestacion_servicio: lugar || obraNombre || undefined,
      obra_denominada: obraNombre || undefined,
    },
    configNomina: {},
  };
}

/**
 * Fusiona un mapeo rápido sobre props ya cargadas (p. ej. desde Supabase), sin mutar el objeto base.
 */
export function fusionarPropsContratoPdfConFast(
  base: ContratoObreroPdfStructuredProps,
  fast: MapeoFastContratoPdf,
): ContratoObreroPdfStructuredProps {
  const c0 = base.contrato ?? null;
  const cf = fast.contrato;
  const contrato =
    cf != null
      ? {
          ...(c0 ?? {}),
          ...cf,
          objeto_contrato: str(cf.objeto_contrato) || str(c0?.objeto_contrato) || null,
          lugar_prestacion_servicio: str(cf.lugar_prestacion_servicio) || str(c0?.lugar_prestacion_servicio) || null,
          obra_denominada: str(cf.obra_denominada) || str(c0?.obra_denominada) || null,
        }
      : c0;

  return {
    ...base,
    empleado: { ...base.empleado, ...fast.empleado },
    entidad: { ...base.entidad, ...fast.entidad },
    parametros: { ...base.parametros, ...fast.parametros },
    contrato,
    configNomina: { ...base.configNomina, ...fast.configNomina },
  };
}
