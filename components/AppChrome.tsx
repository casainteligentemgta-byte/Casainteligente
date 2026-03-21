'use client';

import IOSNavBar from '@/components/IOSNavBar';
import { usePathname } from 'next/navigation';

/**
 * Oculta la barra iOS del CRM clásico dentro de rutas /nexus/* (shell propio).
 */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNexus = pathname?.startsWith('/nexus') ?? false;

  return (
    <>
      <div className={isNexus ? 'min-h-screen' : 'min-h-screen pb-24'}>{children}</div>
      {!isNexus ? <IOSNavBar /> : null}
    </>
  );
}
