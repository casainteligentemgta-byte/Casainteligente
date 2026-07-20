/**
 * Parseo de CSV/TSV exportado desde Excel (tabla de compras históricas / maestro).
 * No depende de Gemini.
 *
 * Formato maestro Rancho (ej. MAESTRO_MAESTRO_RANCHO…):
 * CLASE, FECHA, PROVEEDOR, TIPO, CAPITULO, SUBCAPITULO, DESCRIPCION,
 * MONEDA, TASA, MONTO (BS), MONTO BASE (USD), MONTO PAGADO, LINK FACTURA, …
 * — LINK FACTURA es ruta de soporte, no nº de factura.
 */

import { resolverProveedorYRif } from '@/lib/contabilidad/rifVenezolano';

export type FilaCsvCompra = {
  invoice_number: string;
  supplier_name: string;
  supplier_rif: string;
  date: string;
  descripcion: string;
  item_code: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  moneda: string;
  /** Solo filas CLASE=GASTO del maestro V4; omitido en CSV genérico. */
  cco?: {
    clase?: string;
    tipo_gasto_cco?: string | null;
    capitulo_cco?: string | null;
    subcapitulo_cco?: string | null;
    honorarios_usd?: number | null;
    admin_pct_override?: number | null;
    cco_estado?: string | null;
    monto_pagado_usd?: number | null;
    tasa?: number | null;
    porcentaje_brecha_real?: number | null;
  };
};

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectSep(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis >= commas) return ';';
  return ',';
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Columnas que nunca son nº de factura (rutas / soportes / links). */
function esHeaderLinkOSoporte(norm: string): boolean {
  return (
    norm.includes('link') ||
    norm.includes('soporte') ||
    norm.includes('archivo') ||
    norm.includes('path') ||
    norm.includes('ruta') ||
    norm.startsWith('url') ||
    norm.endsWith('_url') ||
    norm.includes('pdf') ||
    /^(foto|imagen|adjunto)/.test(norm)
  );
}

/**
 * Elige columna por aliases (exacto primero).
 * Fuzzy solo si el alias tiene ≥ 5 chars y el header no es link/soporte.
 */
function pickCol(
  headers: string[],
  aliases: string[],
  opts?: { allowFuzzy?: boolean; excludeNorm?: (n: string) => boolean },
): number {
  const norms = headers.map(normHeader);
  const allowFuzzy = opts?.allowFuzzy !== false;
  const exclude = opts?.excludeNorm;

  for (const a of aliases) {
    const i = norms.indexOf(a);
    if (i >= 0 && !exclude?.(norms[i]!)) return i;
  }

  if (!allowFuzzy) return -1;

  for (const a of aliases) {
    if (a.length < 5) continue; // evita 'nro','mon','cod','pu'
    for (let i = 0; i < norms.length; i++) {
      const h = norms[i]!;
      if (exclude?.(h)) continue;
      if (h === a) return i;
      // Solo header contiene alias (no al revés: 'factura' no debe casar todo)
      if (h.includes(a)) return i;
    }
  }
  return -1;
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return (row[idx] ?? '').trim();
}

/** Detecta rutas de archivo / PDF usadas por error como “factura”. */
export function pareceRutaONombreArchivo(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (/\.(pdf|png|jpe?g|webp|gif|heic)(\b|$)/i.test(s)) return true;
  if (/[/\\]/.test(s)) return true;
  if (/^soportes?/i.test(s)) return true;
  if (/^SOPORTES_/i.test(s)) return true;
  return false;
}

function parseNumCell(raw: string): number {
  let s = raw.replace(/\s/g, '').replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return 0;
  // 1.234.567,89 (miles con punto)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    // 1,234,567.89
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && s.includes('.')) {
    // 1234,56 o 1.234,56 ya cubierto; si ambos: último separador = decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizarFechaCsv(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1]!.padStart(2, '0');
    const mo = m[2]!.padStart(2, '0');
    let y = m[3]!;
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const epoch = Date.UTC(1899, 11, 30) + serial * 86400000;
    const dt = new Date(epoch);
    const y = dt.getUTCFullYear();
    const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return '';
}

function esFormatoMaestroRancho(norms: string[]): boolean {
  const hasProv = norms.includes('proveedor');
  const hasMoneda = norms.includes('moneda');
  const hasMontoUsd = norms.some(
    (h) => h === 'monto_base_usd' || h === 'monto_base' || h.includes('monto_base'),
  );
  const hasMontoBs = norms.some((h) => h === 'monto_bs' || h === 'monto_ves');
  const hasLink = norms.some((h) => esHeaderLinkOSoporte(h));
  return hasProv && (hasMontoUsd || hasMontoBs) && (hasMoneda || hasLink);
}

function resolverMontoMaestro(
  cols: string[],
  moneda: 'VES' | 'USD',
  iMontoUsd: number,
  iMontoBs: number,
  iMontoPagado: number,
  iCosteTotal: number,
  iHonorarios: number,
  iSubGeneric: number,
): number {
  const usd = parseNumCell(cell(cols, iMontoUsd));
  const bs = parseNumCell(cell(cols, iMontoBs));
  const pagado = parseNumCell(cell(cols, iMontoPagado));
  const coste = parseNumCell(cell(cols, iCosteTotal));
  const honor = parseNumCell(cell(cols, iHonorarios));
  const generic = parseNumCell(cell(cols, iSubGeneric));

  if (moneda === 'USD') {
    if (usd > 0) return usd;
    if (pagado > 0) return pagado;
    if (bs > 0) return bs;
  } else {
    if (bs > 0) return bs;
    if (pagado > 0) return pagado;
    if (usd > 0) return usd;
  }
  // No usar honorarios como monto base (rompe KPIs vs programa madre).
  if (coste > 0 && honor > 0 && coste > honor) return coste - honor;
  if (coste > 0) return coste;
  if (generic > 0) return generic;
  return 0;
}

/** Busca la fila real de encabezados (omite título tipo MAESTRO_…). */
function indiceFilaEncabezados(lines: string[], sepHint?: string): { idx: number; sep: string } {
  const markers = [
    'proveedor',
    'descripcion',
    'moneda',
    'factura',
    'fecha',
    'monto_base_usd',
    'monto_bs',
    'monto_pagado',
  ];
  let bestIdx = 0;
  let bestScore = -1;
  let bestSep = sepHint || ',';

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const sep = detectSep(lines[i]!);
    const norms = splitCsvLine(lines[i]!, sep).map(normHeader);
    if (norms.length < 3) continue;
    let score = 0;
    for (const m of markers) {
      if (norms.some((h) => h === m || h.startsWith(`${m}_`) || h.endsWith(`_${m}`))) {
        score += 2;
      } else if (norms.some((h) => h.includes(m) && m.length >= 5)) {
        score += 1;
      }
    }
    // Título tipo MAESTRO_… no debe ganar
    if (norms.some((h) => h.includes('maestro'))) score -= 3;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestSep = sep;
    }
  }

  if (bestScore < 2) {
    const sep = detectSep(lines[0]!);
    return { idx: 0, sep };
  }
  return { idx: bestIdx, sep: bestSep };
}

/**
 * Parsea texto CSV/TSV de Excel. Detecta fila de encabezados (no el título).
 */
export function parseCsvTablaCompras(text: string): FilaCsvCompra[] {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('El CSV no tiene filas de datos. Exporte desde Excel con encabezados.');
  }

  const { idx: headerIdx, sep } = indiceFilaEncabezados(lines);
  const headers = splitCsvLine(lines[headerIdx]!, sep);
  const norms = headers.map(normHeader);
  const maestro = esFormatoMaestroRancho(norms);

  const iFactura = pickCol(
    headers,
    [
      'invoice_number',
      'nro_factura',
      'numero_factura',
      'n_factura',
      'num_factura',
      'no_factura',
      'n_de_factura',
      'factura',
    ],
    { excludeNorm: esHeaderLinkOSoporte },
  );
  // Solo nombres claros de proveedor (sin fuzzy: evita TIPO/CAPITULO/DESCRIPCION).
  const iProveedor = pickCol(
    headers,
    ['supplier_name', 'proveedor', 'razon_social', 'nombre_proveedor', 'beneficiario'],
    { allowFuzzy: false },
  );
  const iRif = pickCol(
    headers,
    ['supplier_rif', 'rif', 'rif_proveedor', 'cedula_rif', 'ci_rif', 'cedula'],
    { allowFuzzy: false },
  );
  const iFecha = pickCol(headers, [
    'fecha',
    'date',
    'fecha_factura',
    'f_emision',
    'fecha_emision',
    'fechafactura',
  ]);
  const iDesc = pickCol(headers, [
    'descripcion',
    'description',
    'articulo',
    'concepto',
    'producto',
    'detalle',
    'material',
  ]);
  const iTipo = pickCol(headers, ['tipo'], { allowFuzzy: false });
  const iCapitulo = pickCol(headers, ['capitulo'], { allowFuzzy: false });
  const iSubcapitulo = pickCol(headers, ['subcapitulo'], { allowFuzzy: false });

  const iCodigo = pickCol(
    headers,
    ['item_code', 'codigo', 'sku', 'cod_prod', 'referencia'],
    { allowFuzzy: false },
  );
  const iUnidad = pickCol(headers, ['unidad', 'unit'], { allowFuzzy: false });
  const iCant = pickCol(headers, ['cantidad', 'quantity', 'qty'], { allowFuzzy: false });
  const iPrecio = pickCol(
    headers,
    ['precio_unitario', 'unit_price', 'precio', 'p_unitario', 'costo_unitario'],
    { allowFuzzy: false },
  );

  // Montos maestro (exactos / semiexactos)
  const iMontoUsd = pickCol(
    headers,
    ['monto_base_usd', 'monto_base', 'monto_usd', 'base_usd'],
    { allowFuzzy: true },
  );
  const iMontoBs = pickCol(
    headers,
    ['monto_bs', 'monto_ves', 'monto_bolivares'],
    { allowFuzzy: true },
  );
  const iMontoPagado = pickCol(headers, ['monto_pagado', 'pagado'], { allowFuzzy: false });
  const iCosteTotal = pickCol(headers, ['coste_total', 'costo_total'], { allowFuzzy: false });
  const iHonorarios = pickCol(headers, ['honorarios'], { allowFuzzy: false });

  // Subtotal genérico (no maestro): evitar casar "monto_bs" si ya hay columnas específicas
  const iSub = pickCol(
    headers,
    ['subtotal', 'total_linea', 'importe', 'monto_total', 'total'],
    {
      allowFuzzy: true,
      excludeNorm: (n) =>
        n.startsWith('monto_') ||
        n === 'monto_bs' ||
        n === 'monto_pagado' ||
        n.includes('tasa') ||
        n.includes('admiv'),
    },
  );

  const iMoneda = pickCol(headers, ['moneda', 'currency', 'divisa'], { allowFuzzy: false });
  const iClase = pickCol(headers, ['clase'], { allowFuzzy: false });
  const iEstado = pickCol(headers, ['estado'], { allowFuzzy: false });
  const iAdminPct = pickCol(
    headers,
    ['porcentaje_admin', 'admin_pct', 'pct_admin', 'admiv'],
    { allowFuzzy: true },
  );
  const iTasa = pickCol(headers, ['tasa'], { allowFuzzy: false });
  const iBrecha = pickCol(
    headers,
    ['porcentaje_brecha_real', 'brecha_real', 'brecha'],
    { allowFuzzy: true },
  );

  if (iProveedor < 0 && iDesc < 0 && iFactura < 0 && iMontoUsd < 0 && iMontoBs < 0) {
    throw new Error(
      'No se reconocieron columnas. Incluya al menos: Proveedor, Descripción o Montos (maestro Rancho).',
    );
  }

  const filas: FilaCsvCompra[] = [];
  let omitidasPorClase = 0;
  for (let r = headerIdx + 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]!, sep);
    if (cols.every((c) => !c.trim())) continue;

    // Maestro V4: solo importar GASTO (ingresos/contratos/presupuestos van por otros flujos).
    if (iClase >= 0) {
      const clase = cell(cols, iClase).trim().toUpperCase();
      if (clase && clase !== 'GASTO') {
        omitidasPorClase += 1;
        continue;
      }
    }

    const monedaRaw = cell(cols, iMoneda).toUpperCase();
    const moneda: 'VES' | 'USD' =
      monedaRaw.includes('USD') || monedaRaw === '$' || monedaRaw.includes('DOL')
        ? 'USD'
        : 'VES';

    let cantidad = parseNumCell(cell(cols, iCant)) || 1;
    let precio = parseNumCell(cell(cols, iPrecio));
    let subtotal = 0;

    if (maestro || iMontoUsd >= 0 || iMontoBs >= 0 || iMontoPagado >= 0) {
      subtotal = resolverMontoMaestro(
        cols,
        moneda,
        iMontoUsd,
        iMontoBs,
        iMontoPagado,
        iCosteTotal,
        iHonorarios,
        iSub,
      );
      // Una fila del maestro = un gasto: cantidad 1, precio = monto
      if (subtotal > 0) {
        cantidad = 1;
        precio = subtotal;
      }
    } else {
      subtotal = parseNumCell(cell(cols, iSub));
      if (!(subtotal > 0) && cantidad > 0 && precio >= 0) {
        subtotal = Math.round(cantidad * precio * 100) / 100;
      }
    }

    let invoice = cell(cols, iFactura);
    if (pareceRutaONombreArchivo(invoice)) invoice = '';

    const { supplier_name: proveedor, supplier_rif: rif } = resolverProveedorYRif({
      proveedor: cell(cols, iProveedor),
      rif: cell(cols, iRif),
    });

    const tipo = cell(cols, iTipo);
    const capitulo = cell(cols, iCapitulo);
    const subcap = cell(cols, iSubcapitulo);
    let descripcion = cell(cols, iDesc);
    if (!descripcion) {
      const partes = [tipo, capitulo, subcap].filter(Boolean);
      descripcion = partes.join(' · ');
    } else if (maestro && (tipo || capitulo)) {
      const pref = [tipo, capitulo].filter(Boolean).join(' · ');
      if (pref && tipo && !descripcion.toUpperCase().includes(tipo.toUpperCase())) {
        descripcion = `${pref}: ${descripcion}`;
      }
    }
    if (!descripcion) {
      descripcion = proveedor ? `Compra ${proveedor}` : invoice ? `Compra factura ${invoice}` : '';
    }

    // No usar TIPO/CAPITULO como si fueran el proveedor
    if (!descripcion && !(subtotal > 0) && !invoice && !proveedor) continue;

    const honorariosRaw = parseNumCell(cell(cols, iHonorarios));
    const adminPctRaw = parseNumCell(cell(cols, iAdminPct));
    const pagadoRaw = parseNumCell(cell(cols, iMontoPagado));
    const tasaRaw = parseNumCell(cell(cols, iTasa));
    const brechaRaw = parseNumCell(cell(cols, iBrecha));
    const estadoRaw = cell(cols, iEstado).trim();

    const cco =
      maestro || iClase >= 0 || iTipo >= 0 || iCapitulo >= 0 || iHonorarios >= 0
        ? {
            clase: iClase >= 0 ? cell(cols, iClase).trim().toUpperCase() || 'GASTO' : 'GASTO',
            tipo_gasto_cco: tipo || null,
            capitulo_cco: capitulo || null,
            subcapitulo_cco: subcap || null,
            honorarios_usd: iHonorarios >= 0 ? honorariosRaw : null,
            admin_pct_override: iAdminPct >= 0 && adminPctRaw > 0 ? adminPctRaw : null,
            cco_estado: estadoRaw || null,
            monto_pagado_usd: iMontoPagado >= 0 ? pagadoRaw : null,
            tasa: iTasa >= 0 && tasaRaw > 0 ? tasaRaw : null,
            porcentaje_brecha_real: iBrecha >= 0 ? brechaRaw : null,
          }
        : undefined;

    filas.push({
      invoice_number: invoice,
      supplier_name: proveedor,
      supplier_rif: rif,
      date: normalizarFechaCsv(cell(cols, iFecha)),
      descripcion: descripcion || 'Ítem',
      item_code: cell(cols, iCodigo),
      unidad: cell(cols, iUnidad) || 'UND',
      cantidad,
      precio_unitario: precio > 0 ? precio : subtotal > 0 ? subtotal / cantidad : 0,
      subtotal,
      moneda,
      cco,
    });
  }

  if (filas.length === 0) {
    const hint =
      omitidasPorClase > 0
        ? ` Se omitieron ${omitidasPorClase} fila(s) que no son CLASE=GASTO (ingresos/contratos/presupuestos).`
        : '';
    throw new Error(`No se encontraron filas válidas en el CSV.${hint}`);
  }
  return filas;
}

export function esArchivoCsvTabla(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith('.csv') ||
    n.endsWith('.tsv') ||
    n.endsWith('.txt') ||
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values' ||
    file.type === 'text/plain'
  );
}
