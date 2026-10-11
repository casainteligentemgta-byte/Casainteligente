'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CATEGORIAS_CATALOGO_DEFAULT,
  crearCategoriaCatalogo,
  crearSubcategoriaCatalogo,
  listarArbolCategorias,
  mergeNombresCategoria,
  subcategoriasAMostrar,
} from '@/lib/productos/categoriasCatalogo';

export function useCategoriasCatalogo() {
  const supabase = useMemo(() => createClient(), []);
  const [nombres, setNombres] = useState<string[]>([...CATEGORIAS_CATALOGO_DEFAULT]);
  /** Subcategorías de cada categoría (clave: nombre de la categoría). */
  const [subcategorias, setSubcategorias] = useState<Record<string, string[]>>(() =>
    subcategoriasAMostrar(CATEGORIAS_CATALOGO_DEFAULT, null),
  );
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    try {
      const arbol = await listarArbolCategorias(supabase);
      setNombres(arbol.categorias);
      setSubcategorias(arbol.subcategorias);
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

  const crearSub = useCallback(
    async (categoria: string, nombre: string) => {
      const creada = await crearSubcategoriaCatalogo(supabase, categoria, nombre);
      setSubcategorias((prev) => ({ ...prev, [categoria]: mergeNombresCategoria(prev[categoria] ?? [], [creada]) }));
      return creada;
    },
    [supabase],
  );

  return { nombres, subcategorias, cargando, crear, crearSub, recargar };
}
