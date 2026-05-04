/**
 * Datos del patrono en la planilla de empleo (referencia Gaceta / LOTTT — expediente).
 * `entidadNombre` = nombre o denominación; `empresaDomicilio` = dirección/domicilio de la empresa.
 */
export type PlanillaPatronoCampos = {
  entidadNombre?: string;
  entidadRif?: string;
  proyectoNombre?: string;
  representanteNombreApellido?: string;
  representanteCi?: string;
  representanteEdad?: string;
  representanteEstadoCivil?: string;
  representanteCargo?: string;
  representanteNacionalidad?: string;
  empresaDomicilio?: string;
};
