/** Representante(s) legal(es) asociados al registro mercantil / contratos (jsonb). */
export type RepresentanteMercantilCi = {
  nombre?: string;
  cedula?: string;
  /** Edad en años (planilla de empleo / Gaceta). */
  edad?: string;
  estado_civil?: string;
  nacionalidad?: string;
  cargo?: string;
  domicilio?: string;
  profesion?: string;
};

/**
 * Registro mercantil en `ci_entidades.registro_mercantil` (jsonb), editado en `/configuracion/entidades`.
 * `fecha`, `tomo` y `numero` alimentan el párrafo del empleador en el contrato laboral PDF (vía `ci_proyectos.entidad_id`).
 */
export type RegistroMercantilCi = {
  /** Domicilio social o de la empresa según consta en el registro (puede coincidir con dirección fiscal). */
  domicilio_empresa?: string;
  /** Tomo del libro de comercio (contrato PDF: «constando en el Tomo …»). */
  tomo?: string;
  /** Número de inscripción o asiento en el RM (contrato PDF: «bajo el Nº …»); no confundir con el RIF. */
  numero?: string;
  /** Fecha de inscripción ISO `YYYY-MM-DD` (contrato PDF: «de fecha …»). */
  fecha?: string;
  /** Tras «Oficina de » en contrato: «Registro Mercantil Segundo de la Circunscripción Judicial del Estado …». */
  circunscripcion?: string;
  /** Uno o varios representantes con datos de identificación para actos y contratos. */
  representantes?: RepresentanteMercantilCi[];
};

/** Permisología / vencimientos en `ci_entidades.permisologia` (jsonb). */
export type PermisologiaCi = {
  ivss_vence?: string;
  inces_vence?: string;
  solvencia_laboral_vence?: string;
};

/** Fila de `public.ci_entidades` (entidad de trabajo / patrono). */
export type CiEntidad = {
  id: string;
  /** Nombre legal / razón social. */
  nombre: string;
  nombre_comercial?: string | null;
  rif: string | null;
  direccion_fiscal?: string | null;
  rep_legal_nombre?: string | null;
  rep_legal_cedula?: string | null;
  rep_legal_cargo?: string | null;
  registro_mercantil?: RegistroMercantilCi | null;
  permisologia?: PermisologiaCi | null;
  logo_url?: string | null;
  sello_url?: string | null;
  notas: string | null;
  created_at?: string;
  updated_at?: string;
};
