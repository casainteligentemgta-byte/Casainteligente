/** Catálogos del paso 1 de hoja de vida (Venezuela). */

export const ESTADOS_CIVILES_HV = [
  'Soltero/a',
  'Casado/a',
  'Divorciado/a',
  'Viudo/a',
  'Unión estable de hecho',
] as const;

export const ESTADOS_VE_HV = [
  'Amazonas',
  'Anzoátegui',
  'Apure',
  'Aragua',
  'Barinas',
  'Bolívar',
  'Carabobo',
  'Cojedes',
  'Delta Amacuro',
  'Distrito Capital',
  'Falcón',
  'Guárico',
  'Lara',
  'Mérida',
  'Miranda',
  'Monagas',
  'Nueva Esparta',
  'Portuguesa',
  'Sucre',
  'Táchira',
  'Trujillo',
  'Vargas',
  'Yaracuy',
  'Zulia',
] as const;

export const PAISES_NACIMIENTO_HV = [
  'Venezuela',
  'Colombia',
  'Brasil',
  'Perú',
  'Ecuador',
  'Bolivia',
  'Chile',
  'Argentina',
  'Panamá',
  'República Dominicana',
  'Cuba',
  'Haití',
  'España',
  'China',
  'Portugal',
  'Italia',
  'Otro',
] as const;

export const NACIONALIDADES_HV = [
  'Venezolana',
  'Colombiana',
  'Brasileña',
  'Peruana',
  'Ecuatoriana',
  'Boliviana',
  'Chilena',
  'Argentina',
  'Panameña',
  'Dominicana',
  'Cubana',
  'Haitiana',
  'Española',
  'China',
  'Portuguesa',
  'Italiana',
  'Otra',
] as const;

/** Prefijos móviles vigentes en Venezuela (con 0). */
export const PREFIJOS_CELULAR_VE = ['0412', '0414', '0416', '0422', '0424', '0426'] as const;

export type LetraCedulaHv = 'V' | 'E';

export function parseCedulaHv(raw: string): { letra: LetraCedulaHv; numero: string } {
  const t = String(raw ?? '').trim().toUpperCase();
  const m = t.match(/^([VE])?[-\s.]*(.*)$/);
  const letra: LetraCedulaHv = m?.[1] === 'E' ? 'E' : 'V';
  const numero = (m?.[2] ?? '').replace(/\D/g, '').slice(0, 9);
  return { letra, numero };
}

export function composeCedulaHv(letra: LetraCedulaHv, numero: string): string {
  const n = String(numero ?? '').replace(/\D/g, '').slice(0, 9);
  return n ? `${letra}-${n}` : '';
}

export function parseCelularVe(raw: string): { prefijo: string; numero: string } {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('58') && d.length >= 12) d = `0${d.slice(2)}`;
  if (d.length === 10 && d.startsWith('4')) d = `0${d}`;
  const prefijo =
    PREFIJOS_CELULAR_VE.find((p) => d.startsWith(p)) ?? PREFIJOS_CELULAR_VE[1];
  const resto = d.startsWith(prefijo) ? d.slice(prefijo.length) : d.replace(/^0?\d{3}/, '');
  return { prefijo, numero: resto.slice(0, 7) };
}

/**
 * Lo que el obrero escribe en la casilla del número. Si escribe o pega el número completo
 * (04241234567, +58 424…), se separa el prefijo en lugar de cortar los 7 primeros dígitos.
 */
export function celularDesdeEntrada(prefijoActual: string, texto: string): string {
  const d = String(texto ?? '').replace(/\D/g, '');
  if (d.length >= 10) {
    const p = parseCelularVe(d);
    return composeCelularVe(p.prefijo, p.numero);
  }
  return composeCelularVe(prefijoActual, d);
}

export function composeCelularVe(prefijo: string, numero: string): string {
  const p = PREFIJOS_CELULAR_VE.includes(prefijo as (typeof PREFIJOS_CELULAR_VE)[number])
    ? prefijo
    : PREFIJOS_CELULAR_VE[1];
  const n = String(numero ?? '').replace(/\D/g, '').slice(0, 7);
  return `${p}${n}`;
}
