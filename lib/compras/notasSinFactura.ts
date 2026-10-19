import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Notas de entrega (y emergencias) registradas en almacén que todavía no tienen factura.
 * Regla acordada: alerta a partir de 5 días continuos sin factura, cada lunes, al comprador
 * y al contador por Telegram.
 */

export const DIAS_ALERTA_NOTA_SIN_FACTURA = 5;
const MS_DIA = 24 * 60 * 60 * 1000;

export type NotaSinFactura = {
  id: string;
  proyecto_id: string | null;
  proveedor_nombre: string | null;
  tipo: string;
  num_doc: string | null;
  created_at: string;
};

/** Fecha límite: notas creadas antes de esta fecha llevan al menos `dias` días continuos. */
export function fechaCorteAlerta(ahora: Date, dias = DIAS_ALERTA_NOTA_SIN_FACTURA): Date {
  return new Date(ahora.getTime() - dias * MS_DIA);
}

/** Días continuos transcurridos desde la creación de la nota (entero, redondeado hacia abajo). */
export function diasTranscurridos(createdAt: string, ahora: Date): number {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((ahora.getTime() - t) / MS_DIA));
}

export function esNotaEnAlerta(createdAt: string, ahora: Date, dias = DIAS_ALERTA_NOTA_SIN_FACTURA): boolean {
  return diasTranscurridos(createdAt, ahora) >= dias;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Mensaje agrupado por obra, con los días sin factura de cada nota. */
export function construirMensajeNotasSinFactura(
  notas: Array<NotaSinFactura & { obra: string | null; dias: number }>,
  baseUrl: string,
): string {
  const total = notas.length;
  const partes: string[] = [
    `🧾 <b>${total} nota${total === 1 ? '' : 's'} de entrega sin factura</b> (${DIAS_ALERTA_NOTA_SIN_FACTURA} días continuos o más)`,
  ];
  const porObra = new Map<string, typeof notas>();
  for (const n of notas) {
    const clave = n.obra?.trim() || 'Sin obra';
    porObra.set(clave, [...(porObra.get(clave) ?? []), n]);
  }
  for (const [obra, lista] of Array.from(porObra.entries())) {
    partes.push('', `<b>${escHtml(obra)}</b>`);
    for (const n of lista) {
      const doc = n.num_doc?.trim() ? escHtml(n.num_doc.trim()) : 'Nota sin número';
      const prov = n.proveedor_nombre?.trim() ? ` · ${escHtml(n.proveedor_nombre.trim())}` : '';
      partes.push(`🟠 ${doc}${prov} — <b>${n.dias} días</b> sin factura`);
    }
  }
  partes.push(
    '',
    'Puede conciliarla con su factura, registrar una devolución o dejar una observación.',
    `<a href="${baseUrl}/contabilidad/compras">Abrir Contabilidad</a>`,
  );
  return partes.join('\n');
}

/** Notas registradas, en estado registrado, sin factura enlazada y con al menos N días. */
export async function listarNotasSinFacturaEnAlerta(
  supabase: SupabaseClient,
  ahora: Date = new Date(),
): Promise<Array<NotaSinFactura & { obra: string | null; dias: number }>> {
  const { data, error } = await supabase
    .from('ci_recepciones_campo')
    .select('id, proyecto_id, proveedor_nombre, tipo, num_doc, created_at')
    .eq('estado', 'registrado')
    .is('factura_canal_pendiente_id', null)
    .in('tipo', ['nota_entrega', 'emergencia'])
    .lt('created_at', fechaCorteAlerta(ahora).toISOString())
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const filas = (data ?? []) as NotaSinFactura[];
  const ids = Array.from(new Set(filas.map((f) => f.proyecto_id).filter(Boolean))) as string[];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const { data: obras } = await supabase.from('ci_proyectos').select('id, nombre').in('id', ids);
    for (const o of (obras ?? []) as Array<{ id: string; nombre: string }>) nombres.set(o.id, o.nombre);
  }

  return filas
    .filter((f) => esNotaEnAlerta(f.created_at, ahora))
    .map((f) => ({
      ...f,
      obra: f.proyecto_id ? (nombres.get(f.proyecto_id) ?? null) : null,
      dias: diasTranscurridos(f.created_at, ahora),
    }));
}

/** Chats de Telegram del comprador y del contador (Administrador es alias legado del contador). */
export async function destinatariosNotasSinFactura(
  supabase: SupabaseClient,
): Promise<Array<{ chatId: string; nombre: string | null }>> {
  const { data, error } = await supabase
    .from('ci_usuarios_sistema_telegram')
    .select('telegram_id, nombre, rol')
    .eq('activo', true)
    .in('rol', ['Comprador', 'Contador', 'Administrador']);
  if (error) throw new Error(error.message);
  const out = new Map<string, { chatId: string; nombre: string | null }>();
  for (const r of (data ?? []) as Array<{ telegram_id: string | number | null; nombre: string | null }>) {
    if (r.telegram_id == null) continue;
    const chatId = String(r.telegram_id);
    if (!out.has(chatId)) out.set(chatId, { chatId, nombre: r.nombre ?? null });
  }
  return Array.from(out.values());
}

export type ResultadoAlertaNotasSinFactura = {
  notas: number;
  destinatarios: number;
  enviados: number;
  errores: number;
};

/** Envía la alerta. Si no hay notas en alerta, no envía nada. */
export async function enviarAlertaNotasSinFactura(
  supabase: SupabaseClient,
  opts?: {
    ahora?: Date;
    baseUrl?: string;
    enviar?: (chatId: string, html: string) => Promise<void>;
  },
): Promise<ResultadoAlertaNotasSinFactura> {
  const ahora = opts?.ahora ?? new Date();
  const notas = await listarNotasSinFacturaEnAlerta(supabase, ahora);
  if (!notas.length) return { notas: 0, destinatarios: 0, enviados: 0, errores: 0 };

  const destinatarios = await destinatariosNotasSinFactura(supabase);
  const base = (opts?.baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://casainteligente.company')
    .trim()
    .replace(/\/$/, '');
  const html = construirMensajeNotasSinFactura(notas, base);

  const enviar =
    opts?.enviar ??
    (async (chatId: string, texto: string) => {
      const { sendTelegramMessage } = await import('@/lib/telegram/botApi');
      await sendTelegramMessage(chatId, texto, {
        parse_mode: 'HTML',
        contextoLogEspejo: '[Notas sin factura · aviso semanal]',
      });
    });

  let enviados = 0;
  let errores = 0;
  for (const d of destinatarios) {
    try {
      await enviar(d.chatId, html);
      enviados += 1;
    } catch (e) {
      errores += 1;
      console.warn('[notasSinFactura] aviso', d.chatId, e);
    }
  }
  return { notas: notas.length, destinatarios: destinatarios.length, enviados, errores };
}
