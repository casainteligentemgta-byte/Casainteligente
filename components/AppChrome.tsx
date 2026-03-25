'use client';

import IOSNavBar from '@/components/IOSNavBar';
import { usePathname } from 'next/navigation';

/**
 * Oculta la barra iOS del CRM clásico dentro de rutas /nexus/* (shell propio).
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNexus = pathname?.startsWith('/nexus') ?? false;
  /** Vista previa del presupuesto: pantalla completa sin dock ni distracciones (y sin caché de miniaturas en otros módulos). */
  const isPresupuestoPreview = pathname === '/ventas/preview';

  return (
    <>
      <div
        className={
          isNexus || isPresupuestoPreview ? 'min-h-screen' : 'min-h-screen pb-24'
        }
      >
        {children}
      </div>
      {!isNexus && !isPresupuestoPreview ? <IOSNavBar /> : null}
    </>
  );
}
