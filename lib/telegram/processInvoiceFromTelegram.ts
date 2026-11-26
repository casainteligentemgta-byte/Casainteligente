import {
  processInvoiceFromCanal,
  type ArchivoCanalFactura,
} from '@/lib/canal/processInvoiceFromCanal';
import { reclamarProcesamientoFacturaCanal, liberarProcesamientoObsoletoFacturaCanal } from '@/lib/canal/reservarFacturaCanalTelegram';
import { telegramSupabaseAdmin } from '@/lib/telegram/supabaseAdmin';
import { downloadTelegramFile, mimeFromTelegramPath, sendTelegramMessage } from '@/lib/telegram/botApi';
import {
  avisarErrorCargaFacturaCanal,
  clasificarErrorCargaFactura,
  textoAvisoErrorCarga,
} from '@/lib/telegram/avisoErrorCargaFactura';
import { crearProgresoFacturaTelegram } from '@/lib/telegram/estadoLecturaFactura';

export async function processTelegramInvoicePhoto(params: {
  pendingId: string;
  chatId: string;
  fileId?: string;
  archivos?: ArchivoCanalFactura[];
  /** El álbum ya pasó a 'procesando' tras el debounce. */
  yaReclamado?: boolean;
}): Promise<void> {
  const adminProgreso = telegramSupabaseAdmin();
  const progreso = crearProgresoFacturaTelegram(params.chatId, {
    supabase: adminProgreso.ok ? adminProgreso.client : null,
    pendingId: params.pendingId,
  });
  await progreso.reportar(5, 'Descargando archivo de Telegram…');

  let archivos = params.archivos && params.archivos.length > 0 ? params.archivos : null;
  if (!archivos) {
    if (!params.fileId) {
      let mostradoSinArchivo = false;
      try {
        await progreso.bad(textoAvisoErrorCarga('general'));
        mostradoSinArchivo = true;
      } catch {
        /* aviso por mensaje nuevo */
      }
      await avisarErrorCargaFacturaCanal({
        pendingId: params.pendingId,
        chatId: params.chatId,
        tipo: 'general',
        yaMostrado: mostradoSinArchivo,
      });
      return;
    }
    try {
      const { buffer, filePath } = await downloadTelegramFile(params.fileId);
      const mimeType = mimeFromTelegramPath(filePath);
      const ext = filePath.split('.').pop() ?? 'jpg';
      archivos = [
        {
          buffer,
          mimeType,
          fileName: `telegram-${params.pendingId}.${ext}`,
        },
      ];
    } catch (e) {
      let mostradoDl = false;
      try {
        await progreso.bad(textoAvisoErrorCarga(clasificarErrorCargaFactura(e)));
        mostradoDl = true;
      } catch {
        /* aviso por mensaje nuevo */
      }
      await avisarErrorCargaFacturaCanal({
        pendingId: params.pendingId,
        chatId: params.chatId,
        errorOriginal: e,
        yaMostrado: mostradoDl,
      });
      const adminDl = telegramSupabaseAdmin();
      if (adminDl.ok) {
        await adminDl.client
          .from('ci_facturas_canal_pendientes')
          .update({
            estado: 'error',
            mensaje_error: (e instanceof Error ? e.message : 'fetch failed').slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.pendingId);
      }
      return;
    }
  }

  const admin = telegramSupabaseAdmin();
  if (admin.ok && !params.yaReclamado) {
    let claim = await reclamarProcesamientoFacturaCanal(admin.client, params.pendingId);
    if (claim === 'already_processing') {
      const liberada = await liberarProcesamientoObsoletoFacturaCanal(
        admin.client,
        params.pendingId,
      );
      if (liberada) {
        claim = await reclamarProcesamientoFacturaCanal(admin.client, params.pendingId);
      }
    }
    if (claim === 'already_done') {
      await progreso.cerrar('ℹ️ Esta factura ya estaba leída. Ya puedes mandar la próxima');
      const { avanzarFlujoFacturaCompradorTelegram, flujoFacturaCompradorIncompleto } =
        await import('@/lib/telegram/flujoFacturaCompradorTelegram');
      const { data: row } = await admin.client
        .from('ci_facturas_canal_pendientes')
        .select('extracted, proyecto_id, entidad_id, ubicacion_destino_id, estado')
        .eq('id', params.pendingId)
        .maybeSingle();
      const estado = String(row?.estado ?? '').toLowerCase();
      if (
        row?.extracted &&
        (estado === 'extraido' || estado === 'error') &&
        flujoFacturaCompradorIncompleto(row.extracted as never, row)
      ) {
        await avanzarFlujoFacturaCompradorTelegram(
          admin.client,
          params.chatId,
          params.pendingId,
        );
      }
      return;
    }
    if (claim === 'already_processing') {
      // Cierra el «Leyendo factura…» de esta invocación para que no quede colgado.
      await progreso.cerrar(
        '⏳ Esta factura aún se está leyendo. Espere 1–2 minutos y, si no avanza, reenvíe la foto con <code>/facturas</code>.',
      );
      return;
    }
    if (claim === 'not_found') {
      await progreso.bad(textoAvisoErrorCarga('general'));
      await avisarErrorCargaFacturaCanal({
        pendingId: params.pendingId,
        chatId: params.chatId,
        tipo: 'general',
        supabase: admin.client,
        yaMostrado: true,
      });
      return;
    }
  }

  try {
    const primario = archivos[0];
    await processInvoiceFromCanal({
      canal: 'telegram',
      pendingId: params.pendingId,
      chatId: params.chatId,
      buffer: primario.buffer,
      mimeType: primario.mimeType,
      fileName: primario.fileName,
      archivos,
      sendReply: (text, html) =>
        sendTelegramMessage(params.chatId, text, html ? { parse_mode: 'HTML' } : undefined),
      progreso,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Error al procesar la factura';
    if (admin.ok) {
      await admin.client
        .from('ci_facturas_canal_pendientes')
        .update({
          estado: 'error',
          mensaje_error: raw.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.pendingId);
    }
    const tipo = clasificarErrorCargaFactura(e);
    let mostrado = false;
    try {
      await progreso.bad(textoAvisoErrorCarga(tipo));
      mostrado = true;
    } catch {
      /* aviso por mensaje nuevo */
    }
    await avisarErrorCargaFacturaCanal({
      pendingId: params.pendingId,
      chatId: params.chatId,
      tipo,
      supabase: admin.ok ? admin.client : undefined,
      yaMostrado: mostrado,
    });
  }
}
