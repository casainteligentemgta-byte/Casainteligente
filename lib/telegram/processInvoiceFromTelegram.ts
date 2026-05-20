import { processInvoiceFromCanal } from '@/lib/canal/processInvoiceFromCanal';
import { downloadTelegramFile, mimeFromTelegramPath, sendTelegramMessage } from '@/lib/telegram/botApi';

export async function processTelegramInvoicePhoto(params: {
  pendingId: string;
  chatId: string;
  fileId: string;
}): Promise<void> {
  const { buffer, filePath } = await downloadTelegramFile(params.fileId);
  const mimeType = mimeFromTelegramPath(filePath);
  const ext = filePath.split('.').pop() ?? 'jpg';

  await processInvoiceFromCanal({
    canal: 'telegram',
    pendingId: params.pendingId,
    chatId: params.chatId,
    buffer,
    mimeType,
    fileName: `telegram-${params.pendingId}.${ext}`,
    sendReply: (text, html) =>
      sendTelegramMessage(params.chatId, text, html ? { parse_mode: 'HTML' } : undefined),
  });
}
