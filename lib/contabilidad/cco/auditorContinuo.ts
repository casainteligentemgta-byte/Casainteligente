/**
 * Auditor continuo CCO: revisión de tablas (higiene) + contratos + caja.
 * Solo lectura / dry-run; notifica al bot ERP Casa Inteligente si hay hallazgos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cargarAlertasConfig,
  canalAdminTelegramDesdeEnv,
} from '@/lib/alertas/alertasConfig';
import { conciliarContratosPorProveedor } from '@/lib/contabilidad/cco/conciliacionContratos';
import { cargarJerarquiaContratos } from '@/lib/contabilidad/cco/contratosJerarquia';
import { calcularKpisOficiales } from '@/lib/contabilidad/cco/kpisOficiales';
import { limpiarDescuadreCco } from '@/lib/contabilidad/cco/limpiarDescuadreCco';
import { obtenerConfigCco } from '@/lib/contabilidad/cco/proyectoConfig';
import {
  getTelegramAllowedChatIds,
  getTelegramBotToken,
  sendTelegramMessage,
} from '@/lib/telegram/botApi';

export type CcoHallazgoSeveridad = 'alta' | 'media' | 'baja';

export type CcoHallazgo = {
  codigo: string;
  severidad: CcoHallazgoSeveridad;
  titulo: string;
  detalle: string;
  meta?: Record<string, unknown>;
};

export type CcoAuditorContinuoObra = {
  proyecto_id: string;
  obra_label: string;
  ok: boolean;
  hallazgos: CcoHallazgo[];
  resumen: {
    higiene_auditoria: number;
    higiene_duplicados: number;
    higiene_ingresos_gemelos: number;
    devaluacion_a_corregir: boolean;
    contratos_pagados_de_mas: number;
    contratos_con_anticipo: number;
    pagos_huerfanos: number;
    saldo_caja: number | null;
  };
  error?: string;
};

export type CcoAuditorContinuoResult = {
  ok: boolean;
  revisadas: number;
  con_hallazgos: number;
  total_hallazgos: number;
  obras: CcoAuditorContinuoObra[];
  notificado: boolean;
  notify_razon: string;
  evento_ids: string[];
};

const UMBRAL_PAGADO_DE_MAS_USD = 1;
const UMBRAL_ANTICIPO_USD = 500;
const UMBRAL_SALDO_CAJA_NEG_USD = -1;

function baseUrlApp(): string {
  const u = (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  return u || '';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

async function labelObra(
  supabase: SupabaseClient,
  proyectoId: string,
  alias: string | null | undefined,
): Promise<string> {
  if (alias?.trim()) return alias.trim();
  try {
    const { data } = await supabase
      .from('ci_proyectos')
      .select('nombre, codigo')
      .eq('id', proyectoId)
      .maybeSingle();
    const nombre = String((data as { nombre?: string } | null)?.nombre ?? '').trim();
    const codigo = String((data as { codigo?: string } | null)?.codigo ?? '').trim();
    if (nombre) return codigo ? `${codigo} · ${nombre}` : nombre;
  } catch {
    /* ignore */
  }
  return `Obra ${proyectoId.slice(0, 8)}`;
}

async function saldoCajaRapido(
  supabase: SupabaseClient,
  proyectoId: string,
  honorariosPct: number,
): Promise<number | null> {
  try {
    const [{ data: ingresos }, { data: gastos }] = await Promise.all([
      supabase
        .from('ci_inyecciones_capital')
        .select('monto_usd')
        .eq('proyecto_id', proyectoId)
        .limit(5000),
      supabase
        .from('contabilidad_compras')
        .select(
          'monto_usd,monto_ves,tasa_bcv_ves_por_usd,tasa_binance,moneda_original,honorarios_usd,admin_pct_override,cco_estado,porcentaje_brecha_real',
        )
        .eq('proyecto_id', proyectoId)
        .limit(8000),
    ]);
    const ingresosUsd = (ingresos ?? []).map((r) =>
      Number((r as { monto_usd?: number | null }).monto_usd) || 0,
    );
    const kpis = calcularKpisOficiales({
      ingresosUsd,
      gastos: (gastos ?? []) as Parameters<typeof calcularKpisOficiales>[0]['gastos'],
      honorariosPctGlobal: honorariosPct,
    });
    return kpis.saldoCaja;
  } catch {
    return null;
  }
}

/** Revisa una obra CCO (solo lectura). */
export async function auditarObraCco(
  supabase: SupabaseClient,
  proyectoId: string,
): Promise<CcoAuditorContinuoObra> {
  const hallazgos: CcoHallazgo[] = [];
  const resumen = {
    higiene_auditoria: 0,
    higiene_duplicados: 0,
    higiene_ingresos_gemelos: 0,
    devaluacion_a_corregir: false,
    contratos_pagados_de_mas: 0,
    contratos_con_anticipo: 0,
    pagos_huerfanos: 0,
    saldo_caja: null as number | null,
  };

  try {
    const config = await obtenerConfigCco(supabase, proyectoId);
    const obraLabel = await labelObra(supabase, proyectoId, config.obra_alias);

    const higiene = await limpiarDescuadreCco(supabase, {
      proyectoId,
      dryRun: true,
    });
    resumen.higiene_auditoria = higiene.auditoriaEliminada;
    resumen.higiene_duplicados = higiene.duplicadosEliminados;
    resumen.higiene_ingresos_gemelos = higiene.ingresosGemelosEliminados;
    resumen.devaluacion_a_corregir = higiene.devaluacionCorregida;

    if (higiene.auditoriaEliminada > 0) {
      hallazgos.push({
        codigo: 'higiene_auditoria_como_gasto',
        severidad: 'alta',
        titulo: 'Bitácora CCO importada como gasto',
        detalle: `${higiene.auditoriaEliminada} fila(s) parecen auditoría V4 cargada como compra. Use Ajustes → Reparar descuadre.`,
        meta: { count: higiene.auditoriaEliminada },
      });
    }
    if (higiene.duplicadosEliminados > 0) {
      hallazgos.push({
        codigo: 'higiene_gastos_duplicados',
        severidad: 'alta',
        titulo: 'Gastos gemelos / duplicados',
        detalle: `${higiene.duplicadosEliminados} gasto(s) duplicado(s) detectado(s) (mismo día/proveedor/monto/concepto).`,
        meta: { count: higiene.duplicadosEliminados },
      });
    }
    if (higiene.ingresosGemelosEliminados > 0) {
      hallazgos.push({
        codigo: 'higiene_ingresos_gemelos',
        severidad: 'media',
        titulo: 'Ingresos gemelos',
        detalle: `${higiene.ingresosGemelosEliminados} inyección(es) duplicada(s) (operador/abono).`,
        meta: { count: higiene.ingresosGemelosEliminados },
      });
    }
    if (higiene.devaluacionCorregida) {
      hallazgos.push({
        codigo: 'higiene_devaluacion',
        severidad: 'media',
        titulo: 'Devaluación con signo incorrecto',
        detalle: `Config devaluación ${higiene.devaluacionAntes}% → debería ser ${higiene.devaluacionDespues}% (forma V4).`,
        meta: {
          antes: higiene.devaluacionAntes,
          despues: higiene.devaluacionDespues,
        },
      });
    }
    if (higiene.errores.length) {
      hallazgos.push({
        codigo: 'higiene_errores',
        severidad: 'media',
        titulo: 'Errores al revisar higiene',
        detalle: higiene.errores.slice(0, 3).join(' · '),
      });
    }

    const jer = await cargarJerarquiaContratos(supabase, proyectoId);
    resumen.pagos_huerfanos = jer.huerfanos.length;
    const { filas } = conciliarContratosPorProveedor(jer.porProveedor);

    for (const f of filas) {
      if (f.montoPagadoDeMas >= UMBRAL_PAGADO_DE_MAS_USD) {
        resumen.contratos_pagados_de_mas += 1;
        hallazgos.push({
          codigo: 'contrato_pagado_de_mas',
          severidad: 'alta',
          titulo: `Pagado de más: ${f.proveedor}`,
          detalle: `Pagado ${fmtUsd(f.montoPagado)} vs acordado ${fmtUsd(f.montoAcordado)} (exceso ${fmtUsd(f.montoPagadoDeMas)}).`,
          meta: {
            proveedor: f.proveedor,
            pagado_de_mas: f.montoPagadoDeMas,
          },
        });
      } else if (f.totalAnticipado >= UMBRAL_ANTICIPO_USD) {
        resumen.contratos_con_anticipo += 1;
        hallazgos.push({
          codigo: 'contrato_anticipo_alto',
          severidad: 'media',
          titulo: `Anticipo alto: ${f.proveedor}`,
          detalle: `Anticipado ${fmtUsd(f.totalAnticipado)} (pagado sin ejecutar / por encima del avance).`,
          meta: {
            proveedor: f.proveedor,
            anticipado: f.totalAnticipado,
          },
        });
      }
    }

    if (jer.huerfanos.length > 0) {
      const montoHuerfanos = jer.huerfanos.reduce((a, p) => a + (Number(p.monto_usd) || 0), 0);
      hallazgos.push({
        codigo: 'pagos_contratista_huerfanos',
        severidad: jer.huerfanos.length >= 5 ? 'alta' : 'media',
        titulo: 'Pagos CONTRATISTA sin contrato',
        detalle: `${jer.huerfanos.length} pago(s) sin vincular (${fmtUsd(montoHuerfanos)}). Revise la pestaña Contratos.`,
        meta: { count: jer.huerfanos.length, monto_usd: montoHuerfanos },
      });
    }

    for (const p of jer.porProveedor) {
      for (const c of p.contratos) {
        if (!(Number(c.monto_base_usd) > 0) && !(Number(c.costo_total_usd) > 0)) {
          hallazgos.push({
            codigo: 'contrato_sin_monto',
            severidad: 'baja',
            titulo: 'Contrato sin monto',
            detalle: `${c.proveedor}: «${c.descripcion || c.id.slice(0, 8)}» tiene monto base 0.`,
            meta: { contrato_id: c.id },
          });
        }
      }
    }

    const saldo = await saldoCajaRapido(
      supabase,
      proyectoId,
      Number(config.honorarios_admin_pct) || 15,
    );
    resumen.saldo_caja = saldo;
    if (saldo != null && saldo < UMBRAL_SALDO_CAJA_NEG_USD) {
      hallazgos.push({
        codigo: 'saldo_caja_negativo',
        severidad: 'alta',
        titulo: 'Saldo en caja negativo',
        detalle: `Saldo oficial ${fmtUsd(saldo)} (ingresos − costo total). Revisar ingresos/gastos.`,
        meta: { saldo_caja: saldo },
      });
    }

    return {
      proyecto_id: proyectoId,
      obra_label: obraLabel,
      ok: true,
      hallazgos,
      resumen,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al auditar obra';
    return {
      proyecto_id: proyectoId,
      obra_label: `Obra ${proyectoId.slice(0, 8)}`,
      ok: false,
      hallazgos: [
        {
          codigo: 'error_revision',
          severidad: 'alta',
          titulo: 'No se pudo revisar la obra',
          detalle: msg,
        },
      ],
      resumen,
      error: msg,
    };
  }
}

/**
 * Destino del aviso: bot ERP Casa Inteligente (`TELEGRAM_BOT_TOKEN`).
 * Prioridad: TELEGRAM_CCO_CHAT_ID → canal admin (config/env) → TELEGRAM_CHAT_ID → whitelist única.
 */
export async function resolverChatBotErpCco(
  supabase: SupabaseClient,
): Promise<{ chatId: string | null; fuente: string }> {
  const cco = process.env.TELEGRAM_CCO_CHAT_ID?.trim();
  if (cco) return { chatId: cco, fuente: 'TELEGRAM_CCO_CHAT_ID' };

  try {
    const meta = await cargarAlertasConfig(supabase);
    if (meta.canalAdminEfectivo) {
      return {
        chatId: meta.canalAdminEfectivo,
        fuente: meta.config.telegram.canalAdminId
          ? 'ci_alertas_config.canal_admin_id'
          : 'TELEGRAM_ADMIN_CHANNEL_ID',
      };
    }
  } catch {
    const adminEnv = canalAdminTelegramDesdeEnv();
    if (adminEnv) return { chatId: adminEnv, fuente: 'TELEGRAM_ADMIN_CHANNEL_ID' };
  }

  const chatCeo = process.env.TELEGRAM_CHAT_ID?.trim();
  if (chatCeo) return { chatId: chatCeo, fuente: 'TELEGRAM_CHAT_ID' };

  const allowed = getTelegramAllowedChatIds();
  if (allowed.size === 1) {
    return {
      chatId: Array.from(allowed)[0] ?? null,
      fuente: 'TELEGRAM_ALLOWED_CHAT_IDS',
    };
  }

  return { chatId: null, fuente: 'sin_destino' };
}

export function construirMensajeTelegramAuditorCco(
  result: CcoAuditorContinuoResult,
): string {
  const base = baseUrlApp();
  const botUser = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || '';
  const lineas: string[] = [
    `🔎 <b>AUDITOR CCO — Casa Inteligente ERP</b>`,
    botUser ? `<i>Bot @${escapeHtml(botUser)}</i>` : '',
    '',
    `Obras revisadas: <b>${result.revisadas}</b>`,
    `Con hallazgos: <b>${result.con_hallazgos}</b>`,
    `Total hallazgos: <b>${result.total_hallazgos}</b>`,
    '',
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));

  for (const obra of result.obras.filter((o) => o.hallazgos.length > 0).slice(0, 8)) {
    const link = base
      ? `${base}/contabilidad/cco?proyecto=${encodeURIComponent(obra.proyecto_id)}&nav=auditoria`
      : '';
    lineas.push(`🏗 <b>${escapeHtml(obra.obra_label)}</b>`);
    for (const h of obra.hallazgos.slice(0, 6)) {
      const icon = h.severidad === 'alta' ? '🔴' : h.severidad === 'media' ? '🟡' : '⚪';
      lineas.push(
        `${icon} ${escapeHtml(h.titulo)} — ${escapeHtml(h.detalle.slice(0, 180))}`,
      );
    }
    if (obra.hallazgos.length > 6) {
      lineas.push(`… +${obra.hallazgos.length - 6} más`);
    }
    if (link) lineas.push(`🔗 ${escapeHtml(link)}`);
    lineas.push('');
  }

  lineas.push(
    `<i>Revisión automática CCO (tablas + contratos). Aviso del bot ERP solo si hay hallazgos.</i>`,
  );
  return lineas.join('\n');
}

async function notificarBotErpCco(
  supabase: SupabaseClient,
  result: CcoAuditorContinuoResult,
): Promise<{ ok: boolean; razon: string; chatId?: string }> {
  if (!getTelegramBotToken()) {
    return {
      ok: false,
      razon: 'TELEGRAM_BOT_TOKEN no configurado (bot Casa Inteligente ERP)',
    };
  }

  const dest = await resolverChatBotErpCco(supabase);
  if (!dest.chatId) {
    return {
      ok: false,
      razon:
        'Sin chat destino: configure TELEGRAM_CCO_CHAT_ID, TELEGRAM_ADMIN_CHANNEL_ID o TELEGRAM_CHAT_ID',
    };
  }

  const text = construirMensajeTelegramAuditorCco(result);
  try {
    await sendTelegramMessage(dest.chatId, text, {
      parse_mode: 'HTML',
      skipLogEspejo: false,
      contextoLogEspejo: 'Auditor CCO continuo',
      rolDestinatario: 'Admin / CCO',
      accionLogDestinatario: 'solo_notificacion',
    });
    return {
      ok: true,
      razon: `erp_bot_ok:${dest.fuente}`,
      chatId: dest.chatId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error_telegram';
    return {
      ok: false,
      razon: `erp_bot_error:${dest.fuente}: ${msg.slice(0, 200)}`,
      chatId: dest.chatId,
    };
  }
}

async function persistirEventos(
  supabase: SupabaseClient,
  obras: CcoAuditorContinuoObra[],
  actor: string,
): Promise<string[]> {
  const ids: string[] = [];
  const ahora = new Date().toISOString();

  for (const obra of obras) {
    const severidadMax = obra.hallazgos.some((h) => h.severidad === 'alta')
      ? 'alta'
      : obra.hallazgos.some((h) => h.severidad === 'media')
        ? 'media'
        : obra.hallazgos.length
          ? 'baja'
          : 'ok';

    const detalle =
      obra.hallazgos.length === 0
        ? 'Revisión OK · sin hallazgos'
        : `${obra.hallazgos.length} hallazgo(s) · severidad máx. ${severidadMax}`;

    const { data, error } = await supabase
      .from('cco_auditoria_eventos')
      .insert({
        proyecto_id: obra.proyecto_id,
        fecha: ahora,
        accion: 'AUDITOR CONTINUO',
        detalle,
        actor,
        metadata: {
          severidad_max: severidadMax,
          hallazgos: obra.hallazgos,
          resumen: obra.resumen,
          ok: obra.ok,
          error: obra.error ?? null,
        },
      })
      .select('id')
      .maybeSingle();

    if (!error && data?.id) ids.push(String(data.id));
  }

  return ids;
}

export type EjecutarAuditorContinuoOpts = {
  /** Si se indica, solo esa obra; si no, todas con cco_proyecto_config. */
  proyectoId?: string | null;
  /** Persistir en cco_auditoria_eventos (default true). */
  persistir?: boolean;
  /** Enviar Telegram si hay hallazgos (default true). */
  notificar?: boolean;
  actor?: string;
};

/** Ejecuta el auditor continuo (una obra o todas). */
export async function ejecutarAuditorContinuoCco(
  supabase: SupabaseClient,
  opts: EjecutarAuditorContinuoOpts = {},
): Promise<CcoAuditorContinuoResult> {
  const actor = opts.actor?.trim() || 'auditor_continuo';
  const persistir = opts.persistir !== false;
  const notificar = opts.notificar !== false;

  let proyectoIds: string[] = [];
  if (opts.proyectoId?.trim()) {
    proyectoIds = [opts.proyectoId.trim()];
  } else {
    const { data, error } = await supabase
      .from('cco_proyecto_config')
      .select('proyecto_id')
      .limit(500);
    if (error) throw error;
    proyectoIds = (data ?? []).map((r) =>
      String((r as { proyecto_id: string }).proyecto_id),
    );
  }

  const obras: CcoAuditorContinuoObra[] = [];
  for (const id of proyectoIds) {
    obras.push(await auditarObraCco(supabase, id));
  }

  const conHallazgos = obras.filter((o) => o.hallazgos.length > 0);
  const totalHallazgos = obras.reduce((a, o) => a + o.hallazgos.length, 0);

  let eventoIds: string[] = [];
  if (persistir && obras.length) {
    eventoIds = await persistirEventos(supabase, obras, actor);
  }

  const result: CcoAuditorContinuoResult = {
    ok: true,
    revisadas: obras.length,
    con_hallazgos: conHallazgos.length,
    total_hallazgos: totalHallazgos,
    obras,
    notificado: false,
    notify_razon: 'sin_hallazgos',
    evento_ids: eventoIds,
  };

  if (!notificar) {
    result.notify_razon = 'notificar_desactivado';
    return result;
  }

  if (totalHallazgos === 0) {
    result.notify_razon = 'sin_hallazgos';
    return result;
  }

  const tg = await notificarBotErpCco(supabase, result);
  if (tg.ok) {
    result.notificado = true;
    result.notify_razon = tg.razon;
  } else {
    result.notify_razon = tg.razon;
  }

  return result;
}
