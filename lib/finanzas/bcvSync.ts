import type { SupabaseClient } from '@supabase/supabase-js';
import { enviarTelegramHtml } from '@/lib/alerts/telegramParadojaCeo';
import {
  FUENTE_BCV_OFICIAL,
  fechaAlmacenamientoTasaBcv,
  hoyIsoCaracas,
  type ParseoBcvOficial,
} from '@/lib/finanzas/bcvOficial';
import { obtenerTasaOficialBcv } from '@/lib/finanzas/bcvOficialFetch';
import {
  leerTasaBcvPorFecha,
  tasaDesdeAgregadorPorFecha,
  type FilaTasaBcv,
  type FuenteTasaBcv,
} from '@/lib/finanzas/bcvTasaPorFecha';
import { notifyErrorBot } from '@/lib/telegram/notifyErrorBot';
import { resolverChatAdministracion } from '@/lib/telegram/chatAdministracion';

export type CandidatoTasaBcv = {
  fecha: string;
  usd: number;
  fuente: string;
  fecha_valor: string | null;
};

export type MotivoAlertaTasaBcv = 'sin_tasa_hoy' | 'fallback' | null;

export type ResultadoSyncTasaBcv = {
  ok: boolean;
  hoy: string;
  oficial: ParseoBcvOficial | null;
  errorOficial: string | null;
  upserts: CandidatoTasaBcv[];
  filaHoy: FilaTasaBcv | null;
  alerta: MotivoAlertaTasaBcv;
  alertaEnviada: boolean;
};

export function decidirUpsertTasaBcv(params: {
  existente: { fuente: string } | null | undefined;
  candidato: CandidatoTasaBcv;
}): 'insert' | 'update' | 'keep' {
  if (!params.existente) return 'insert';
  if (params.existente.fuente === FUENTE_BCV_OFICIAL && params.candidato.fuente !== FUENTE_BCV_OFICIAL) {
    return 'keep';
  }
  return 'update';
}

export function debeAlertarSyncTasaBcv(params: {
  filaHoy: { fuente: string } | null | undefined;
}): MotivoAlertaTasaBcv {
  if (!params.filaHoy) return 'sin_tasa_hoy';
  if (params.filaHoy.fuente !== FUENTE_BCV_OFICIAL) return 'fallback';
  return null;
}

export function mensajeAlertaTasaBcv(opts: {
  hoy: string;
  motivo: Exclude<MotivoAlertaTasaBcv, null>;
  filaHoy?: FilaTasaBcv | null;
  errorOficial?: string | null;
}): string {
  if (opts.motivo === 'sin_tasa_hoy') {
    return (
      `⚠️ <b>Tasa BCV</b>\n` +
      `No hay tasa oficial para <b>${opts.hoy}</b> (America/Caracas).\n` +
      (opts.errorOficial ? `Portada BCV: ${opts.errorOficial}\n` : '') +
      `No usar una tasa vieja como si fuera la de hoy.`
    );
  }
  const usd = opts.filaHoy?.usd != null ? String(opts.filaHoy.usd) : '—';
  return (
    `⚠️ <b>Tasa BCV por respaldo</b>\n` +
    `Hoy ${opts.hoy}: ${usd} Bs/USD (fuente <code>${opts.filaHoy?.fuente ?? '—'}</code>).\n` +
    (opts.errorOficial ? `Portada BCV: ${opts.errorOficial}\n` : '') +
    `No se pudo leer www.bcv.org.ve; se guardó un agregador.`
  );
}

function tablaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /ci_tasas_bcv/i.test(error.message ?? '');
}

export async function upsertTasaBcv(
  supabase: SupabaseClient,
  candidato: CandidatoTasaBcv,
): Promise<'insert' | 'update' | 'keep'> {
  const existente = await leerTasaBcvPorFecha(supabase, candidato.fecha);
  const decision = decidirUpsertTasaBcv({ existente, candidato });
  if (decision === 'keep') return 'keep';
  const { error } = await supabase.from('ci_tasas_bcv').upsert(
    {
      fecha: candidato.fecha,
      usd: candidato.usd,
      fuente: candidato.fuente,
      fecha_valor: candidato.fecha_valor,
    },
    { onConflict: 'fecha' },
  );
  if (error) {
    if (tablaAusente(error)) {
      throw new Error('Falta la tabla ci_tasas_bcv. Ejecuta la migración 402 en Supabase.');
    }
    throw new Error(error.message);
  }
  return decision;
}

export async function alertarTasaBcvAdmin(
  supabase: SupabaseClient,
  textoHtml: string,
): Promise<boolean> {
  let enviada = false;
  try {
    const destino = await resolverChatAdministracion(supabase);
    if (destino.chatId) {
      const tg = await enviarTelegramHtml(textoHtml, destino.chatId);
      if (tg.ok) enviada = true;
    }
  } catch (e) {
    console.warn('[bcv-sync] alerta admin', e instanceof Error ? e.message : e);
  }
  try {
    const ok = await notifyErrorBot(textoHtml.replace(/<[^>]+>/g, ''), { origen: 'Tasa BCV' });
    if (ok) enviada = true;
  } catch (e) {
    console.warn('[bcv-sync] alerta log bot', e instanceof Error ? e.message : e);
  }
  return enviada;
}

function candidatoDesdeOficial(parsed: ParseoBcvOficial, hoy: string): CandidatoTasaBcv {
  const fecha = fechaAlmacenamientoTasaBcv({ fechaValor: parsed.fechaValor, hoy });
  return {
    fecha,
    usd: parsed.usd,
    fuente: FUENTE_BCV_OFICIAL,
    fecha_valor: parsed.fechaValor,
  };
}

/**
 * Sync diario: portada BCV (oficial) y, si falta la de hoy, agregadores por fecha.
 * No escribe una tasa vieja como si fuera de hoy.
 */
export async function sincronizarTasaBcvDiaria(
  supabase: SupabaseClient,
  opts?: { now?: Date; alertar?: boolean },
): Promise<ResultadoSyncTasaBcv> {
  const hoy = hoyIsoCaracas(opts?.now);
  const upserts: CandidatoTasaBcv[] = [];
  let oficial: ParseoBcvOficial | null = null;
  let errorOficial: string | null = null;

  try {
    oficial = await obtenerTasaOficialBcv();
  } catch (e) {
    errorOficial = e instanceof Error ? e.message : String(e);
    console.warn('[bcv-sync] portada BCV', errorOficial);
  }

  if (oficial) {
    const cand = candidatoDesdeOficial(oficial, hoy);
    await upsertTasaBcv(supabase, cand);
    upserts.push(cand);
  }

  let filaHoy = await leerTasaBcvPorFecha(supabase, hoy);
  if (!filaHoy) {
    const fb = await tasaDesdeAgregadorPorFecha(hoy);
    if (fb) {
      const cand: CandidatoTasaBcv = {
        fecha: hoy,
        usd: fb.tasa_bcv_ves_por_usd,
        fuente: fb.fuente,
        fecha_valor: fb.fecha_valor ?? hoy,
      };
      await upsertTasaBcv(supabase, cand);
      upserts.push(cand);
      filaHoy = await leerTasaBcvPorFecha(supabase, hoy);
    }
  }

  const alerta = debeAlertarSyncTasaBcv({ filaHoy });
  let alertaEnviada = false;
  if (alerta && opts?.alertar !== false) {
    const texto = mensajeAlertaTasaBcv({
      hoy,
      motivo: alerta,
      filaHoy,
      errorOficial,
    });
    alertaEnviada = await alertarTasaBcvAdmin(supabase, texto);
  }

  return {
    ok: Boolean(filaHoy) || upserts.length > 0,
    hoy,
    oficial,
    errorOficial,
    upserts,
    filaHoy,
    alerta,
    alertaEnviada,
  };
}

export type { FilaTasaBcv, FuenteTasaBcv };
