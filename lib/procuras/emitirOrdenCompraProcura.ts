import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarUsuariosOrdenCompraTelegram,
} from '@/lib/compras/usuariosSistemaTelegram';
import { etiquetaCapituloMaestro } from '@/lib/compras/capitulosMaestro';
import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';
import {
  insertarAuditoriaProcuraSinTransicion,
  metadatosAuditoriaSupervisor,
  motivoAuditoriaSupervisor,
  nombreActorSupervisorFormal,
  type ContextoAuditoriaSupervisor,
} from '@/lib/procuras/auditoriaSupervisorProcura';
import { actualizarTicketProcuraSolicitante } from '@/lib/procuras/ticketProcuraSolicitanteTelegram';
import {
  etiquetaEstadoProcura,
  parseEstadoProcura,
  type EstadoProcura,
} from '@/lib/procuras/procuraEstados';
import {
  listarAlmacenesStockMaterialEntidad,
  notaLogisticaStockEntidadComprador,
  type AlmacenStockEntidad,
} from '@/lib/procuras/disponibilidadMaterialProcura';
import { replicarOrdenCompraProcuraEnLogBot } from '@/lib/telegram/espejoSalidaLogBot';
import { tecladoFacturaOrdenCompraProcura } from '@/lib/telegram/facturaOrdenCompraTelegram';
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
  material_id?: string | null;
  cantidad: number;
  unidad: string;
  solicitante_nombre: string | null;
  solicitante_telegram_chat_id: number | null;
  prioridad: string | null;
  monto_estimado_usd: number | null;
  observaciones: string | null;
  proyecto_id?: string | null;
  entidad_id?: string | null;
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
      'id,ticket,estado,material_txt,material_id,cantidad,unidad,solicitante_nombre,solicitante_telegram_chat_id,prioridad,monto_estimado_usd,observaciones,proyecto_id,entidad_id,ci_proyectos(nombre),ci_entidades(nombre),ci_compras_capitulos_maestro(codigo,nombre)',
    )
    .eq('id', procuraId.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as ProcuraOrdenCompraRow;
}

export function mensajeOrdenCompraComprador(
  procura: ProcuraOrdenCompraRow,
  params: {
    autorNombre: string;
    motivo?: string | null;
    cantidadCompra?: number | null;
    almacenesEntidad?: AlmacenStockEntidad[];
  },
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
  const notaLogistica = notaLogisticaStockEntidadComprador(params.almacenesEntidad ?? []);

  return (
    '🛒 <b>Nueva orden de compra</b>\n\n' +
    `🎫 <b>${escHtml(procura.ticket)}</b>\n` +
    `📦 <b>${escHtml(cantidad)}</b> · ${escHtml(nombreMaterialProcuraVisible(procura.material_txt))}\n` +
    `👷 <b>Solicitante:</b> ${escHtml(procura.solicitante_nombre?.trim() || '—')}\n` +
    `📁 <b>Obra / capítulo:</b> ${escHtml(obra)}\n` +
    `🔴 <b>Prioridad:</b> ${escHtml(prioridad)}${monto}${notaLogistica}\n` +
    `✅ <b>Autorizó:</b> ${escHtml(params.autorNombre)}${motivo}\n\n` +
    'Registre la factura con los botones o con <code>/facturas</code> (foto o manual).\n' +
    `<a href="${escHtml(urlCuadroProcuras())}">Ver cuadro de procuras</a>`
  );
}

export function opcionesMensajeOrdenCompraComprador(procuraId: string): {
  reply_markup: ReturnType<typeof tecladoFacturaOrdenCompraProcura>;
} {
  return { reply_markup: tecladoFacturaOrdenCompraProcura(procuraId) };
}

export async function notificarCompradoresOrdenCompra(
  supabase: SupabaseClient,
  procura: ProcuraOrdenCompraRow,
  params: {
    autorNombre: string;
    motivo?: string | null;
    cantidadCompra?: number | null;
    almacenesEntidad?: AlmacenStockEntidad[];
  },
): Promise<{ enviados: number; omitidos: number }> {
  const compradores = await listarUsuariosOrdenCompraTelegram(supabase);
  const texto = mensajeOrdenCompraComprador(procura, params);
  let enviados = 0;
  let omitidos = 0;

  if (!compradores.length) {
    console.warn('[ordenCompraProcura] Sin compradores Telegram activos');
  } else {
    for (const u of compradores) {
      try {
        await sendTelegramMessage(String(u.telegram_id), texto, {
          parse_mode: 'HTML',
          rolDestinatario: u.rol === 'Administrador' ? 'Administrador' : 'Comprador',
          nombreDestinatario: u.nombre,
          accionLogDestinatario: 'ejecutar_compra',
          contextoLogEspejo: '[Procura · orden de compra]',
          skipLogEspejo: true,
          ...opcionesMensajeOrdenCompraComprador(procura.id),
        });
        enviados += 1;
      } catch (e) {
        console.warn('[ordenCompraProcura] notify', u.nombre, e);
        omitidos += 1;
      }
    }
  }

  await replicarOrdenCompraProcuraEnLogBot({
    procuraId: procura.id,
    mensaje: texto,
    ticket: String(procura.ticket ?? ''),
    destinatarios: compradores.map((u) => ({
      nombre: u.nombre,
      chatId: u.telegram_id,
    })),
    sinCompradorConfigurado: compradores.length === 0,
  });

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

/** PM / vía rápida: avisa a compradores. El estado «Comprada» (en_compra) queda al registrar factura. */
export async function emitirOrdenCompraProcura(
  supabase: SupabaseClient,
  params: {
    procuraId: string;
    autorNombre: string;
    motivo?: string | null;
    /** Cantidad a comprar (saldo tras despacho parcial). */
    cantidadCompra?: number | null;
    auditoriaSupervisor?: ContextoAuditoriaSupervisor | null;
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
    const almacenesEntidad = procura.material_id?.trim()
      ? await listarAlmacenesStockMaterialEntidad(supabase, {
          materialId: procura.material_id,
          entidadId: procura.entidad_id,
          proyectoId: procura.proyecto_id,
        })
      : [];
    const notify = await notificarCompradoresOrdenCompra(supabase, procura, {
      autorNombre: params.autorNombre,
      motivo: params.motivo,
      cantidadCompra: params.cantidadCompra,
      almacenesEntidad,
    });
    if (params.auditoriaSupervisor) {
      const motivoAudit = motivoAuditoriaSupervisor(
        params.motivo?.trim() || 'Reenvío de orden de compra por supervisor',
        params.auditoriaSupervisor,
      );
      const histErr = await insertarAuditoriaProcuraSinTransicion(supabase, {
        procuraId,
        estado: estadoActual,
        motivo: motivoAudit,
        usuario: nombreActorSupervisorFormal(params.auditoriaSupervisor.actorNombre),
        metadatos: metadatosAuditoriaSupervisor(params.auditoriaSupervisor),
      });
      if (histErr) {
        console.error('[emitirOrdenCompraProcura] auditoría supervisor reenvío:', histErr);
      }
    }
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

  const almacenesEntidad = procura.material_id?.trim()
    ? await listarAlmacenesStockMaterialEntidad(supabase, {
        materialId: procura.material_id,
        entidadId: procura.entidad_id,
        proyectoId: procura.proyecto_id,
      })
    : [];

  const motivoOrden =
    params.motivo?.trim() ||
    `Orden de compra emitida por ${params.autorNombre}`.slice(0, 500);

  const notify = await notificarCompradoresOrdenCompra(supabase, procura, {
    autorNombre: params.autorNombre,
    motivo: motivoOrden,
    cantidadCompra: params.cantidadCompra,
    almacenesEntidad,
  });

  if (params.auditoriaSupervisor) {
    const motivoAudit = motivoAuditoriaSupervisor(
      params.motivo?.trim() || 'Reenvío de orden de compra por supervisor',
      params.auditoriaSupervisor,
    );
    const histErr = await insertarAuditoriaProcuraSinTransicion(supabase, {
      procuraId,
      estado: estadoActual,
      motivo: motivoAudit,
      usuario: nombreActorSupervisorFormal(params.auditoriaSupervisor.actorNombre),
      metadatos: metadatosAuditoriaSupervisor(params.auditoriaSupervisor),
    });
    if (histErr) {
      console.error('[emitirOrdenCompraProcura] auditoría supervisor:', histErr);
    }
  }

  if (procura.solicitante_telegram_chat_id) {
    await actualizarTicketProcuraSolicitante(supabase, procuraId, {
      ordenCompraEmitida: true,
    });
  }

  return {
    ok: true,
    ticket: procura.ticket,
    estado: estadoActual,
    compradoresNotificados: notify.enviados,
  };
}
