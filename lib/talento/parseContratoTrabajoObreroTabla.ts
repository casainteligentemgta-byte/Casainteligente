/**
 * Parsea Excel (.xlsx/.xls) o CSV con filas de obreros para generar
 * contratos de trabajo en serie (antes «contrato express»).
 *
 * Formato de plantilla alineado a la tabla de nómina de obra:
 * N° Excel | Nombre (Manuscrito) | Nombre Completo (Excel) | C.I. | Categoría | Tipo | Cargo | Cánon Semanal ($) | Cuenta Bancaria
 */

import * as XLSX from 'xlsx';
import { CEDULA_VE_NORMALIZADA_REGEX, normCedulaToken } from '@/lib/talento/cedulaAuth';

/** Columnas canónicas reconocidas (aliases en español / inglés). */
export const COLUMNAS_CONTRATO_TRABAJO_OBRERO = {
  cedula: [
    'cedula',
    'cédula',
    'ci',
    'c_i',
    'c_i_',
    'documento',
    'doc',
    'rif_obrero',
  ],
  nombres: ['nombres', 'primer_nombre', 'name'],
  apellidos: ['apellidos', 'apellido', 'surname'],
  nombre_completo: [
    'nombre_completo',
    'nombre completo',
    'nombre_completo_excel',
    'nombre_completo__excel_',
    'obrero',
    'trabajador',
    'full_name',
  ],
  /** Nombre corto manuscrito (informativo; si no hay completo se usa como nombre). */
  nombre_manuscrito: [
    'nombre_manuscrito',
    'nombre__manuscrito_',
    'nombre',
    'nombre_corto',
  ],
  direccion: ['direccion', 'dirección', 'domicilio', 'direccion_domicilio', 'address'],
  municipio: ['municipio', 'municipio_residencia', 'obrero_municipio'],
  estado_residencia: ['estado_residencia', 'edo', 'obrero_estado'],
  nacionalidad: ['nacionalidad'],
  estado_civil: ['estado_civil', 'edo_civil', 'civil'],
  fecha_ingreso: ['fecha_ingreso', 'fecha ingreso', 'ingreso', 'fecha', 'fecha_firma'],
  jornada: ['jornada', 'jornada_trabajo', 'turno'],
  horario: ['horario', 'horario_semanal', 'horario_semanal_texto'],
  bono_usd: ['bono', 'bono_usd', 'bono_manual_usd', 'bono usd'],
  /** Cánon semanal de la tabla de nómina (referencia; el PDF usa tabulador por cargo). */
  canon_semanal_usd: [
    'canon_semanal',
    'canon_semanal_usd',
    'canon_semanal___',
    'canón_semanal',
    'canon',
  ],
  cargo: ['cargo', 'oficio', 'cargo_nombre', 'tabulador', 'puesto'],
  categoria: ['categoria', 'categoría', 'category'],
  tipo: ['tipo', 'tipo_obrero', 'clasificacion', 'clasificación'],
  cuenta_bancaria: ['cuenta_bancaria', 'cuenta', 'banco', 'n_cuenta'],
  n_excel: ['n_excel', 'n__excel', 'n', 'numero', 'n_'],
  config_nomina_id: ['config_nomina_id', 'nomina_id', 'tabulador_id'],
  proyecto_id: ['proyecto_id', 'obra_id', 'project_id'],
  proyecto_nombre: ['proyecto', 'obra', 'proyecto_nombre', 'nombre_obra'],
  objeto_contrato: ['objeto', 'objeto_contrato'],
} as const;

export type ColumnaContratoTrabajo = keyof typeof COLUMNAS_CONTRATO_TRABAJO_OBRERO;

export type FilaContratoTrabajoObrero = {
  filaExcel: number;
  cedula: string;
  nombres: string | null;
  apellidos: string | null;
  nombreCompleto: string | null;
  direccion: string | null;
  municipio: string | null;
  estadoResidencia: string | null;
  nacionalidad: string | null;
  estadoCivil: string | null;
  fechaIngreso: string | null;
  jornada: string | null;
  horario: string | null;
  bonoUsd: number;
  canonSemanalUsd: number | null;
  cargo: string | null;
  categoria: string | null;
  tipo: string | null;
  cuentaBancaria: string | null;
  configNominaId: string | null;
  proyectoId: string | null;
  proyectoNombre: string | null;
  objetoContrato: string | null;
  /** Errores de fila (sin defaults de obra/cargo aún). */
  errores: string[];
};

export type ParseContratoTrabajoResult = {
  filas: FilaContratoTrabajoObrero[];
  encabezados: string[];
  mapeo: Partial<Record<ColumnaContratoTrabajo, string>>;
  avisos: string[];
};

function normHeader(h: string): string {
  return String(h ?? '')
    .replace(/\uFEFF/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_');
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Excel serial date (~días desde 1899-12-30)
    if (v > 20_000 && v < 80_000) {
      const epoch = Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000;
      const dt = new Date(epoch);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // Cédulas pegadas como número (p. ej. 10199713)
    if (Number.isInteger(v) && v >= 1_000_000 && v <= 99_999_999) {
      return String(Math.trunc(v));
    }
    return String(v);
  }
  return String(v).trim();
}

function formatCedulaDisplay(raw: string): string {
  const t = normCedulaToken(raw);
  const m = t.match(/^([VE])(\d{6,9})$/);
  if (m) return `${m[1]}-${m[2]}`;
  // Solo dígitos → asumir V (tabla de obra suele traer 10.199.713)
  const digits = t.replace(/\D/g, '');
  if (/^\d{6,9}$/.test(digits)) return `V-${digits}`;
  return t;
}

function normalizeCedulaForApi(raw: string): string {
  const display = formatCedulaDisplay(raw);
  return normCedulaToken(display);
}

function parseFechaIso(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1]!.padStart(2, '0');
    const mo = m[2]!.padStart(2, '0');
    let y = m[3]!;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  return s.length >= 8 ? s.slice(0, 10) : null;
}

function parseJornada(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (/diurn/.test(t)) return 'DIURNA';
  if (/nocturn/.test(t)) return 'NOCTURNA';
  if (/mixt/.test(t)) return 'MIXTA';
  return raw.trim().toUpperCase();
}

function parseMoneyUsd(raw: string): number | null {
  const s = raw.replace(/[$\s]/g, '').replace(',', '.').trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function mapHeaders(headers: string[]): {
  mapeo: Partial<Record<ColumnaContratoTrabajo, string>>;
  avisos: string[];
} {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    const n = normHeader(h);
    if (n && !byNorm.has(n)) byNorm.set(n, h);
  }

  const mapeo: Partial<Record<ColumnaContratoTrabajo, string>> = {};
  const avisos: string[] = [];

  for (const [campo, aliases] of Object.entries(COLUMNAS_CONTRATO_TRABAJO_OBRERO) as Array<
    [ColumnaContratoTrabajo, readonly string[]]
  >) {
    for (const alias of aliases) {
      const hit = byNorm.get(normHeader(alias));
      if (hit) {
        mapeo[campo] = hit;
        break;
      }
    }
  }

  // Encabezados típicos de la tabla de nómina (normHeader exacto).
  if (!mapeo.cedula) {
    for (const [norm, original] of byNorm) {
      if (norm === 'c_i' || norm === 'c_i_' || /^c_?i_?$/.test(norm)) {
        mapeo.cedula = original;
        break;
      }
    }
  }
  if (!mapeo.nombre_completo) {
    for (const [norm, original] of byNorm) {
      if (norm.includes('nombre_completo') || (norm.includes('nombre') && norm.includes('excel'))) {
        mapeo.nombre_completo = original;
        break;
      }
    }
  }
  if (!mapeo.canon_semanal_usd) {
    for (const [norm, original] of byNorm) {
      if (norm.includes('canon')) {
        mapeo.canon_semanal_usd = original;
        break;
      }
    }
  }

  if (!mapeo.cedula) {
    avisos.push('No se detectó columna de cédula (C.I.).');
  }
  if (!mapeo.nombres && !mapeo.nombre_completo && !mapeo.nombre_manuscrito) {
    avisos.push('No se detectó columna de nombre completo.');
  }

  return { mapeo, avisos };
}

function getCell(
  row: Record<string, unknown>,
  mapeo: Partial<Record<ColumnaContratoTrabajo, string>>,
  campo: ColumnaContratoTrabajo,
): string {
  const key = mapeo[campo];
  if (!key) return '';
  return cellStr(row[key]);
}

/**
 * Lee un ArrayBuffer (xlsx/xls/csv) y devuelve filas tipadas para contratos en serie.
 */
export function parseContratoTrabajoObreroTabla(buffer: ArrayBuffer, filename?: string): ParseContratoTrabajoResult {
  const name = (filename ?? '').toLowerCase();
  const wb = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    codepage: name.endsWith('.csv') ? 65001 : undefined,
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { filas: [], encabezados: [], mapeo: {}, avisos: ['El archivo no tiene hojas.'] };
  }
  const sheet = wb.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  });

  if (rows.length === 0) {
    return {
      filas: [],
      encabezados: [],
      mapeo: {},
      avisos: ['No hay filas de datos en la primera hoja.'],
    };
  }

  const encabezados = Object.keys(rows[0] ?? {});
  const { mapeo, avisos } = mapHeaders(encabezados);

  const filas: FilaContratoTrabajoObrero[] = [];
  rows.forEach((row, idx) => {
    const filaExcel = idx + 2; // 1 = encabezado
    const cedulaRaw = getCell(row, mapeo, 'cedula');
    const nombres = getCell(row, mapeo, 'nombres') || null;
    const apellidos = getCell(row, mapeo, 'apellidos') || null;
    const manuscrito = getCell(row, mapeo, 'nombre_manuscrito') || null;
    let nombreCompleto = getCell(row, mapeo, 'nombre_completo') || null;
    if (nombreCompleto && /^no\s*registrado$/i.test(nombreCompleto.trim())) {
      // Fila de la tabla sin alta en Excel de nómina → omitir
      return;
    }
    if (!nombreCompleto && nombres && apellidos) {
      nombreCompleto = `${nombres} ${apellidos}`.trim();
    }
    if (!nombreCompleto && manuscrito) {
      nombreCompleto = manuscrito.trim();
    }

    const errores: string[] = [];
    let cedula = '';
    if (!cedulaRaw) {
      errores.push('Falta cédula (C.I.)');
    } else {
      cedula = normalizeCedulaForApi(cedulaRaw);
      if (!CEDULA_VE_NORMALIZADA_REGEX.test(cedula)) {
        errores.push(`Cédula inválida (${cedulaRaw})`);
      }
    }

    const tieneNombre =
      (Boolean(nombres?.trim()) && Boolean(apellidos?.trim())) ||
      Boolean(nombreCompleto && nombreCompleto.trim().length >= 2);
    if (!tieneNombre) {
      errores.push('Falta nombre completo');
    }

    const cargo = getCell(row, mapeo, 'cargo') || null;
    const categoria = getCell(row, mapeo, 'categoria') || null;
    const tipo = getCell(row, mapeo, 'tipo') || null;

    // Fila totalmente vacía → omitir
    const vacia =
      !cedulaRaw &&
      !nombres &&
      !apellidos &&
      !nombreCompleto &&
      !manuscrito &&
      !cargo;
    if (vacia) return;

    const canon = parseMoneyUsd(getCell(row, mapeo, 'canon_semanal_usd'));
    const bonoRaw = getCell(row, mapeo, 'bono_usd');
    const bonoParsed = bonoRaw ? parseMoneyUsd(bonoRaw) : null;
    const bonoUsd = bonoParsed != null && bonoParsed >= 0 ? bonoParsed : 0;

    filas.push({
      filaExcel,
      cedula,
      nombres: nombres?.trim() || null,
      apellidos: apellidos?.trim() || null,
      nombreCompleto: nombreCompleto?.trim() || null,
      direccion: getCell(row, mapeo, 'direccion') || null,
      municipio: getCell(row, mapeo, 'municipio') || null,
      estadoResidencia: getCell(row, mapeo, 'estado_residencia') || null,
      nacionalidad: getCell(row, mapeo, 'nacionalidad') || null,
      estadoCivil: getCell(row, mapeo, 'estado_civil') || null,
      fechaIngreso: parseFechaIso(getCell(row, mapeo, 'fecha_ingreso')),
      jornada: parseJornada(getCell(row, mapeo, 'jornada')),
      horario: getCell(row, mapeo, 'horario') || null,
      bonoUsd,
      canonSemanalUsd: canon,
      cargo: cargo?.trim() || null,
      categoria: categoria?.trim() || null,
      tipo: tipo?.trim() || null,
      cuentaBancaria: getCell(row, mapeo, 'cuenta_bancaria') || null,
      configNominaId: getCell(row, mapeo, 'config_nomina_id') || null,
      proyectoId: getCell(row, mapeo, 'proyecto_id') || null,
      proyectoNombre: getCell(row, mapeo, 'proyecto_nombre') || null,
      objetoContrato: getCell(row, mapeo, 'objeto_contrato') || null,
      errores,
    });
  });

  return { filas, encabezados, mapeo, avisos };
}

/**
 * Encabezados de la plantilla = misma tabla de nómina de obra
 * (sin domicilio / municipio / estado).
 */
export const PLANTILLA_ENCABEZADOS_CONTRATO_TRABAJO = [
  'N° Excel',
  'Nombre (Manuscrito)',
  'Nombre Completo (Excel)',
  'C.I.',
  'Categoría',
  'Tipo',
  'Cargo',
  'Cánon Semanal ($)',
  'Cuenta Bancaria',
] as const;

/** Genera un .xlsx de plantilla (ArrayBuffer) con filas de ejemplo. */
export function generarPlantillaContratoTrabajoXlsx(): ArrayBuffer {
  const ejemplo = [
    {
      'N° Excel': 26,
      'Nombre (Manuscrito)': 'Brigido Gonzalez',
      'Nombre Completo (Excel)': 'BRIGIDO ANTONIO GONZALEZ CALVO',
      'C.I.': '10.199.713',
      Categoría: 'OBRERO',
      Tipo: 'AYUDANTE',
      Cargo: 'AYUDANTE',
      'Cánon Semanal ($)': 70,
      'Cuenta Bancaria': '0102 0667 7900 0045 3819',
    },
    {
      'N° Excel': 19,
      'Nombre (Manuscrito)': 'Antony Diaz',
      'Nombre Completo (Excel)': 'ANTONY JOSE DIAZ DIAZ',
      'C.I.': '25.479.932',
      Categoría: 'OBRERO',
      Tipo: 'CLASIFICADO',
      Cargo: 'ELECTRICISTA',
      'Cánon Semanal ($)': 90,
      'Cuenta Bancaria': '0102 0671 5100 0016 2854',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(ejemplo, {
    header: [...PLANTILLA_ENCABEZADOS_CONTRATO_TRABAJO],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Obreros');
  return xlsxWriteToArrayBuffer(wb);
}

function xlsxWriteToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown;
  if (out instanceof ArrayBuffer) return out;
  if (typeof SharedArrayBuffer !== 'undefined' && out instanceof SharedArrayBuffer) {
    const u8 = new Uint8Array(out);
    const copy = new Uint8Array(u8.byteLength);
    copy.set(u8);
    return copy.buffer;
  }
  if (out instanceof Uint8Array) {
    const copy = new Uint8Array(out.byteLength);
    copy.set(out);
    return copy.buffer;
  }
  if (Array.isArray(out)) {
    const u8 = Uint8Array.from(out as number[]);
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  }
  throw new Error('No se pudo serializar el Excel');
}
