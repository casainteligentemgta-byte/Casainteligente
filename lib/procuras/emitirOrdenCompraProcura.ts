import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarUsuariosOrdenCompraTelegram,
  type UsuarioSistemaTelegram,
} from '@/lib/compras/usuariosSistemaTelegram';
import { etiquetaCapituloMaestro } from '@/lib/compras/capitulosMaestro';
import { notificarProcurasTelegram } from '@/lib/procuras/notificarProcuraTelegram';
import {
  etiquetaEstadoProcura,
  parseEstadoProcura,
  type EstadoProcura,
} from '@/lib/procuras/procuraEstados';
import { sendTelegramMessage } from '@/lib/telegram/botApi';

const ESTADOS_ORIGEN_ORDEN: readonly EstadoProcura[] = [
  'solicitada',
  'aprobada',
  'aprobada_directa',
  'recibida_parcial',
];

export type ProcuraOrdenCompraRow = {
  id: string;
  ticket: string;
  estado: string;
  material_txt: string;
  cantidad: number;
  unidad: string;
  solicitante_nombre: string | null;
  solicitante_telegram_chat_id: number | null;
  prioridad: string | null;
  monto_estimado_usd: number | null;
  observaciones: string | null;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
  ci_entidades?: { nombre: string } | { nombre: string }[] | null;
  ci_compras_capitulos_maestro?: { codigo?: string; nombre?: string } | null;
};

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nombreRel(
  rel: { nombre?: string } | { nombre?: string }[] | null | undefined,
): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.nombre?.trim() || null;
  return rel.nombre?.trim() || null;
}

function urlCuadroProcuras(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  return base ? `${base}/contabilidad/procuras` : '/contabilidad/procuras';
}

export async function cargarProcuraOrdenCompra(
  supabase: SupabaseClient,
  procuraId: string,
): Promise<ProcuraOrdenCompraRow | null> {
  const { data, error } = await supabase
    .from('ci_procuras')
    .select(
      'id,ticket,estado,material_txt,cantidad,unidad,solicitante_nombre,solicitante_telegram_chat_id,prioridad,monto_estimado_usd,observaciones,ci_proyectos(nombre),ci_entidades(nombre),ci_compras_capitulos_maestro(codigo,nombre)',
    )
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as ProcuraOrdenCompraRow;
}

function mensajeOrdenCompraComprador(
  procura: ProcuraOrdenCompraRow,
  params: { autorNombre: string; motivo?: string | null; cantidadCompra?: number | null },
): string {
  const cap = procura.ci_compras_capitulos_maestro;
  const capLabel = cap
    ? etiquetaCapituloMaestro({
        codigo: String(cap.codigo ?? ''),
        nombre: String(cap.nombre ?? ''),
      })
    : null;
  const obra =
    capLabel ||
    nombreRel(procura.ci_proyectos) ||
    nombreRel(procura.ci_entidades) ||
    '—';
  const qty =
    params.cantidadCompra != null && Number.isFinite(params.cantidadCompra)
      ? params.cantidadCompra
      : Number(procura.cantidad);
  const cantidad = `${qty.toLocaleString('es-VE')} ${procura.unidad}`;
  const prioridad = procura.prioridad?.trim() || '—';
  const monto =
    procura.monto_estimado_usd != null && Number.isFinite(Number(procura.monto_estimado_usd))
      ? `\n💵 <b>Estimado:</b> USD ${Number(procura.monto_estimado_usd).toFixed(2)}`
      : '';
  const motivo = params.motivo?.trim()
    ? `\n📝 ${escHtml(params.motivo.trim())}`
    : '';

  return (
    '🛒 <b>Nueva orden de compra</b>\n\n' +
    `🎫 <b>${escHtml(procura.ticket)}</b>\n` +
    `📦 <b>${escHtml(cantidad)}</b> · ${escHtml(procura.material_txt)}\n` +
    `👷 <b>Solicitante:</b> ${escHtml(procura.solicitante_nombre?.trim() || '—')}\n` +
    `📁 <b>Obra / capítulo:</b> ${escHtml(obra)}\n` +
    `🔴 <b>Prioridad:</b> ${escHtml(prioridad)}${monto}\n` +
    `✅ <b>Autorizó:</b> ${escHtml(params.autorNombre)}${motivo}\n\n` +
    'Ejecute la compra y registre la factura con <code>/facturas</code>.\n' +
    `<a href="${escHtml(urlCuadroProcuras())}">Ver cuadro de procuras</a>`
  );
}

export async function notificarCompradoresOrdenCompra(
  supabase: SupabaseClient,
  procura: ProcuraOrdenCompraRow,
  params: { autorNombre: string; motivo?: string | null; cantidadCompra?: number | null },
): Promise<{ enviados: number; omitidos: number }> {
  const compradores = await listarUsuariosOrdenCompraTelegram(supabase);
  if (!compradores.length) {
    console.warn('[ordenCompraProcura] Sin compradores Telegram activos');
    return { enviados: 0, omitidos: 0 };
  }

  const texto = mensajeOrdenCompraComprador(procura, params);
  let enviados = 0;
  let omitidos = 0;

  for (const u of compradores) {
    try {
      await sendTelegramMessage(String(u.telegram_id), texto, {
        parse_mode: 'HTML',
      });
      enviados += 1;
    } catch (e) {
      console.warn('[ordenCompraProcura] notify', u.nombre, e);
      omitidos += 1;
    }
  }

  return { enviados, omitidos };
}

export type EmitirOrdenCompraProcuraResult = {
  ok: boolean;
  ticket?: string;
  estado?: string;
  yaExistia?: boolean;
  compradoresNotificados?: number;
  error?: string;
};

/** PM / vía rápida: pasa la procura a en_compra y avisa a compradores. */
export async function emitirOrdenCompraProcura(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    autorNombre: string;
    motivo?: string | null;
    /** Cantidad a comprar (saldo tras despacho parcial). */
    cantidadCompra?: number | null;
  },
): Promise<EmitirOrdenCompraProcuraResult> {
  const procuraId = params.procuraId.trim();
  if (!procuraId) {
    return { ok: false, error: 'Id de procura inválido.' };
  }

  let procura = await cargarProcuraOrdenCompra(supabase, procuraId);
  if (!procura) {
    return { ok: false, error: 'Procura no encontrada.' };
  }

  const estadoActual = parseEstadoProcura(procura.estado);
  if (!estadoActual) {
    return { ok: false, error: `Estado no válido: ${procura.estado}` };
  }

  if (estadoActual === 'en_compra') {
    const notify = await notificarCompradoresOrdenCompra(supabase, procura, {
      autorNombre: params.autorNombre,
      motivo: params.motivo,
      cantidadCompra: params.cantidadCompra,
    });
    return {
      ok: true,
      ticket: procura.ticket,
      estado: 'en_compra',
      yaExistia: true,
      compradoresNotificados: notify.enviados,
    };
  }

  if (!ESTADOS_ORIGEN_ORDEN.includes(estadoActual)) {
    return {
      ok: false,
      error: `No se puede emitir orden desde «${etiquetaEstadoProcura(estadoActual)}».`,
    };
  }

  const motivoOrden =
    params.motivo?.trim() ||
    `Orden de compra emitida por ${params.autorNombre}`.slice(0, 500);

  const { data, error } = await supabase.rpc(
    'procesar_procuras_lote' as 'ci_registrar_ingreso_manual_campo',
    {
      p_ids: [procuraId],
      p_nuevo_estado: 'en_compra',
      p_motivo: motivoOrden,
    } as never,
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  procura = (await cargarProcuraOrdenCompra(supabase, procuraId)) ?? procura;

  const filas = (data ?? []) as Array<{
    ticket: string;
    nuevo_est: string;
    telegram_id: string | null;
  }>;

  if (procura.solicitante_telegram_chat_id) {
    await notificarProcurasTelegram(
      [
        {
          ticket: procura.ticket,
          material_txt: procura.material_txt,
          nuevo_est: 'en_compra',
          telegram_id: String(procura.solicitante_telegram_chat_id),
        },
      ],
      motivoOrden,
    );
  } else if (filas[0]?.telegram_id) {
    await notificarProcurasTelegram(
      filas.map((f) => ({
        ticket: f.ticket,
        material_txt: procura!.material_txt,
        nuevo_est: f.nuevo_est,
        telegram_id: f.telegram_id,
      })),
      motivoOrden,
    );
  }

  const notify = await notificarCompradoresOrdenCompra(supabase, procura, {
    autorNombre: params.autorNombre,
    motivo: motivoOrden,
    cantidadCompra: params.cantidadCompra,
  });

  return {
    ok: true,
    ticket: filas[0]?.ticket ?? procura.ticket,
    estado: 'en_compra',
    compradoresNotificados: notify.enviados,
  };
}
