'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CATEGORIAS_CATALOGO_DEFAULT,
  crearCategoriaCatalogo,
  listarCategoriasCatalogo,
  mergeNombresCategoria,
} from '@/lib/productos/categoriasCatalogo';

export function useCategoriasCatalogo() {
  const supabase = useMemo(() => createClient(), []);
  const [nombres, setNombres] = useState<string[]>([...CATEGORIAS_CATALOGO_DEFAULT]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    try {
      const list = await listarCategoriasCatalogo(supabase);
      setNombres(list);
    } catch {
      setNombres((prev) => mergeNombresCategoria(CATEGORIAS_CATALOGO_DEFAULT, prev));
    }
  }, [supabase]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    void recargar().finally(() => {
      if (!cancelado) setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [recargar]);

  const crear = useCallback(
    async (nombre: string) => {
      const creada = await crearCategoriaCatalogo(supabase, nombre);
      setNombres((prev) => mergeNombresCategoria(prev, [creada]));
      return creada;
    },
    [supabase],
  );

  return { nombres, cargando, crear, recargar };
}
