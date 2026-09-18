'use client';

import FlotaShell from '@/components/flota/FlotaShell';
import FlotaResumenPage from '@/app/flota/page';
import FlotaConductoresPage from '@/app/flota/conductores/page';
import FlotaGasolinaPage from '@/app/flota/gasolina/page';
import FlotaMantenimientoPage from '@/app/flota/mantenimiento/page';
import FlotaAlertasPage from '@/app/flota/alertas/page';
import FlotaChatbotPage from '@/app/flota/chatbot/page';
import type { FlotaTabId } from '@/components/flota/FlotaNav';

export default function FlotaWorkspace({
  entidadId,
  defaultTipo = 'maquinaria',
}: {
  entidadId: string;
  defaultTipo?: 'maquinaria' | 'camioneta' | 'camion' | 'auto' | 'moto' | 'otro';
}) {
  return (
    <FlotaShell
      embedded
      entidadId={entidadId}
      defaultTipo={defaultTipo}
      sections={(tab: FlotaTabId) => {
        switch (tab) {
          case 'conductores':
            return <FlotaConductoresPage />;
          case 'gasolina':
            return <FlotaGasolinaPage />;
          case 'taller':
            return <FlotaMantenimientoPage />;
          case 'alertas':
            return <FlotaAlertasPage />;
          case 'mecanico':
            return <FlotaChatbotPage />;
          default:
            return <FlotaResumenPage />;
        }
      }}
    />
  );
}
