'use client';

import RegistroPorNeedCliente from '@/app/registro/RegistroPorNeedCliente';

/** Vista local para revisar el paso 1 de hoja de vida. No se usa en producción. */
export default function VistaPreviaCamposHojaVida() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-sm text-zinc-400">
        No disponible.
      </div>
    );
  }
  return <RegistroPorNeedCliente previewObraNombre="Villa Zolita 2026 – Etapa 1" />;
}
