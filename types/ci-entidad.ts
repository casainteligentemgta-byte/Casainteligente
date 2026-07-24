/** Representante(s) legal(es) asociados al registro mercantil / contratos (jsonb). */
export type RepresentanteMercantilCi = {
  nombre?: string;
  cedula?: string;
  /** Edad en años (planilla de empleo / Gaceta). */
  edad?: string;
  estado_civil?: string;
  /** Ej. «Venezolano» o la nacionalidad indicada si no es venezolano. */
  nacionalidad?: string;
  cargo?: string;
  /** Vía / urbanización del domicilio del representante (comparecencia). */
  domicilio?: string;
  /** Municipio donde reside el representante (comparecencia / contrato PDF). */
  municipio_residencia?: string;
  /** Estado donde reside el representante. */
  estado_residencia?: string;
  profesion?: string;
  /** Redacción «el ciudadano» / «la ciudadana» en contrato PDF. */
  genero?: 'M' | 'F';
};

/**
 * Registro mercantil en `ci_entidades.registro_mercantil` (jsonb), editado en `/configuracion/entidades`.
 * `fecha`, `tomo` y `numero` alimentan el párrafo del empleador en el contrato laboral PDF (vía `ci_proyectos.entidad_id`).
 */
export type RegistroMercantilCi = {
  /** Domicilio social o de la empresa según consta en el registro (puede coincidir con dirección fiscal). */
  domicilio_empresa?: string;
  /** Estado (geográfico) del domicilio según registro mercantil. En el formulario se captura antes que municipio y sector. */
  domicilio_estado_registro?: string;
  /** Municipio del domicilio según RM. */
  domicilio_municipio_registro?: string;
  /** Sector / parroquia urbana según RM; en documentos legales suele ir antes de municipio y estado. */
  domicilio_sector_registro?: string;
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
  /** Alias o columna dedicada según migración; usada en PDFs y resolución de domicilio fiscal. */
  domicilio_fiscal?: string | null;
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
