import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';

/** Mapeo canónico Lulo → campos de ci_presupuesto_partidas. */
export const defaultMapping = {
  codigo: 'CodPar',
  descripcion: 'DesPar',
  unidad: 'UniPar',
  cantidad: 'CanPar',
  precio: 'PrePar',
  monto: 'MonPar',
} as const;

export type LuloPartidaFieldMapping = {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio: string;
  monto?: string;
  tableName?: string;
};

/** Overrides opcionales enviados por el cliente (`customMapping`). */
export type LuloCustomPartidaMapping = Partial<
  Omit<LuloPartidaFieldMapping, 'tableName'>
> & {
  tableName?: string;
};

/** @deprecated Usar `LuloPartidaFieldMapping` / `customMapping`. */
export type LuloPartidaColumnMapping = LuloPartidaFieldMapping & {
  precio_unitario?: string;
  monto_total?: string;
};

export function resolvePartidaMapping(
  customMapping?: LuloCustomPartidaMapping | LuloPartidaColumnMapping | null,
): LuloPartidaFieldMapping {
  if (!customMapping) {
    return { ...defaultMapping };
  }
  return mappingFromCustom(customMapping);
}

/**
 * Llaves del primer registro de la tabla Access (objeto fila de mdb-reader).
 * Si la fila no trae keys, usa los nombres de columna del esquema.
 */
export function detectedColumnsFromFirstRecord(
  columnNames: string[],
  firstRow?: Record<string, unknown>,
): string[] {
  if (firstRow && typeof firstRow === 'object') {
    const fromRow = Object.keys(firstRow).filter((k) => !k.startsWith('MSys'));
    if (fromRow.length > 0) return fromRow;
  }
  return columnNames.length > 0 ? [...columnNames] : [];
}

/** ¿El archivo incluye todas las columnas referenciadas por el mapeo resuelto? */
export function columnsContainPartidaMapping(
  detectedColumns: string[],
  mapping: LuloPartidaFieldMapping,
): boolean {
  const norm = new Set(detectedColumns.map(normalizeColumnKey));
  const required = [
    mapping.codigo,
    mapping.descripcion,
    mapping.unidad,
    mapping.cantidad,
    mapping.precio,
  ];
  return required.every((col) => norm.has(normalizeColumnKey(col)));
}

export function hasCustomMappingInput(
  customMapping?: LuloCustomPartidaMapping | LuloPartidaColumnMapping | null,
): boolean {
  return customMapping != null && Object.keys(customMapping).length > 0;
}

/** @deprecated Usar `columnsContainPartidaMapping`. */
export function matchStandardLuloPartidaColumns(columns: string[]) {
  return {
    hasStandard: columnsContainPartidaMapping(columns, { ...defaultMapping }),
    codigo: defaultMapping.codigo,
    descripcion: defaultMapping.descripcion,
    cantidad: defaultMapping.cantidad,
  };
}

/** @deprecated Usar `detectedColumnsFromFirstRecord`. */
export function detectedColumnsFromTable(
  columnNames: string[],
  firstRow?: Record<string, unknown>,
): string[] {
  return detectedColumnsFromFirstRecord(columnNames, firstRow);
}

export function isPartidaColumnMappingValid(
  mapping: LuloPartidaFieldMapping,
  detectedColumns: string[],
): boolean {
  return columnsContainPartidaMapping(detectedColumns, mapping);
}

function guessColumn(columns: string[], patterns: RegExp[]): string {
  for (const col of columns) {
    const n = normalizeColumnKey(col);
    if (patterns.some((p) => p.test(n))) return col;
  }
  return '';
}

/**
 * Infiere mapeo desde nombres de columna (sin exigir CodPar/DesPar de Lulo).
 */
export function inferPartidaMappingFromColumns(columns: string[]): LuloPartidaFieldMapping {
  const codigo =
    guessColumn(columns, [
      /^codpar$/,
      /^cod_par$/,
      /^cod$/,
      /codigo/,
      /^part$/,
      /partida/,
      /rubro/,
      /capitulo/,
      /item/,
      /numero/,
      /^num$/,
      /wbs/,
      /clave/,
    ]) || columns[0] || '';
  const descripcion =
    guessColumn(columns, [
      /^despar$/,
      /^des_par$/,
      /descrip/,
      /concepto/,
      /detalle/,
      /nombre/,
      /actividad/,
      /obra/,
      /titulo/,
      /glosa/,
      /texto/,
    ]) ||
    columns.find((c) => c !== codigo) ||
    columns[1] ||
    '';
  const unidad = guessColumn(columns, [/^unipar$/, /^uni_par$/, /unidad/, /^und$/, /medida/]);
  const cantidad = guessColumn(columns, [
    /^canpar$/,
    /^can_par$/,
    /cantidad/,
    /^cant$/,
    /qty/,
    /volumen/,
    /metraje/,
  ]);
  const precio = guessColumn(columns, [
    /^prepar$/,
    /^pre_par$/,
    /precio/,
    /unitario/,
    /^pu$/,
    /costo_unit/,
  ]);
  const monto = guessColumn(columns, [
    /^monpar$/,
    /^mon_par$/,
    /^totpar$/,
    /^tot_par$/,
    /^imppar$/,
    /monto/,
    /^total$/,
    /importe/,
    /parcial/,
    /^pt$/,
    /costo_total/,
    /valor/,
  ]);

  return {
    codigo,
    descripcion,
    unidad,
    cantidad,
    precio,
    monto: monto || undefined,
  };
}

function mappingFromCustom(
  customMapping: LuloCustomPartidaMapping | LuloPartidaColumnMapping,
): LuloPartidaFieldMapping {
  const legacy = customMapping as LuloPartidaColumnMapping;
  return {
    codigo: customMapping.codigo ?? defaultMapping.codigo,
    descripcion: customMapping.descripcion ?? defaultMapping.descripcion,
    unidad: customMapping.unidad ?? defaultMapping.unidad,
    cantidad: customMapping.cantidad ?? defaultMapping.cantidad,
    precio:
      customMapping.precio ??
      legacy.precio_unitario ??
      defaultMapping.precio,
    monto: customMapping.monto ?? legacy.monto_total ?? defaultMapping.monto,
    tableName: customMapping.tableName,
  };
}

/** Mapeo efectivo: custom → estándar Lulo → inferido por columnas. */
export function resolvePartidaMappingForColumns(
  columns: string[],
  customMapping?: LuloCustomPartidaMapping | LuloPartidaColumnMapping | null,
): LuloPartidaFieldMapping {
  if (hasCustomMappingInput(customMapping)) {
    return mappingFromCustom(customMapping!);
  }
  const std = { ...defaultMapping };
  if (columnsContainPartidaMapping(columns, std)) {
    return std;
  }
  return inferPartidaMappingFromColumns(columns);
}
