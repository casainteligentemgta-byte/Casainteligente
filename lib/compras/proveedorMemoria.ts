/**
 * Memoria de proveedor para el flujo de facturas (OCR → extraído → confirmar).
 * Puro: sin I/O. Normaliza RIF/ítems, agrega perfil, aplica correcciones y detecta anomalías.
 */

import { normalizarRifVenezolano } from '@/lib/contabilidad/rifVenezolano';
import { normalizarNombreEmpresa, normalizarRif } from '@/lib/contabilidad/propietarioFactura';
import {
  monedaExtractedConfirmada,
  normalizarMonedaExtracted,
  parseCondicionPagoExtracted,
  parseDiasCreditoExtracted,
  type AnomaliaFacturaCanal,
  type ExtractedCanalHeader,
  type ExtractedCanalItem,
  type SugerenciasDestinoProveedor,
} from '@/lib/contabilidad/extractedCanal';

export type { AnomaliaFacturaCanal };

export const UMBRAL_DESVIO_PRECIO = 0.4;
export const UMBRAL_SUMA_LINEAS = 0.02;
export const MAX_ITEMS_PERFIL = 40;
export const MAX_FACTURAS_AGREGAR = 80;

export type CampoSugeridoFactura =
  | 'moneda'
  | 'dias_credito'
  | 'condicion_pago'
  | 'supplier_name'
  | 'entidad_id'
  | 'proyecto_id'
  | 'ubicacion_destino_id'
  | 'imputacion'
  | 'clasificacion_gasto';

export type ItemPerfilProveedor = {
  nombre_norm: string;
  nombre_habitual: string;
  precio_mediana: number;
  n: number;
};

export type ProveedorPerfil = {
  rif_normalizado: string;
  rif_etiqueta: string;
  nombre_canonico: string | null;
  moneda_habitual: string | null;
  dias_credito_habitual: number | null;
  condicion_pago_habitual: string | null;
  entidad_id_habitual: string | null;
  proyecto_id_habitual: string | null;
  ubicacion_destino_id_habitual: string | null;
  imputacion_habitual: string | null;
  clasificacion_gasto_habitual: string | null;
  n_facturas: number;
  items: ItemPerfilProveedor[];
};

export type CorreccionProveedor = {
  campo: string;
  valor_original: string;
  valor_corregido: string;
  n_veces?: number;
};

export type FacturaConfirmadaParaPerfil = {
  supplier_rif?: string | null;
  supplier_name?: string | null;
  moneda?: string | null;
  dias_credito?: number | null;
  condicion_pago?: string | null;
  entidad_id?: string | null;
  proyecto_id?: string | null;
  ubicacion_destino_id?: string | null;
  imputacion?: string | null;
  clasificacion_gasto_entidad?: string | null;
  items?: Array<{ description?: string | null; unit_price?: number | null }>;
};

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Clave estable de RIF: formato canónico venezolano, o compacto si no parsea. */
export function claveRifPerfil(raw: string | null | undefined): string {
  return normalizarRifVenezolano(raw) || normalizarRif(raw);
}

export function variantesRifBusqueda(raw: string | null | undefined): string[] {
  const origen = String(raw ?? '').trim();
  const canon = normalizarRifVenezolano(raw);
  const compact = normalizarRif(raw);
  const out: string[] = [];
  for (const s of [origen, canon, compact]) {
    if (s.length >= 4 && out.indexOf(s) < 0) out.push(s);
  }
  return out;
}

/** Nombre de ítem comparable: minúsculas, sin acentos ni puntuación. */
export function normalizarNombreItem(raw: string | null | undefined): string {
  return sinAcentos(String(raw ?? ''))
    .toLowerCase()
    .replace(/[.,;:()[\]{}"']/g, ' ')
    .replace(/[\/_|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mediana(nums: number[]): number | null {
  const vals = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  if (vals.length % 2 === 1) return vals[mid]!;
  return (vals[mid - 1]! + vals[mid]!) / 2;
}

/** Más frecuente; en empate gana el primero (pasar más reciente primero). */
export function moda<T>(valores: T[]): T | null {
  if (!valores.length) return null;
  const counts = new Map<T, number>();
  let best: T = valores[0]!;
  let bestN = 0;
  for (const v of valores) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

function noVacio(s: string | null | undefined): s is string {
  return Boolean(s && s.trim());
}

export function agregarPerfilProveedor(
  facturas: FacturaConfirmadaParaPerfil[],
): ProveedorPerfil | null {
  const usable = facturas.filter((f) => claveRifPerfil(f.supplier_rif));
  if (!usable.length) return null;

  const rif = claveRifPerfil(usable[0]!.supplier_rif);
  const nombres = usable.map((f) => String(f.supplier_name ?? '').trim()).filter(noVacio);
  const monedas = usable
    .map((f) => {
      const m = String(f.moneda ?? '').trim().toUpperCase();
      if (m === 'USD') return 'USD';
      if (m === 'VES' || m === 'BS') return 'VES';
      return '';
    })
    .filter(noVacio);
  const dias = usable
    .map((f) => parseDiasCreditoExtracted(f.dias_credito))
    .filter((n): n is number => n != null);
  const condiciones = usable
    .map((f) => String(f.condicion_pago ?? '').trim().toLowerCase())
    .filter((c) => c === 'contado' || c === 'credito');
  const entidades = usable.map((f) => String(f.entidad_id ?? '').trim()).filter(noVacio);
  const proyectos = usable.map((f) => String(f.proyecto_id ?? '').trim()).filter(noVacio);
  const almacenes = usable.map((f) => String(f.ubicacion_destino_id ?? '').trim()).filter(noVacio);
  const imputaciones = usable.map((f) => String(f.imputacion ?? '').trim()).filter(noVacio);
  const clasifs = usable
    .map((f) => String(f.clasificacion_gasto_entidad ?? '').trim())
    .filter(noVacio);

  const porItem = new Map<string, { nombres: string[]; precios: number[] }>();
  for (const f of usable) {
    for (const it of f.items ?? []) {
      const nombre = String(it.description ?? '').trim();
      const norm = normalizarNombreItem(nombre);
      if (!norm) continue;
      const precio = Number(it.unit_price);
      const bucket = porItem.get(norm) ?? { nombres: [], precios: [] };
      bucket.nombres.push(nombre);
      if (Number.isFinite(precio) && precio > 0) bucket.precios.push(precio);
      porItem.set(norm, bucket);
    }
  }

  const items: ItemPerfilProveedor[] = Array.from(porItem.entries())
    .map(([nombre_norm, bucket]) => ({
      nombre_norm,
      nombre_habitual: moda(bucket.nombres) ?? bucket.nombres[0] ?? nombre_norm,
      precio_mediana: mediana(bucket.precios) ?? 0,
      n: bucket.nombres.length,
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_ITEMS_PERFIL);

  return {
    rif_normalizado: rif,
    rif_etiqueta: normalizarRifVenezolano(usable[0]!.supplier_rif) || rif,
    nombre_canonico: moda(nombres),
    moneda_habitual: moda(monedas),
    dias_credito_habitual: moda(dias),
    condicion_pago_habitual: moda(condiciones),
    entidad_id_habitual: moda(entidades),
    proyecto_id_habitual: moda(proyectos),
    ubicacion_destino_id_habitual: moda(almacenes),
    imputacion_habitual: moda(imputaciones),
    clasificacion_gasto_habitual: moda(clasifs),
    n_facturas: usable.length,
    items,
  };
}

export function listaCamposSugeridos(
  extracted: ExtractedCanalHeader | null | undefined,
): string[] {
  const raw = extracted?.campos_sugeridos;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => String(c).trim()).filter(Boolean);
}

export function esCampoSugerido(
  extracted: ExtractedCanalHeader | null | undefined,
  campo: string,
): boolean {
  return listaCamposSugeridos(extracted).includes(campo);
}

export function sinCampoSugerido(
  extracted: ExtractedCanalHeader,
  campo: string,
): ExtractedCanalHeader {
  const rest = listaCamposSugeridos(extracted).filter((c) => c !== campo);
  return { ...extracted, campos_sugeridos: rest };
}

function valorComparable(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

/** Aplica mapeos original → corregido (RIF, nombre, moneda, ítems, días). */
export function aplicarCorreccionesExtracted(
  extracted: ExtractedCanalHeader,
  correcciones: CorreccionProveedor[],
): ExtractedCanalHeader {
  if (!correcciones.length) return extracted;
  let next: ExtractedCanalHeader = { ...extracted, items: extracted.items?.map((it) => ({ ...it })) };

  const porCampo = new Map<string, CorreccionProveedor[]>();
  for (const c of correcciones) {
    const list = porCampo.get(c.campo) ?? [];
    list.push(c);
    porCampo.set(c.campo, list);
  }

  const aplicarCampo = (campo: keyof ExtractedCanalHeader) => {
    const actual = valorComparable(next[campo]);
    if (!actual) return;
    const hit = (porCampo.get(campo) ?? []).find(
      (c) => valorComparable(c.valor_original).toLowerCase() === actual.toLowerCase(),
    );
    if (!hit) return;
    (next as Record<string, unknown>)[campo] = coerceValorCampo(campo, hit.valor_corregido);
  };

  aplicarCampo('supplier_rif');
  aplicarCampo('supplier_name');
  aplicarCampo('moneda');
  aplicarCampo('dias_credito');
  aplicarCampo('condicion_pago');

  const mapsItem = porCampo.get('item_description') ?? [];
  if (mapsItem.length && next.items?.length) {
    next = {
      ...next,
      items: next.items.map((it) => {
        const desc = String(it.description ?? '').trim();
        if (!desc) return it;
        const norm = normalizarNombreItem(desc);
        const hit = mapsItem.find((c) => {
          const orig = c.valor_original.trim();
          return (
            orig.toLowerCase() === desc.toLowerCase() ||
            normalizarNombreItem(orig) === norm
          );
        });
        return hit ? { ...it, description: hit.valor_corregido } : it;
      }),
    };
  }

  return next;
}

function coerceValorCampo(campo: string, raw: string): unknown {
  if (campo === 'dias_credito') return parseDiasCreditoExtracted(raw);
  if (campo === 'moneda') return normalizarMonedaExtracted(raw);
  if (campo === 'condicion_pago') return parseCondicionPagoExtracted(raw);
  if (campo === 'total_amount') {
    const n = Number(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

export function prefillingDesdePerfil(
  extracted: ExtractedCanalHeader,
  perfil: ProveedorPerfil | null,
): { extracted: ExtractedCanalHeader; camposSugeridos: string[] } {
  if (!perfil) return { extracted, camposSugeridos: listaCamposSugeridos(extracted) };

  const sugeridos = new Set(listaCamposSugeridos(extracted));
  const next: ExtractedCanalHeader = { ...extracted };
  const destino: SugerenciasDestinoProveedor = { ...(extracted.sugerencias_destino ?? {}) };

  if (!monedaExtractedConfirmada(next.moneda) && perfil.moneda_habitual) {
    next.moneda = normalizarMonedaExtracted(perfil.moneda_habitual);
    sugeridos.add('moneda');
  }

  if (!String(next.condicion_pago ?? '').trim() && perfil.condicion_pago_habitual) {
    next.condicion_pago = perfil.condicion_pago_habitual;
    sugeridos.add('condicion_pago');
  }

  if (
    parseCondicionPagoExtracted(next.condicion_pago) === 'credito' &&
    parseDiasCreditoExtracted(next.dias_credito) == null &&
    perfil.dias_credito_habitual != null
  ) {
    next.dias_credito = perfil.dias_credito_habitual;
    sugeridos.add('dias_credito');
  }

  const nombreOcr = String(next.supplier_name ?? '').trim();
  if (perfil.nombre_canonico) {
    if (!nombreOcr) {
      next.supplier_name = perfil.nombre_canonico;
      sugeridos.add('supplier_name');
    } else if (
      normalizarNombreEmpresa(nombreOcr) !== normalizarNombreEmpresa(perfil.nombre_canonico) &&
      normalizarNombreEmpresa(nombreOcr).length < 4
    ) {
      next.supplier_name = perfil.nombre_canonico;
      sugeridos.add('supplier_name');
    }
  }

  if (perfil.entidad_id_habitual && !destino.entidad_id) {
    destino.entidad_id = perfil.entidad_id_habitual;
    sugeridos.add('entidad_id');
  }
  if (perfil.proyecto_id_habitual && !destino.proyecto_id) {
    destino.proyecto_id = perfil.proyecto_id_habitual;
    sugeridos.add('proyecto_id');
  }
  if (perfil.ubicacion_destino_id_habitual && !destino.ubicacion_destino_id) {
    destino.ubicacion_destino_id = perfil.ubicacion_destino_id_habitual;
    sugeridos.add('ubicacion_destino_id');
  }
  if (perfil.imputacion_habitual && !destino.imputacion) {
    destino.imputacion = perfil.imputacion_habitual;
    sugeridos.add('imputacion');
  }
  if (perfil.clasificacion_gasto_habitual && !destino.clasificacion_gasto) {
    destino.clasificacion_gasto = perfil.clasificacion_gasto_habitual;
    sugeridos.add('clasificacion_gasto');
  }

  next.sugerencias_destino = destino;
  next.campos_sugeridos = Array.from(sugeridos);
  return { extracted: next, camposSugeridos: next.campos_sugeridos };
}

function itemPerfilPara(perfil: ProveedorPerfil | null, description: string): ItemPerfilProveedor | null {
  if (!perfil) return null;
  const norm = normalizarNombreItem(description);
  if (!norm) return null;
  return perfil.items.find((it) => it.nombre_norm === norm) ?? null;
}

export function detectarAnomaliasFactura(params: {
  extracted: ExtractedCanalHeader;
  perfil?: ProveedorPerfil | null;
}): AnomaliaFacturaCanal[] {
  const { extracted, perfil } = params;
  const out: AnomaliaFacturaCanal[] = [];
  const items = extracted.items ?? [];

  for (const it of items) {
    const desc = String(it.description ?? '').trim();
    if (!desc) continue;
    const precio = Number(it.unit_price);
    if (!Number.isFinite(precio) || precio === 0) {
      out.push({
        tipo: 'precio_cero',
        severidad: 'alerta',
        mensaje: `La línea «${desc}» tiene precio 0.`,
        detalle: desc,
      });
      continue;
    }
    const hist = itemPerfilPara(perfil ?? null, desc);
    if (hist && hist.precio_mediana > 0 && hist.n >= 2) {
      const desvio = Math.abs(precio - hist.precio_mediana) / hist.precio_mediana;
      if (desvio > UMBRAL_DESVIO_PRECIO) {
        const pct = Math.round(desvio * 100);
        out.push({
          tipo: 'precio_desviado',
          severidad: 'alerta',
          mensaje: `El precio de «${desc}» se desvía ${pct}% de lo habitual de este proveedor (${hist.precio_mediana}).`,
          detalle: desc,
        });
      }
    }
  }

  if (monedaExtractedConfirmada(extracted.moneda) && perfil?.moneda_habitual) {
    const actual = normalizarMonedaExtracted(extracted.moneda);
    const habitual = normalizarMonedaExtracted(perfil.moneda_habitual);
    if (actual !== habitual) {
      out.push({
        tipo: 'moneda_distinta',
        severidad: 'aviso',
        mensaje: `La moneda (${actual === 'USD' ? 'USD' : 'Bs'}) no es la habitual de este proveedor (${habitual === 'USD' ? 'USD' : 'Bs'}).`,
      });
    }
  }

  const total = extracted.total_amount != null ? Number(extracted.total_amount) : null;
  if (total != null && Number.isFinite(total) && items.length > 0) {
    const suma = items.reduce((s, it) => {
      const q = Number(it.quantity);
      const p = Number(it.unit_price);
      const qty = Number.isFinite(q) && q > 0 ? q : 0;
      const pu = Number.isFinite(p) ? p : 0;
      return s + qty * pu;
    }, 0);
    const denom = Math.max(Math.abs(total), 1);
    const rel = Math.abs(suma - total) / denom;
    const abs = Math.abs(suma - total);
    if (rel > UMBRAL_SUMA_LINEAS && abs > 0.05) {
      out.push({
        tipo: 'suma_lineas_distinta',
        severidad: 'alerta',
        mensaje: `La suma de líneas (${redondear2(suma)}) no coincide con el total (${redondear2(total)}).`,
      });
    }
  }

  return out;
}

function redondear2(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 2 });
}

export function snapshotOcrOriginal(extracted: ExtractedCanalHeader): ExtractedCanalHeader {
  return {
    invoice_number: extracted.invoice_number,
    supplier_name: extracted.supplier_name,
    supplier_rif: extracted.supplier_rif,
    date: extracted.date,
    total_amount: extracted.total_amount,
    moneda: extracted.moneda ?? null,
    condicion_pago: extracted.condicion_pago ?? null,
    dias_credito: extracted.dias_credito ?? null,
    items: (extracted.items ?? []).map((it) => ({
      description: it.description,
      item_code: it.item_code,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
    })),
  };
}

const CAMPOS_CORRECCION_CABECERA = [
  'moneda',
  'supplier_rif',
  'supplier_name',
  'dias_credito',
  'condicion_pago',
  'entidad_id',
] as const;

export function correccionesDesdeCambio(params: {
  original: Record<string, unknown>;
  corregido: Record<string, unknown>;
  campos?: readonly string[];
}): CorreccionProveedor[] {
  const campos = params.campos ?? CAMPOS_CORRECCION_CABECERA;
  const out: CorreccionProveedor[] = [];
  for (const campo of campos) {
    const anterior = valorComparable(params.original[campo]);
    const nuevo = valorComparable(params.corregido[campo]);
    if (!anterior || !nuevo) continue;
    if (anterior.toLowerCase() === nuevo.toLowerCase()) continue;
    if (campo === 'moneda') {
      const a = normalizarMonedaExtracted(anterior);
      const b = normalizarMonedaExtracted(nuevo);
      if (a === b) continue;
    }
    out.push({ campo, valor_original: anterior, valor_corregido: nuevo });
  }
  return out;
}

export function correccionesDeLineas(
  original: ExtractedCanalItem[] | undefined,
  corregido: ExtractedCanalItem[] | undefined,
): CorreccionProveedor[] {
  const prev = original ?? [];
  const next = corregido ?? [];
  const out: CorreccionProveedor[] = [];
  const n = Math.min(prev.length, next.length);
  for (let i = 0; i < n; i++) {
    const a = String(prev[i]?.description ?? '').trim();
    const b = String(next[i]?.description ?? '').trim();
    if (!a || !b) continue;
    if (normalizarNombreItem(a) === normalizarNombreItem(b)) continue;
    out.push({
      campo: 'item_description',
      valor_original: a,
      valor_corregido: b,
    });
  }
  return out;
}

export function construirHintProveedor(
  perfil: ProveedorPerfil | null,
  correcciones: CorreccionProveedor[],
): string {
  const lineas: string[] = [];
  if (perfil) {
    const bits = [
      perfil.nombre_canonico ? `nombre canónico «${perfil.nombre_canonico}»` : null,
      `RIF ${perfil.rif_etiqueta}`,
      perfil.moneda_habitual
        ? `moneda habitual ${perfil.moneda_habitual === 'USD' ? 'USD' : 'bolívares (VES)'}`
        : null,
      perfil.condicion_pago_habitual
        ? perfil.condicion_pago_habitual === 'credito'
          ? `suele vender a crédito${perfil.dias_credito_habitual ? ` (${perfil.dias_credito_habitual} días)` : ''}`
          : 'suele vender de contado'
        : null,
    ].filter(Boolean);
    if (bits.length) lineas.push(`Proveedor conocido: ${bits.join('; ')}.`);
    const items = perfil.items.slice(0, 8);
    if (items.length) {
      lineas.push(
        'Ítems habituales (usa estos nombres si coinciden): ' +
          items.map((it) => `«${it.nombre_habitual}»`).join(', ') +
          '.',
      );
    }
  }
  const mapsNombre = correcciones.filter((c) => c.campo === 'supplier_name').slice(0, 4);
  for (const c of mapsNombre) {
    lineas.push(`Si lees «${c.valor_original}», el nombre correcto es «${c.valor_corregido}».`);
  }
  const mapsItem = correcciones.filter((c) => c.campo === 'item_description').slice(0, 8);
  for (const c of mapsItem) {
    lineas.push(`Ítem: «${c.valor_original}» se registra como «${c.valor_corregido}».`);
  }
  const mapsMoneda = correcciones.filter((c) => c.campo === 'moneda').slice(0, 2);
  for (const c of mapsMoneda) {
    lineas.push(`Moneda: si parece ${c.valor_original}, en esta casa se registra como ${c.valor_corregido}.`);
  }
  return lineas.join(' ').trim().slice(0, 900);
}

export function textoAnomaliasParaNotificacion(anomalias: AnomaliaFacturaCanal[]): string {
  if (!anomalias.length) return '';
  return anomalias.map((a) => `⚠ ${a.mensaje}`).join(' · ');
}

export function textoAnomaliasTelegramHtml(anomalias: AnomaliaFacturaCanal[]): string {
  if (!anomalias.length) return '';
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    `\n\n⚠️ <b>Revisar</b>\n` +
    anomalias.map((a) => `• ${esc(a.mensaje)}`).join('\n')
  );
}

/** Une snapshot OCR + correcciones + perfil + anomalías para persistir en extracted. */
export function enriquecerExtractedConMemoriaPuro(params: {
  ocr: ExtractedCanalHeader;
  perfil: ProveedorPerfil | null;
  correcciones: CorreccionProveedor[];
}): ExtractedCanalHeader {
  const ocr_original = params.ocr.ocr_original ?? snapshotOcrOriginal(params.ocr);
  const conCorrecciones = aplicarCorreccionesExtracted(
    { ...params.ocr, ocr_original },
    params.correcciones,
  );
  const { extracted } = prefillingDesdePerfil(conCorrecciones, params.perfil);
  const anomalias = detectarAnomaliasFactura({ extracted, perfil: params.perfil });
  return { ...extracted, ocr_original, anomalias };
}
