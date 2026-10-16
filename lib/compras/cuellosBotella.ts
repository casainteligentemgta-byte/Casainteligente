import type { SupabaseClient } from '@supabase/supabase-js';
import { listarAdministradoresSistemaTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import {
  encargadosAlmacenObra,
  personasNominaConRol,
  type PersonaNominaTelegram,
} from '@/lib/almacen/depositariosNomina';

/**
 * Cuellos de botella de la cadena procura → compra → retiro → almacén → salida.
 *
 * Cada etapa tiene un umbral: lo que pasa de ahí está «detenido» y se avisa a quien
 * le toca moverlo. Si lleva el doble del umbral se escala también a administración.
 * Lo usan el centro web (/compras/cuellos-botella) y el aviso diario por Telegram.
 */

export type ClaveEtapa =
  | 'aprobacion'
  | 'compra'
  | 'ingreso'
  | 'retiro'
  | 'transporte'
  | 'cuarentena'
  | 'pedidos'
  | 'canal';

export type RolResponsable = 'pm' | 'comprador' | 'logistica' | 'depositario' | 'remitente';

export type DefinicionEtapa = {
  clave: ClaveEtapa;
  titulo: string;
  /** A quién le toca moverlo (texto para mostrar). */
  responsable: string;
  umbralHoras: number;
  roles: RolResponsable[];
};

export const ETAPAS_CUELLO: DefinicionEtapa[] = [
  { clave: 'aprobacion', titulo: 'Procura por aprobar', responsable: 'PM / coordinador', umbralHoras: 24, roles: ['pm'] },
  { clave: 'compra', titulo: 'Aprobada sin comprar', responsable: 'Comprador', umbralHoras: 48, roles: ['comprador'] },
  { clave: 'canal', titulo: 'Factura sin confirmar', responsable: 'Quien la envió', umbralHoras: 24, roles: ['remitente'] },
  { clave: 'retiro', titulo: 'Mercancía por retirar', responsable: 'Logística', umbralHoras: 24, roles: ['logistica', 'comprador'] },
  { clave: 'transporte', titulo: 'En camino sin llegar', responsable: 'Depositario', umbralHoras: 24, roles: ['depositario'] },
  { clave: 'cuarentena', titulo: 'Cuarentena sin verificar', responsable: 'Depositario', umbralHoras: 48, roles: ['depositario'] },
  { clave: 'ingreso', titulo: 'Comprada sin recibir', responsable: 'Depositario / comprador', umbralHoras: 120, roles: ['depositario', 'comprador'] },
  { clave: 'pedidos', titulo: 'Pedido de material sin despachar', responsable: 'Depositario', umbralHoras: 24, roles: ['depositario'] },
];

export type ItemCuello = {
  id: string;
  etapa: ClaveEtapa;
  referencia: string;
  detalle: string;
  proyectoId: string | null;
  obra: string | null;
  desde: string;
  horas: number;
  /** Pasó el umbral de la etapa. */
  detenido: boolean;
  /** Lleva el doble del umbral: se escala a administración. */
  critico: boolean;
  /** Chat de quien originó el ítem (factura del canal, comprador del retiro). */
  chatOrigen: string | null;
};

export type EtapaCuello = DefinicionEtapa & {
  items: ItemCuello[];
  detenidos: number;
  criticos: number;
  horasMaximas: number;
};

export type ResumenCuellos = {
  generadoAt: string;
  etapas: EtapaCuello[];
  totalDetenidos: number;
  totalCriticos: number;
};

const H = 3_600_000;

function horasDesde(iso: string | null | undefined, ahora: number): number {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (ahora - t) / H);
}

function txt(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

type FilaBruta = Record<string, unknown>;

type RespuestaDb = { data: unknown; error: { message?: string } | null };

/** Columnas como `string` (no literal): evita que supabase-js infiera el tipo de cada fila. */
function desde(supabase: SupabaseClient, tabla: string, columnas: string) {
  return supabase.from(tabla).select(columnas);
}

async function filas(tabla: string, consulta: PromiseLike<RespuestaDb>): Promise<FilaBruta[]> {
  const { data, error } = await consulta;
  if (error) {
    // Una tabla ausente (migración pendiente) no debe tumbar el resto del tablero.
    console.warn(`[cuellosBotella] ${tabla}:`, error.message);
    return [];
  }
  return (Array.isArray(data) ? data : []) as FilaBruta[];
}

export async function calcularCuellosBotella(
  supabase: SupabaseClient,
  opts?: { proyectoId?: string | null; ahora?: Date },
): Promise<ResumenCuellos> {
  const ahora = (opts?.ahora ?? new Date()).getTime();
  const soloObra = opts?.proyectoId?.trim() || null;
  const def = new Map(ETAPAS_CUELLO.map((e) => [e.clave, e]));
  const items: ItemCuello[] = [];

  const agregar = (
    etapa: ClaveEtapa,
    base: Omit<ItemCuello, 'etapa' | 'horas' | 'detenido' | 'critico' | 'obra'>,
  ) => {
    if (soloObra && base.proyectoId !== soloObra) return;
    const umbral = def.get(etapa)!.umbralHoras;
    const horas = horasDesde(base.desde, ahora);
    items.push({
      ...base,
      etapa,
      obra: null,
      horas,
      detenido: horas >= umbral,
      critico: horas >= umbral * 2,
    });
  };

  const [procuras, cuarentena, retiros, pedidos, canal] = await Promise.all([
    filas(
      'ci_procuras',
      desde(supabase, 'ci_procuras', 'id,ticket,estado,material_txt,cantidad,unidad,proyecto_id,updated_at').in(
        'estado',
        ['solicitada', 'pendiente_pm', 'aprobada', 'aprobada_directa', 'en_compra'],
      ),
    ),
    filas(
      'quality_inspections',
      desde(
        supabase,
        'quality_inspections',
        'id,invoice_id,quantity,line_description,created_at,purchase_invoices(invoice_number,supplier_name,proyecto_id)',
      ).eq('status', 'PENDIENTE'),
    ),
    filas(
      'ci_compras_retiros',
      desde(
        supabase,
        'ci_compras_retiros',
        'id,estado,proyecto_id,numero_factura,proveedor_nombre,transportista_nombre,solicitado_por_chat_id,created_at,asignado_at,retirado_at',
      ).in('estado', ['pendiente', 'asignado', 'en_camino']),
    ),
    filas(
      'inv_requerimientos_salida',
      desde(
        supabase,
        'inv_requerimientos_salida',
        'id,codigo,estado,proyecto_id,material_nombre,cantidad,unidad,solicitante_nombre,created_at,tomado_at',
      ).in('estado', ['solicitado', 'en_despacho']),
    ),
    filas(
      'ci_facturas_canal_pendientes',
      desde(
        supabase,
        'ci_facturas_canal_pendientes',
        'id,estado,chat_id,chat_label,proyecto_id,extracted,mensaje_error,created_at,updated_at',
      ).in('estado', ['recibido', 'procesando', 'extraido']),
    ),
  ]);

  for (const p of procuras) {
    const estado = txt(p.estado);
    const etapa: ClaveEtapa =
      estado === 'solicitada' || estado === 'pendiente_pm'
        ? 'aprobacion'
        : estado === 'en_compra'
          ? 'ingreso'
          : 'compra';
    const cant = Number(p.cantidad);
    agregar(etapa, {
      id: txt(p.id),
      referencia: txt(p.ticket) || 'Procura',
      detalle: [txt(p.material_txt), Number.isFinite(cant) && cant > 0 ? `${cant} ${txt(p.unidad)}`.trim() : '']
        .filter(Boolean)
        .join(' · '),
      proyectoId: txt(p.proyecto_id) || null,
      desde: txt(p.updated_at),
      chatOrigen: null,
    });
  }

  // Cuarentena: una fila por factura (no por línea), con la línea más antigua.
  const porFactura = new Map<string, { n: number; desde: string; fila: FilaBruta }>();
  for (const q of cuarentena) {
    const inv = txt(q.invoice_id);
    const prev = porFactura.get(inv);
    const desde = txt(q.created_at);
    if (!prev) porFactura.set(inv, { n: 1, desde, fila: q });
    else {
      prev.n += 1;
      if (desde < prev.desde) prev.desde = desde;
    }
  }
  for (const [inv, g] of Array.from(porFactura.entries())) {
    const pi = (g.fila.purchase_invoices ?? {}) as FilaBruta;
    agregar('cuarentena', {
      id: inv,
      referencia: `Factura ${txt(pi.invoice_number) || 'S/N'}`,
      detalle: `${txt(pi.supplier_name) || 'Proveedor'} · ${g.n} línea(s)`,
      proyectoId: txt(pi.proyecto_id) || null,
      desde: g.desde,
      chatOrigen: null,
    });
  }

  for (const r of retiros) {
    const enCamino = txt(r.estado) === 'en_camino';
    agregar(enCamino ? 'transporte' : 'retiro', {
      id: txt(r.id),
      referencia: `Factura ${txt(r.numero_factura) || 'S/N'}`,
      detalle: [
        txt(r.proveedor_nombre),
        txt(r.estado) === 'asignado' ? `tomado por ${txt(r.transportista_nombre) || '—'}` : '',
        enCamino ? `lo trae ${txt(r.transportista_nombre) || '—'}` : '',
        txt(r.estado) === 'pendiente' ? 'nadie lo ha tomado' : '',
      ]
        .filter(Boolean)
        .join(' · '),
      proyectoId: txt(r.proyecto_id) || null,
      desde: txt(enCamino ? r.retirado_at : r.estado === 'asignado' ? r.asignado_at : r.created_at) || txt(r.created_at),
      chatOrigen: txt(r.solicitado_por_chat_id) || null,
    });
  }

  for (const r of pedidos) {
    agregar('pedidos', {
      id: txt(r.id),
      referencia: txt(r.codigo) || 'Pedido',
      detalle: [txt(r.material_nombre), `${txt(r.cantidad)} ${txt(r.unidad)}`.trim(), txt(r.solicitante_nombre)]
        .filter(Boolean)
        .join(' · '),
      proyectoId: txt(r.proyecto_id) || null,
      desde: txt(r.estado === 'en_despacho' ? r.tomado_at : r.created_at) || txt(r.created_at),
      chatOrigen: null,
    });
  }

  for (const f of canal) {
    const ex = (f.extracted ?? {}) as FilaBruta;
    const estado = txt(f.estado);
    agregar('canal', {
      id: txt(f.id),
      referencia: `Factura ${txt(ex.invoice_number) || 'sin leer'}`,
      detalle: [
        txt(ex.supplier_name),
        estado === 'procesando' ? 'lectura trabada' : estado === 'extraido' ? 'leída, falta confirmar' : 'sin procesar',
        txt(f.mensaje_error),
      ]
        .filter(Boolean)
        .join(' · '),
      proyectoId: txt(f.proyecto_id) || null,
      desde: txt(f.updated_at) || txt(f.created_at),
      chatOrigen: txt(f.chat_id) || null,
    });
  }

  // Nombres de obra.
  const ids = Array.from(new Set(items.map((i) => i.proyectoId).filter((x): x is string => !!x)));
  if (ids.length) {
    const { data } = await supabase.from('ci_proyectos').select('id,nombre,nombre_proyecto').in('id', ids);
    const nombres = new Map(
      ((data ?? []) as FilaBruta[]).map((p) => [txt(p.id), txt(p.nombre) || txt(p.nombre_proyecto)]),
    );
    for (const i of items) i.obra = i.proyectoId ? nombres.get(i.proyectoId) || null : null;
  }

  const etapas: EtapaCuello[] = ETAPAS_CUELLO.map((e) => {
    const deEtapa = items.filter((i) => i.etapa === e.clave).sort((a, b) => b.horas - a.horas);
    return {
      ...e,
      items: deEtapa,
      detenidos: deEtapa.filter((i) => i.detenido).length,
      criticos: deEtapa.filter((i) => i.critico).length,
      horasMaximas: deEtapa[0]?.horas ?? 0,
    };
  });

  return {
    generadoAt: new Date(ahora).toISOString(),
    etapas,
    totalDetenidos: etapas.reduce((s, e) => s + e.detenidos, 0),
    totalCriticos: etapas.reduce((s, e) => s + e.criticos, 0),
  };
}

/* ───────────────────────── Avisos por Telegram ───────────────────────── */

const ROLES_PM = new Set(['pm_obra', 'pm', 'coordinador', 'project_manager']);
const ROLES_COMPRADOR = new Set(['comprador', 'compras', 'procura']);
const ROLES_LOGISTICA = new Set(['logistica']);

export function textoEdad(horas: number): string {
  if (horas < 24) return `${Math.max(1, Math.round(horas))} h`;
  const d = Math.floor(horas / 24);
  return `${d} día${d === 1 ? '' : 's'}`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type Destinatario = { chatId: string; nombre: string | null };

/** A quién avisar por cada ítem detenido (con caché por obra). */
async function crearResolutor(supabase: SupabaseClient) {
  const cache = new Map<string, Promise<PersonaNominaTelegram[]>>();
  const memo = (k: string, f: () => Promise<PersonaNominaTelegram[]>) => {
    if (!cache.has(k)) cache.set(k, f().catch(() => []));
    return cache.get(k)!;
  };
  const admins = memo('admins', async () =>
    (await listarAdministradoresSistemaTelegram(supabase)).map((a) => ({
      chatId: a.chatId,
      nombre: a.nombre,
      rol: 'administrador',
    })),
  );

  const porRol = async (rol: RolResponsable, item: ItemCuello): Promise<PersonaNominaTelegram[]> => {
    const pid = item.proyectoId;
    if (rol === 'remitente') {
      return item.chatOrigen ? [{ chatId: item.chatOrigen, nombre: null, rol: 'remitente' }] : [];
    }
    if (rol === 'depositario') {
      if (!pid) return [];
      return memo(`dep:${pid}`, async () => (await encargadosAlmacenObra(supabase, pid)).personas);
    }
    const roles = rol === 'pm' ? ROLES_PM : rol === 'comprador' ? ROLES_COMPRADOR : ROLES_LOGISTICA;
    const deObra = pid ? await memo(`${rol}:${pid}`, () => personasNominaConRol(supabase, pid, roles)) : [];
    if (deObra.length) return deObra;
    if (rol === 'comprador' && item.chatOrigen) {
      return [{ chatId: item.chatOrigen, nombre: null, rol: 'comprador' }];
    }
    return [];
  };

  return async (etapa: DefinicionEtapa, item: ItemCuello): Promise<Destinatario[]> => {
    const out = new Map<string, Destinatario>();
    for (const rol of etapa.roles) {
      for (const p of await porRol(rol, item)) out.set(p.chatId, { chatId: p.chatId, nombre: p.nombre });
    }
    // Nadie en la obra para este paso, o ya va por el doble del plazo: administración.
    if (!out.size || item.critico) {
      for (const a of await admins) if (!out.has(a.chatId)) out.set(a.chatId, { chatId: a.chatId, nombre: a.nombre });
    }
    return Array.from(out.values());
  };
}

export type ResultadoAvisos = {
  detenidos: number;
  destinatarios: number;
  enviados: number;
  errores: number;
};

const MAX_LINEAS_POR_ETAPA = 12;

/**
 * Un solo mensaje por persona con todo lo que tiene detenido, agrupado por etapa.
 * Pensado para correr una vez al día (cron) o a mano desde el centro.
 */
export async function enviarAvisosCuellosBotella(
  supabase: SupabaseClient,
  opts?: {
    resumen?: ResumenCuellos;
    enviar?: (chatId: string, html: string) => Promise<void>;
    baseUrl?: string;
  },
): Promise<ResultadoAvisos> {
  const resumen = opts?.resumen ?? (await calcularCuellosBotella(supabase));
  const resolver = await crearResolutor(supabase);
  const bandejas = new Map<string, { nombre: string | null; porEtapa: Map<ClaveEtapa, ItemCuello[]> }>();

  let detenidos = 0;
  for (const etapa of resumen.etapas) {
    for (const item of etapa.items) {
      if (!item.detenido) continue;
      detenidos += 1;
      for (const d of await resolver(etapa, item)) {
        const b = bandejas.get(d.chatId) ?? { nombre: d.nombre, porEtapa: new Map() };
        const lista = b.porEtapa.get(etapa.clave) ?? [];
        lista.push(item);
        b.porEtapa.set(etapa.clave, lista);
        bandejas.set(d.chatId, b);
      }
    }
  }

  const base = (opts?.baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://casainteligente.company')
    .trim()
    .replace(/\/$/, '');
  const enviar =
    opts?.enviar ??
    (async (chatId: string, html: string) => {
      const { sendTelegramMessage } = await import('@/lib/telegram/botApi');
      await sendTelegramMessage(chatId, html, {
        parse_mode: 'HTML',
        contextoLogEspejo: '[Cuellos de botella · aviso diario]',
      });
    });

  let enviados = 0;
  let errores = 0;
  for (const [chatId, b] of Array.from(bandejas.entries())) {
    const total = Array.from(b.porEtapa.values()).reduce((s, l) => s + l.length, 0);
    const partes: string[] = [`⏳ <b>Tiene ${total} pendiente${total === 1 ? '' : 's'} detenido${total === 1 ? '' : 's'}</b>`];
    for (const etapa of ETAPAS_CUELLO) {
      const lista = b.porEtapa.get(etapa.clave);
      if (!lista?.length) continue;
      partes.push('', `<b>${escHtml(etapa.titulo)}</b> <i>(más de ${textoEdad(etapa.umbralHoras)})</i>`);
      for (const it of lista.slice(0, MAX_LINEAS_POR_ETAPA)) {
        const obra = it.obra ? ` · ${escHtml(it.obra)}` : '';
        const marca = it.critico ? '🔴' : '🟠';
        partes.push(
          `${marca} ${escHtml(it.referencia)}${it.detalle ? ` · ${escHtml(it.detalle.slice(0, 80))}` : ''}${obra} — <b>${textoEdad(it.horas)}</b>`,
        );
      }
      if (lista.length > MAX_LINEAS_POR_ETAPA) partes.push(`… y ${lista.length - MAX_LINEAS_POR_ETAPA} más`);
    }
    partes.push('', `<a href="${base}/compras/cuellos-botella">Abrir centro de cuellos de botella</a>`);
    try {
      await enviar(chatId, partes.join('\n'));
      enviados += 1;
    } catch (e) {
      errores += 1;
      console.warn('[cuellosBotella] aviso', chatId, e);
    }
  }

  return { detenidos, destinatarios: bandejas.size, enviados, errores };
}
