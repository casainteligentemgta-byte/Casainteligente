'use client';

import { useCallback, useEffect, useState } from 'react';
import { ampliarModulosPorPermisos, modulosParaRolesEmpresa, type ModuloNavId } from '@/lib/auth/modulosPorRol';

type Estado =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'ready'; modulos: Set<ModuloNavId>; roles: string[]; permisos: string[] };

/**
 * Carga permisos/roles de la sesión y calcula módulos visibles en la nav.
 * Sin sesión o sin rol: solo Inicio (no muestra menú completo).
 */
export function useModulosNavPermitidos(): Estado {
  const [estado, setEstado] = useState<Estado>({ status: 'loading' });

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/permisos', { cache: 'no-store', credentials: 'include' });
      if (res.status === 401) {
        setEstado({ status: 'anon' });
        return;
      }
      const data = (await res.json()) as {
        roles_empresa?: string[];
        permisos?: string[];
        error?: string;
      };
      if (!res.ok) {
        setEstado({ status: 'anon' });
        return;
      }
      const roles = data.roles_empresa ?? [];
      const permisos = data.permisos ?? [];
      const base = modulosParaRolesEmpresa(roles);
      const modulos = ampliarModulosPorPermisos(base, permisos);
      setEstado({ status: 'ready', modulos, roles, permisos });
    } catch {
      setEstado({ status: 'anon' });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return estado;
}
