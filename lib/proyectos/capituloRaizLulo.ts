/** Capítulo raíz inferido del código de partida Lulo (ej. E311110150 → E-31 → ESTRUCTURA). */

const ETIQUETA_POR_PREFIJO: Record<string, string> = {
  'E-31': 'ESTRUCTURA',
  'E-30': 'ESTRUCTURA',
  'E-32': 'ESTRUCTURA',
  E: 'ESTRUCTURA',
  'A-01': 'ARQUITECTURA',
  'A-02': 'ARQUITECTURA',
  A: 'ARQUITECTURA',
  'I-01': 'INSTALACIONES',
  'I-02': 'INSTALACIONES',
  I: 'INSTALACIONES',
  'M-01': 'MOBILIARIO',
  M: 'MOBILIARIO',
  'G-01': 'GENERAL',
  G: 'GENERAL',
  'O-01': 'OBRA CIVIL',
  O: 'OBRA CIVIL',
};

export type CapituloRaizLulo = {
  prefijo: string;
  etiqueta: string;
};

export function extraerCapituloRaizDesdeCodigo(codigoPartida: string): CapituloRaizLulo {
  const raw = String(codigoPartida ?? '').trim().toUpperCase();
  const compact = raw.replace(/\s+/g, '');

  const matchGuion = compact.match(/^([A-Z])-(\d{1,2})/);
  if (matchGuion) {
    const prefijo = `${matchGuion[1]}-${matchGuion[2].padStart(2, '0')}`;
    return { prefijo, etiqueta: resolverEtiquetaCapituloRaiz(prefijo) };
  }

  const matchLetraNum = compact.match(/^([A-Z])(\d{2,})/);
  if (matchLetraNum) {
    const prefijo = `${matchLetraNum[1]}-${matchLetraNum[2].slice(0, 2)}`;
    return { prefijo, etiqueta: resolverEtiquetaCapituloRaiz(prefijo) };
  }

  const soloLetra = compact.match(/^([A-Z])/);
  if (soloLetra) {
    const prefijo = soloLetra[1];
    return { prefijo, etiqueta: resolverEtiquetaCapituloRaiz(prefijo) };
  }

  const digitos = compact.match(/^(\d{1,2})/);
  if (digitos) {
    const prefijo = digitos[1].padStart(2, '0');
    return { prefijo, etiqueta: `CAPÍTULO ${prefijo}` };
  }

  return { prefijo: 'GEN', etiqueta: 'GENERAL' };
}

export function resolverEtiquetaCapituloRaiz(prefijo: string): string {
  const p = prefijo.trim().toUpperCase();
  if (ETIQUETA_POR_PREFIJO[p]) return ETIQUETA_POR_PREFIJO[p];
  const letra = p.split('-')[0];
  if (letra && ETIQUETA_POR_PREFIJO[letra]) return ETIQUETA_POR_PREFIJO[letra];
  return p.includes('-') ? `CAPÍTULO ${p}` : `CAPÍTULO ${p}`;
}

export function tituloCapituloRaizEjecutivo(raiz: CapituloRaizLulo): string {
  if (raiz.etiqueta === raiz.prefijo || raiz.etiqueta.startsWith('CAPÍTULO')) {
    return raiz.etiqueta;
  }
  return `${raiz.etiqueta} (${raiz.prefijo})`;
}
