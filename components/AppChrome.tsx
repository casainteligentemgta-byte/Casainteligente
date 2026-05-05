'use client';

import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import IOSNavBar from '@/components/IOSNavBar';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useState } from 'react';
import { Toaster } from 'sonner';

/** Resuelve la ruta aunque `usePathname()` vaya un tick vacío en el cliente (evita mostrar el dock en /registro/*). */
function useResolvedPathname(): string {
  const pathname = usePathname();
  const [pathFromWindow, setPathFromWindow] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '',
  );
  useLayoutEffect(() => {
    setPathFromWindow(window.location.pathname);
  }, [pathname]);
  const fromHook = typeof pathname === 'string' ? pathname : '';
  return fromHook.length > 0 ? fromHook : pathFromWindow;
}

/**
 * Oculta la barra iOS del CRM clásico dentro de rutas /nexus/* (shell propio).
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const path = useResolvedPathname();
  const isNexus = path.startsWith('/nexus');
  /** Vista previa del presupuesto: pantalla completa sin dock ni distracciones (y sin caché de miniaturas en otros módulos). */
  const isPresupuestoPreview = path === '/ventas/preview';
  /** Entrevista candidato: pantalla completa sin dock (anti-distracción). */
  const isRecruitmentCandidate = path === '/reclutamiento';
  /** Postulación pública: sin dock CRM (evita «Inicio» y otros módulos). */
  const isPublicRegistro = path.startsWith('/registro');

  const chromeMinimal =
    isNexus || isPresupuestoPreview || isRecruitmentCandidate || isPublicRegistro;

  return (
    <>
      <ReactQueryProvider>
        <div className={chromeMinimal ? 'min-h-screen' : 'min-h-screen pb-28 sm:pb-24'}>{children}</div>
      </ReactQueryProvider>
      {!chromeMinimal ? <IOSNavBar /> : null}
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
