import { Suspense } from 'react';
import TelegramWhitelistPanel from '@/components/configuracion/TelegramWhitelistPanel';

export const metadata = {
  title: 'Lista blanca Telegram | Casa Inteligente',
  description: 'Autorizar chats que pueden interactuar con el bot de Telegram.',
};

export default function ConfiguracionTelegramPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F]">
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
            Cargando…
          </div>
        }
      >
        <TelegramWhitelistPanel />
      </Suspense>
    </main>
  );
}
