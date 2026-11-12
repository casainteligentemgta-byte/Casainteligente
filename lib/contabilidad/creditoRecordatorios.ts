import type { SupabaseClient } from '@supabase/supabase-js';
import { todayIsoVenezuela } from '@/lib/contabilidad/comprasFiltros';
import { sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  creditoVisibleEnAlcance,
  formatearUsdCorto,
  htmlAnexoCreditosVencidos,
  tecladoPagadoCredito,
  textoPlazoCredito,
  tipoRecordatorioCredito,
  type AlcanceEntidadesCredito,
  type CreditoAbierto,
  type TipoRecordatorioCredito,
} from '@/lib/contabilidad/creditoPagos';
import {
  alcanceEntidadesCreditoTelegram,
  listarCreditosAbiertos,
} from '@/lib/contabilidad/creditoPagosDb';
import {
  listarAdministradoresSistemaTelegram,
  listarUsuariosOrdenCompraTelegram,
  usuarioEsAdministradorProcura,
} from '@/lib/compras/usuariosSistemaTelegram';
import { personasNominaConRol } from '@/lib/almacen/depositariosNomina';

const ROLES_NOMINA_RESPONSABLE = new Set(['comprador', 'compras', 'admin', 'administrador', 'contador']);

export type ResultadoRecordatoriosCredito = {
  revisados: number;
  candidatos: number;
  enviados: number;
  omitidos: number;
  errores: number;
};

function tablaAusente(message: string | undefined): boolean {
  return /does not exist|42P01|schema cache/i.test(String(message ?? ''));
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mensajeRecordatorioCredito(c: CreditoAbierto, tipo: TipoRecordatorioCredito): string {
  const urgencia = tipo === 'vencido' ? '🔴' : tipo === 'vencimiento' ? '🟠' : '🟡';
  const titulo =
    tipo === 'vencido' ? 'Crédito vencido' : tipo === 'vencimiento' ? 'Crédito vence hoy' : 'Crédito vence en 3 días';
  return (
    `${urgencia} <b>${titulo}</b>\n` +
    `${escHtml(c.proveedor)} · #${escHtml(c.numeroFactura)} · ${escHtml(c.entidadNombre)}\n` +
    `US$${formatearUsdCorto(c.saldoUsd)} · ${escHtml(textoPlazoCredito(c.diasHasta))}`
  );
}

export function creditosParaRecordarHoy(
  items: CreditoAbierto[],
  incluirVencidos: boolean,
): Array<{ credito: CreditoAbierto; tipo: TipoRecordatorioCredito }> {
  const out: Array<{ credito: CreditoAbierto; tipo: TipoRecordatorioCredito }> = [];
  for (const c of items) {
    const tipo = tipoRecordatorioCredito(c.diasHasta);
    if (!tipo) continue;
    if (tipo === 'vencido' && !incluirVencidos) continue;
    if (tipo === '3_dias' || tipo === 'vencimiento' || tipo === 'vencido') {
      out.push({ credito: c, tipo });
    }
  }
  return out;
}

type DestinoRecordatorio = {
  chatId: string;
  nombre: string | null;
  alcance: AlcanceEntidadesCredito;
};

async function cargarDestinosSistema(
  supabase: SupabaseClient,
): Promise<DestinoRecordatorio[]> {
  const out: DestinoRecordatorio[] = [];
  try {
    for (const u of await listarUsuariosOrdenCompraTelegram(supabase)) {
      const chatId = String(u.telegram_id);
      if (!chatId) continue;
      if (usuarioEsAdministradorProcura(u)) {
        out.push({ chatId, nombre: u.nombre, alcance: { todas: true, entidadIds: [] } });
        continue;
      }
      const alcance = await alcanceEntidadesCreditoTelegram(supabase, chatId, u);
      out.push({ chatId, nombre: u.nombre, alcance });
    }
  } catch (e) {
    console.warn('[credito recordatorio] compradores sistema', e);
  }
  return out;
}

export async function listarResponsablesCredito(
  supabase: SupabaseClient,
  credito: CreditoAbierto,
  destinosSistema?: DestinoRecordatorio[],
): Promise<Array<{ chatId: string; nombre: string | null }>> {
  const destinos = new Map<string, { chatId: string; nombre: string | null }>();
  const add = (chatId: string, nombre: string | null) => {
    const id = String(chatId).trim();
    if (!id) return;
    if (!destinos.has(id)) destinos.set(id, { chatId: id, nombre });
  };

  const sistema = destinosSistema ?? (await cargarDestinosSistema(supabase));
  for (const d of sistema) {
    if (creditoVisibleEnAlcance(credito.entidadId, d.alcance)) add(d.chatId, d.nombre);
  }

  if (credito.proyectoId) {
    try {
      for (const p of await personasNominaConRol(supabase, credito.proyectoId, ROLES_NOMINA_RESPONSABLE)) {
        add(p.chatId, p.nombre);
      }
    } catch (e) {
      console.warn('[credito recordatorio] nómina', e);
    }
  }

  if (credito.entidadId) {
    try {
      const { data: obras } = await supabase
        .from('ci_proyectos')
        .select('id')
        .eq('entidad_id', credito.entidadId);
      for (const o of obras ?? []) {
        const pid = String((o as { id?: string }).id ?? '');
        if (!pid || pid === credito.proyectoId) continue;
        for (const p of await personasNominaConRol(supabase, pid, ROLES_NOMINA_RESPONSABLE)) {
          add(p.chatId, p.nombre);
        }
      }
    } catch (e) {
      console.warn('[credito recordatorio] obras entidad', e);
    }
  }

  if (!destinos.size) {
    try {
      for (const a of await listarAdministradoresSistemaTelegram(supabase)) add(a.chatId, a.nombre);
    } catch (e) {
      console.warn('[credito recordatorio] admins', e);
    }
  }
  return Array.from(destinos.values());
}

async function marcarEnviado(
  supabase: SupabaseClient,
  purchaseInvoiceId: string,
  tipo: TipoRecordatorioCredito,
  hoy: string,
  chatId: string,
): Promise<boolean> {
  const { error } = await supabase.from('contabilidad_credito_recordatorios').insert({
    purchase_invoice_id: purchaseInvoiceId,
    tipo,
    enviado_el: hoy,
    chat_id: chatId,
  });
  if (!error) return true;
  if (/duplicate|unique|23505/i.test(error.message)) return false;
  if (tablaAusente(error.message)) return true;
  console.warn('[credito recordatorio] log', error.message);
  return true;
}

export async function enviarRecordatoriosCredito(
  supabase: SupabaseClient,
  opts?: { hoyIso?: string; incluirVencidos?: boolean },
): Promise<ResultadoRecordatoriosCredito> {
  const hoy = opts?.hoyIso ?? todayIsoVenezuela();
  const incluirVencidos = opts?.incluirVencidos ?? false;
  const result: ResultadoRecordatoriosCredito = {
    revisados: 0,
    candidatos: 0,
    enviados: 0,
    omitidos: 0,
    errores: 0,
  };

  let abiertos: CreditoAbierto[] = [];
  try {
    abiertos = await listarCreditosAbiertos(supabase, { todas: true, entidadIds: [] }, hoy);
  } catch (e) {
    console.warn('[credito recordatorio] listar', e);
    return result;
  }
  result.revisados = abiertos.length;
  const candidatos = creditosParaRecordarHoy(abiertos, incluirVencidos);
  result.candidatos = candidatos.length;
  const destinosSistema = await cargarDestinosSistema(supabase);

  for (const { credito, tipo } of candidatos) {
    const responsables = await listarResponsablesCredito(supabase, credito, destinosSistema);
    if (!responsables.length) {
      result.omitidos += 1;
      continue;
    }
    const html = mensajeRecordatorioCredito(credito, tipo);
    const teclado = tecladoPagadoCredito(credito);
    for (const r of responsables) {
      const nuevo = await marcarEnviado(supabase, credito.purchaseInvoiceId, tipo, hoy, r.chatId);
      if (!nuevo) {
        result.omitidos += 1;
        continue;
      }
      try {
        await sendTelegramMessage(r.chatId, html, {
          parse_mode: 'HTML',
          reply_markup: teclado,
          contextoLogEspejo: '[Contabilidad · recordatorio crédito]',
        });
        result.enviados += 1;
      } catch (e) {
        result.errores += 1;
        console.warn('[credito recordatorio] envío', r.chatId, e);
      }
    }
  }
  return result;
}

/** Texto corto para el aviso diario de cuellos de botella. */
export async function anexoCreditosVencidosDiario(
  supabase: SupabaseClient,
  hoyIso = todayIsoVenezuela(),
): Promise<string> {
  try {
    const abiertos = await listarCreditosAbiertos(supabase, { todas: true, entidadIds: [] }, hoyIso);
    return htmlAnexoCreditosVencidos(abiertos);
  } catch (e) {
    console.warn('[credito] anexo diario', e);
    return '';
  }
}
