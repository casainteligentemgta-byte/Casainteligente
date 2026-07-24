'use client';

import dynamic from 'next/dynamic';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import ModulosRutaGuard from '@/components/auth/ModulosRutaGuard';
import IOSNavBar from '@/components/IOSNavBar';
import { usePathname } from 'next/navigation';

/** Sonner rompe el SSR en dev si se renderiza en servidor (componente interno undefined). */
const Toaster = dynamic(() => import('sonner').then((m) => ({ default: m.Toaster })), { ssr: false });

/** Solo pathname del router (sin `window`) para que SSR y cliente coincidan en hidratación. */
function useResolvedPathname(): string {
  const pathname = usePathname();
  return typeof pathname === 'string' ? pathname : '';
}

/**
 * Oculta la barra iOS del CRM clásico dentro de rutas /nexus/* (shell propio).
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const path = useResolvedPathname();

  const isNexus = path.startsWith('/nexus');
  const isLegal = path === '/legal' || path.startsWith('/legal/');
  /** Landing / registro comercial del Módulo Abogado (público, sin dock CRM). */
  const isAbogado = path === '/abogado' || path.startsWith('/abogado/');
  /** Vista previa del presupuesto: pantalla completa sin dock ni distracciones (y sin caché de miniaturas en otros módulos). */
  const isPresupuestoPreview = path === '/ventas/preview';
  /** Entrevista candidato u onboarding: pantalla completa sin dock (anti-distracción). */
  const isRecruitment =
    path.startsWith('/reclutamiento') ||
    (path.startsWith('/rrhh') && path.includes('reclutamiento'));
  /** Postulación pública: sin dock CRM (evita «Inicio» y otros módulos). */
  const isPublicRegistro = path.startsWith('/registro');
  const isLogin = path === '/login' || path.startsWith('/auth');

  const chromeMinimal =
    isNexus ||
    isLegal ||
    isAbogado ||
    isPresupuestoPreview ||
    isRecruitment ||
    isPublicRegistro ||
    isLogin;

  return (
    <>
      <ReactQueryProvider>
        {!chromeMinimal ? <ModulosRutaGuard /> : null}
        {/* Dock inferior auto-oculto: poco padding; el menú no reserva espacio fijo */}
        <div className={chromeMinimal ? 'min-h-screen' : 'min-h-screen pb-8'}>{children}</div>
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
