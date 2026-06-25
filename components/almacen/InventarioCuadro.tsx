'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
    Package,
    AlertTriangle,
    TrendingUp,
    Search,
    Filter,
    Plus,
    Truck,
    ShieldCheck,
    Settings2,
    Trash2,
    ArrowUpRight,
    Share2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    List,
    Pencil,
    Loader2,
    Download,
    Route,
} from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import { apiUrl } from '@/lib/http/apiUrl';
import type { InspeccionCuarentenaRow } from '@/lib/almacen/listarInspeccionesCuarentena';
import {
    formatInventoryLocationLabel,
    type DepositRow,
    type FurnitureRow,
} from '@/lib/almacen/formatInventoryLocation';
import Link from 'next/link';
import {
    filtrarProyectosPorEntidad,
    labelPartida,
    loadEntidades,
    loadPartidasPorProyecto,
    loadProyectos,
    type EntidadRow,
    type PartidaRow,
    type ProyectoRow,
} from '@/lib/almacen/inventoryClasificacion';
import {
    filtrarObrasConstruccion,
    esCentroCostoEntidad,
} from '@/lib/proyectos/naturalezaProyecto';
import { etiquetaClasificacionGastoEntidad } from '@/lib/contabilidad/clasificacionGastoEntidad';
import {
  getStockAgregadoPorMaterialObra,
} from '@/lib/almacen/getStockRealObra';
import {
    cargarStockPorUbicaciones,
    cargarValorInventarioPorDeposito,
    enriquecerMapaStockConProyectoFiltro,
    fusionarFilaEnResumenStock,
    listarDepositIdsParaFiltroInventario,
    listarUbicacionesParaFiltroInventario,
    proyectoIdsDeEntidad,
    resolverUbicacionIdsFiltroConMeta,
    resolverUbicacionIdsFiltroEntidadConMeta,
    type StockEnUbicacionResumen,
    type ValorInventarioDeposito,
} from '@/lib/almacen/inventarioFiltroUbicacion';
import {
    buildInventarioShareUrl,
    copiarTextoInventario,
    descargarTextoComoArchivo,
    hasInventarioShareParams,
    inventarioCuadroPathFromState,
    inventarioFilasACsv,
    inventarioFilasATextoResumen,
    inventarioFilasATsv,
    nombreArchivoInventarioCsv,
    parseInventarioShareParams,
    type InventarioExportScope,
    type InventarioFilaExport,
    type InventarioShareState,
} from '@/lib/almacen/inventarioExportShare';
import {
    borrarInventarioCuadroFiltrosGuardados,
    filtrarInspeccionesCuarentenaCuadro,
    guardarInventarioCuadroFiltros,
    leerInventarioCuadroFiltrosGuardados,
    materialAsignadoDepositoEnAlcance,
    materialCoincideCatalogoEntidad,
    materialPasaFiltroDeposito,
    mensajeVacioCuadroAlmacen,
} from '@/lib/almacen/inventarioCuadroFiltros';
import { obtenerCatalogoEntidad } from '@/lib/almacen/catalogoEntidad';
import type { UbicacionInventario } from '@/types/inventario-obra';
import CeldaStockEditable from '@/components/almacen/CeldaStockEditable';
import { useAlmacenFiltros } from '@/components/almacen/AlmacenFiltrosProvider';
import { resolverUbicacionAjusteStock } from '@/lib/almacen/resolverUbicacionAjusteStock';
import {
    cargarReordenPorObra,
    reorderPointEfectivo,
} from '@/lib/almacen/inventarioReordenObra';

const INVENTORY_SELECT = `
  *,
  entidad:ci_entidades(id,nombre,rif),
  proyecto:ci_proyectos(id,nombre,entidad_id,naturaleza_proyecto,clasificacion_gasto_entidad),
  partida:ci_presupuesto_partidas(id,codigo_partida,descripcion),
  category:material_categories(id,name)
`;

const CATEGORIAS_FILTRO = [
    'Todos',
    'Materiales',
    'Herramientas',
    'Maquinaria',
    'Combustibles',
    'Consumibles',
    'EPP',
] as const;

type KpiVista = 'ninguno' | 'stock_bajo' | 'cuarentena' | 'sku';

function nombreCategoriaItem(item: InventoryItem): string {
    const cat = item.category;
    const raw = Array.isArray(cat) ? cat[0] : cat;
    return String(raw?.name ?? '').trim();
}

function categoriaCoincideFiltro(item: InventoryItem, filtro: string): boolean {
    if (filtro === 'Todos') return true;
    const n = nombreCategoriaItem(item).toLowerCase();
    switch (filtro) {
        case 'Materiales':
            return n.includes('material');
        case 'Herramientas':
            return n.includes('herramient');
        case 'Maquinaria':
            return n.includes('maquinaria') || n.includes('equipo');
        case 'Combustibles':
            return n.includes('combustib');
        case 'Consumibles':
            return n.includes('consumib') || n.includes('logística de campo') || n.includes('logistica de campo');
        case 'EPP':
            return n.includes('epp') || n.includes('protección') || n.includes('proteccion');
        default:
            return true;
    }
}

function filtroCategoriaParaItem(item: InventoryItem): string {
    for (const cat of CATEGORIAS_FILTRO) {
        if (cat !== 'Todos' && categoriaCoincideFiltro(item, cat)) return cat;
    }
    return 'Todos';
}

/** Entidad del catálogo puede estar vacía aunque el material tenga stock físico en la obra filtrada. */
function materialPasaFiltroEntidad(
    item: InventoryItem,
    opts: {
        filterEntidadId?: string;
        filterEntidadNombre?: string | null;
        filterProyectoId?: string;
        filterDepositId?: string;
        proyectoIdsEntidad?: Set<string>;
        sapPrefijoEntidad?: string | null;
        stockEnFiltro: number;
        filtroStockPorUbicacion: boolean;
        filtroSoloEntidad: boolean;
        /** Materiales en cuarentena de la obra filtrada (sin stock físico aún). */
        materialIdsCuarentenaObra?: Set<string>;
        depositIdsScope?: readonly string[];
        stockDepositIds?: string[];
    },
): boolean {
    /** Con filtro de almacén/obra: si hay stock físico, mostrar aunque el catálogo no coincida. */
    if (
        opts.stockEnFiltro > 0 &&
        (opts.filtroStockPorUbicacion || opts.filtroSoloEntidad)
    ) {
        return true;
    }

    if (!opts.filterEntidadId) {
        if (opts.filtroStockPorUbicacion && opts.stockEnFiltro > 0 && opts.filterProyectoId) {
            return true;
        }
        return true;
    }

    const catalogMatch = materialCoincideCatalogoEntidad(item, {
        filterEntidadId: opts.filterEntidadId,
        filterEntidadNombre: opts.filterEntidadNombre,
        proyectoIdsEntidad: opts.proyectoIdsEntidad,
        sapPrefijoEntidad: opts.sapPrefijoEntidad,
    });

    if (!opts.filterProyectoId) {
        if (opts.filterDepositId) {
            if (catalogMatch && opts.stockEnFiltro > 0) return true;
            if (catalogMatch && item.deposit_id === opts.filterDepositId) return true;
            return false;
        }
        if (catalogMatch) return true;
        if (opts.filtroSoloEntidad && opts.stockEnFiltro > 0) return true;
        return false;
    }

    if (opts.filtroStockPorUbicacion && opts.stockEnFiltro > 0) return true;
    if (opts.materialIdsCuarentenaObra?.has(item.id)) return true;
    if (
        opts.filterProyectoId &&
        !opts.filterDepositId &&
        materialAsignadoDepositoEnAlcance(
            item,
            { deposit_ids: opts.stockDepositIds },
            { depositIdsScope: opts.depositIdsScope },
        )
    ) {
        return true;
    }
    if (!catalogMatch) return false;
    if (item.proyecto_id === opts.filterProyectoId) return true;
    return false;
}

function labelUbicacionEnTabla(
    item: InventoryItem,
    stockUb: StockEnUbicacionResumen | undefined,
    filtroPorUbicacionActivo: boolean,
    depositsById: Map<string, DepositRow>,
    furnitureById: Map<string, FurnitureRow>,
): string {
    if (filtroPorUbicacionActivo && stockUb?.ubicacion_nombres?.length) {
        const almacenes = stockUb.ubicacion_nombres.join(' · ');
        const obras = (stockUb.proyecto_nombres ?? []).filter(Boolean).join(' · ');
        if (obras && !almacenes.toLowerCase().includes(obras.toLowerCase())) {
            return `${almacenes} · ${obras}`;
        }
        return almacenes;
    }
    return formatInventoryLocationLabel(item, depositsById, furnitureById);
}

function obraMostradaEnTabla(
    item: InventoryItem,
    stockUb: StockEnUbicacionResumen | undefined,
    filtroPorUbicacionActivo: boolean,
    filterProyectoId: string,
    proyectos: ProyectoRow[],
): { nombre: string; desdeStockFisico: boolean } | null {
    if (item.proyecto?.nombre?.trim()) {
        return { nombre: item.proyecto.nombre.trim(), desdeStockFisico: false };
    }
    const desdeUbicacion = (stockUb?.proyecto_nombres ?? []).filter((n) => n.trim());
    if (desdeUbicacion.length) {
        return {
            nombre: desdeUbicacion.join(' · '),
            desdeStockFisico: true,
        };
    }
    if (filtroPorUbicacionActivo && filterProyectoId) {
        const pr = proyectos.find((p) => p.id === filterProyectoId);
        if (pr?.nombre?.trim()) {
            return { nombre: pr.nombre.trim(), desdeStockFisico: true };
        }
    }
    return null;
}

const NAV_ALMACEN = [
    { href: '/almacen/procurement', label: 'Compras', icon: Truck, className: 'border-blue-500/40 bg-blue-600/20 text-blue-100' },
    { href: '/almacen/recepcion', label: 'Ingreso', icon: Package, className: 'border-[#FF9500]/40 bg-[#FF9500]/10 text-[#FF9500]' },
    { href: '/almacen/despacho', label: 'SALIDA', icon: ArrowUpRight, className: 'border-orange-500/35 text-orange-200' },
    { href: '/almacen/maestros', label: 'Catálogo', icon: Package, className: 'border-blue-500/35 text-blue-200' },
    { href: '/almacen?cuadro=trazabilidad', label: 'Trazabilidad / Kardex', icon: Route, className: 'border-amber-500/35 bg-amber-500/10 text-amber-200' },
    { href: '/almacen/maestros', label: 'Configuración', icon: Settings2, className: 'border-zinc-800 text-zinc-300' },
    { href: null, label: 'Compartir', icon: Share2, className: 'border-zinc-800 text-zinc-300', action: 'share' as const },
    { href: '/almacen/nuevo', label: 'Nuevo', icon: Plus, className: 'border-white/20 bg-white text-black' },
] as const;

type StatFlipKey = 'valor' | 'bajo' | 'cuarentena' | 'sku';

function FlipStatCard({
    flipped,
    onToggle,
    front,
    back,
    className = '',
}: {
    flipped: boolean;
    onToggle: () => void;
    front: React.ReactNode;
    back: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                }
            }}
            className={`relative h-[132px] cursor-pointer select-none ${className}`}
            style={{ perspective: '1000px' }}
        >
            <div
                className="relative w-full h-full transition-transform duration-500 ease-in-out"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
            >
                <div
                    className={`absolute inset-0 ${flipped ? 'pointer-events-none' : 'pointer-events-auto'}`}
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                    <GlassCard className="p-4 h-full">{front}</GlassCard>
                </div>
                <div
                    className={`absolute inset-0 overflow-y-auto max-h-[132px] ${flipped ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    <GlassCard className="p-3 h-full">{back}</GlassCard>
                </div>
            </div>
        </div>
    );
}

/** Coincide nombres entre inventario y catálogo comercial (`products.nombre`). */
function normalizeInventoryName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildCatalogImageLookup(
    rows: { nombre: string | null; imagen: string | null }[] | null | undefined,
): Record<string, string> {
    const lookup: Record<string, string> = {};
    for (const row of rows ?? []) {
        const key = normalizeInventoryName(String(row.nombre ?? ''));
        if (!key) continue;
        const u = typeof row.imagen === 'string' ? row.imagen.trim() : '';
        if (!u) continue;
        if (lookup[key] === undefined) lookup[key] = u;
    }
    return lookup;
}

/** Prioridad: `image_url` → foto vía `product_id` → coincidencia de nombre con catálogo. */
function InventoryListThumb({
    imageUrl,
    catalogUrlFromProduct,
    catalogUrlFromName,
}: {
    imageUrl: string | null | undefined;
    catalogUrlFromProduct?: string | null;
    catalogUrlFromName?: string | null;
}) {
    const [failed, setFailed] = useState(false);
    const resolved =
        (imageUrl?.trim() ||
            catalogUrlFromProduct?.trim() ||
            catalogUrlFromName?.trim() ||
            '') ||
        '';

    useEffect(() => {
        setFailed(false);
    }, [resolved]);

    const showImage = Boolean(resolved) && !failed;

    return (
        <div
            suppressHydrationWarning
            className="w-9 h-9 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center shrink-0"
        >
            {showImage ? (
                <img
                    src={resolved}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <Package className="text-zinc-700" size={16} />
            )}
        </div>
    );
}

function resolverDepositoValorItem(
    item: InventoryItem,
    stockUb: StockEnUbicacionResumen | undefined,
    filterDepositId: string,
): string {
    if (filterDepositId) return filterDepositId;
    const ids = stockUb?.deposit_ids?.filter(Boolean);
    if (ids?.length === 1) return ids[0]!;
    if (item.deposit_id?.trim()) return item.deposit_id.trim();
    if (ids?.length) return ids[0]!;
    return '__sin__';
}

export default function InventarioCuadro() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        entidades,
        proyectos,
        depositsById,
        proyectosFiltro,
        depositsFiltrados,
        filterEntidadId,
        filterProyectoId,
        filterDepositId,
        setFilterEntidadId,
        setFilterProyectoId,
        setFilterDepositId,
        nombreEntidadFiltro,
        nombreProyectoFiltro,
        ubicacionIdsFiltro,
        ubicacionesInventario,
        filtroSinUbicaciones,
        depositoSinInterseccion,
        cargandoUbicaciones: cargandoStockUbicacion,
        filtroStockPorUbicacion,
        filtroSoloEntidad,
        filtroStockEntidadActivo,
        proyectoIdsEntidadArr,
        proyectoIdsEntidad,
    } = useAlmacenFiltros();
    const shareParamsApplied = useRef(false);
    const filtrosPersistenciaLista = useRef(false);
    const [hydrated, setHydrated] = useState(false);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');
    const [stats, setStats] = useState({
        totalValue: 0,
        lowStockCount: 0,
        totalItems: 0,
        quarantineCount: 0
    });
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingBulk, setDeletingBulk] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const selectAllRef = useRef<HTMLInputElement>(null);
    /** `products.imagen` por nombre normalizado (fallback si no hay `product_id`). */
    const [catalogImagenByName, setCatalogImagenByName] = useState<Record<string, string>>({});
    /** `products.imagen` por `products.id` cuando el ítem tiene `product_id`. */
    const [catalogImagenByProductId, setCatalogImagenByProductId] = useState<Record<number, string>>({});
    const [furnitureById, setFurnitureById] = useState<Map<string, FurnitureRow>>(new Map());
    const [mastersWarning, setMastersWarning] = useState<string | null>(null);
    const [partidasFiltro, setPartidasFiltro] = useState<PartidaRow[]>([]);
    const [filterPartidaId, setFilterPartidaId] = useState('');
    const [sinClasificacionObra, setSinClasificacionObra] = useState(false);
    const [sinAlmacenAsignado, setSinAlmacenAsignado] = useState(false);
    /** Stock en `inventario_stock` (compras registradas por ubicación, migr. 180). */
    const [stockPorUbicacion, setStockPorUbicacion] = useState<
        Map<string, StockEnUbicacionResumen>
    >(new Map());
    const [itemsDesdeStock, setItemsDesdeStock] = useState<InventoryItem[]>([]);
    const [cargandoStockUbicacionLocal, setCargandoStockUbicacionLocal] = useState(false);
    const cargandoStockFiltro = cargandoStockUbicacion || cargandoStockUbicacionLocal;
    const [savingStockId, setSavingStockId] = useState<string | null>(null);
    /** Stock agregado de todas las ubicaciones (KPIs sin filtro de almacén). */
    const [stockGlobal, setStockGlobal] = useState<Map<string, StockEnUbicacionResumen>>(new Map());
    const [stockGlobalCargado, setStockGlobalCargado] = useState(false);
    /** Umbral stock bajo por obra (migr. 246); fallback a global_inventory.reorder_point. */
    const [reordenPorObra, setReordenPorObra] = useState<Map<string, number>>(new Map());
    const [statFlips, setStatFlips] = useState<Record<StatFlipKey, boolean>>({
        valor: false,
        bajo: false,
        cuarentena: false,
        sku: false,
    });
    const [valorRotateIdx, setValorRotateIdx] = useState(0);
    const [kpiVista, setKpiVista] = useState<KpiVista>('ninguno');
    const [exportScope, setExportScope] = useState<InventarioExportScope>('filtrado');
    const [compartidoOk, setCompartidoOk] = useState(false);
    const [valorPorDeposito, setValorPorDeposito] = useState<ValorInventarioDeposito[]>([]);
    const [sapPrefijoEntidadFiltro, setSapPrefijoEntidadFiltro] = useState<string | null>(null);
    /** Inspecciones PENDIENTE (fuente operativa de cuarentena). */
    const [cuarentenaOperativa, setCuarentenaOperativa] = useState<InspeccionCuarentenaRow[]>([]);
    /** Panel categorías + filtros avanzados (colapsable para ver más tabla). */
    const [panelFiltrosExpandido, setPanelFiltrosExpandido] = useState(true);

    const toggleStatFlip = useCallback((key: StatFlipKey) => {
        setStatFlips((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const supabase = createClient();

    const aplicarFiltrosInventario = useCallback((parsed: Partial<InventarioShareState>) => {
        if (parsed.q) setSearchTerm(parsed.q);
        if (parsed.cat && (CATEGORIAS_FILTRO as readonly string[]).includes(parsed.cat)) {
            setActiveCategory(parsed.cat);
        }
        if (parsed.partida) setFilterPartidaId(parsed.partida);
        if (parsed.sinObra) setSinClasificacionObra(true);
        if (parsed.sinAlmacen) setSinAlmacenAsignado(true);
        if (
            parsed.kpi === 'stock_bajo' ||
            parsed.kpi === 'cuarentena' ||
            parsed.kpi === 'sku'
        ) {
            setKpiVista(parsed.kpi);
        }
    }, []);

    useEffect(() => {
        setHydrated(true);
        try {
            const raw = localStorage.getItem('ci-inventario-panel-filtros-expandido');
            if (raw === '0') setPanelFiltrosExpandido(false);
        } catch {
            /* modo privado */
        }
    }, []);

    const alternarPanelFiltros = useCallback(() => {
        setPanelFiltrosExpandido((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('ci-inventario-panel-filtros-expandido', next ? '1' : '0');
            } catch {
                /* ignore */
            }
            return next;
        });
    }, []);

    const cargarCuarentenaOperativa = useCallback(async () => {
        try {
            const res = await fetch(apiUrl('/api/almacen/quality/pendientes'), { cache: 'no-store' });
            const json = (await res.json()) as { items?: InspeccionCuarentenaRow[] };
            if (!res.ok) return;
            const items = json.items ?? [];
            setCuarentenaOperativa(items);
            const unidades = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            setStats((prev) => ({ ...prev, quarantineCount: unidades }));
        } catch {
            /* KPI opcional */
        }
    }, []);

    useEffect(() => {
        if (!hydrated || shareParamsApplied.current) return;
        shareParamsApplied.current = true;

        const fromUrl = hasInventarioShareParams(searchParams)
            ? parseInventarioShareParams(searchParams)
            : null;
        const fromStorage = !fromUrl ? leerInventarioCuadroFiltrosGuardados() : null;
        aplicarFiltrosInventario(fromUrl ?? fromStorage ?? {});
        filtrosPersistenciaLista.current = true;
    }, [hydrated, searchParams, aplicarFiltrosInventario]);

    useEffect(() => {
        if (depositsById.size === 0) return;
        setMastersWarning(null);
    }, [depositsById.size]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const ubicaciones = await listarUbicacionesParaFiltroInventario(supabase);
                const ids = ubicaciones.map((u) => u.id);
                if (!ids.length) return;
                const stockMap = await cargarStockPorUbicaciones(supabase, ids);
                if (!cancelled) {
                    setStockGlobal(stockMap);
                    setStockGlobalCargado(true);
                }
            } catch (e) {
                console.warn('[inventario] stock global:', e);
                if (!cancelled) setStockGlobalCargado(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [supabase]);

    useEffect(() => {
        if (!filterProyectoId) {
            setReordenPorObra(new Map());
            return;
        }
        let cancelled = false;
        void cargarReordenPorObra(supabase, filterProyectoId)
            .then((map) => {
                if (!cancelled) setReordenPorObra(map);
            })
            .catch((e) => {
                console.warn('[inventario] reorden obra:', e);
                if (!cancelled) setReordenPorObra(new Map());
            });
        return () => {
            cancelled = true;
        };
    }, [filterProyectoId, supabase]);

    useEffect(() => {
        if (!filterProyectoId) {
            setPartidasFiltro([]);
            setFilterPartidaId('');
            return;
        }
        void loadPartidasPorProyecto(supabase, filterProyectoId).then(setPartidasFiltro).catch(() => setPartidasFiltro([]));
    }, [filterProyectoId, supabase]);

    const proyectosById = useMemo(
        () => new Map(proyectos.map((p) => [p.id, p])),
        [proyectos],
    );

    useEffect(() => {
        if (!filterEntidadId) {
            setSapPrefijoEntidadFiltro(null);
            return;
        }
        let cancelled = false;
        void obtenerCatalogoEntidad(supabase, filterEntidadId)
            .then((row) => {
                if (!cancelled) setSapPrefijoEntidadFiltro(row?.sap_prefijo ?? null);
            })
            .catch(() => {
                if (!cancelled) setSapPrefijoEntidadFiltro(null);
            });
        return () => {
            cancelled = true;
        };
    }, [filterEntidadId, supabase]);

    const depositsLista = useMemo(() => {
        return Array.from(depositsById.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'es'),
        );
    }, [depositsById]);

    const depositIdsScope = useMemo(
        () =>
            listarDepositIdsParaFiltroInventario(ubicacionesInventario, {
                entidadId: filterEntidadId || undefined,
                proyectoId: filterProyectoId || undefined,
                proyectoNombre: nombreProyectoFiltro || undefined,
                proyectos,
                deposits: depositsLista.map((d) => ({ id: d.id, entidad_id: d.entidad_id ?? null })),
            }),
        [ubicacionesInventario, filterEntidadId, filterProyectoId, nombreProyectoFiltro, proyectos, depositsLista],
    );

    const hrefDespacho = useMemo(() => {
        const q = new URLSearchParams();
        if (filterProyectoId) q.set('proyectoId', filterProyectoId);
        if (filterDepositId && ubicacionesInventario.length) {
            const candidatos = ubicacionesInventario.filter(
                (u) => u.deposit_id === filterDepositId && u.activo !== false,
            );
            let raiz =
                candidatos.find((u) => !u.ubicacion_padre_id) ??
                (filterProyectoId
                    ? candidatos.find((u) => u.obra_id === filterProyectoId)
                    : undefined) ??
                candidatos[0];
            if (raiz?.id) q.set('ubicacion_id', raiz.id);
        }
        const qs = q.toString();
        return qs ? `/almacen/despacho?${qs}` : '/almacen/despacho';
    }, [filterProyectoId, filterDepositId, ubicacionesInventario]);

    useEffect(() => {
        if (filtroStockPorUbicacion && sinClasificacionObra) {
            setSinClasificacionObra(false);
        }
    }, [filtroStockPorUbicacion, sinClasificacionObra]);

    const hayFiltrosActivos =
        Boolean(searchTerm.trim()) ||
        activeCategory !== 'Todos' ||
        Boolean(filterEntidadId) ||
        Boolean(filterProyectoId) ||
        Boolean(filterPartidaId) ||
        Boolean(filterDepositId) ||
        sinClasificacionObra ||
        sinAlmacenAsignado ||
        kpiVista !== 'ninguno';

    const etiquetasResumenFiltros = useMemo(() => {
        const chips: string[] = [];
        if (activeCategory !== 'Todos') chips.push(activeCategory);
        const ent = entidades.find((e) => e.id === filterEntidadId);
        if (ent?.nombre) chips.push(ent.nombre);
        const pr = proyectos.find((p) => p.id === filterProyectoId);
        if (pr?.nombre) chips.push(pr.nombre);
        const dep = filterDepositId ? depositsById.get(filterDepositId) : undefined;
        if (dep?.name) {
            chips.push(dep.locality ? `${dep.name} (${dep.locality})` : dep.name);
        }
        const part = partidasFiltro.find((p) => p.id === filterPartidaId);
        if (part) {
            chips.push(
                part.codigo_partida
                    ? `${part.codigo_partida} · ${part.descripcion}`
                    : part.descripcion,
            );
        }
        if (sinClasificacionObra) chips.push('Sin obra');
        if (sinAlmacenAsignado) chips.push('Sin almacén');
        if (kpiVista === 'stock_bajo') chips.push('Stock bajo');
        if (kpiVista === 'cuarentena') chips.push('Cuarentena');
        if (kpiVista === 'sku') chips.push('SKU');
        if (searchTerm.trim()) chips.push(`«${searchTerm.trim().slice(0, 28)}»`);
        return chips;
    }, [
        activeCategory,
        entidades,
        filterEntidadId,
        proyectos,
        filterProyectoId,
        filterDepositId,
        depositsById,
        partidasFiltro,
        filterPartidaId,
        sinClasificacionObra,
        sinAlmacenAsignado,
        kpiVista,
        searchTerm,
    ]);

    useEffect(() => {
        void fetchInventory();
        void cargarCuarentenaOperativa();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial; categoría filtra en cliente
    }, [cargarCuarentenaOperativa]);

    const itemsCatalogo = useMemo(() => {
        const byId = new Map<string, InventoryItem>();
        for (const it of items) byId.set(it.id, it);
        for (const it of itemsDesdeStock) {
            if (!byId.has(it.id)) byId.set(it.id, it);
        }

        const desdeMapaStock = (map: Map<string, StockEnUbicacionResumen>): InventoryItem[] => {
            const conStock: InventoryItem[] = [];
            for (const [materialId, row] of Array.from(map.entries())) {
                if (row.cantidad_disponible <= 0) continue;
                const item = byId.get(materialId);
                if (item) conStock.push(item);
            }
            return conStock.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        };

        /** Almacén / obra / entidad seleccionados → inventario_stock en esas ubicaciones. */
        if (filtroStockEntidadActivo) {
            if (cargandoStockFiltro) return [];
            return desdeMapaStock(stockPorUbicacion);
        }

        /** Sin filtro de ubicación: solo materiales con stock físico (suma global). */
        if (!stockGlobalCargado) return [];
        return desdeMapaStock(stockGlobal);
    }, [
        items,
        itemsDesdeStock,
        filtroStockEntidadActivo,
        stockPorUbicacion,
        stockGlobal,
        stockGlobalCargado,
        cargandoStockFiltro,
    ]);

    useEffect(() => {
        if (cargandoStockUbicacion) return;
        if (!filtroStockEntidadActivo) {
            setStockPorUbicacion(new Map());
            setItemsDesdeStock([]);
            return;
        }
        if (ubicacionIdsFiltro.length === 0) {
            setStockPorUbicacion(new Map());
            setItemsDesdeStock([]);
            return;
        }

        const ids = ubicacionIdsFiltro;
        let cancelled = false;
        void (async () => {
            setCargandoStockUbicacionLocal(true);
            try {
                const ubicaciones = ubicacionesInventario;
                const ubicacionesFiltro = ubicaciones.filter((u) => ids.includes(u.id));
                const nombresUbicacionFiltro = ubicacionesFiltro
                    .map((u) => u.nombre)
                    .filter(Boolean);

                let stockMap = new Map<string, StockEnUbicacionResumen>();
                const etiquetaUb =
                    nombresUbicacionFiltro[0] ?? nombreProyectoFiltro ?? 'Obra';

                if (filterProyectoId) {
                    stockMap = await cargarStockPorUbicaciones(supabase, ids);
                    if (!filterDepositId) {
                        const agg = await getStockAgregadoPorMaterialObra(
                            supabase,
                            filterProyectoId,
                            nombreProyectoFiltro || undefined,
                        );
                        agg.forEach((qty, materialId) => {
                            if (qty <= 0) return;
                            const prev = stockMap.get(materialId);
                            if (!prev) {
                                fusionarFilaEnResumenStock(stockMap, materialId, {
                                    cantidad: qty,
                                    ubicacionNombre: etiquetaUb,
                                    proyectoId: filterProyectoId,
                                    proyectoNombre: nombreProyectoFiltro || undefined,
                                });
                            } else if (prev.cantidad_disponible < qty) {
                                stockMap.set(materialId, {
                                    ...prev,
                                    cantidad_disponible: qty,
                                });
                            }
                        });
                    }
                } else if (filterEntidadId && !filterDepositId) {
                    stockMap = await cargarStockPorUbicaciones(supabase, ids);
                    const proysEntidad = proyectos.filter((p) => p.entidad_id === filterEntidadId);
                    for (const pr of proysEntidad) {
                        const agg = await getStockAgregadoPorMaterialObra(
                            supabase,
                            pr.id,
                            pr.nombre,
                        );
                        agg.forEach((qty, materialId) => {
                            if (qty <= 0) return;
                            const prev = stockMap.get(materialId);
                            if (!prev) {
                                fusionarFilaEnResumenStock(stockMap, materialId, {
                                    cantidad: qty,
                                    ubicacionNombre: pr.nombre,
                                    proyectoId: pr.id,
                                    proyectoNombre: pr.nombre,
                                });
                            } else if (prev.cantidad_disponible < qty) {
                                stockMap.set(materialId, {
                                    ...prev,
                                    cantidad_disponible: qty,
                                });
                            }
                        });
                    }
                } else {
                    stockMap = await cargarStockPorUbicaciones(supabase, ids);
                }

                if (filterProyectoId) {
                    enriquecerMapaStockConProyectoFiltro(stockMap, {
                        proyectoId: filterProyectoId,
                        proyectoNombre: nombreProyectoFiltro || undefined,
                    });
                }
                if (cancelled) return;
                setStockPorUbicacion(stockMap);

                const knownIds = new Set(items.map((i) => i.id));
                const missing = Array.from(stockMap.keys()).filter((id) => !knownIds.has(id));
                if (!missing.length) {
                    setItemsDesdeStock([]);
                    return;
                }

                const { data: extraRows, error } = await supabase
                    .from('global_inventory')
                    .select(INVENTORY_SELECT)
                    .in('id', missing);
                if (cancelled) return;
                if (error) {
                    console.warn('[inventario] materiales por stock ubicación:', error.message);
                    setItemsDesdeStock([]);
                    return;
                }
                const prFiltro = filterProyectoId
                    ? proyectos.find((p) => p.id === filterProyectoId)
                    : filterEntidadId
                      ? proyectos.find((p) => p.entidad_id === filterEntidadId)
                      : undefined;
                setItemsDesdeStock(
                    (extraRows ?? []).map((row) => {
                        const item = row as InventoryItem;
                        if (item.proyecto_id?.trim() || !prFiltro) return item;
                        return {
                            ...item,
                            proyecto_id: prFiltro.id,
                            proyecto: {
                                id: prFiltro.id,
                                nombre: prFiltro.nombre,
                                entidad_id: prFiltro.entidad_id,
                            },
                        };
                    }),
                );
            } catch (e) {
                console.warn('[inventario] stock por ubicación:', e);
                if (!cancelled) {
                    setStockPorUbicacion(new Map());
                    setItemsDesdeStock([]);
                }
            } finally {
                if (!cancelled) setCargandoStockUbicacionLocal(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        cargandoStockUbicacion,
        filtroStockEntidadActivo,
        ubicacionIdsFiltro,
        filterProyectoId,
        filterDepositId,
        filterEntidadId,
        supabase,
        items,
        proyectos,
        ubicacionesInventario,
        nombreProyectoFiltro,
    ]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            let invQuery = supabase.from('global_inventory').select(INVENTORY_SELECT).order('name');

            if (activeCategory !== 'Todos') {
                // Assuming we join with categories or have category names here
                // For now, let's just fetch all or filter if we had categories
            }

            let invRes = await invQuery;
            const [prodRes, depRes, furRes] = await Promise.all([
                supabase.from('products').select('nombre, imagen').not('imagen', 'is', null),
                supabase.from('inventory_deposits').select('id,name,locality,code,entidad_id'),
                supabase.from('inventory_furniture').select('id,deposit_id,name'),
            ]);

            if (invRes.error) {
                const msg = invRes.error.message ?? '';
                if (
                    msg.includes('entidad_id') ||
                    msg.includes('presupuesto_partida') ||
                    msg.includes('naturaleza_proyecto') ||
                    msg.includes('clasificacion_gasto_entidad') ||
                    invRes.error.code === '42703'
                ) {
                    invQuery = supabase
                        .from('global_inventory')
                        .select(
                            `*, entidad:ci_entidades(id,nombre,rif), proyecto:ci_proyectos(id,nombre,entidad_id), partida:ci_presupuesto_partidas(id,codigo_partida,descripcion), category:material_categories(id,name)`,
                        )
                        .order('name');
                    invRes = await invQuery;
                }
            }
            if (invRes.error) throw invRes.error;

            const inventoryItems = (invRes.data ?? []) as InventoryItem[];
            setItems(inventoryItems);

            const furMap = new Map<string, FurnitureRow>();
            for (const f of (furRes.data ?? []) as FurnitureRow[]) {
                if (f.id) furMap.set(f.id, f);
            }
            setFurnitureById(furMap);

            if (depRes.error) {
                setMastersWarning(
                    `No se cargaron depósitos (ubicación): ${depRes.error.message}. Ejecute migración 014 en Supabase.`
                );
            } else if (depositsById.size === 0 && (depRes.data ?? []).length === 0) {
                setMastersWarning(
                    'No hay depósitos en inventory_deposits. Cree al menos uno en Almacén → Maestros.'
                );
            } else {
                setMastersWarning(null);
            }

            if (furRes.error) {
                console.warn('inventory_furniture:', furRes.error.message);
            }

            if (!prodRes.error && prodRes.data) {
                setCatalogImagenByName(buildCatalogImageLookup(prodRes.data));
            } else {
                console.warn('Catálogo products (imagen):', prodRes.error?.message);
                setCatalogImagenByName({});
            }

            const linkedIds = Array.from(
                new Set(
                    inventoryItems
                        .map((row) => (row.product_id != null ? Number(row.product_id) : NaN))
                        .filter((n) => Number.isFinite(n) && n > 0),
                ),
            );
            if (linkedIds.length > 0) {
                const { data: byIdRows, error: byIdErr } = await supabase
                    .from('products')
                    .select('id, imagen')
                    .in('id', linkedIds);
                if (!byIdErr && byIdRows) {
                    const map: Record<number, string> = {};
                    for (const r of byIdRows) {
                        const id = Number(r.id);
                        const u = typeof r.imagen === 'string' ? r.imagen.trim() : '';
                        if (Number.isFinite(id) && u) map[id] = u;
                    }
                    setCatalogImagenByProductId(map);
                } else {
                    setCatalogImagenByProductId({});
                }
            } else {
                setCatalogImagenByProductId({});
            }

            // KPIs de stock usan inventario_stock (filtro obra); sin filtro el valor es referencial del catálogo
            const totalVal = 0;
            const lowStock = 0;
            setStats((prev) => ({
                totalValue: totalVal,
                lowStockCount: lowStock,
                totalItems: inventoryItems.length,
                quarantineCount: prev.quarantineCount,
            }));
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const filtroPorUbicacionActivo = filtroStockEntidadActivo;

    const cantidadStockReal = useCallback(
        (item: InventoryItem): number => {
            if (filtroStockEntidadActivo) {
                return stockPorUbicacion.get(item.id)?.cantidad_disponible ?? 0;
            }
            const fromStock = stockGlobal.get(item.id)?.cantidad_disponible;
            if (fromStock != null) return fromStock;
            return 0;
        },
        [filtroStockEntidadActivo, stockPorUbicacion, stockGlobal],
    );

    const reorderPointItem = useCallback(
        (item: InventoryItem): number =>
            reorderPointEfectivo(
                item.id,
                Number(item.reorder_point),
                filterProyectoId ? reordenPorObra : null,
            ),
        [filterProyectoId, reordenPorObra],
    );

    const actualizarStockLocal = useCallback(
        (materialId: string, cantidadNueva: number) => {
            setStockPorUbicacion((prev) => {
                if (!prev.has(materialId)) return prev;
                const next = new Map(prev);
                const row = next.get(materialId);
                if (row) next.set(materialId, { ...row, cantidad_disponible: cantidadNueva });
                return next;
            });
            setStockGlobal((prev) => {
                if (!prev.has(materialId)) return prev;
                const next = new Map(prev);
                const row = next.get(materialId);
                if (row) next.set(materialId, { ...row, cantidad_disponible: cantidadNueva });
                return next;
            });
        },
        [],
    );

    const guardarStockCuadro = useCallback(
        async (materialId: string, cantidadNueva: number) => {
            setSavingStockId(materialId);
            try {
                const stockUb = stockPorUbicacion.get(materialId) ?? stockGlobal.get(materialId);
                const ubicacionId = await resolverUbicacionAjusteStock({
                    materialId,
                    stockUb,
                    ubicacionIdsFiltro,
                });
                if (!ubicacionId) {
                    throw new Error(
                        'Indique proyecto o almacén en los filtros, o edite el material en detalle.',
                    );
                }

                const res = await fetch(
                    `/api/almacen/inventario/${encodeURIComponent(materialId)}/stock`,
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ubicacion_id: ubicacionId,
                            cantidad: cantidadNueva,
                            notas: 'Ajuste manual desde cuadro de almacén',
                        }),
                    },
                );
                const data = (await res.json()) as { error?: string; cantidadNueva?: number };
                if (!res.ok) throw new Error(data.error || 'No se pudo ajustar el stock');

                const qty = Number(data.cantidadNueva ?? cantidadNueva);
                actualizarStockLocal(materialId, qty);
            } finally {
                setSavingStockId(null);
            }
        },
        [actualizarStockLocal, stockPorUbicacion, stockGlobal, ubicacionIdsFiltro],
    );

    const cuarentenaFiltrada = useMemo(
        () =>
            filtrarInspeccionesCuarentenaCuadro(cuarentenaOperativa, {
                filterEntidadId: filterEntidadId || undefined,
                filterProyectoId: filterProyectoId || undefined,
                filterDepositId: filterDepositId || undefined,
                ubicacionIdsFiltro: ubicacionIdsFiltro,
            }),
        [
            cuarentenaOperativa,
            filterEntidadId,
            filterProyectoId,
            filterDepositId,
            ubicacionIdsFiltro,
        ],
    );

    const materialIdsCuarentenaObra = useMemo(
        () => new Set(cuarentenaFiltrada.map((i) => i.material_id)),
        [cuarentenaFiltrada],
    );

    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        return itemsCatalogo.filter((item) => {
            if (
                filtroStockEntidadActivo &&
                cargandoStockFiltro &&
                kpiVista !== 'cuarentena'
            ) {
                return false;
            }

            const dep = item.deposit_id ? depositsById.get(item.deposit_id) : undefined;
            const depLabel = dep
                ? `${dep.name} ${dep.locality ?? ''}`.toLowerCase()
                : '';
            const stockUb = stockPorUbicacion.get(item.id);
            const stockEnFiltro = stockUb?.cantidad_disponible ?? 0;
            const ubicacionStockLabel = (stockUb?.ubicacion_nombres ?? []).join(' ').toLowerCase();

            const textMatch =
                !term ||
                item.name.toLowerCase().includes(term) ||
                (item.sap_code?.toLowerCase().includes(term) ?? false) ||
                (item.entidad?.nombre?.toLowerCase().includes(term) ?? false) ||
                (item.proyecto?.nombre?.toLowerCase().includes(term) ?? false) ||
                (item.partida?.codigo_partida?.toLowerCase().includes(term) ?? false) ||
                (item.partida?.descripcion?.toLowerCase().includes(term) ?? false) ||
                depLabel.includes(term) ||
                ubicacionStockLabel.includes(term) ||
                (item.location?.toLowerCase().includes(term) ?? false);

            if (!textMatch) return false;
            if (!categoriaCoincideFiltro(item, activeCategory)) return false;
            if (
                !materialPasaFiltroEntidad(item, {
                    filterEntidadId,
                    filterEntidadNombre: nombreEntidadFiltro,
                    filterProyectoId,
                    filterDepositId,
                    proyectoIdsEntidad,
                    sapPrefijoEntidad: sapPrefijoEntidadFiltro,
                    stockEnFiltro,
                    filtroStockPorUbicacion,
                    filtroSoloEntidad,
                    materialIdsCuarentenaObra:
                        kpiVista === 'cuarentena' ? materialIdsCuarentenaObra : undefined,
                    depositIdsScope:
                        filterProyectoId && !filterDepositId ? depositIdsScope : undefined,
                    stockDepositIds: stockUb?.deposit_ids,
                })
            ) {
                return false;
            }
            if (
                !materialPasaFiltroDeposito(item, stockUb, {
                    filterDepositId,
                    filtroStockPorUbicacion,
                    filtroSinUbicaciones,
                    cargandoStockUbicacion: cargandoStockFiltro,
                })
            ) {
                return false;
            }
            if (filterPartidaId && item.presupuesto_partida_id !== filterPartidaId) return false;
            if (sinClasificacionObra && (item.proyecto_id || item.entidad_id)) return false;
            if (sinAlmacenAsignado && item.deposit_id) return false;

            if (!filtroStockPorUbicacion) {
                if (filterProyectoId && item.proyecto_id !== filterProyectoId) return false;
                if (filterDepositId && item.deposit_id !== filterDepositId) return false;
            }

            const qty = cantidadStockReal(item);
            if (kpiVista === 'stock_bajo' && qty > reorderPointItem(item)) return false;
            if (kpiVista === 'cuarentena') {
                if (!materialIdsCuarentenaObra.has(item.id)) return false;
            } else {
                const stockDatosListos = filtroStockEntidadActivo
                    ? !cargandoStockFiltro
                    : stockGlobalCargado;
                if (stockDatosListos && qty <= 0) return false;
            }

            return true;
        });
    }, [
        itemsCatalogo,
        searchTerm,
        activeCategory,
        filterEntidadId,
        filterProyectoId,
        filterPartidaId,
        filterDepositId,
        sinClasificacionObra,
        sinAlmacenAsignado,
        depositsById,
        filtroStockPorUbicacion,
        filtroSoloEntidad,
        filtroStockEntidadActivo,
        sapPrefijoEntidadFiltro,
        nombreEntidadFiltro,
        proyectoIdsEntidad,
        filtroSinUbicaciones,
        stockPorUbicacion,
        stockGlobalCargado,
        cargandoStockFiltro,
        reorderPointItem,
        kpiVista,
        cuarentenaFiltrada,
        materialIdsCuarentenaObra,
        depositIdsScope,
    ]);

    const todasSeleccionadas = useMemo(
        () => filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id)),
        [filteredItems, selectedIds],
    );
    const algunaSeleccionada = selectedIds.size > 0;
    const seleccionIndeterminada = algunaSeleccionada && !todasSeleccionadas;

    useEffect(() => {
        const el = selectAllRef.current;
        if (el) el.indeterminate = seleccionIndeterminada;
    }, [seleccionIndeterminada]);

    useEffect(() => {
        setSelectedIds((prev) => {
            const visible = new Set(filteredItems.map((item) => item.id));
            const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [filteredItems]);

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            if (filteredItems.length > 0 && filteredItems.every((item) => prev.has(item.id))) {
                return new Set();
            }
            return new Set(filteredItems.map((item) => item.id));
        });
    }, [filteredItems]);

    const toggleSelectItem = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const estadoCompartir = useMemo((): InventarioShareState => {
        return {
            q: searchTerm.trim() || undefined,
            cat: activeCategory !== 'Todos' ? activeCategory : undefined,
            entidad: filterEntidadId || undefined,
            proyecto: filterProyectoId || undefined,
            partida: filterPartidaId || undefined,
            deposito: filterDepositId || undefined,
            sinObra: sinClasificacionObra || undefined,
            sinAlmacen: sinAlmacenAsignado || undefined,
            kpi: kpiVista !== 'ninguno' ? kpiVista : undefined,
            cuadro: 'inventario',
        };
    }, [
        searchTerm,
        activeCategory,
        filterEntidadId,
        filterProyectoId,
        filterPartidaId,
        filterDepositId,
        sinClasificacionObra,
        sinAlmacenAsignado,
        kpiVista,
    ]);

    const stockParaExport = useCallback(
        (item: InventoryItem, scope: InventarioExportScope): number => {
            if (scope === 'filtrado') return cantidadStockReal(item);
            const fromStock = stockGlobal.get(item.id)?.cantidad_disponible;
            if (fromStock != null) return fromStock;
            return 0;
        },
        [cantidadStockReal, stockGlobal],
    );

    const construirFilasExport = useCallback(
        (scope: InventarioExportScope): InventarioFilaExport[] => {
            const lista = scope === 'filtrado' ? filteredItems : itemsCatalogo;
            return lista.map((item) => {
                const stockUb =
                    scope === 'filtrado' && filtroPorUbicacionActivo
                        ? stockPorUbicacion.get(item.id)
                        : undefined;
                const obraTabla = obraMostradaEnTabla(
                    item,
                    stockUb,
                    scope === 'filtrado' && filtroPorUbicacionActivo,
                    filterProyectoId,
                    proyectos,
                );
                const stock = stockParaExport(item, scope);
                const costo = Number(item.average_weighted_cost) || 0;
                const cat = item.category;
                const rawCat = Array.isArray(cat) ? cat[0] : cat;
                return {
                    codigo: item.sap_code?.trim() || '',
                    material: item.name,
                    unidad: item.unit || 'UND',
                    entidad: item.entidad?.nombre?.trim() || '',
                    obra: obraTabla?.nombre?.trim() || item.proyecto?.nombre?.trim() || '',
                    partida: item.partida
                        ? [item.partida.codigo_partida, item.partida.descripcion]
                              .filter(Boolean)
                              .join(' · ')
                        : '',
                    ubicacion:
                        scope === 'filtrado' && filtroPorUbicacionActivo
                            ? labelUbicacionEnTabla(
                                  item,
                                  stockUb,
                                  true,
                                  depositsById,
                                  furnitureById,
                              )
                            : formatInventoryLocationLabel(item, depositsById, furnitureById),
                    stock,
                    costoPromedio: costo,
                    valorStock: stock * costo,
                    ultimaCompraFecha: item.last_purchase_date
                        ? new Date(item.last_purchase_date).toLocaleDateString('es-VE')
                        : '',
                    ultimaCompraPrecio: Number(item.last_purchase_price) || 0,
                    categoria: String(rawCat?.name ?? '').trim(),
                };
            });
        },
        [
            filteredItems,
            itemsCatalogo,
            filtroPorUbicacionActivo,
            stockPorUbicacion,
            filterProyectoId,
            proyectos,
            stockParaExport,
            depositsById,
            furnitureById,
        ],
    );

    const etiquetaScopeExport = useCallback(
        (scope: InventarioExportScope) =>
            scope === 'filtrado'
                ? `Vista filtrada (${filteredItems.length} ítem(s))`
                : `Tabla completa (${itemsCatalogo.length} ítem(s))`,
        [filteredItems.length, itemsCatalogo.length],
    );

    const exportarInventarioCsv = useCallback(
        (scope: InventarioExportScope) => {
            const filas = construirFilasExport(scope);
            if (!filas.length) {
                alert('No hay materiales para exportar.');
                return;
            }
            descargarTextoComoArchivo(
                inventarioFilasACsv(filas),
                nombreArchivoInventarioCsv(scope),
            );
        },
        [construirFilasExport],
    );

    const compartirInventario = useCallback(
        async (scope: InventarioExportScope) => {
            if (typeof window === 'undefined') return;
            const filas = construirFilasExport(scope);
            if (!filas.length) {
                alert('No hay materiales para compartir.');
                return;
            }
            const url =
                scope === 'filtrado'
                    ? buildInventarioShareUrl(window.location.origin, estadoCompartir)
                    : `${window.location.origin}/almacen`;
            const totalValor = filas.reduce((s, f) => s + f.valorStock, 0);
            const titulo = '📦 Stock por obra — Casa Inteligente';
            const resumen = inventarioFilasATextoResumen(filas, {
                titulo,
                scopeLabel: etiquetaScopeExport(scope),
                totalValor,
                url,
            });

            if (typeof navigator.share === 'function') {
                try {
                    await navigator.share({
                        title: 'Stock por obra',
                        text: resumen,
                        url,
                    });
                    return;
                } catch (e) {
                    if (e instanceof Error && e.name === 'AbortError') return;
                }
            }

            const tsv = `\n\n${inventarioFilasATsv(filas)}`;
            const ok = await copiarTextoInventario(`${resumen}${tsv}`);
            if (ok) {
                setCompartidoOk(true);
                window.setTimeout(() => setCompartidoOk(false), 2500);
            } else {
                alert('No se pudo copiar al portapapeles.');
            }
        },
        [construirFilasExport, estadoCompartir, etiquetaScopeExport],
    );

    const compartirInventarioWhatsApp = useCallback(
        (scope: InventarioExportScope) => {
            if (typeof window === 'undefined') return;
            const filas = construirFilasExport(scope);
            if (!filas.length) {
                alert('No hay materiales para compartir.');
                return;
            }
            const url =
                scope === 'filtrado'
                    ? buildInventarioShareUrl(window.location.origin, estadoCompartir)
                    : `${window.location.origin}/almacen`;
            const totalValor = filas.reduce((s, f) => s + f.valorStock, 0);
            const text = inventarioFilasATextoResumen(filas, {
                titulo: `📦 *INVENTARIO DE ALMACENES* — ${new Date().toLocaleDateString('es-VE')}`,
                scopeLabel: etiquetaScopeExport(scope),
                totalValor,
                url,
                maxLineas: 40,
            });
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        },
        [construirFilasExport, estadoCompartir, etiquetaScopeExport],
    );

    const copiarInventarioPortapapeles = useCallback(
        async (scope: InventarioExportScope) => {
            const filas = construirFilasExport(scope);
            if (!filas.length) {
                alert('No hay materiales para copiar.');
                return;
            }
            const url =
                scope === 'filtrado'
                    ? buildInventarioShareUrl(window.location.origin, estadoCompartir)
                    : `${window.location.origin}/almacen`;
            const text = `${etiquetaScopeExport(scope)}\n${url}\n\n${inventarioFilasATsv(filas)}`;
            const ok = await copiarTextoInventario(text);
            if (ok) {
                setCompartidoOk(true);
                window.setTimeout(() => setCompartidoOk(false), 2500);
            } else {
                alert('No se pudo copiar al portapapeles.');
            }
        },
        [construirFilasExport, estadoCompartir, etiquetaScopeExport],
    );

    const statsFiltrados = useMemo(() => {
        const base = hayFiltrosActivos ? filteredItems : itemsCatalogo;
        const totalVal = base.reduce(
            (acc, item) =>
                acc + cantidadStockReal(item) * Number(item.average_weighted_cost),
            0,
        );
        const lowStock = base.filter(
            (item) => cantidadStockReal(item) <= reorderPointItem(item),
        ).length;
        const quarantineUnidades = (hayFiltrosActivos ? cuarentenaFiltrada : cuarentenaOperativa).reduce(
            (acc, i) => acc + (Number(i.quantity) || 0),
            0,
        );
        return {
            totalValue: totalVal,
            lowStockCount: lowStock,
            totalItems: base.length,
            quarantineCount: quarantineUnidades,
        };
    }, [
        filteredItems,
        itemsCatalogo,
        hayFiltrosActivos,
        cantidadStockReal,
        reorderPointItem,
        cuarentenaOperativa,
        cuarentenaFiltrada,
    ]);

    const baseItemsKpi = useMemo(
        () => (hayFiltrosActivos ? filteredItems : itemsCatalogo),
        [hayFiltrosActivos, filteredItems, itemsCatalogo],
    );

    const valorPorAlmacen = useMemo(() => {
        const map = new Map<string, { name: string; value: number }>();

        const depositLabel = (depId: string) => {
            const dep = depositsById.get(depId);
            return dep
                ? dep.locality
                    ? `${dep.name} (${dep.locality})`
                    : dep.name
                : 'Almacén';
        };

        for (const item of baseItemsKpi) {
            const qty = cantidadStockReal(item);
            const val = qty * Number(item.average_weighted_cost);
            if (val <= 0) continue;

            const stockUb = stockPorUbicacion.get(item.id);
            const depId = resolverDepositoValorItem(item, stockUb, filterDepositId);
            const name = depId === '__sin__' ? 'Sin almacén asignado' : depositLabel(depId);
            const prev = map.get(depId) ?? { name, value: 0 };
            map.set(depId, { name: prev.name, value: prev.value + val });
        }

        return Array.from(map.values())
            .filter((r) => r.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [
        baseItemsKpi,
        cantidadStockReal,
        depositsById,
        filterDepositId,
        stockPorUbicacion,
    ]);

    const valorDesglose = useMemo(() => {
        const fromCatalogo = valorPorAlmacen.map((d, i) => ({
            id: `cat-${d.name}-${i}`,
            name: d.name,
            value: d.value,
        }));
        if (filtroStockEntidadActivo && fromCatalogo.length) return fromCatalogo;
        const fromDeposito = valorPorDeposito
            .filter((d) => d.value > 0)
            .map((d) => ({ id: d.depositId, name: d.name, value: d.value }));
        if (fromDeposito.length) return fromDeposito;
        return fromCatalogo;
    }, [valorPorDeposito, valorPorAlmacen, filtroStockEntidadActivo]);

    const valorTotalKpi = useMemo(() => {
        const sum = valorDesglose.reduce((s, d) => s + d.value, 0);
        if (sum > 0) return sum;
        return statsFiltrados.totalValue;
    }, [valorDesglose, statsFiltrados.totalValue]);

    useEffect(() => {
        if (!itemsCatalogo.length || !depositsLista.length) {
            setValorPorDeposito([]);
            return;
        }
        if (filtroStockEntidadActivo && cargandoStockUbicacion) return;
        if (
            filtroStockEntidadActivo &&
            !filterDepositId &&
            ubicacionIdsFiltro.length === 0
        ) {
            setValorPorDeposito([]);
            return;
        }
        let cancelled = false;
        const costoPorMaterial = new Map(
            itemsCatalogo.map((i) => [i.id, Number(i.average_weighted_cost)]),
        );
        const depositLabels = new Map(
            depositsLista.map((d) => [
                d.id,
                d.locality ? `${d.name} (${d.locality})` : d.name,
            ]),
        );
        const materialIds =
            hayFiltrosActivos && baseItemsKpi.length
                ? new Set(baseItemsKpi.map((i) => i.id))
                : undefined;
        const ubicacionIds =
            filtroStockEntidadActivo && ubicacionIdsFiltro.length
                ? ubicacionIdsFiltro
                : undefined;
        void cargarValorInventarioPorDeposito(supabase, costoPorMaterial, depositLabels, {
            materialIds,
            soloDepositoId: filterDepositId || undefined,
            ubicacionIds,
        })
            .then((rows) => {
                if (!cancelled) setValorPorDeposito(rows);
            })
            .catch((e) => console.warn('[inventario] valor por depósito:', e));
        return () => {
            cancelled = true;
        };
    }, [
        itemsCatalogo,
        depositsLista,
        supabase,
        hayFiltrosActivos,
        baseItemsKpi,
        filterDepositId,
        filtroStockEntidadActivo,
        cargandoStockUbicacion,
        ubicacionIdsFiltro,
    ]);

    useEffect(() => {
        setValorRotateIdx(0);
    }, [filterEntidadId, filterProyectoId, filterDepositId, hayFiltrosActivos]);

    const itemsStockBajo = useMemo(
        () =>
            baseItemsKpi
                .filter((item) => cantidadStockReal(item) <= reorderPointItem(item))
                .sort((a, b) => cantidadStockReal(a) - cantidadStockReal(b))
                .slice(0, 8),
        [baseItemsKpi, cantidadStockReal, reorderPointItem],
    );

    const itemsCuarentenaResumen = useMemo(() => {
        const fuente = hayFiltrosActivos ? cuarentenaFiltrada : cuarentenaOperativa;
        const byMaterial = new Map<string, { nombre: string; qty: number; unit: string }>();
        for (const insp of fuente) {
            const mid = insp.material_id;
            const nombre =
                String(insp.material_name ?? insp.line_description ?? 'Material').trim() || 'Material';
            const prev = byMaterial.get(mid) ?? { nombre, qty: 0, unit: insp.material_unit ?? 'UND' };
            prev.qty += Number(insp.quantity) || 0;
            byMaterial.set(mid, prev);
        }
        return Array.from(byMaterial.entries())
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 8);
    }, [cuarentenaOperativa, cuarentenaFiltrada, hayFiltrosActivos]);

    const skuPorCategoria = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of baseItemsKpi) {
            const name = item.category?.name ?? 'Sin categoría';
            map.set(name, (map.get(name) ?? 0) + 1);
        }
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);
    }, [baseItemsKpi]);

    const valorSlots = useMemo(() => {
        if (filterDepositId && valorDesglose.length === 1) {
            return [{ label: valorDesglose[0]!.name, value: valorTotalKpi }];
        }
        const slots: { label: string; value: number }[] = [
            { label: 'Valor total', value: valorTotalKpi },
        ];
        for (const d of valorDesglose) {
            slots.push({ label: d.name, value: d.value });
        }
        return slots;
    }, [valorTotalKpi, valorDesglose, filterDepositId]);

    const valorSlotActual = valorSlots[valorRotateIdx % Math.max(valorSlots.length, 1)] ?? {
        label: 'Valor total',
        value: valorTotalKpi,
    };

    const valorPuedeRotar = valorSlots.length > 1;

    const valorSinStockFisico =
        valorTotalKpi <= 0 &&
        baseItemsKpi.length > 0 &&
        (filtroStockEntidadActivo ? !cargandoStockUbicacion : stockGlobalCargado);

    const limpiarFiltros = () => {
        setSearchTerm('');
        setActiveCategory('Todos');
        setFilterEntidadId('');
        setFilterProyectoId('');
        setFilterPartidaId('');
        setFilterDepositId('');
        setSinClasificacionObra(false);
        setSinAlmacenAsignado(false);
        setKpiVista('ninguno');
        setStatFlips({ valor: false, bajo: false, cuarentena: false, sku: false });
        borrarInventarioCuadroFiltrosGuardados();
        router.replace('/almacen', { scroll: false });
    };

    const mensajeVacio = useMemo(
        () =>
            mensajeVacioCuadroAlmacen({
                cargandoStockUbicacion: cargandoStockFiltro,
                filtroStockPorUbicacion,
                filtroSoloEntidad,
                filtroSinUbicaciones,
                filterDepositId: Boolean(filterDepositId),
                filterProyectoId: Boolean(filterProyectoId),
                filterEntidadId: Boolean(filterEntidadId),
                hayFiltrosActivos,
                kpiCuarentena: kpiVista === 'cuarentena',
            }),
        [
            cargandoStockFiltro,
            filtroStockPorUbicacion,
            filtroSoloEntidad,
            filtroSinUbicaciones,
            filterDepositId,
            filterProyectoId,
            filterEntidadId,
            hayFiltrosActivos,
            kpiVista,
        ],
    );

    useEffect(() => {
        if (!hydrated || !filtrosPersistenciaLista.current) return;
        guardarInventarioCuadroFiltros(estadoCompartir);
        const path = inventarioCuadroPathFromState(estadoCompartir);
        const actual = `${window.location.pathname}${window.location.search}`;
        if (path !== actual) {
            router.replace(path, { scroll: false });
        }
    }, [hydrated, estadoCompartir, router]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(val);
    };

    const shareInventory = () => {
        void compartirInventarioWhatsApp(exportScope);
    };

    /** Elimina un ítem del maestro global_inventory y registros vinculados (irreversible). */
    const eliminarMaterialPorId = async (
        id: string,
        label: string,
        opciones?: { skipConfirm?: boolean },
    ): Promise<boolean> => {
        try {
            const previewRes = await fetch(apiUrl(`/api/almacen/inventario/${encodeURIComponent(id)}`), {
                cache: 'no-store',
            });
            const preview = (await previewRes.json()) as {
                error?: string;
                total?: number;
                vinculos?: Record<string, number>;
            };
            if (!previewRes.ok) {
                alert(preview.error || 'No se pudo consultar el material.');
                return false;
            }

            if (!opciones?.skipConfirm) {
                const totalVinculos = Number(preview.total ?? 0);
                let mensajeConfirm = `¿Eliminar del inventario?\n\n${label}\n\nEsta acción no se puede deshacer.`;
                if (totalVinculos > 0) {
                    const partes: string[] = [];
                    const v = preview.vinculos ?? {};
                    if (v.movimientos) partes.push(`${v.movimientos} movimiento(s) de stock`);
                    if (v.comprasLineas) {
                        partes.push(
                            `${v.comprasLineas} línea(s) de compra${v.comprasFacturas ? ` (${v.comprasFacturas} factura(s))` : ''}`,
                        );
                    }
                    if (v.transferenciasLineas) {
                        partes.push(
                            `${v.transferenciasLineas} línea(s) de transferencia${v.transferencias ? ` (${v.transferencias} transferencia(s))` : ''}`,
                        );
                    }
                    if (v.egresosLineas) {
                        partes.push(
                            `${v.egresosLineas} línea(s) de egreso${v.egresos ? ` (${v.egresos} egreso(s))` : ''}`,
                        );
                    }
                    if (v.recepcionesLineas) {
                        partes.push(
                            `${v.recepcionesLineas} línea(s) de recepción${v.recepciones ? ` (${v.recepciones} recepción(es))` : ''}`,
                        );
                    }
                    if (v.stock) partes.push(`${v.stock} registro(s) de stock`);
                    if (v.series) partes.push(`${v.series} número(s) de serie`);
                    if (v.purchaseDetails) partes.push(`${v.purchaseDetails} línea(s) en tránsito`);
                    if (v.maquinaria) partes.push(`${v.maquinaria} ficha(s) de maquinaria`);
                    mensajeConfirm =
                        `Este material tiene registros vinculados:\n\n• ${partes.join('\n• ')}\n\n` +
                        `¿Eliminar también esos movimientos, compras y demás registros?\n\n` +
                        `Material: ${label}\n\nEsta acción no se puede deshacer.`;
                }

                if (!confirm(mensajeConfirm)) return false;
            }

            const delRes = await fetch(apiUrl(`/api/almacen/inventario/${encodeURIComponent(id)}`), {
                method: 'DELETE',
            });
            const delBody = (await delRes.json()) as { error?: string };
            if (!delRes.ok) {
                alert(delBody.error || 'Error al borrar el material.');
                return false;
            }
            return true;
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error al borrar');
            return false;
        }
    };

    const deleteMaterial = async (id: string, label: string) => {
        setDeletingId(id);
        try {
            const ok = await eliminarMaterialPorId(id, label);
            if (ok) await fetchInventory();
        } finally {
            setDeletingId(null);
        }
    };

    const handleBulkDelete = async () => {
        const items = filteredItems.filter((item) => selectedIds.has(item.id));
        if (!items.length) return;
        if (
            !confirm(
                `¿Eliminar ${items.length} material(es) del inventario?\n\n` +
                    `Si tienen movimientos, compras u otros registros vinculados, también se eliminarán.\n\n` +
                    `Esta acción no se puede deshacer.`,
            )
        ) {
            return;
        }
        setDeletingBulk(true);
        let okCount = 0;
        let failCount = 0;
        try {
            for (const item of items) {
                setDeletingId(item.id);
                const ok = await eliminarMaterialPorId(item.id, item.name, { skipConfirm: true });
                if (ok) okCount += 1;
                else failCount += 1;
            }
            setSelectedIds(new Set());
            await fetchInventory();
            if (failCount > 0) {
                alert(`${okCount} eliminado(s). ${failCount} no se pudieron borrar.`);
            }
        } finally {
            setDeletingId(null);
            setDeletingBulk(false);
        }
    };

    const handleKpiToggle = useCallback((key: StatFlipKey, vista: KpiVista) => {
        const opening = !statFlips[key];
        setStatFlips((prev) => ({ ...prev, [key]: opening }));
        setKpiVista(opening ? vista : 'ninguno');
    }, [statFlips]);

    const handleValorCardToggle = useCallback(() => {
        toggleStatFlip('valor');
    }, [toggleStatFlip]);

    const handleValorRotatePrev = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setValorRotateIdx(
                (i) => (i - 1 + valorSlots.length) % Math.max(valorSlots.length, 1),
            );
        },
        [valorSlots.length],
    );

    const handleValorRotateNext = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setValorRotateIdx((i) => (i + 1) % Math.max(valorSlots.length, 1));
        },
        [valorSlots.length],
    );

    const navBtnClass =
        'inline-flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-zinc-800 transition-all whitespace-nowrap';

    return (
        <div className="text-white pb-6 font-sans max-w-[100vw] overflow-x-hidden">
            {/* Header Section */}
            <div className="mb-4">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tighter mb-1">STOCK</h1>
                <p className="text-[11px] text-zinc-500 mb-2 max-w-xl">
                    {filtroStockEntidadActivo
                        ? 'Stock físico del almacén seleccionado (inventario_stock) · ajuste inline en la tabla'
                        : 'Stock físico en todas las ubicaciones · seleccione entidad, obra o almacén arriba para acotar'}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {NAV_ALMACEN.map((nav) => {
                        const Icon = nav.icon;
                        const btn = (
                            <button
                                type="button"
                                className={`${navBtnClass} ${nav.className}`}
                                onClick={'action' in nav && nav.action === 'share' ? shareInventory : undefined}
                            >
                                <Icon size={14} />
                                {nav.label}
                            </button>
                        );
                        if ('action' in nav && nav.action === 'share') {
                            return <span key={nav.label}>{btn}</span>;
                        }
                        const href =
                            nav.href === '/almacen/despacho' ? hrefDespacho : nav.href!;
                        return (
                            <Link key={nav.href} href={href}>
                                {btn}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {mastersWarning ? (
                <div className="mb-6 p-4 rounded-2xl bg-amber-600/10 border border-amber-600/30 text-amber-200 text-sm font-bold">
                    {mastersWarning}
                </div>
            ) : null}

            {panelFiltrosExpandido ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                <FlipStatCard
                    flipped={statFlips.valor}
                    onToggle={handleValorCardToggle}
                    front={
                        <>
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <TrendingUp className="text-blue-500" size={18} />
                                </div>
                                <button
                                    type="button"
                                    title="Ver desglose por almacén"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStatFlip('valor');
                                    }}
                                    className="p-1 rounded-md text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10"
                                >
                                    <List size={14} />
                                </button>
                            </div>
                            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-0.5 truncate">
                                {valorSlotActual.label}
                            </p>
                            <h2 className="text-2xl font-black tracking-tight">
                                {formatCurrency(valorSlotActual.value)}
                            </h2>
                            {valorPuedeRotar ? (
                                <div className="flex items-center justify-between gap-1 mt-1">
                                    <button
                                        type="button"
                                        title="Almacén anterior"
                                        onClick={handleValorRotatePrev}
                                        className="p-0.5 rounded text-zinc-600 hover:text-blue-400"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <p className="text-[9px] text-zinc-600 font-bold truncate">
                                        {valorRotateIdx + 1}/{valorSlots.length} · Clic para desglose
                                    </p>
                                    <button
                                        type="button"
                                        title="Siguiente almacén"
                                        onClick={handleValorRotateNext}
                                        className="p-0.5 rounded text-zinc-600 hover:text-blue-400"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[9px] text-zinc-600 font-bold mt-1 flex items-center gap-1">
                                    <List size={10} />
                                    {valorSinStockFisico
                                        ? 'Sin stock físico · clic para detalle'
                                        : 'Clic para desglose por almacén'}
                                </p>
                            )}
                        </>
                    }
                    back={
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                                    Valor por almacén
                                </p>
                                <button
                                    type="button"
                                    title="Volver"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStatFlip('valor');
                                    }}
                                    className="p-0.5 rounded text-zinc-600 hover:text-blue-400 shrink-0"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                            </div>
                            <div className="flex justify-between gap-2 text-[10px] font-bold border-b border-zinc-800/60 pb-1 mb-1">
                                <span className="text-zinc-500">Total</span>
                                <span className="text-blue-300 shrink-0">{formatCurrency(valorTotalKpi)}</span>
                            </div>
                            {valorDesglose.length === 0 ? (
                                <p className="text-xs text-zinc-500">
                                    {valorSinStockFisico
                                        ? 'Stock físico en 0. El valor usa cantidad × costo ponderado.'
                                        : 'Sin datos de almacén'}
                                </p>
                            ) : (
                                valorDesglose.map((row) => (
                                    <div
                                        key={row.id}
                                        className="flex justify-between gap-2 text-[11px] font-bold border-b border-zinc-800/60 pb-1"
                                    >
                                        <span className="text-zinc-400 truncate">{row.name}</span>
                                        <span className="text-blue-300 shrink-0">{formatCurrency(row.value)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    }
                />

                <FlipStatCard
                    flipped={statFlips.bajo}
                    onToggle={() => handleKpiToggle('bajo', 'stock_bajo')}
                    className={kpiVista === 'stock_bajo' ? 'ring-2 ring-red-500/40 rounded-2xl' : ''}
                    front={
                        <>
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                                    <AlertTriangle className="text-red-500" size={18} />
                                </div>
                                {statsFiltrados.lowStockCount > 0 && (
                                    <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-md">
                                        CRÍTICO
                                    </span>
                                )}
                            </div>
                            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-0.5">
                                Stock Bajo
                            </p>
                            <h2 className="text-2xl font-black tracking-tight text-red-500">
                                {statsFiltrados.lowStockCount}{' '}
                                <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">
                                    Items
                                </span>
                            </h2>
                            <p className="text-[9px] text-zinc-600 font-bold mt-1">Clic para ver productos</p>
                        </>
                    }
                    back={
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">
                                Productos con stock bajo
                            </p>
                            {itemsStockBajo.length === 0 ? (
                                <p className="text-xs text-zinc-500">Sin alertas de stock</p>
                            ) : (
                                itemsStockBajo.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/almacen/editar/${item.id}`);
                                        }}
                                        className="w-full flex justify-between gap-2 text-left text-[11px] font-bold border-b border-zinc-800/60 pb-1 hover:text-red-300"
                                    >
                                        <span className="text-zinc-400 truncate">{item.name}</span>
                                        <span className="text-red-400 shrink-0">
                                            {cantidadStockReal(item)} / {reorderPointItem(item)}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    }
                />

                <FlipStatCard
                    flipped={statFlips.cuarentena}
                    onToggle={() => handleKpiToggle('cuarentena', 'cuarentena')}
                    className={kpiVista === 'cuarentena' ? 'ring-2 ring-amber-500/40 rounded-2xl' : ''}
                    front={
                        <>
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                    <ShieldCheck className="text-amber-500" size={18} />
                                </div>
                            </div>
                            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-0.5">
                                En Tránsito
                            </p>
                            <h2 className="text-2xl font-black tracking-tight text-amber-500">
                                {statsFiltrados.quarantineCount}{' '}
                                <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">
                                    Unidades
                                </span>
                            </h2>
                            <p className="text-[9px] text-zinc-600 font-bold mt-1">Clic para ver detalle</p>
                        </>
                    }
                    back={
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
                                Inspecciones pendientes (
                                {hayFiltrosActivos ? cuarentenaFiltrada.length : cuarentenaOperativa.length}
                                )
                            </p>
                            {itemsCuarentenaResumen.length === 0 ? (
                                <p className="text-xs text-zinc-500">Sin mercancía en tránsito</p>
                            ) : (
                                itemsCuarentenaResumen.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/almacen/editar/${item.id}`);
                                        }}
                                        className="w-full flex justify-between gap-2 text-left text-[11px] font-bold border-b border-zinc-800/60 pb-1 hover:text-amber-300"
                                    >
                                        <span className="text-zinc-400 truncate">{item.nombre}</span>
                                        <span className="text-amber-400 shrink-0">
                                            {item.qty} {item.unit}
                                        </span>
                                    </button>
                                ))
                            )}
                            <Link
                                href="/almacen/procurement/quality"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-flex text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300"
                            >
                                Liberar tránsito →
                            </Link>
                        </div>
                    }
                />

                <FlipStatCard
                    flipped={statFlips.sku}
                    onToggle={() => toggleStatFlip('sku')}
                    front={
                        <>
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-zinc-100/10 rounded-xl border border-zinc-100/20">
                                    <Package className="text-white" size={18} />
                                </div>
                            </div>
                            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-0.5">
                                Total SKU
                            </p>
                            <h2 className="text-2xl font-black tracking-tight">{statsFiltrados.totalItems}</h2>
                            {hayFiltrosActivos && statsFiltrados.totalItems !== stats.totalItems ? (
                                <p className="text-[9px] text-zinc-600 font-bold mt-0.5">
                                    de {itemsCatalogo.length} con stock físico
                                </p>
                            ) : (
                                <p className="text-[9px] text-zinc-600 font-bold mt-1">Clic para ver por categoría</p>
                            )}
                        </>
                    }
                    back={
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-1">
                                SKU por categoría
                            </p>
                            {skuPorCategoria.length === 0 ? (
                                <p className="text-xs text-zinc-500">Sin categorías</p>
                            ) : (
                                skuPorCategoria.map(([name, count]) => (
                                    <div
                                        key={name}
                                        className="flex justify-between gap-2 text-[11px] font-bold border-b border-zinc-800/60 pb-1"
                                    >
                                        <span className="text-zinc-400 truncate">{name}</span>
                                        <span className="text-zinc-200 shrink-0">{count}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    }
                />
            </div>
            ) : null}

            {/* Filters & Search */}
            <div className="flex flex-col gap-2 mb-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, SAP, entidad, proyecto o partida Lulo…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all"
                    />
                </div>

                {!panelFiltrosExpandido ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2.5">
                        <Filter className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 shrink-0">
                            Filtros
                        </span>
                        {etiquetasResumenFiltros.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                                {etiquetasResumenFiltros.map((chip) => (
                                    <span
                                        key={chip}
                                        className="inline-block max-w-[200px] truncate rounded-md border border-zinc-700/80 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-zinc-300"
                                        title={chip}
                                    >
                                        {chip}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-zinc-600 flex-1">
                                Sin filtros de entidad, obra o categoría
                            </span>
                        )}
                        <span className="text-[10px] font-bold text-zinc-500 whitespace-nowrap">
                            {filteredItems.length} / {itemsCatalogo.length}
                            {filtroStockEntidadActivo ? (
                                <span className="text-emerald-500/90"> · stock físico</span>
                            ) : (
                                <span className="text-zinc-600"> · con existencia</span>
                            )}
                        </span>
                        {hayFiltrosActivos ? (
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 whitespace-nowrap"
                            >
                                Limpiar
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={alternarPanelFiltros}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-sky-300 hover:bg-sky-500/20 whitespace-nowrap"
                        >
                            <ChevronDown size={14} />
                            Mostrar filtros
                        </button>
                    </div>
                ) : (
                    <>
                <div className="flex flex-wrap gap-1.5">
                    {CATEGORIAS_FILTRO.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                                activeCategory === cat
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                                    : 'bg-zinc-900/80 border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                {kpiVista !== 'ninguno' ? (
                    <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">
                        Filtro KPI activo:{' '}
                        {kpiVista === 'stock_bajo'
                            ? 'stock bajo'
                            : kpiVista === 'cuarentena'
                              ? 'cuarentena'
                              : 'SKU'}
                        {' · '}
                        <button type="button" onClick={limpiarFiltros} className="underline hover:text-sky-300">
                            quitar
                        </button>
                    </p>
                ) : null}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-sky-400 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Filtrar visualización
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 ml-auto">
                            <span className="text-[10px] font-bold text-zinc-500">
                                {filteredItems.length} de {itemsCatalogo.length} ítems
                            </span>
                            <button
                                type="button"
                                onClick={alternarPanelFiltros}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                                title="Ocultar panel de filtros y ganar espacio para la tabla"
                            >
                                <ChevronUp size={14} />
                                Ocultar filtros
                            </button>
                        </div>
                        {filterDepositId ? (
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                                Almacén:{' '}
                                {depositsById.get(filterDepositId)?.locality
                                    ? `${depositsById.get(filterDepositId)!.name} (${depositsById.get(filterDepositId)!.locality})`
                                    : depositsById.get(filterDepositId)?.name ?? 'Seleccionado'}
                                {' · '}
                                <button
                                    type="button"
                                    onClick={() => setFilterDepositId('')}
                                    className="underline hover:text-emerald-200"
                                >
                                    quitar
                                </button>
                            </span>
                        ) : null}
                        <span className="text-[10px] font-bold text-zinc-500 hidden xl:inline">
                            Mostrando {filteredItems.length} de {itemsCatalogo.length} ítems
                            {cargandoStockUbicacion && filtroStockEntidadActivo
                                ? ' · actualizando stock…'
                                : ' · stock editable con Enter'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <label className="block sm:col-span-2 lg:col-span-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
                                Partida Lulo
                            </span>
                            <select
                                value={filterPartidaId}
                                onChange={(e) => setFilterPartidaId(e.target.value)}
                                disabled={!filterProyectoId}
                                className="w-full rounded-xl border border-zinc-700 bg-black/50 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                            >
                                <option value="">Todas las partidas</option>
                                {partidasFiltro.map((pt) => (
                                    <option key={pt.id} value={pt.id}>{labelPartida(pt)}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {depositoSinInterseccion && filterDepositId ? (
                        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                            El almacén elegido (barra superior) no coincide con la obra/entidad. Revise maestros o quite el filtro de almacén.
                        </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/80">
                        <label
                            className={`flex items-center gap-2 text-[10px] font-bold uppercase cursor-pointer ${
                                filtroStockPorUbicacion
                                    ? 'text-zinc-600 cursor-not-allowed'
                                    : 'text-zinc-500'
                            }`}
                            title={
                                filterProyectoId || filterDepositId
                                    ? 'Incompatible con filtro de obra o almacén (usa stock físico)'
                                    : undefined
                            }
                        >
                            <input
                                type="checkbox"
                                checked={sinClasificacionObra}
                                disabled={filtroStockPorUbicacion}
                                onChange={(e) => setSinClasificacionObra(e.target.checked)}
                                className="rounded border-zinc-700 disabled:opacity-40"
                            />
                            Sin obra
                        </label>
                        <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sinAlmacenAsignado}
                                onChange={(e) => {
                                    setSinAlmacenAsignado(e.target.checked);
                                    if (e.target.checked) setFilterDepositId('');
                                }}
                                className="rounded border-zinc-700"
                            />
                            Sin almacén
                        </label>
                        {hayFiltrosActivos ? (
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 ml-auto"
                            >
                                Limpiar filtros
                            </button>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Exportar / compartir
                        </span>
                        <select
                            value={exportScope}
                            onChange={(e) => setExportScope(e.target.value as InventarioExportScope)}
                            className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 text-[10px] font-bold text-white"
                        >
                            <option value="filtrado">
                                Vista filtrada ({filteredItems.length})
                            </option>
                            <option value="completo">
                                Tabla completa ({itemsCatalogo.length})
                            </option>
                        </select>
                        <button
                            type="button"
                            onClick={() => exportarInventarioCsv(exportScope)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20"
                        >
                            <Download size={14} />
                            CSV
                        </button>
                        <button
                            type="button"
                            onClick={() => void copiarInventarioPortapapeles(exportScope)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-black/40 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-zinc-300 hover:bg-zinc-900"
                        >
                            Copiar
                        </button>
                        <button
                            type="button"
                            onClick={() => void compartirInventario(exportScope)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-sky-300 hover:bg-sky-500/20"
                        >
                            <Share2 size={14} />
                            Compartir
                        </button>
                        <button
                            type="button"
                            onClick={() => compartirInventarioWhatsApp(exportScope)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-green-300 hover:bg-green-500/20"
                        >
                            WhatsApp
                        </button>
                        {compartidoOk ? (
                            <span className="text-[10px] font-bold text-emerald-400">
                                Copiado al portapapeles
                            </span>
                        ) : null}
                    </div>
                </div>
                    </>
                )}
            </div>

            <>
            {/* Items Table */}
            {!loading && filteredItems.length > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-300">
                        <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={todasSeleccionadas}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-zinc-600 accent-sky-500"
                        />
                        {todasSeleccionadas
                            ? 'Quitar selección'
                            : `Seleccionar todos (${filteredItems.length})`}
                    </label>
                    {algunaSeleccionada ? (
                        <>
                            <span className="text-xs font-black text-sky-400">
                                {selectedIds.size} seleccionado(s)
                            </span>
                            <button
                                type="button"
                                disabled={deletingBulk || deletingId !== null}
                                onClick={() => void handleBulkDelete()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                            >
                                {deletingBulk ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Trash2 size={14} />
                                )}
                                Borrar seleccionados
                            </button>
                            <Link
                                href={
                                    selectedIds.size === 1
                                        ? `/almacen/editar/${Array.from(selectedIds)[0]}`
                                        : '#'
                                }
                                onClick={(e) => {
                                    if (selectedIds.size !== 1) e.preventDefault();
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
                                    selectedIds.size === 1
                                        ? 'border-sky-500/35 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
                                        : 'border-zinc-700 text-zinc-600 pointer-events-none'
                                }`}
                                title={
                                    selectedIds.size === 1
                                        ? 'Editar material seleccionado'
                                        : 'Seleccione un solo material para editar'
                                }
                            >
                                <Pencil size={14} />
                                Editar
                            </Link>
                        </>
                    ) : null}
                </div>
            ) : null}

            <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
                    <colgroup>
                        <col className="w-9" />
                        <col className="w-[26%]" />
                        <col className="w-[22%]" />
                        <col className="w-[14%]" />
                        <col className="w-[12%]" />
                        <col className="w-[14%]" />
                        <col className="w-[4.5rem]" />
                    </colgroup>
                    <thead>
                        <tr className="bg-zinc-900/50 border-b border-zinc-800 text-left">
                            <th className="px-2 py-2.5">
                                <span className="sr-only">Seleccionar</span>
                            </th>
                            <th className="px-2 py-2.5 font-black text-[9px] uppercase tracking-widest text-zinc-500">Material</th>
                            <th className="px-2 py-2.5 font-black text-[9px] uppercase tracking-widest text-zinc-500">Entidad / obra</th>
                            <th className="px-2 py-2.5 font-black text-[9px] uppercase tracking-widest text-zinc-500">Ubicación</th>
                            <th className="px-2 py-2.5 font-black text-[9px] uppercase tracking-widest text-zinc-500">Stock</th>
                            <th className="px-2 py-2.5 font-black text-[9px] uppercase tracking-widest text-zinc-500">Costo / compra</th>
                            <th className="px-1 py-2.5 font-black text-[9px] uppercase tracking-widest text-zinc-500 text-right">Acc.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {loading || cargandoStockFiltro ? (
                            [1, 2, 3].map(i => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={7} className="p-6 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">
                                        {cargandoStockFiltro
                                            ? 'Cargando stock del almacén…'
                                            : 'Cargando materiales…'}
                                    </td>
                                </tr>
                            ))
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-16 text-center">
                                    <div className="flex flex-col items-center">
                                        <Package size={48} className="text-zinc-800 mb-4" />
                                        <p className="text-zinc-500 font-black text-xl tracking-tight">
                                            {mensajeVacio?.titulo ?? 'No se encontraron materiales'}
                                        </p>
                                        <p className="text-zinc-600 font-bold text-sm uppercase tracking-widest mt-1 max-w-md">
                                            {mensajeVacio?.subtitulo ??
                                                'Ajusta tus filtros o registra un nuevo item'}
                                        </p>
                                        {hayFiltrosActivos ? (
                                            <button
                                                type="button"
                                                onClick={limpiarFiltros}
                                                className="mt-4 text-[10px] font-black uppercase tracking-wide text-sky-400 hover:text-sky-300"
                                            >
                                                Limpiar filtros
                                            </button>
                                        ) : null}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => {
                                const stockMostrar = cantidadStockReal(item);
                                const stockUb = filtroPorUbicacionActivo
                                    ? stockPorUbicacion.get(item.id)
                                    : undefined;
                                const obraTabla = obraMostradaEnTabla(
                                    item,
                                    stockUb,
                                    filtroPorUbicacionActivo,
                                    filterProyectoId,
                                    proyectos,
                                );
                                const categoriaNombre =
                                    nombreCategoriaItem(item) || 'Sin categoría';
                                const proyectoItem = item.proyecto_id
                                    ? proyectosById.get(item.proyecto_id)
                                    : undefined;
                                const esGastoEntidad =
                                    proyectoItem && esCentroCostoEntidad(proyectoItem);

                                return (
                                <tr
                                    key={item.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => router.push(`/almacen/editar/${item.id}`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            router.push(`/almacen/editar/${item.id}`);
                                        }
                                    }}
                                    className={`group transition-colors cursor-pointer ${
                                        selectedIds.has(item.id)
                                            ? 'bg-sky-500/10 hover:bg-sky-500/15'
                                            : 'hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <td
                                        className="px-2 py-2 align-middle"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => toggleSelectItem(item.id)}
                                            className="h-3.5 w-3.5 rounded border-zinc-600 accent-sky-500"
                                            aria-label={`Seleccionar ${item.name}`}
                                        />
                                    </td>
                                    <td className="px-2 py-2 overflow-hidden">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <InventoryListThumb
                                                imageUrl={item.image_url}
                                                catalogUrlFromProduct={
                                                    item.product_id != null
                                                        ? catalogImagenByProductId[Number(item.product_id)]
                                                        : undefined
                                                }
                                                catalogUrlFromName={
                                                    catalogImagenByName[normalizeInventoryName(item.name)]
                                                }
                                            />
                                            <div className="min-w-0">
                                                <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-1.5 py-px rounded border border-blue-500/20 uppercase truncate inline-block max-w-full">
                                                    {item.sap_code || 'SIN COD'}
                                                </span>
                                                <h4 className="font-black text-zinc-100 text-sm leading-tight truncate" title={item.name}>
                                                    {item.name}
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider truncate">{item.unit}</p>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveCategory(filtroCategoriaParaItem(item));
                                                        }}
                                                        className="text-[8px] font-black bg-amber-500/10 text-amber-400 px-1.5 py-px rounded border border-amber-500/25 uppercase truncate max-w-full hover:bg-amber-500/20 transition-colors"
                                                        title={`Categoría: ${categoriaNombre}. Clic para filtrar.`}
                                                    >
                                                        {categoriaNombre}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 max-w-0">
                                        <div className="space-y-0.5 text-[9px] font-bold min-w-0">
                                            {item.entidad?.nombre ? (
                                                <p className="text-violet-300 truncate" title={item.entidad.nombre}>
                                                    {item.entidad.nombre}
                                                </p>
                                            ) : (
                                                <p className="text-zinc-600 uppercase tracking-wider">Sin entidad</p>
                                            )}
                                            {esGastoEntidad ? (
                                                <p
                                                    className="text-amber-400/95 truncate"
                                                    title="Gasto de entidad (OpEx)"
                                                >
                                                    {etiquetaClasificacionGastoEntidad(
                                                        item.clasificacion_gasto_entidad ??
                                                            proyectoItem?.clasificacion_gasto_entidad,
                                                    )}
                                                    <span className="ml-1 text-[9px] font-black uppercase text-zinc-500">
                                                        · entidad
                                                    </span>
                                                </p>
                                            ) : obraTabla ? (
                                                <p
                                                    className={`truncate ${
                                                        obraTabla.desdeStockFisico
                                                            ? 'text-sky-300/95'
                                                            : 'text-sky-400/90'
                                                    }`}
                                                    title={obraTabla.nombre}
                                                >
                                                    {obraTabla.nombre}
                                                    {obraTabla.desdeStockFisico &&
                                                    !item.proyecto_id ? (
                                                        <span className="ml-1 text-[9px] font-black uppercase text-zinc-500">
                                                            · stock
                                                        </span>
                                                    ) : null}
                                                </p>
                                            ) : (
                                                <p className="text-zinc-600">Sin proyecto</p>
                                            )}
                                            {item.partida ? (
                                                <p className="text-emerald-500/90 truncate" title={item.partida.descripcion}>
                                                    {item.partida.codigo_partida
                                                        ? `${item.partida.codigo_partida} · `
                                                        : ''}
                                                    {item.partida.descripcion}
                                                </p>
                                            ) : item.proyecto_id ? (
                                                <p className="text-zinc-600">Sin partida Lulo</p>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 max-w-0">
                                        <div className="flex items-center gap-1.5 text-zinc-400 font-bold text-xs capitalize min-w-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 shrink-0"></div>
                                            <span className="truncate">
                                            {labelUbicacionEnTabla(
                                                item,
                                                stockUb,
                                                filtroPorUbicacionActivo,
                                                depositsById,
                                                furnitureById,
                                            )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2">
                                        <CeldaStockEditable
                                            cantidad={stockMostrar}
                                            reorderPoint={reorderPointItem(item)}
                                            unidad={item.unit}
                                            saving={savingStockId === item.id}
                                            onSave={(qty) => guardarStockCuadro(item.id, qty)}
                                        />
                                        {filtroPorUbicacionActivo && stockUb ? (
                                            <span className="text-[8px] font-black text-emerald-500/90 uppercase mt-0.5 block leading-tight">
                                                Almacén filtrado
                                            </span>
                                        ) : null}
                                        {!filtroPorUbicacionActivo && Number(item.stock_quarantine) > 0 ? (
                                            <span className="text-[8px] font-black text-amber-500 uppercase mt-0.5 block leading-tight">
                                                +{item.stock_quarantine} tránsito
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="px-2 py-2 overflow-hidden">
                                        <div className="font-bold text-zinc-300 text-xs tabular-nums truncate">
                                            {formatCurrency(Number(item.average_weighted_cost))}
                                        </div>
                                        {item.last_purchase_date ? (
                                            <p
                                                className="text-[9px] text-zinc-500 font-bold truncate leading-tight"
                                                title={`${new Date(item.last_purchase_date).toLocaleDateString()} · ${formatCurrency(Number(item.last_purchase_price))}`}
                                            >
                                                {new Date(item.last_purchase_date).toLocaleDateString('es-VE', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                })}
                                                {' · '}
                                                {formatCurrency(Number(item.last_purchase_price))}
                                            </p>
                                        ) : (
                                            <p className="text-[9px] text-zinc-700 font-bold uppercase">Sin compra</p>
                                        )}
                                    </td>
                                    <td className="px-1 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex gap-0.5 justify-end items-center">
                                            <Link href={`/almacen/editar/${item.id}`}>
                                                <button
                                                    type="button"
                                                    title="Editar material"
                                                    className="p-1.5 text-zinc-600 hover:text-sky-400 hover:bg-sky-500/10 rounded-md transition-all"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                            </Link>
                                            <button
                                                type="button"
                                                title="Eliminar del inventario"
                                                disabled={deletingId === item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void deleteMaterial(item.id, item.name);
                                                }}
                                                className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all disabled:opacity-40"
                                            >
                                                {deletingId === item.id ? (
                                                    <span className="inline-block w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 size={15} />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
                        )}
                    </tbody>
                </table>
                </div>
            </GlassCard>
            </>
        </div>
    );
}
