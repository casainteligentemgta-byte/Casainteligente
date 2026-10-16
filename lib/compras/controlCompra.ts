import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarTextoMaterial } from '@/lib/almacen/normalizarTextoMaterial';
import { normalizarUnidadProcura } from '@/lib/procuras/unidadesProcura';

/**
 * Control de compras (migración 362): lo pedido (procura) contra lo facturado (líneas de
 * la compra) contra lo recibido (lo que entró al almacén).
 *
 *   facturado_mayor_pedido   la factura cobra más cantidad que la pedida
 *   no_pedido                la factura trae un material que ninguna procura pidió
 *   recibido_menor_facturado llegó menos de lo que se facturó (incluye todo rechazado)
 *
 * Se revisa al confirmar la factura (pedido vs facturado) y al cerrar la recepción
 * (facturado vs recibido). Cada diferencia se guarda una vez por factura y se avisa.
 */

export type TipoDiferencia = 'facturado_mayor_pedido' | 'no_pedido' | 'recibido_menor_facturado';

export type LineaPedida = {
  procura_id: string;
  material_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
};

export type LineaFacturada = {
  material_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
};

export type Diferencia = {
  tipo: TipoDiferencia;
  clave: string;
  procura_id: string | null;
  material_id: string | null;
  descripcion: string;
  unidad: string;
  cantidad_pedida: number | null;
  cantidad_facturada: number;
  cantidad_recibida: number | null;
  precio_unitario: number;
  monto_diferencia: number;
};

/** Margen para no alertar por redondeos (2 %). */
export const TOLERANCIA_CONTROL = 0.02;

const redondear = (n: number) => Math.round(n * 1e4) / 1e4;

type Agrupada = {
  material_id: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
};

/** Las líneas facturadas del mismo material se suman (precio promedio ponderado). */
function agruparFacturadas(lineas: LineaFacturada[]): Agrupada[] {
  const por = new Map<string, Agrupada & { monto: number }>();
  for (const l of lineas) {
    const cant = Number(l.cantidad) || 0;
    if (cant <= 0) continue;
    const clave = l.material_id?.trim() || `txt:${normalizarTextoMaterial(l.descripcion)}`;
    const prev = por.get(clave);
    const monto = cant * (Number(l.precio_unitario) || 0);
    if (prev) {
      prev.cantidad += cant;
      prev.monto += monto;
    } else {
      por.set(clave, {
        material_id: l.material_id?.trim() || null,
        descripcion: l.descripcion.trim() || 'Material',
        unidad: normalizarUnidadProcura(l.unidad),
        cantidad: cant,
        precio_unitario: 0,
        monto,
      });
    }
  }
  return Array.from(por.values()).map((g) => ({
    material_id: g.material_id,
    descripcion: g.descripcion,
    unidad: g.unidad,
    cantidad: redondear(g.cantidad),
    precio_unitario: g.cantidad > 0 ? g.monto / g.cantidad : 0,
  }));
}

/**
 * Compara. `recibidas` (material_id → cantidad) solo cuando la recepción ya cerró;
 * sin ella no se evalúa lo recibido.
 */
export function compararPedidoFacturadoRecibido(p: {
  pedidas: LineaPedida[];
  facturadas: LineaFacturada[];
  recibidas?: Map<string, number> | null;
  tolerancia?: number;
}): Diferencia[] {
  const tol = p.tolerancia ?? TOLERANCIA_CONTROL;
  const out: Diferencia[] = [];
  const facturadas = agruparFacturadas(p.facturadas);

  // ── Pedido vs facturado (solo si la factura viene de procuras) ──
  if (p.pedidas.length) {
    // Si alguna procura es de texto libre no se puede saber con certeza qué material
    // pidió: no se marca «no pedido» para no dar falsas alarmas.
    const todasConMaterial = p.pedidas.every((x) => x.material_id?.trim());
    const pedidoPorMaterial = new Map<string, { cantidad: number; unidad: string; procura_id: string }>();
    for (const x of p.pedidas) {
      const id = x.material_id?.trim();
      if (!id) continue;
      const prev = pedidoPorMaterial.get(id);
      pedidoPorMaterial.set(id, {
        cantidad: (prev?.cantidad ?? 0) + (Number(x.cantidad) || 0),
        unidad: normalizarUnidadProcura(x.unidad),
        procura_id: prev?.procura_id ?? x.procura_id,
      });
    }

    for (const f of facturadas) {
      const pedido = f.material_id ? pedidoPorMaterial.get(f.material_id) : undefined;
      if (!pedido) {
        if (todasConMaterial) {
          out.push({
            tipo: 'no_pedido',
            clave: `no_pedido:${f.material_id ?? normalizarTextoMaterial(f.descripcion)}`,
            procura_id: null,
            material_id: f.material_id,
            descripcion: f.descripcion,
            unidad: f.unidad,
            cantidad_pedida: 0,
            cantidad_facturada: f.cantidad,
            cantidad_recibida: null,
            precio_unitario: f.precio_unitario,
            monto_diferencia: redondear(f.cantidad * f.precio_unitario),
          });
        }
        continue;
      }
      if (pedido.unidad !== f.unidad) continue; // no se comparan sacos con kilos
      if (f.cantidad > pedido.cantidad * (1 + tol)) {
        const exceso = f.cantidad - pedido.cantidad;
        out.push({
          tipo: 'facturado_mayor_pedido',
          clave: `facturado_mayor_pedido:${f.material_id}`,
          procura_id: pedido.procura_id,
          material_id: f.material_id,
          descripcion: f.descripcion,
          unidad: f.unidad,
          cantidad_pedida: redondear(pedido.cantidad),
          cantidad_facturada: f.cantidad,
          cantidad_recibida: null,
          precio_unitario: f.precio_unitario,
          monto_diferencia: redondear(exceso * f.precio_unitario),
        });
      }
    }
  }

  // ── Facturado vs recibido ──
  if (p.recibidas) {
    for (const f of facturadas) {
      if (!f.material_id) continue;
      const recibido = p.recibidas.get(f.material_id) ?? 0;
      if (recibido < f.cantidad * (1 - tol)) {
        const falta = f.cantidad - recibido;
        out.push({
          tipo: 'recibido_menor_facturado',
          clave: `recibido_menor_facturado:${f.material_id}`,
          procura_id: null,
          material_id: f.material_id,
          descripcion: f.descripcion,
          unidad: f.unidad,
          cantidad_pedida: null,
          cantidad_facturada: f.cantidad,
          cantidad_recibida: redondear(recibido),
          precio_unitario: f.precio_unitario,
          monto_diferencia: redondear(falta * f.precio_unitario),
        });
      }
    }
  }

  return out;
}

/* ─────────────────────────── Base de datos ─────────────────────────── */

type Fila = Record<string, unknown>;
const txt = (v: unknown) => (v == null ? '' : String(v).trim());

export type ResultadoControl = { diferencias: number; nuevas: number; avisados: number };

/**
 * Revisa la factura, guarda las diferencias (una vez cada una) y avisa las nuevas.
 * `recepcion`: true cuando la cuarentena ya cerró (o hay conteo del depositario).
 * Nunca lanza: el control no debe tumbar la factura ni la recepción.
 */
export async function revisarControlCompra(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  opts?: {
    recepcion?: boolean;
    /** Conteo del depositario (canal): manda sobre lo aprobado en cuarentena. */
    cantidadesRecibidas?: Array<{ material_id: string; cantidad: number }> | null;
    avisar?: (diferencias: Diferencia[], contexto: ContextoFactura) => Promise<number>;
  },
): Promise<ResultadoControl> {
  const pi = purchaseInvoiceId.trim();
  const vacio = { diferencias: 0, nuevas: 0, avisados: 0 };
  if (!pi) return vacio;
  try {
    const ctx = await cargarContextoFactura(supabase, pi);
    if (!ctx) return vacio;

    let recibidas: Map<string, number> | null = null;
    if (opts?.cantidadesRecibidas?.length) {
      recibidas = new Map();
      for (const c of opts.cantidadesRecibidas) {
        const id = c.material_id?.trim();
        if (id) recibidas.set(id, (recibidas.get(id) ?? 0) + (Number(c.cantidad) || 0));
      }
    } else if (opts?.recepcion) {
      const { data } = await supabase
        .from('quality_inspections')
        .select('status,material_id,quantity')
        .eq('invoice_id', pi);
      const filas = (data ?? []) as Fila[];
      if (filas.length && !filas.some((f) => txt(f.status).toUpperCase() === 'PENDIENTE')) {
        recibidas = new Map();
        for (const f of filas) {
          if (txt(f.status).toUpperCase() !== 'APROBADO') continue;
          const id = txt(f.material_id);
          if (id) recibidas.set(id, (recibidas.get(id) ?? 0) + (Number(f.quantity) || 0));
        }
      }
    }

    const diferencias = compararPedidoFacturadoRecibido({
      pedidas: ctx.pedidas,
      facturadas: ctx.facturadas,
      recibidas,
    });
    if (!diferencias.length) return vacio;

    const { data: previas } = await supabase
      .from('ci_control_compras')
      .select('clave')
      .eq('purchase_invoice_id', pi);
    const yaEstaban = new Set(((previas ?? []) as Fila[]).map((f) => txt(f.clave)));

    const ahora = new Date().toISOString();
    const { error } = await supabase.from('ci_control_compras').upsert(
      diferencias.map((d) => ({
        purchase_invoice_id: pi,
        procura_id: d.procura_id,
        proyecto_id: ctx.proyectoId,
        tipo: d.tipo,
        clave: d.clave,
        material_id: d.material_id,
        descripcion: d.descripcion.slice(0, 300),
        unidad: d.unidad,
        cantidad_pedida: d.cantidad_pedida,
        cantidad_facturada: d.cantidad_facturada,
        cantidad_recibida: d.cantidad_recibida,
        precio_unitario: d.precio_unitario,
        moneda: ctx.moneda,
        monto_diferencia: d.monto_diferencia,
        updated_at: ahora,
      })),
      { onConflict: 'purchase_invoice_id,clave' },
    );
    if (error) {
      if (!/ci_control_compras/.test(error.message ?? '')) console.warn('[controlCompra] guardar:', error.message);
      return { diferencias: diferencias.length, nuevas: 0, avisados: 0 };
    }

    const nuevas = diferencias.filter((d) => !yaEstaban.has(d.clave));
    let avisados = 0;
    if (nuevas.length) {
      const avisar = opts?.avisar ?? ((ds, c) => avisarDiferenciasCompra(supabase, ds, c));
      avisados = await avisar(nuevas, ctx);
    }
    return { diferencias: diferencias.length, nuevas: nuevas.length, avisados };
  } catch (e) {
    console.warn('[controlCompra]', pi, e);
    return vacio;
  }
}

export type ContextoFactura = {
  purchaseInvoiceId: string;
  numero: string;
  proveedor: string;
  moneda: string;
  proyectoId: string | null;
  obra: string | null;
  pedidas: LineaPedida[];
  facturadas: LineaFacturada[];
};

async function cargarContextoFactura(supabase: SupabaseClient, pi: string): Promise<ContextoFactura | null> {
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id,invoice_number,supplier_name,moneda,proyecto_id')
    .eq('id', pi)
    .maybeSingle();
  if (!inv) return null;
  const factura = inv as Fila;

  const { data: compras } = await supabase
    .from('contabilidad_compras')
    .select('id,procura_id,moneda,proyecto_id')
    .eq('purchase_invoice_id', pi);
  const filasCompra = (compras ?? []) as Fila[];
  const compraIds = filasCompra.map((c) => txt(c.id)).filter(Boolean);

  let facturadas: LineaFacturada[] = [];
  if (compraIds.length) {
    const { data: lineas } = await supabase
      .from('contabilidad_compra_lineas')
      .select('material_id,descripcion,cantidad,unidad,precio_unitario')
      .in('compra_id', compraIds);
    facturadas = ((lineas ?? []) as Fila[]).map((l) => ({
      material_id: txt(l.material_id) || null,
      descripcion: txt(l.descripcion),
      cantidad: Number(l.cantidad) || 0,
      unidad: txt(l.unidad) || 'UND',
      precio_unitario: Number(l.precio_unitario) || 0,
    }));
  }

  const procuraIds = new Set(filasCompra.map((c) => txt(c.procura_id)).filter(Boolean));
  const { data: porFactura } = await supabase.from('ci_procuras').select('id').eq('purchase_invoice_id', pi);
  for (const p of (porFactura ?? []) as Fila[]) procuraIds.add(txt(p.id));

  let pedidas: LineaPedida[] = [];
  if (procuraIds.size) {
    const { data: procuras } = await supabase
      .from('ci_procuras')
      .select('id,material_id,material_txt,cantidad,cantidad_compra,unidad')
      .in('id', Array.from(procuraIds));
    pedidas = ((procuras ?? []) as Fila[]).map((p) => {
      // Lo que se mandó a comprar (si parte salió del almacén) o lo pedido.
      const compra = Number(p.cantidad_compra);
      return {
        procura_id: txt(p.id),
        material_id: txt(p.material_id) || null,
        descripcion: txt(p.material_txt),
        cantidad: compra > 0 ? compra : Number(p.cantidad) || 0,
        unidad: txt(p.unidad) || 'UND',
      };
    });
  }

  const proyectoId =
    txt(factura.proyecto_id) || filasCompra.map((c) => txt(c.proyecto_id)).find(Boolean) || null;
  let obra: string | null = null;
  if (proyectoId) {
    const { data: p } = await supabase.from('ci_proyectos').select('nombre').eq('id', proyectoId).maybeSingle();
    obra = txt((p as Fila | null)?.nombre) || null;
  }

  return {
    purchaseInvoiceId: pi,
    numero: txt(factura.invoice_number) || 'S/N',
    proveedor: txt(factura.supplier_name) || 'Proveedor',
    moneda: txt(factura.moneda) || filasCompra.map((c) => txt(c.moneda)).find(Boolean) || 'VES',
    proyectoId,
    obra,
    pedidas,
    facturadas,
  };
}

/* ─────────────────────────── Aviso ─────────────────────────── */

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const num = (n: number | null) => (n == null ? '—' : Number(n).toLocaleString('es-VE', { maximumFractionDigits: 2 }));

export function lineaDiferencia(d: Diferencia, moneda: string): string {
  const monto = d.monto_diferencia > 0 ? ` · <b>${num(d.monto_diferencia)} ${escHtml(moneda)}</b>` : '';
  const desc = escHtml(d.descripcion.slice(0, 60));
  const u = escHtml(d.unidad);
  switch (d.tipo) {
    case 'facturado_mayor_pedido':
      return `🔺 ${desc}: pedido ${num(d.cantidad_pedida)} ${u}, facturado ${num(d.cantidad_facturada)} ${u}${monto}`;
    case 'no_pedido':
      return `❓ ${desc}: facturado ${num(d.cantidad_facturada)} ${u} y nadie lo pidió${monto}`;
    case 'recibido_menor_facturado':
      return `📉 ${desc}: facturado ${num(d.cantidad_facturada)} ${u}, recibido ${num(d.cantidad_recibida)} ${u}${monto}`;
    default:
      return `⚠️ ${desc}`;
  }
}

export function mensajeDiferenciasCompra(ds: Diferencia[], c: ContextoFactura, baseUrl: string): string {
  return [
    `⚠️ <b>Diferencias en la factura #${escHtml(c.numero)}</b>`,
    `🏢 ${escHtml(c.proveedor)}${c.obra ? ` · 🏗 ${escHtml(c.obra)}` : ''}`,
    '',
    ...ds.map((d) => lineaDiferencia(d, c.moneda)),
    '',
    'Revise antes de pagar o reclame al proveedor.',
    `<a href="${baseUrl}/compras/torre-control">Ver y marcar revisada</a>`,
  ].join('\n');
}

const ROLES_AVISO = new Set(['comprador', 'compras', 'contador', 'contabilidad']);

/** Al comprador y al contador de la obra, y a administración. */
export async function avisarDiferenciasCompra(
  supabase: SupabaseClient,
  ds: Diferencia[],
  c: ContextoFactura,
): Promise<number> {
  const destinos = new Set<string>();
  try {
    if (c.proyectoId) {
      const { personasNominaConRol } = await import('@/lib/almacen/depositariosNomina');
      for (const p of await personasNominaConRol(supabase, c.proyectoId, ROLES_AVISO)) destinos.add(p.chatId);
    }
    const { listarAdministradoresSistemaTelegram } = await import('@/lib/compras/usuariosSistemaTelegram');
    for (const a of await listarAdministradoresSistemaTelegram(supabase)) destinos.add(a.chatId);
  } catch (e) {
    console.warn('[controlCompra] destinatarios:', e);
  }
  if (!destinos.size) return 0;

  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://casainteligente.company')
    .trim()
    .replace(/\/$/, '');
  const html = mensajeDiferenciasCompra(ds, c, base);
  const { sendTelegramMessage } = await import('@/lib/telegram/botApi');
  let enviados = 0;
  for (const chat of Array.from(destinos)) {
    try {
      await sendTelegramMessage(chat, html, { parse_mode: 'HTML', contextoLogEspejo: '[Compras · control de factura]' });
      enviados += 1;
    } catch (e) {
      console.warn('[controlCompra] aviso', chat, e);
    }
  }
  return enviados;
}
