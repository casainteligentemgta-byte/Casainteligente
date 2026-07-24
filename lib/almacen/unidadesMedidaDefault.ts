export type UnidadMedidaOpcion = { code: string; name: string };

/** Catálogo base (misma semilla que migration 014 + unidades frecuentes en obra). */
export const UNIDADES_MEDIDA_DEFAULT: UnidadMedidaOpcion[] = [
  { code: 'UND', name: 'Unidad' },
  { code: 'PAR', name: 'Par' },
  { code: 'M', name: 'Metro lineal' },
  { code: 'M2', name: 'Metro cuadrado' },
  { code: 'M3', name: 'Metro cúbico' },
  { code: 'KG', name: 'Kilogramo' },
  { code: 'L', name: 'Litro' },
  { code: 'GL', name: 'Galón' },
  { code: 'ROL', name: 'Rollo' },
  { code: 'SAC', name: 'Saco' },
  { code: 'BOL', name: 'Bolsa' },
  { code: 'CAJ', name: 'Caja' },
  { code: 'TUB', name: 'Tubo' },
  { code: 'HR', name: 'Hora' },
  { code: 'DIA', name: 'Día' },
];

export const UNIDAD_CUSTOM_VALUE = '__custom__';

export function normalizarCodigoUnidad(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 32) || 'UND';
}

export function fusionarUnidadesMedida(
  ...listas: (UnidadMedidaOpcion[] | undefined)[]
): UnidadMedidaOpcion[] {
  const map = new Map<string, UnidadMedidaOpcion>();
  for (const lista of listas) {
    for (const u of lista ?? []) {
      const code = normalizarCodigoUnidad(u.code);
      if (!map.has(code)) map.set(code, { code, name: u.name.trim() || code });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, 'es'));
}

export function codigoUnidadEnCatalogo(value: string, catalogo: UnidadMedidaOpcion[]): boolean {
  const code = normalizarCodigoUnidad(value);
  return catalogo.some((u) => u.code === code);
}
