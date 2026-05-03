'use client';

import IOSNavBar from '@/components/IOSNavBar';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';

/**
 * Oculta la barra iOS del CRM clásico dentro de rutas /nexus/* (shell propio).
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNexus = pathname?.startsWith('/nexus') ?? false;
  /** Vista previa del presupuesto: pantalla completa sin dock ni distracciones (y sin caché de miniaturas en otros módulos). */
  const isPresupuestoPreview = pathname === '/ventas/preview';
  /** Entrevista candidato: pantalla completa sin dock (anti-distracción). */
  const isRecruitmentCandidate = pathname === '/reclutamiento';

  return (
    <>
      <div
        className={
          isNexus || isPresupuestoPreview || isRecruitmentCandidate
            ? 'min-h-screen'
            : 'min-h-screen pb-28 sm:pb-24'
        }
      >
        {children}
      </div>
      {!isNexus && !isPresupuestoPreview && !isRecruitmentCandidate ? <IOSNavBar /> : null}
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'border border-white/10 bg-[#0A0A0F]/95 text-zinc-100 backdrop-blur-md shadow-xl shadow-black/40',
            title: 'text-zinc-100',
            description: 'text-zinc-400',
          },
        }}
      />
    </>
  );
}
