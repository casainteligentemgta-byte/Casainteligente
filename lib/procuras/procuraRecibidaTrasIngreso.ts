/**
 * Cuando la compra de una solicitud (procura) entra al almacén, la solicitud pasa a
 * «Recibida» y se le avisa a quien pidió el material, para que lo solicite al almacén.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';
import { ejecutarTransicionProcuraLote } from '@/lib/procuras/auditoriaSupervisorProcura';
import { actualizarTicketProcuraSolicitante } from '@/lib/procuras/ticketProcuraSolicitanteTelegram';
import { sendTelegramMessage } from '@/lib/telegram/botApi';

type ProcuraComprada = {
  id: string;
  ticket: string;
  estado: string;
  material_id: string | null;
  material_txt: string;
  cantidad: number;
  cantidad_compra: number | null;
  unidad: string;
  solicitante_telegram_chat_id: number | string | null;
};

export type CantidadRecibida = { material_id: string; cantidad: number };

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cantidadTexto(n: number): string {
  return Number(n).toLocaleString('es-VE');
}

/**
 * Estado que le corresponde a la solicitud según lo que contó el almacén.
 * Sin conteo (ingreso por la web) se da por recibida completa.
 */
export function estadoProcuraTrasIngreso(
  procura: Pick<ProcuraComprada, 'material_id' | 'cantidad' | 'cantidad_compra'>,
  recibidas?: CantidadRecibida[] | null,
): { estado: 'recibida' | 'recibida_parcial'; esperado: number; recibido: number | null } {
  const comprado = Number(procura.cantidad_compra ?? 0);
  const esperado = comprado > 0 ? comprado : Number(procura.cantidad) || 0;
  const material = procura.material_id?.trim();
  if (!recibidas?.length || !material) return { estado: 'recibida', esperado, recibido: null };
  const delMaterial = recibidas.filter((r) => r.material_id.trim() === material);
  if (!delMaterial.length) return { estado: 'recibida', esperado, recibido: null };
  const recibido = delMaterial.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
  return { estado: recibido + 1e-9 < esperado ? 'recibida_parcial' : 'recibida', esperado, recibido };
}

export function mensajeMaterialEnAlmacen(params: {
  ticket: string;
  materialTxt: string;
  unidad: string;
  esperado: number;
  recibido: number | null;
  completa: boolean;
  almacen: string | null;
  numeroFactura: string | null;
}): string {
  const cantidad = params.recibido != null ? params.recibido : params.esperado;
  const titulo = params.completa
    ? '📦 <b>Su material ya está en el almacén</b>'
    : '📦 <b>Llegó al almacén una parte de su material</b>';
  const lineas = [
    titulo,
    '',
    `🎫 <b>${escHtml(params.ticket)}</b>`,
    `📦 <b>${escHtml(cantidadTexto(cantidad))} ${escHtml(params.unidad)}</b> · ${escHtml(nombreMaterialProcuraVisible(params.materialTxt))}`,
  ];
  if (!params.completa) {
    lineas.push(`⏳ Faltan <b>${escHtml(cantidadTexto(Math.max(0, params.esperado - cantidad)))} ${escHtml(params.unidad)}</b> por llegar.`);
  }
  if (params.almacen) lineas.push(`📥 Almacén: <b>${escHtml(params.almacen)}</b>`);
  if (params.numeroFactura) lineas.push(`🧾 Factura #${escHtml(params.numeroFactura)}`);
  lineas.push('', 'Para retirarlo: <code>/salida</code> → <b>Pedir material</b>.');
  return lineas.join('\n');
}

/**
 * Marca como recibidas las solicitudes ligadas a la factura que acaba de entrar al almacén.
 * No lanza: un fallo aquí nunca debe tumbar el ingreso.
 */
export async function marcarProcurasRecibidasTrasIngreso(
  supabase: SupabaseClient,
  purchaseInvoiceId: string | null | undefined,
  recibidas?: CantidadRecibida[] | null,
): Promise<number> {
  const pi = purchaseInvoiceId?.trim();
  if (!pi) return 0;
  let marcadas = 0;
  try {
    const { data: compras } = await supabase
      .from('contabilidad_compras')
      .select('procura_id,invoice_number,ubicacion_destino_id')
      .eq('purchase_invoice_id', pi);
    const filasCompra = (compras ?? []) as Array<{
      procura_id?: string | null;
      invoice_number?: string | null;
      ubicacion_destino_id?: string | null;
    }>;
    const ids = new Set(filasCompra.map((c) => String(c.procura_id ?? '').trim()).filter(Boolean));

    const { data: porFactura } = await supabase.from('ci_procuras').select('id').eq('purchase_invoice_id', pi);
    for (const p of (porFactura ?? []) as Array<{ id: string }>) ids.add(String(p.id));
    if (!ids.size) return 0;

    const numeroFactura = filasCompra.map((c) => String(c.invoice_number ?? '').trim()).find(Boolean) ?? null;
    const ubicacionId = filasCompra.map((c) => String(c.ubicacion_destino_id ?? '').trim()).find(Boolean) ?? null;
    let almacen: string | null = null;
    if (ubicacionId) {
      const { data: ub } = await supabase.from('inv_ubicaciones').select('nombre').eq('id', ubicacionId).maybeSingle();
      almacen = String(ub?.nombre ?? '').trim() || null;
    }

    const { data: procuras } = await supabase
      .from('ci_procuras')
      .select('id,ticket,estado,material_id,material_txt,cantidad,cantidad_compra,unidad,solicitante_telegram_chat_id')
      .in('id', Array.from(ids));

    for (const procura of (procuras ?? []) as ProcuraComprada[]) {
      const estadoActual = String(procura.estado ?? '').toLowerCase();
      // Solo las que estaban esperando la compra; una ya recibida no se vuelve a avisar.
      if (estadoActual !== 'en_compra' && estadoActual !== 'recibida_parcial') continue;

      const { estado, esperado, recibido } = estadoProcuraTrasIngreso(procura, recibidas);
      try {
        if (estado !== estadoActual) {
          await ejecutarTransicionProcuraLote(supabase, {
            procuraId: procura.id,
            nuevoEstado: estado,
            motivo:
              estado === 'recibida'
                ? `Compra recibida en almacén${numeroFactura ? ` (factura #${numeroFactura})` : ''}`
                : `Compra recibida en parte en almacén${numeroFactura ? ` (factura #${numeroFactura})` : ''}`,
          });
        }
        marcadas += 1;
      } catch (e) {
        console.warn('[procuraRecibida] transición', procura.ticket, e);
        continue;
      }

      try {
        await actualizarTicketProcuraSolicitante(supabase, procura.id);
      } catch (e) {
        console.warn('[procuraRecibida] ticket', procura.ticket, e);
      }

      const chat = procura.solicitante_telegram_chat_id;
      if (chat == null || String(chat).trim() === '') continue;
      try {
        // Mensaje nuevo: editar el ticket no le suena en el teléfono a quien lo pidió.
        await sendTelegramMessage(
          String(chat),
          mensajeMaterialEnAlmacen({
            ticket: procura.ticket,
            materialTxt: procura.material_txt,
            unidad: procura.unidad,
            esperado,
            recibido,
            completa: estado === 'recibida',
            almacen,
            numeroFactura,
          }),
          { parse_mode: 'HTML', rolDestinatario: 'Solicitante', contextoLogEspejo: '[Procura · material en almacén]' },
        );
      } catch (e) {
        console.warn('[procuraRecibida] aviso solicitante', procura.ticket, e);
      }
    }
  } catch (e) {
    console.warn('[procuraRecibida]', e);
  }
  return marcadas;
}
