'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  filtrarProyectosPorEntidad,
  loadEntidades,
  loadProyectos,
  type EntidadRow,
  type ProyectoRow,
} from '@/lib/almacen/inventoryClasificacion';
import { filtrarObrasConstruccion } from '@/lib/proyectos/naturalezaProyecto';
import {
  listarDepositIdsParaFiltroInventario,
  listarUbicacionesParaFiltroInventario,
  proyectoIdsDeEntidad,
  resolverUbicacionIdsFiltroConMeta,
  resolverUbicacionIdsFiltroEntidadConMeta,
} from '@/lib/almacen/inventarioFiltroUbicacion';
import {
  asegurarUbicacionDeposito,
  asegurarUbicacionObra,
} from '@/lib/almacen/ubicacionesInventario';
import {
  hasInventarioShareParams,
  parseInventarioShareParams,
} from '@/lib/almacen/inventarioExportShare';
import {
  guardarInventarioCuadroFiltros,
  leerInventarioCuadroFiltrosGuardados,
} from '@/lib/almacen/inventarioCuadroFiltros';
import type { DepositRow } from '@/lib/almacen/formatInventoryLocation';
import type { UbicacionInventario } from '@/types/inventario-obra';

export type AlmacenFiltrosContextValue = {
  hydrated: boolean;
  entidades: EntidadRow[];
  proyectos: ProyectoRow[];
  depositsById: Map<string, DepositRow>;
  proyectosFiltro: ProyectoRow[];
  depositsFiltrados: DepositRow[];
  filterEntidadId: string;
  filterProyectoId: string;
  filterDepositId: string;
  setFilterEntidadId: (id: string) => void;
  setFilterProyectoId: (id: string) => void;
  setFilterDepositId: (id: string) => void;
  nombreEntidadFiltro: string;
  nombreProyectoFiltro: string;
  ubicacionIdsFiltro: string[];
  ubicacionesInventario: UbicacionInventario[];
  filtroSinUbicaciones: boolean;
  depositoSinInterseccion: boolean;
  cargandoUbicaciones: boolean;
  filtroStockPorUbicacion: boolean;
  filtroSoloEntidad: boolean;
  filtroStockEntidadActivo: boolean;
  proyectoIdsEntidadArr: string[] | undefined;
  proyectoIdsEntidad: Set<string>;
};

const AlmacenFiltrosContext = createContext<AlmacenFiltrosContextValue | null>(null);

export function useAlmacenFiltros(): AlmacenFiltrosContextValue {
  const ctx = useContext(AlmacenFiltrosContext);
  if (!ctx) {
    throw new Error('useAlmacenFiltros debe usarse dentro de AlmacenFiltrosProvider');
  }
  return ctx;
}

/** Igual que useAlmacenFiltros pero null fuera del provider (embeds legacy). */
export function useAlmacenFiltrosOptional(): AlmacenFiltrosContextValue | null {
  return useContext(AlmacenFiltrosContext);
}

export function AlmacenFiltrosProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const initApplied = useRef(false);
  const persistReady = useRef(false);

  const [hydrated, setHydrated] = useState(false);
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [depositsById, setDepositsById] = useState<Map<string, DepositRow>>(new Map());
  const [ubicacionesInventario, setUbicacionesInventario] = useState<UbicacionInventario[]>([]);

  const [filterEntidadId, setFilterEntidadId] = useState('');
  const [filterProyectoId, setFilterProyectoId] = useState('');
  const [filterDepositId, setFilterDepositId] = useState('');

  const [ubicacionIdsFiltro, setUbicacionIdsFiltro] = useState<string[]>([]);
  const [filtroSinUbicaciones, setFiltroSinUbicaciones] = useState(false);
  const [depositoSinInterseccion, setDepositoSinInterseccion] = useState(false);
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [e, p, depRes] = await Promise.all([
          loadEntidades(supabase),
          loadProyectos(supabase),
          supabase.from('inventory_deposits').select('id,name,locality,code,entidad_id'),
        ]);
        setEntidades(e);
        setProyectos(p);
        const depMap = new Map<string, DepositRow>();
        for (const d of (depRes.data ?? []) as DepositRow[]) {
          if (d.id) depMap.set(d.id, d);
        }
        setDepositsById(depMap);
      } catch {
        /* filtros opcionales */
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!hydrated || initApplied.current) return;
    initApplied.current = true;
    const fromUrl = hasInventarioShareParams(searchParams)
      ? parseInventarioShareParams(searchParams)
      : null;
    const fromStorage = !fromUrl ? leerInventarioCuadroFiltrosGuardados() : null;
    const src = fromUrl ?? fromStorage ?? {};
    if (src.entidad) setFilterEntidadId(src.entidad);
    if (src.proyecto) setFilterProyectoId(src.proyecto);
    if (src.deposito) setFilterDepositId(src.deposito);
    persistReady.current = true;
  }, [hydrated, searchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ubicaciones = await listarUbicacionesParaFiltroInventario(supabase);
        if (!cancelled) setUbicacionesInventario(ubicaciones);
      } catch (e) {
        console.warn('[almacen-filtros] ubicaciones:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const nombreEntidadFiltro = useMemo(
    () => entidades.find((e) => e.id === filterEntidadId)?.nombre ?? '',
    [entidades, filterEntidadId],
  );

  const nombreProyectoFiltro = useMemo(
    () => proyectos.find((p) => p.id === filterProyectoId)?.nombre ?? '',
    [proyectos, filterProyectoId],
  );

  const proyectosFiltro = useMemo(() => {
    const base = filtrarObrasConstruccion(
      filtrarProyectosPorEntidad(proyectos, filterEntidadId || null),
    );
    if (!filterProyectoId) return base;
    if (base.some((p) => p.id === filterProyectoId)) return base;
    const extra = proyectos.find((p) => p.id === filterProyectoId);
    return extra ? [...base, extra] : base;
  }, [proyectos, filterEntidadId, filterProyectoId]);

  const proyectoIdsEntidad = useMemo(
    () => (filterEntidadId ? proyectoIdsDeEntidad(proyectos, filterEntidadId) : new Set<string>()),
    [filterEntidadId, proyectos],
  );

  const proyectoIdsEntidadArr = useMemo(
    () =>
      filterEntidadId && !filterProyectoId && proyectoIdsEntidad.size > 0
        ? Array.from(proyectoIdsEntidad)
        : undefined,
    [filterEntidadId, filterProyectoId, proyectoIdsEntidad],
  );

  const filtroStockPorUbicacion = Boolean(filterProyectoId || filterDepositId);
  const filtroSoloEntidad = Boolean(
    filterEntidadId && !filterProyectoId && !filterDepositId,
  );
  const filtroStockEntidadActivo = filtroStockPorUbicacion || filtroSoloEntidad;

  const depositsLista = useMemo(
    () =>
      Array.from(depositsById.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [depositsById],
  );

  const depositsEntidad = useMemo(
    () => depositsLista.map((d) => ({ id: d.id, entidad_id: d.entidad_id ?? null })),
    [depositsLista],
  );

  const depositIdsScope = useMemo(
    () =>
      listarDepositIdsParaFiltroInventario(ubicacionesInventario, {
        entidadId: filterEntidadId || undefined,
        proyectoId: filterProyectoId || undefined,
        proyectoNombre: nombreProyectoFiltro || undefined,
        proyectos,
        deposits: depositsEntidad,
      }),
    [
      ubicacionesInventario,
      filterEntidadId,
      filterProyectoId,
      nombreProyectoFiltro,
      proyectos,
      depositsEntidad,
    ],
  );

  const depositsFiltrados = useMemo(() => {
    if (!filterEntidadId && !filterProyectoId) return depositsLista;
    if (!depositIdsScope.length) return depositsLista;
    const scope = new Set(depositIdsScope);
    const scoped = depositsLista.filter((d) => scope.has(d.id));
    return scoped.length ? scoped : depositsLista;
  }, [depositsLista, filterEntidadId, filterProyectoId, depositIdsScope]);

  useEffect(() => {
    if (!filterDepositId) return;
    if (!depositsFiltrados.some((d) => d.id === filterDepositId)) {
      setFilterDepositId('');
    }
  }, [filterDepositId, depositsFiltrados]);

  useEffect(() => {
    if (!filterProyectoId || filterEntidadId) return;
    const pr = proyectos.find((p) => p.id === filterProyectoId);
    if (pr?.entidad_id) setFilterEntidadId(pr.entidad_id);
  }, [filterProyectoId, filterEntidadId, proyectos]);

  useEffect(() => {
    if (!filterEntidadId && !filterProyectoId && !filterDepositId) {
      setUbicacionIdsFiltro([]);
      setFiltroSinUbicaciones(false);
      setDepositoSinInterseccion(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setCargandoUbicaciones(true);
      try {
        let ubicaciones = ubicacionesInventario.length
          ? ubicacionesInventario
          : await listarUbicacionesParaFiltroInventario(supabase);

        let nombreObraFiltro = nombreProyectoFiltro;
        if (filterProyectoId && !nombreObraFiltro.trim()) {
          const { data: prRow } = await supabase
            .from('ci_proyectos')
            .select('nombre')
            .eq('id', filterProyectoId)
            .maybeSingle();
          nombreObraFiltro = String(prRow?.nombre ?? '').trim();
        }

        const depositoFiltro = filterDepositId ? depositsById.get(filterDepositId) : undefined;
        const depositNombre = depositoFiltro?.name?.trim() || undefined;

        const resolverIds = (ubs: UbicacionInventario[]) => {
          if (filterProyectoId) {
            return resolverUbicacionIdsFiltroConMeta(ubs, {
              proyectoId: filterProyectoId,
              proyectoNombre: nombreObraFiltro || undefined,
              depositId: filterDepositId || undefined,
              depositNombre,
            });
          }
          if (filterDepositId) {
            return resolverUbicacionIdsFiltroConMeta(ubs, {
              depositId: filterDepositId,
              depositNombre,
            });
          }
          if (filterEntidadId) {
            return resolverUbicacionIdsFiltroEntidadConMeta(ubs, {
              entidadId: filterEntidadId,
              proyectos,
              depositId: filterDepositId || undefined,
              depositNombre,
              deposits: depositsEntidad,
            });
          }
          return { ubicacionIds: [] as string[], depositoSinInterseccion: false };
        };

        let res = resolverIds(ubicaciones);

        if (!res.ubicacionIds.length) {
          let sync = false;
          if (filterDepositId && depositoFiltro) {
            const code =
              depositoFiltro.code?.trim() ||
              filterDepositId.replace(/-/g, '').slice(0, 12).toUpperCase();
            await asegurarUbicacionDeposito(supabase, {
              id: depositoFiltro.id,
              code,
              name: depositoFiltro.name,
            });
            sync = true;
          } else if (filterProyectoId) {
            await asegurarUbicacionObra(
              supabase,
              filterProyectoId,
              nombreObraFiltro || 'Obra',
            );
            sync = true;
          } else if (filterEntidadId && !filterProyectoId && !filterDepositId) {
            const proysEntidad = proyectos.filter((p) => p.entidad_id === filterEntidadId);
            for (const pr of proysEntidad.slice(0, 25)) {
              await asegurarUbicacionObra(supabase, pr.id, pr.nombre);
            }
            sync = true;
          }

          if (sync && !cancelled) {
            ubicaciones = await listarUbicacionesParaFiltroInventario(supabase);
            setUbicacionesInventario(ubicaciones);
            res = resolverIds(ubicaciones);
          }
        }

        if (!ubicacionesInventario.length && ubicaciones.length && !cancelled) {
          setUbicacionesInventario(ubicaciones);
        }

        if (cancelled) return;
        setUbicacionIdsFiltro(res.ubicacionIds);
        setFiltroSinUbicaciones(res.ubicacionIds.length === 0);
        setDepositoSinInterseccion(res.depositoSinInterseccion);
      } catch (e) {
        console.warn('[almacen-filtros] resolver ubicaciones:', e);
        if (!cancelled) {
          setUbicacionIdsFiltro([]);
          setFiltroSinUbicaciones(false);
          setDepositoSinInterseccion(false);
        }
      } finally {
        if (!cancelled) setCargandoUbicaciones(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    filterEntidadId,
    filterProyectoId,
    filterDepositId,
    nombreProyectoFiltro,
    proyectos,
    supabase,
    ubicacionesInventario,
    depositsById,
    depositsEntidad,
  ]);

  useEffect(() => {
    if (!hydrated || !persistReady.current) return;
    guardarInventarioCuadroFiltros({
      entidad: filterEntidadId || undefined,
      proyecto: filterProyectoId || undefined,
      deposito: filterDepositId || undefined,
    });
    const qs = new URLSearchParams(searchParams.toString());
    if (filterEntidadId) qs.set('entidad', filterEntidadId);
    else qs.delete('entidad');
    if (filterProyectoId) qs.set('proyecto', filterProyectoId);
    else qs.delete('proyecto');
    if (filterDepositId) qs.set('deposito', filterDepositId);
    else qs.delete('deposito');
    const path = `/almacen?${qs.toString()}`;
    const actual = `${window.location.pathname}${window.location.search}`;
    if (path !== actual) {
      router.replace(path, { scroll: false });
    }
  }, [
    hydrated,
    filterEntidadId,
    filterProyectoId,
    filterDepositId,
    router,
    searchParams,
  ]);

  const onSetEntidad = useCallback((id: string) => {
    setFilterEntidadId(id);
    setFilterProyectoId((prev) => {
      if (!id || !prev) return prev;
      const pr = proyectos.find((p) => p.id === prev);
      return pr?.entidad_id === id ? prev : '';
    });
  }, [proyectos]);

  const onSetProyecto = useCallback(
    (id: string) => {
      setFilterProyectoId(id);
      if (id) {
        const pr = proyectos.find((p) => p.id === id);
        if (pr?.entidad_id && !filterEntidadId) {
          setFilterEntidadId(pr.entidad_id);
        }
      }
    },
    [proyectos, filterEntidadId],
  );

  const value = useMemo(
    (): AlmacenFiltrosContextValue => ({
      hydrated,
      entidades,
      proyectos,
      depositsById,
      proyectosFiltro,
      depositsFiltrados,
      filterEntidadId,
      filterProyectoId,
      filterDepositId,
      setFilterEntidadId: onSetEntidad,
      setFilterProyectoId: onSetProyecto,
      setFilterDepositId: setFilterDepositId,
      nombreEntidadFiltro,
      nombreProyectoFiltro,
      ubicacionIdsFiltro,
      ubicacionesInventario,
      filtroSinUbicaciones,
      depositoSinInterseccion,
      cargandoUbicaciones,
      filtroStockPorUbicacion,
      filtroSoloEntidad,
      filtroStockEntidadActivo,
      proyectoIdsEntidadArr,
      proyectoIdsEntidad,
    }),
    [
      hydrated,
      entidades,
      proyectos,
      depositsById,
      proyectosFiltro,
      depositsFiltrados,
      filterEntidadId,
      filterProyectoId,
      filterDepositId,
      onSetEntidad,
      onSetProyecto,
      nombreEntidadFiltro,
      nombreProyectoFiltro,
      ubicacionIdsFiltro,
      ubicacionesInventario,
      filtroSinUbicaciones,
      depositoSinInterseccion,
      cargandoUbicaciones,
      filtroStockPorUbicacion,
      filtroSoloEntidad,
      filtroStockEntidadActivo,
      proyectoIdsEntidadArr,
      proyectoIdsEntidad,
    ],
  );

  return (
    <AlmacenFiltrosContext.Provider value={value}>{children}</AlmacenFiltrosContext.Provider>
  );
}
