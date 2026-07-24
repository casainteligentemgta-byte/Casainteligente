import { processInvoiceFromCanal } from '@/lib/canal/processInvoiceFromCanal';
import { downloadWhatsAppMedia, sendWhatsAppText } from '@/lib/whatsapp/botApi';

export async function processWhatsappInvoiceMedia(params: {
  pendingId: string;
  from: string;
  mediaId: string;
  mimeTypeHint?: string;
}): Promise<void> {
  const { buffer, mimeType } = await downloadWhatsAppMedia(params.mediaId);
  const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';

  await processInvoiceFromCanal({
    canal: 'whatsapp',
    pendingId: params.pendingId,
    chatId: params.from,
    buffer,
    mimeType: params.mimeTypeHint ?? mimeType,
    fileName: `whatsapp-${params.pendingId}.${ext}`,
    sendReply: (text) => sendWhatsAppText(params.from, text),
  });
}
