import { Suspense } from 'react';
import TelegramWhitelistPanel from '@/components/configuracion/TelegramWhitelistPanel';
import UsuariosComprasTelegramPanel from '@/components/configuracion/UsuariosComprasTelegramPanel';

export const metadata = {
  title: 'Telegram | Casa Inteligente',
  description: 'Lista blanca del bot y usuarios del departamento de compras (/procura).',
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
        <div className="mx-auto max-w-4xl space-y-12 px-4 py-8">
          <TelegramWhitelistPanel embedded />
          <UsuariosComprasTelegramPanel />
        </div>
      </Suspense>
    </main>
  );
}
