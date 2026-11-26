/**
 * Formato fijo de un solo mensaje para el depositario (obra sin internet).
 *
 * Telegram encola el texto y lo entrega después; el bot no puede hacer Q&A
 * paso a paso. El depositario escribe el movimiento completo:
 *
 *   INGRESO
 *   doc: 421
 *   proveedor: Cemex
 *   20 cemento
 *   5 tubo pvc 1/2
 *
 *   SALIDA
 *   destino/uso: colado losa
 *   72 cemento
 *
 *   INVENTARIO
 *   120 cemento
 *
 * Una línea de artículo = un ítem. Un mensaje = un movimiento.
 * /formato muestra esta plantilla. El flujo con botones sigue disponible
 * cuando hay señal.
 */

import {
  esNumeroDocumentoPlaceholder,
  sanitizarNumeroDocumentoMovimiento,
} from '@/lib/almacen/documentoRecepcionCampo';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';

export type TipoFormatoFijo = 'ingreso' | 'salida' | 'inventario';

export type LineaFormatoFijo = {
  cantidad: number;
  descripcion: string;
  lineaOriginal: string;
  indice: number;
};

export type MovimientoFormatoFijo = {
  tipo: TipoFormatoFijo;
  doc: string | null;
  proveedor: string | null;
  destinoUso: string | null;
  obra: string | null;
  lineas: LineaFormatoFijo[];
  lineasIgnoradas: string[];
};

export type ParseFormatoFijoResult =
  | { ok: true; movimiento: MovimientoFormatoFijo }
  | { ok: false; motivo: 'no_es_formato' | 'sin_lineas' | 'varios_tipos' };

const TIPO_POR_CLAVE: Record<string, TipoFormatoFijo> = {
  ingreso: 'ingreso',
  ingresos: 'ingreso',
  salida: 'salida',
  salidas: 'salida',
  egreso: 'salida',
  egresos: 'salida',
  inventario: 'inventario',
  conteo: 'inventario',
  conteofisico: 'inventario',
};

const META_DOC = new Set(['doc', 'documento', 'factura', 'nro', 'nr', 'num', 'numero', 'n']);
const META_PROV = new Set(['proveedor', 'provee', 'prov']);
const META_DESTINO = new Set(['destino', 'uso', 'destinouso', 'destino/uso']);
const META_OBRA = new Set(['obra', 'proyecto']);

function normalizarClave(texto: string): string {
  return normalizarTextoMaterial(texto).replace(/\s+/g, '');
}

function claveTipo(texto: string): TipoFormatoFijo | null {
  const clave = normalizarClave(texto).replace(/:+$/, '');
  return TIPO_POR_CLAVE[clave] ?? null;
}

function parsearCantidad(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10000) / 10000;
}

const RE_ITEM =
  /^\s*(\d+(?:[.,]\d+)?)\s*(?:x\s+|×\s+)?(.+?)\s*$/i;
const RE_META = /^\s*([^:=\n]{1,40})\s*[:=]\s*(.*?)\s*$/;

function asignarMeta(
  mov: MovimientoFormatoFijo,
  claveRaw: string,
  valor: string,
): boolean {
  const clave = normalizarClave(claveRaw);
  const v = valor.trim();
  if (!v) return true;
  if (META_DOC.has(clave) || clave === 'nº' || clave === 'n°') {
    mov.doc = v;
    return true;
  }
  if (META_PROV.has(clave)) {
    mov.proveedor = v;
    return true;
  }
  if (META_DESTINO.has(clave) || clave === 'destino/uso') {
    mov.destinoUso = v;
    return true;
  }
  if (META_OBRA.has(clave)) {
    mov.obra = v;
    return true;
  }
  return false;
}

/**
 * true si el texto parece un movimiento de formato fijo (primera línea =
 * INGRESO / SALIDA / INVENTARIO y hay más contenido). No consume un «INGRESO»
 * suelto del wizard paso a paso.
 */
export function esMensajeFormatoFijo(texto: string): boolean {
  const lineas = texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== '---' && l !== '—');
  if (lineas.length < 2) return false;
  return claveTipo(lineas[0] ?? '') != null;
}

export function parsearFormatoFijoMovimiento(texto: string): ParseFormatoFijoResult {
  const crudas = texto.replace(/\r\n/g, '\n').split('\n');
  const utiles = crudas
    .map((l, indice) => ({ texto: l.trim(), indice }))
    .filter((l) => l.texto && l.texto !== '---' && l.texto !== '—' && l.texto !== '--');

  if (utiles.length < 2) return { ok: false, motivo: 'no_es_formato' };

  const tipo = claveTipo(utiles[0]!.texto);
  if (!tipo) return { ok: false, motivo: 'no_es_formato' };

  const mov: MovimientoFormatoFijo = {
    tipo,
    doc: null,
    proveedor: null,
    destinoUso: null,
    obra: null,
    lineas: [],
    lineasIgnoradas: [],
  };

  for (const fila of utiles.slice(1)) {
    const otroTipo = claveTipo(fila.texto);
    if (otroTipo) {
      if (otroTipo !== tipo) return { ok: false, motivo: 'varios_tipos' };
      continue;
    }

    const meta = fila.texto.match(RE_META);
    if (meta) {
      if (asignarMeta(mov, meta[1] ?? '', meta[2] ?? '')) continue;
    }

    const item = fila.texto.match(RE_ITEM);
    if (item) {
      const cantidad = parsearCantidad(item[1] ?? '');
      const descripcion = String(item[2] ?? '').trim();
      if (cantidad && descripcion && !claveTipo(descripcion)) {
        mov.lineas.push({
          cantidad,
          descripcion,
          lineaOriginal: fila.texto,
          indice: fila.indice + 1,
        });
        continue;
      }
    }

    if (esNumeroDocumentoPlaceholder(fila.texto) || esRespuestaCortaSiNo(fila.texto)) {
      mov.lineasIgnoradas.push(fila.texto);
      continue;
    }
    mov.lineasIgnoradas.push(fila.texto);
  }

  if (!mov.lineas.length) return { ok: false, motivo: 'sin_lineas' };
  return { ok: true, movimiento: mov };
}

function esRespuestaCortaSiNo(texto: string): boolean {
  return esNumeroDocumentoPlaceholder(texto);
}

export function shortIdDesdeMensajeTelegram(chatId: string, messageId: number): string {
  const s = `${String(chatId).trim()}:${messageId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

export function yyyymmddCaracas(fecha: Date): string {
  const caracas = fechaEnCaracas(fecha);
  const y = caracas.getUTCFullYear();
  const m = String(caracas.getUTCMonth() + 1).padStart(2, '0');
  const d = String(caracas.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function fechaIsoCaracas(fecha: Date): string {
  const s = yyyymmddCaracas(fecha);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function formatearFechaMensajeCaracas(fecha: Date): string {
  const caracas = fechaEnCaracas(fecha);
  const dd = String(caracas.getUTCDate()).padStart(2, '0');
  const mm = String(caracas.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(caracas.getUTCHours()).padStart(2, '0');
  const min = String(caracas.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

/** Venezuela no usa DST: UTC−4. */
export function fechaEnCaracas(fecha: Date): Date {
  return new Date(fecha.getTime() - 4 * 60 * 60 * 1000);
}

export type MensajeTelegramFecha = {
  date?: number;
  edit_date?: number;
  forward_date?: number;
  forward_origin?: { date?: number };
};

/**
 * Fecha del movimiento = cuándo el depositario lo escribió / reenvió,
 * no cuándo el webhook lo procesó (puede ser horas después).
 * Prioridad: origen del reenvío → forward_date → date.
 * edit_date se ignora: una corrección posterior no cambia el hecho.
 */
export function fechaMovimientoDesdeMensajeTelegram(
  msg: MensajeTelegramFecha | null | undefined,
): Date {
  const unix =
    Number(msg?.forward_origin?.date) ||
    Number(msg?.forward_date) ||
    Number(msg?.date) ||
    0;
  if (unix > 0) return new Date(unix * 1000);
  return new Date();
}

export function generarNumeroDocumentoIngreso(params: {
  fecha: Date;
  chatId: string;
  messageId: number;
}): string {
  return `ING-${yyyymmddCaracas(params.fecha)}-${shortIdDesdeMensajeTelegram(params.chatId, params.messageId)}`;
}

/** Nº de documento de un INGRESO: nunca Si/Sí/No; si falta, ING-YYYYMMDD-id. */
export function resolverDocIngresoFormatoFijo(params: {
  doc: string | null;
  fecha: Date;
  chatId: string;
  messageId: number;
}): { doc: string; generado: boolean } {
  const limpio = sanitizarNumeroDocumentoMovimiento(params.doc);
  if (limpio) return { doc: limpio, generado: false };
  return {
    doc: generarNumeroDocumentoIngreso(params),
    generado: true,
  };
}

export function claveIdempotenciaFormatoFijo(chatId: string, messageId: number): string {
  return `${String(chatId).trim()}:${messageId}`;
}

export function escHtmlFormatoFijo(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const MENSAJE_FORMATO_FIJO_AYUDA =
  '<b>Formato fijo</b> (un mensaje, sin internet)\n\n' +
  'Escribe el movimiento completo. Telegram lo manda cuando vuelva la señal.\n' +
  'Un mensaje = un movimiento. Cada línea de cantidad es un artículo.\n\n' +
  '<b>Ingreso</b>\n' +
  '<pre>INGRESO\n' +
  'doc: 421\n' +
  'proveedor: Cemex\n' +
  '20 cemento\n' +
  '5 tubo pvc 1/2</pre>\n' +
  '<i>Sin doc se genera ING-fecha-id. No escribas Si/No como número.</i>\n\n' +
  '<b>Salida</b>\n' +
  '<pre>SALIDA\n' +
  'destino/uso: colado losa\n' +
  '72 cemento</pre>\n\n' +
  '<b>Inventario</b> (conteo físico → ajuste en kardex)\n' +
  '<pre>INVENTARIO\n' +
  '120 cemento</pre>\n\n' +
  'Opcional: <code>obra: Rancho Flamboyant</code>\n' +
  'Si hay señal, /ingreso y /salida con botones siguen igual.';

export function etiquetaTipoFormatoFijo(tipo: TipoFormatoFijo): string {
  if (tipo === 'ingreso') return 'INGRESO';
  if (tipo === 'salida') return 'SALIDA';
  return 'INVENTARIO';
}

export function resumenLineasFormatoFijo(
  lineas: Array<{ cantidad: number; nombre: string }>,
): string {
  return lineas
    .map((l) => `${Number.isInteger(l.cantidad) ? String(l.cantidad) : String(l.cantidad)} ${l.nombre}`)
    .join(', ');
}
