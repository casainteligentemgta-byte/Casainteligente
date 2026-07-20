/**
 * CSV maestro exportado por el programa CCO del suegro (Antigravity / V4)
 * → payload para importarMaestroV4 (misma ruta que el JSON ETL).
 *
 * Columnas típicas OneDrive:
 *   ID?, CLASE, FECHA, PROVEEDOR, TIPO, CAPITULO, SUBCAPITULO, DESCRIPCION,
 *   MONEDA, TASA, MONTO (BS), MONTO BASE (USD), MONTO PAGADO, HONORARIOS,
 *   COSTE TOTAL, PORCENTAJE ADMIN, FORMA PAGO, ESTADO, TASA BINANCE,
 *   TASA USADA, PORCENTAJE BRECHA REAL, LINK FACTURA, …
 */

import type {
  CcoV4EstructuraRow,
  CcoV4ImportPayload,
  CcoV4TransaccionRow,
} from '@/lib/contabilidad/cco/importarMaestroV4';

export type CcoCsvMaestroParseResult = CcoV4ImportPayload & {
  resumen: {
    total: number;
    porClase: Record<string, number>;
    conIdExplicit: number;
    estructura: number;
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
    if (a.length < 5) continue;
    for (let i = 0; i < norms.length; i++) {
      const h = norms[i]!;
      if (exclude?.(h)) continue;
      if (h === a) return i;
      if (h.includes(a)) return i;
    }
  }
  return -1;
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return (row[idx] ?? '').trim();
}

function parseNumCell(raw: string): number {
  let s = raw.replace(/\s/g, '').replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && s.includes('.')) {
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

function normalizarFechaCsv(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
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
    const day = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return null;
}

function indiceFilaEncabezados(lines: string[]): { idx: number; sep: string } {
  const markers = [
    'clase',
    'proveedor',
    'descripcion',
    'moneda',
    'fecha',
    'monto_base_usd',
    'monto_bs',
    'capitulo',
  ];
  let bestIdx = 0;
  let bestScore = -1;
  let bestSep = ',';

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
    if (norms.some((h) => h.includes('maestro'))) score -= 3;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestSep = sep;
    }
  }

  if (bestScore < 2) {
    return { idx: 0, sep: detectSep(lines[0]!) };
  }
  return { idx: bestIdx, sep: bestSep };
}

/** Hash estable positivo (FNV-1a 32-bit) para filas sin columna ID. */
function stableOrigenId(parts: string[]): number {
  let h = 2166136261;
  const s = parts.join('\u001f');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = h >>> 0;
  return n === 0 ? 1 : n;
}

function normalizarClase(raw: string): string {
  const c = raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!c) return '';
  if (c.startsWith('GAST')) return 'GASTO';
  if (c.startsWith('INGR') || c === 'INGRESO' || c === 'APORTE' || c === 'INYECCION') {
    return 'INGRESO';
  }
  if (c.startsWith('CONT')) return 'CONTRATO';
  if (c.startsWith('PRES')) return 'PRESUPUESTO';
  if (c.startsWith('AUD')) return 'AUDITORIA';
  return c;
}

/**
 * Detecta el CSV maestro del programa CCO (OneDrive): requiere columna CLASE
 * y montos / proveedor típicos del export.
 */
export function esCsvMaestroCco(text: string): boolean {
  try {
    const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return false;
    const { idx, sep } = indiceFilaEncabezados(lines);
    const norms = splitCsvLine(lines[idx]!, sep).map(normHeader);
    const hasClase = norms.some((h) => h === 'clase' || h === 'tipo_clase' || h === 'class');
    if (!hasClase) return false;
    const hasProv = norms.includes('proveedor');
    const hasMonto = norms.some(
      (h) =>
        h === 'monto_base_usd' ||
        h.includes('monto_base') ||
        h === 'monto_bs' ||
        h === 'monto_pagado' ||
        h === 'coste_total' ||
        h === 'costo_total',
    );
    return hasProv || hasMonto;
  } catch {
    return false;
  }
}

/**
 * Parsea el CSV OneDrive del programa del suegro a payload CCO V4.
 */
export function parseCsvMaestroV4(
  text: string,
  opts?: {
    proyecto_id?: string;
    honorarios_admin_pct?: number;
    obra_alias?: string | null;
  },
): CcoCsvMaestroParseResult {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('El CSV no tiene filas de datos. Descargue el maestro desde OneDrive.');
  }

  const { idx: headerIdx, sep } = indiceFilaEncabezados(lines);
  const headers = splitCsvLine(lines[headerIdx]!, sep);

  const iClase = pickCol(headers, ['clase', 'tipo_clase', 'class'], { allowFuzzy: false });
  if (iClase < 0) {
    throw new Error(
      'No se encontró la columna CLASE. Este importador es para el CSV maestro del programa CCO (OneDrive).',
    );
  }

  const iId = pickCol(
    headers,
    ['id', 'origen_v4_id', 'id_v4', 'txid', 'correlativo'],
    { allowFuzzy: false, excludeNorm: esHeaderLinkOSoporte },
  );
  const iFecha = pickCol(headers, ['fecha', 'date', 'fecha_factura', 'fecha_emision']);
  const iProveedor = pickCol(
    headers,
    ['proveedor', 'supplier_name', 'razon_social', 'beneficiario', 'nombre_proveedor'],
    { allowFuzzy: false },
  );
  const iTipo = pickCol(headers, ['tipo', 'tipo_gasto', 'rubro'], { allowFuzzy: false });
  const iCapitulo = pickCol(headers, ['capitulo', 'capítulo'], { allowFuzzy: false });
  const iSubcapitulo = pickCol(headers, ['subcapitulo', 'subcapítulo', 'sub_capitulo'], {
    allowFuzzy: false,
  });
  const iDesc = pickCol(headers, [
    'descripcion',
    'description',
    'concepto',
    'detalle',
    'observacion',
    'observaciones',
  ]);
  const iMoneda = pickCol(headers, ['moneda', 'currency', 'divisa'], { allowFuzzy: false });
  const iTasa = pickCol(headers, ['tasa', 'tasa_bcv', 'tc'], { allowFuzzy: false });
  const iMontoBs = pickCol(
    headers,
    ['monto_bs', 'monto_ves', 'monto_bolivares', 'monto_orig', 'monto_original'],
    { allowFuzzy: true },
  );
  const iMontoUsd = pickCol(
    headers,
    ['monto_base_usd', 'monto_base', 'monto_usd', 'base_usd'],
    { allowFuzzy: true },
  );
  const iMontoPagado = pickCol(headers, ['monto_pagado', 'pagado', 'abonado'], {
    allowFuzzy: false,
  });
  const iHonorarios = pickCol(headers, ['honorarios', 'honorario'], { allowFuzzy: false });
  const iCosteTotal = pickCol(headers, ['coste_total', 'costo_total', 'total_usd', 'total'], {
    allowFuzzy: false,
  });
  const iPctAdmin = pickCol(
    headers,
    [
      'porcentaje_admin',
      'pct_admin',
      'admin_pct',
      'admiv',
      'porc_admin',
      'porcentaje_administracion',
      'honorarios_pct',
    ],
    { allowFuzzy: true },
  );
  const iFormaPago = pickCol(headers, ['forma_pago', 'metodo_pago', 'pago'], {
    allowFuzzy: false,
  });
  const iEstado = pickCol(headers, ['estado', 'status', 'situacion'], { allowFuzzy: false });
  const iTasaBinance = pickCol(headers, ['tasa_binance', 'binance'], { allowFuzzy: true });
  const iTasaUsada = pickCol(headers, ['tasa_usada', 'tipo_tasa'], { allowFuzzy: false });
  const iBrecha = pickCol(
    headers,
    [
      'porcentaje_brecha_real',
      'brecha_real',
      'brecha',
      'devaluacion',
      'porcentaje_brecha',
      'pct_brecha',
    ],
    { allowFuzzy: true },
  );
  const iContratoVinc = pickCol(
    headers,
    ['contrato_vinculado', 'contrato', 'ref_contrato'],
    { allowFuzzy: false },
  );

  const transacciones: CcoV4TransaccionRow[] = [];
  const usedIds = new Set<number>();
  let conIdExplicit = 0;
  const porClase: Record<string, number> = {};
  const brechas: number[] = [];

  const capByKey = new Map<string, { id: number; nombre: string }>();
  const subByKey = new Map<string, { id: number; nombre: string; padreKey: string }>();

  const ensureCapitulo = (nombre: string): number | null => {
    const n = nombre.trim();
    if (!n) return null;
    const key = n.toUpperCase();
    const existing = capByKey.get(key);
    if (existing) return existing.id;
    // ID estable por nombre (no depende del orden de aparición en el CSV).
    const id = stableOrigenId(['CAP', key]);
    capByKey.set(key, { id, nombre: n });
    return id;
  };

  const ensureSubcapitulo = (nombre: string, padreNombre: string): number | null => {
    const n = nombre.trim();
    const p = padreNombre.trim();
    if (!n || !p) return null;
    const padreKey = p.toUpperCase();
    const key = `${padreKey}\u001f${n.toUpperCase()}`;
    const existing = subByKey.get(key);
    if (existing) return existing.id;
    ensureCapitulo(p);
    const id = stableOrigenId(['SUB', padreKey, n.toUpperCase()]);
    subByKey.set(key, { id, nombre: n, padreKey });
    return id;
  };

  for (let r = headerIdx + 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]!, sep);
    if (cols.every((c) => !c.trim())) continue;

    const clase = normalizarClase(cell(cols, iClase));
    if (!clase) continue;

    const proveedor = cell(cols, iProveedor);
    const tipo = cell(cols, iTipo);
    const capitulo = cell(cols, iCapitulo);
    const subcapitulo = cell(cols, iSubcapitulo);
    const descripcion = cell(cols, iDesc);
    const fecha = normalizarFechaCsv(cell(cols, iFecha));

    const monedaRaw = cell(cols, iMoneda).toUpperCase();
    const moneda =
      monedaRaw.includes('USD') || monedaRaw === '$' || monedaRaw.includes('DOL')
        ? 'USD'
        : monedaRaw.includes('VES') ||
            monedaRaw.includes('BS') ||
            monedaRaw.includes('BOL')
          ? 'VES'
          : monedaRaw || 'USD';

    const tasa = parseNumCell(cell(cols, iTasa));
    const montoBs = parseNumCell(cell(cols, iMontoBs));
    const montoUsd = parseNumCell(cell(cols, iMontoUsd));
    const montoPagado = parseNumCell(cell(cols, iMontoPagado));
    const honorarios = parseNumCell(cell(cols, iHonorarios));
    const costeTotal = parseNumCell(cell(cols, iCosteTotal));
    const pctAdmin = parseNumCell(cell(cols, iPctAdmin));
    const tasaBinance = parseNumCell(cell(cols, iTasaBinance));
    const brechaRaw = cell(cols, iBrecha);
    const brecha = brechaRaw ? parseNumCell(brechaRaw) : null;

    // Filas vacías de data
    if (
      !proveedor &&
      !descripcion &&
      !(montoUsd > 0) &&
      !(montoBs > 0) &&
      !(costeTotal > 0) &&
      !(montoPagado > 0) &&
      clase !== 'AUDITORIA'
    ) {
      continue;
    }

    let origen: number | null = null;
    if (iId >= 0) {
      const idRaw = cell(cols, iId);
      const idNum = parseNumCell(idRaw);
      if (idNum > 0 && Number.isInteger(idNum)) {
        origen = idNum;
        conIdExplicit += 1;
      }
    }
    if (origen == null) {
      // Sin columna ID: hash de negocio (sin índice de fila) para reimports estables
      // aunque se inserten/borren otras filas en el CSV.
      origen = stableOrigenId([
        clase,
        fecha ?? '',
        proveedor,
        tipo,
        capitulo,
        subcapitulo,
        descripcion,
        String(montoUsd || montoBs || costeTotal),
        moneda,
      ]);
    }
    // Evitar colisión rara de hash en el mismo lote
    while (usedIds.has(origen)) origen = (origen % 2000000000) + 1;
    usedIds.add(origen);

    if (capitulo) ensureCapitulo(capitulo);
    if (capitulo && subcapitulo) ensureSubcapitulo(subcapitulo, capitulo);

    if (brecha != null && Number.isFinite(brecha) && brecha !== 0) {
      brechas.push(brecha);
    }

    const montoBaseUsd =
      montoUsd > 0
        ? montoUsd
        : moneda === 'USD' && montoPagado > 0
          ? montoPagado
          : moneda === 'VES' && tasa > 0 && montoBs > 0
            ? Math.round((montoBs / tasa) * 10000) / 10000
            : costeTotal > 0 && honorarios > 0
              ? Math.max(0, costeTotal - honorarios)
              : costeTotal > 0
                ? costeTotal
                : 0;

    const montoOrig =
      moneda === 'VES'
        ? montoBs > 0
          ? montoBs
          : montoBaseUsd
        : montoBaseUsd > 0
          ? montoBaseUsd
          : montoBs;

    transacciones.push({
      origen_v4_id: origen,
      clase,
      fecha,
      proveedor: proveedor || null,
      tipo: tipo || null,
      capitulo: capitulo || null,
      subcapitulo: subcapitulo || null,
      descripcion: descripcion || null,
      moneda,
      tasa: tasa > 0 ? tasa : null,
      monto_orig: montoOrig > 0 ? montoOrig : null,
      monto_base_usd: montoBaseUsd > 0 ? montoBaseUsd : null,
      monto_pagado: montoPagado > 0 ? montoPagado : null,
      forma_pago: cell(cols, iFormaPago) || null,
      estado: cell(cols, iEstado) || null,
      honorarios: honorarios > 0 ? honorarios : null,
      costo_total: costeTotal > 0 ? costeTotal : null,
      porcentaje_admin: pctAdmin > 0 ? pctAdmin : null,
      tasa_binance: tasaBinance > 0 ? tasaBinance : null,
      tasa_usada: cell(cols, iTasaUsada) || null,
      porcentaje_brecha_real: brecha,
      contrato_vinculado: cell(cols, iContratoVinc) || null,
    });

    porClase[clase] = (porClase[clase] ?? 0) + 1;
  }

  if (transacciones.length === 0) {
    throw new Error('No se encontraron filas válidas con CLASE en el CSV maestro.');
  }

  const estructura: CcoV4EstructuraRow[] = [];
  for (const cap of Array.from(capByKey.values())) {
    estructura.push({
      origen_v4_id: cap.id,
      nombre: cap.nombre,
      tipo_nivel: 'CAPITULO',
      padre_origen_v4_id: null,
    });
  }
  for (const sub of Array.from(subByKey.values())) {
    const padreId = capByKey.get(sub.padreKey)?.id ?? null;
    estructura.push({
      origen_v4_id: sub.id,
      nombre: sub.nombre,
      tipo_nivel: 'SUBCAPITULO',
      padre_origen_v4_id: padreId,
    });
  }

  const devaluacionPromedio =
    brechas.length > 0
      ? Math.round((brechas.reduce((a, b) => a + b, 0) / brechas.length) * 100000) / 100000
      : 0;

  return {
    proyecto_id: opts?.proyecto_id ?? '',
    honorarios_admin_pct: opts?.honorarios_admin_pct ?? 15,
    devaluacion_pct: devaluacionPromedio,
    obra_alias: opts?.obra_alias ?? 'CSV OneDrive / CCO V4',
    auto_vincular: true,
    estructura,
    transacciones,
    resumen: {
      total: transacciones.length,
      porClase,
      conIdExplicit,
      estructura: estructura.length,
    },
  };
}
