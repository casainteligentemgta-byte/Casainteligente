import {
  camposRegistroMercantilContrato,
  fechaLargaRegistroMercantilContratoVe,
} from '@/lib/talento/registroMercantilCamposPdf';
import { textoTrasLaPalabraOficinaDe } from '@/lib/talento/textoOficinaRegistroMercantil';

/** Oficina de registro mercantil para comparecencia (con artículo «el»). */
export function oficinaRegistroMercantilComparecencia(circunscripcion: string | null | undefined): string {
  const t = (circunscripcion ?? '').trim();
  if (!t) {
    return 'el Registro Mercantil Segundo de la Circunscripción del Estado Nueva Esparta';
  }
  if (/^el\s+registro\s+mercantil/i.test(t)) return t;
  if (/^registro\s+mercantil/i.test(t)) return `el ${t}`;
  return `el ${textoTrasLaPalabraOficinaDe(t)}`;
}

/**
 * Párrafo «inscrita por ante el Registro Mercantil…, en fecha…, N°…, Tomo…»
 * desde `ci_entidades.registro_mercantil` (jsonb).
 */
export function textoInscripcionRegistroMercantilComparecencia(raw: unknown): string {
  const campos = camposRegistroMercantilContrato(raw);
  const oficina = oficinaRegistroMercantilComparecencia(campos.circunscripcion);
  const fecha = fechaLargaRegistroMercantilContratoVe(campos.fecha) ?? '___';
  const num = campos.numero.trim() || '___';
  const tomo = campos.tomo.trim() || '___';
  return `inscrita por ante ${oficina}, en fecha ${fecha}, quedando anotada bajo el N° ${num}, Tomo ${tomo},`;
}
