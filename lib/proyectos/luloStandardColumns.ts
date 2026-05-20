import { normalizeColumnKey } from '@/lib/proyectos/luloColumnInfer';

/** Mapeo canónico Lulo → campos de ci_presupuesto_partidas. */
export const defaultMapping = {
  codigo: 'CodPar',
  descripcion: 'DesPar',
  unidad: 'UniPar',
  cantidad: 'CanPar',
  precio: 'PrePar',
} as const;

export type LuloPartidaFieldMapping = {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  precio: string;
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
    tableName: customMapping.tableName,
  };
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
