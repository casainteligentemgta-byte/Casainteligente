'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { hrefPermitidoPorModulos } from '@/lib/auth/modulosPorRol';
import { useModulosNavPermitidos } from '@/hooks/useModulosNavPermitidos';

/**
 * Si el usuario entra por URL a un módulo oculto por rol, redirige a inicio.
 * No aplica en login/auth/nexus/registro ni mientras carga permisos.
 */
export default function ModulosRutaGuard() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const acceso = useModulosNavPermitidos();

  useEffect(() => {
    if (acceso.status !== 'ready') return;
    if (hrefPermitidoPorModulos(pathname, acceso.modulos)) return;
    router.replace('/');
  }, [acceso, pathname, router]);

  return null;
}
