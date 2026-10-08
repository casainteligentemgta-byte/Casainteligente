import type { ContratoObreroPdfStructuredProps } from '@/lib/talento/ContratoObreroPdfStructured';
import { valorPlantillaEfectivamenteVacio } from '@/lib/talento/datosObraContratoPm';

/** Dato que el contrato imprimiría en blanco: de quién depende y cómo se llama. */
export type FaltanteContrato = { origen: 'obra' | 'empleador'; dato: string };

function vacio(v: unknown): boolean {
  return valorPlantillaEfectivamenteVacio(v == null ? '' : String(v));
}

/**
 * Revisa los mismos datos con que se arma el PDF del contrato y devuelve los que saldrían
 * en blanco. No incluye los que tienen valor por defecto (horario, ciudad del domicilio procesal).
 */
export function faltantesDesdePropsContrato(
  props: Pick<ContratoObreroPdfStructuredProps, 'entidad' | 'contrato' | 'parametros'>,
): FaltanteContrato[] {
  const out: FaltanteContrato[] = [];
  const obra = (dato: string, v: unknown) => {
    if (vacio(v)) out.push({ origen: 'obra', dato });
  };
  const emp = (dato: string, v: unknown) => {
    if (vacio(v)) out.push({ origen: 'empleador', dato });
  };

  const c = props.contrato ?? null;
  obra('Nombre de la obra', c?.obra_denominada);
  obra('Lugar de trabajo (ubicación de la obra)', c?.lugar_prestacion_servicio);
  obra('Fase técnica de la obra', c?.objeto_contrato);
  obra('Punto de encuentro del transporte', props.parametros.textoPuntoEncuentroTransporteSex);

  const e = props.entidad;
  emp('Razón social', e.nombre_legal ?? e.nombre);
  emp('RIF', e.rif);
  emp('Domicilio de la empresa', e.domicilio_fiscal ?? e.direccion_fiscal);
  emp('Municipio de la sede', e.municipio_fiscal);
  emp('Estado de la sede', e.estado_fiscal);
  emp('Nombre del representante legal', e.rep_legal_nombre ?? e.representante_legal);
  emp('Cédula del representante legal', e.rep_legal_cedula);
  emp('Estado civil del representante legal', e.rep_legal_estado_civil);
  emp('Registro mercantil: fecha', e.rm_fecha);
  emp('Registro mercantil: número', e.rm_numero);
  emp('Registro mercantil: tomo', e.rm_tomo);
  return out;
}
