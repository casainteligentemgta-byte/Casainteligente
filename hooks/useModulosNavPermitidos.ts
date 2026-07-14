'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '@/lib/http/apiUrl';
import { createClient } from '@/lib/supabase/client';
import {
  ampliarModulosPorPermisos,
  modulosParaRolesEmpresa,
  type ModuloNavId,
} from '@/lib/auth/modulosPorRol';

type Estado =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'ready'; modulos: Set<ModuloNavId>; roles: string[]; permisos: string[] };

/**
 * Carga permisos/roles de la sesión y calcula módulos visibles en la nav.
 * Reintenta cuando la sesión aún no está lista (evita quedar solo en Inicio).
 */
export function useModulosNavPermitidos(): Estado {
  const [estado, setEstado] = useState<Estado>({ status: 'loading' });

  const cargar = useCallback(async (intento = 0) => {
    try {
      const res = await fetch(apiUrl('/api/auth/permisos'), {
        cache: 'no-store',
        credentials: 'include',
      });
      if (res.status === 401) {
        // Cookie/sesión a veces llega milisegundos después del primer mount
        if (intento < 4) {
          await new Promise((r) => setTimeout(r, 250 * (intento + 1)));
          return cargar(intento + 1);
        }
        setEstado({ status: 'anon' });
        return;
      }
      const data = (await res.json()) as {
        roles_empresa?: string[];
        permisos?: string[];
        error?: string;
      };
      if (!res.ok) {
        if (intento < 2) {
          await new Promise((r) => setTimeout(r, 400));
          return cargar(intento + 1);
        }
        setEstado({ status: 'anon' });
        return;
      }
      const roles = data.roles_empresa ?? [];
      const permisos = data.permisos ?? [];
      const base = modulosParaRolesEmpresa(roles);
      const modulos = ampliarModulosPorPermisos(base, permisos);
      setEstado({ status: 'ready', modulos, roles, permisos });
    } catch {
      if (intento < 2) {
        await new Promise((r) => setTimeout(r, 400));
        return cargar(intento + 1);
      }
      setEstado({ status: 'anon' });
    }
  }, []);

  useEffect(() => {
    void cargar(0);
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        void cargar(0);
      }
      if (event === 'SIGNED_OUT') {
        setEstado({ status: 'anon' });
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [cargar]);

  return estado;
}
