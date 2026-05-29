'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
    Package,
    AlertTriangle,
    TrendingUp,
    Search,
    Filter,
    Plus,
    ChevronRight,
    Truck,
    ShieldCheck,
    History,
    Settings2,
    Trash2,
    ArrowUpRight,
    ArrowRightLeft,
    Share2,
    RotateCw,
} from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
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
import { getStockAgregadoPorMaterialObra } from '@/lib/almacen/getStockRealObra';
import {
    cargarStockPorUbicaciones,
    cargarValorInventarioPorDeposito,
    listarUbicacionesParaFiltroInventario,
    materialCoincideFiltroProyectoDeposito,
    resolverUbicacionIdsFiltro,
    type StockEnUbicacionResumen,
    type ValorInventarioDeposito,
} from '@/lib/almacen/inventarioFiltroUbicacion';

const INVENTORY_SELECT = `
  *,
  entidad:ci_entidades(id,nombre,rif),
  proyecto:ci_proyectos(id,nombre,entidad_id),
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

const NAV_ALMACEN = [
    { href: '/almacen/recepcion', label: 'Ingreso', icon: Package, className: 'border-[#FF9500]/40 bg-[#FF9500]/10 text-[#FF9500]' },
    { href: '/almacen/procurement', label: 'Compras', icon: Truck, className: 'border-blue-500/40 bg-blue-600/20 text-blue-100' },
    { href: '/almacen/despacho', label: 'SALIDA', icon: ArrowUpRight, className: 'border-orange-500/35 text-orange-200' },
    { href: '/almacen/movimientos', label: 'Movimientos', icon: History, className: 'border-violet-500/35 text-violet-200' },
    { href: '/almacen/migrar-obra', label: 'A obra', icon: ArrowRightLeft, className: 'border-violet-500/35 text-violet-200' },
    { href: '/almacen/maestros', label: 'Configuración', icon: Settings2, className: 'border-zinc-800 text-zinc-300' },
    { href: '/almacen/kardex', label: 'Kardex', icon: History, className: 'border-zinc-800 text-zinc-300' },
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
                    className="absolute inset-0"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                    <GlassCard className="p-4 h-full">{front}</GlassCard>
                </div>
                <div
                    className="absolute inset-0 overflow-y-auto max-h-[132px]"
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
    const [mounted, setMounted] = useState(false);
    const resolved =
        (imageUrl?.trim() ||
            catalogUrlFromProduct?.trim() ||
            catalogUrlFromName?.trim() ||
            '') ||
        '';

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setFailed(false);
    }, [resolved]);

    const showImage = mounted && Boolean(resolved) && !failed;

    return (
        <div className="w-12 h-12 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center shrink-0">
            {showImage ? (
                <img
                    src={resolved}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <Package className="text-zinc-700" size={20} />
            )}
        </div>
    );
}

export default function InventoryMasterPage() {
    const router = useRouter();
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
    /** `products.imagen` por nombre normalizado (fallback si no hay `product_id`). */
    const [catalogImagenByName, setCatalogImagenByName] = useState<Record<string, string>>({});
    /** `products.imagen` por `products.id` cuando el ítem tiene `product_id`. */
    const [catalogImagenByProductId, setCatalogImagenByProductId] = useState<Record<number, string>>({});
    const [depositsById, setDepositsById] = useState<Map<string, DepositRow>>(new Map());
    const [furnitureById, setFurnitureById] = useState<Map<string, FurnitureRow>>(new Map());
    const [mastersWarning, setMastersWarning] = useState<string | null>(null);
    const [entidades, setEntidades] = useState<EntidadRow[]>([]);
    const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
    const [partidasFiltro, setPartidasFiltro] = useState<PartidaRow[]>([]);
    const [filterEntidadId, setFilterEntidadId] = useState('');
    const [filterProyectoId, setFilterProyectoId] = useState('');
    const [filterPartidaId, setFilterPartidaId] = useState('');
    const [filterDepositId, setFilterDepositId] = useState('');
    const [sinClasificacionObra, setSinClasificacionObra] = useState(false);
    const [sinAlmacenAsignado, setSinAlmacenAsignado] = useState(false);
    /** Stock en `inventario_stock` (compras registradas por ubicación, migr. 180). */
    const [stockPorUbicacion, setStockPorUbicacion] = useState<
        Map<string, StockEnUbicacionResumen>
    >(new Map());
    const [itemsDesdeStock, setItemsDesdeStock] = useState<InventoryItem[]>([]);
    const [cargandoStockUbicacion, setCargandoStockUbicacion] = useState(false);
    /** Stock agregado de todas las ubicaciones (KPIs sin filtro de almacén). */
    const [stockGlobal, setStockGlobal] = useState<Map<string, StockEnUbicacionResumen>>(new Map());
    const [statFlips, setStatFlips] = useState<Record<StatFlipKey, boolean>>({
        valor: false,
        bajo: false,
        cuarentena: false,
        sku: false,
    });
    const [valorRotateIdx, setValorRotateIdx] = useState(0);
    const [kpiVista, setKpiVista] = useState<KpiVista>('ninguno');
    const [valorPorDeposito, setValorPorDeposito] = useState<ValorInventarioDeposito[]>([]);

    const toggleStatFlip = useCallback((key: StatFlipKey) => {
        setStatFlips((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const supabase = createClient();

    useEffect(() => {
        void (async () => {
            try {
                const [e, p] = await Promise.all([loadEntidades(supabase), loadProyectos(supabase)]);
                setEntidades(e);
                setProyectos(p);
            } catch {
                /* filtros opcionales */
            }
        })();
    }, [supabase]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const ubicaciones = await listarUbicacionesParaFiltroInventario(supabase);
                const ids = ubicaciones.map((u) => u.id);
                if (!ids.length) return;
                const stockMap = await cargarStockPorUbicaciones(supabase, ids);
                if (!cancelled) setStockGlobal(stockMap);
            } catch (e) {
                console.warn('[inventario] stock global:', e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [supabase]);

    useEffect(() => {
        if (!filterProyectoId) {
            setPartidasFiltro([]);
            setFilterPartidaId('');
            return;
        }
        void loadPartidasPorProyecto(supabase, filterProyectoId).then(setPartidasFiltro).catch(() => setPartidasFiltro([]));
    }, [filterProyectoId, supabase]);

    const proyectosFiltro = useMemo(
        () => filtrarProyectosPorEntidad(proyectos, filterEntidadId || null),
        [proyectos, filterEntidadId],
    );

    const depositsLista = useMemo(() => {
        return Array.from(depositsById.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'es'),
        );
    }, [depositsById]);

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

    useEffect(() => {
        fetchInventory();
    }, [activeCategory]);

    const itemsCatalogo = useMemo(() => {
        const byId = new Map<string, InventoryItem>();
        for (const it of items) byId.set(it.id, it);
        for (const it of itemsDesdeStock) {
            if (!byId.has(it.id)) byId.set(it.id, it);
        }
        return Array.from(byId.values());
    }, [items, itemsDesdeStock]);

    useEffect(() => {
        if (!filterProyectoId && !filterDepositId) {
            setStockPorUbicacion(new Map());
            setItemsDesdeStock([]);
            return;
        }

        let cancelled = false;
        void (async () => {
            setCargandoStockUbicacion(true);
            try {
                const ubicaciones = await listarUbicacionesParaFiltroInventario(supabase);
                const nombreProyectoFiltro =
                    proyectos.find((p) => p.id === filterProyectoId)?.nombre ?? '';
                const ids = resolverUbicacionIdsFiltro(ubicaciones, {
                    proyectoId: filterProyectoId || undefined,
                    proyectoNombre: nombreProyectoFiltro || undefined,
                    depositId: filterDepositId || undefined,
                });
                if (cancelled) return;

                let stockMap: Map<string, StockEnUbicacionResumen>;
                if (!ids.length && filterProyectoId) {
                    const agg = await getStockAgregadoPorMaterialObra(
                        supabase,
                        filterProyectoId,
                        nombreProyectoFiltro || undefined,
                    );
                    stockMap = new Map();
                    agg.forEach((qty, materialId) => {
                        if (qty > 0) {
                            stockMap.set(materialId, {
                                cantidad_disponible: qty,
                                ubicacion_nombres: ['Obra'],
                            });
                        }
                    });
                } else if (!ids.length) {
                    setStockPorUbicacion(new Map());
                    setItemsDesdeStock([]);
                    return;
                } else {
                    stockMap = await cargarStockPorUbicaciones(supabase, ids);
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
                setItemsDesdeStock((extraRows ?? []) as InventoryItem[]);
            } catch (e) {
                console.warn('[inventario] stock por ubicación:', e);
                if (!cancelled) {
                    setStockPorUbicacion(new Map());
                    setItemsDesdeStock([]);
                }
            } finally {
                if (!cancelled) setCargandoStockUbicacion(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [filterProyectoId, filterDepositId, supabase, items, proyectos]);

    useEffect(() => {
        if (!itemsCatalogo.length || !depositsLista.length) {
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
        void cargarValorInventarioPorDeposito(supabase, costoPorMaterial, depositLabels)
            .then((rows) => {
                if (!cancelled) setValorPorDeposito(rows);
            })
            .catch((e) => console.warn('[inventario] valor por depósito:', e));
        return () => {
            cancelled = true;
        };
    }, [itemsCatalogo, depositsLista, supabase]);

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
                supabase.from('inventory_deposits').select('id,name,locality'),
                supabase.from('inventory_furniture').select('id,deposit_id,name'),
            ]);

            if (invRes.error) {
                const msg = invRes.error.message ?? '';
                if (msg.includes('entidad_id') || msg.includes('presupuesto_partida') || invRes.error.code === '42703') {
                    invQuery = supabase.from('global_inventory').select('*').order('name');
                    invRes = await invQuery;
                }
            }
            if (invRes.error) throw invRes.error;

            const inventoryItems = (invRes.data ?? []) as InventoryItem[];
            setItems(inventoryItems);

            const depMap = new Map<string, DepositRow>();
            for (const d of (depRes.data ?? []) as DepositRow[]) {
                if (d.id) depMap.set(d.id, d);
            }
            setDepositsById(depMap);

            const furMap = new Map<string, FurnitureRow>();
            for (const f of (furRes.data ?? []) as FurnitureRow[]) {
                if (f.id) furMap.set(f.id, f);
            }
            setFurnitureById(furMap);

            if (depRes.error) {
                setMastersWarning(
                    `No se cargaron depósitos (ubicación): ${depRes.error.message}. Ejecute migración 014 en Supabase.`
                );
            } else if (depMap.size === 0) {
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
            const quarantine = inventoryItems.reduce((acc, item) =>
                acc + Number(item.stock_quarantine), 0);

            setStats({
                totalValue: totalVal,
                lowStockCount: lowStock,
                totalItems: inventoryItems.length,
                quarantineCount: quarantine
            });
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const filtroPorUbicacionActivo = Boolean(filterProyectoId || filterDepositId);

    const optsFiltroProyectoDeposito = useMemo(
        () => ({
            proyectoId: filterProyectoId || undefined,
            depositId: filterDepositId || undefined,
        }),
        [filterProyectoId, filterDepositId],
    );

    const cantidadStockReal = useCallback(
        (item: InventoryItem): number => {
            if (filtroPorUbicacionActivo) {
                const fromUb = stockPorUbicacion.get(item.id)?.cantidad_disponible;
                if (fromUb != null && fromUb > 0) return fromUb;
                if (materialCoincideFiltroProyectoDeposito(item, optsFiltroProyectoDeposito)) {
                    return Number(item.stock_available) || 0;
                }
                return fromUb ?? 0;
            }
            const fromStock = stockGlobal.get(item.id)?.cantidad_disponible;
            if (fromStock != null && fromStock > 0) return fromStock;
            return Number(item.stock_available) || 0;
        },
        [filtroPorUbicacionActivo, stockPorUbicacion, stockGlobal, optsFiltroProyectoDeposito],
    );

    const filteredItems = useMemo(() => {
        return itemsCatalogo.filter((item) => {
            const term = searchTerm.trim().toLowerCase();
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
            if (filterEntidadId && item.entidad_id !== filterEntidadId) return false;
            if (filterPartidaId && item.presupuesto_partida_id !== filterPartidaId) return false;
            if (sinClasificacionObra && (item.proyecto_id || item.entidad_id)) return false;
            if (sinAlmacenAsignado && item.deposit_id) return false;

            if (filtroPorUbicacionActivo) {
                if (stockEnFiltro > 0) return true;
                if (materialCoincideFiltroProyectoDeposito(item, optsFiltroProyectoDeposito)) {
                    return true;
                }
                return false;
            }

            if (filterProyectoId && item.proyecto_id !== filterProyectoId) return false;
            if (filterDepositId && item.deposit_id !== filterDepositId) return false;

            const qty = cantidadStockReal(item);
            if (kpiVista === 'stock_bajo' && qty > Number(item.reorder_point)) return false;
            if (kpiVista === 'cuarentena' && Number(item.stock_quarantine) <= 0) return false;

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
        filtroPorUbicacionActivo,
        stockPorUbicacion,
        cantidadStockReal,
        kpiVista,
        optsFiltroProyectoDeposito,
    ]);

    const statsFiltrados = useMemo(() => {
        const base = hayFiltrosActivos ? filteredItems : itemsCatalogo;
        const totalVal = base.reduce(
            (acc, item) =>
                acc + cantidadStockReal(item) * Number(item.average_weighted_cost),
            0,
        );
        const lowStock = base.filter(
            (item) => cantidadStockReal(item) <= Number(item.reorder_point),
        ).length;
        const quarantine = base.reduce((acc, item) => acc + Number(item.stock_quarantine), 0);
        return {
            totalValue: totalVal,
            lowStockCount: lowStock,
            totalItems: base.length,
            quarantineCount: quarantine,
        };
    }, [filteredItems, itemsCatalogo, hayFiltrosActivos, cantidadStockReal]);

    const baseItemsKpi = useMemo(
        () => (hayFiltrosActivos ? filteredItems : itemsCatalogo),
        [hayFiltrosActivos, filteredItems, itemsCatalogo],
    );

    const valorPorAlmacen = useMemo(() => {
        const map = new Map<string, { name: string; value: number }>();
        for (const item of baseItemsKpi) {
            const qty = cantidadStockReal(item);
            const val = qty * Number(item.average_weighted_cost);
            const depId = item.deposit_id ?? '__sin__';
            const dep = item.deposit_id ? depositsById.get(item.deposit_id) : null;
            const name = dep
                ? dep.locality
                    ? `${dep.name} (${dep.locality})`
                    : dep.name
                : 'Sin almacén asignado';
            const prev = map.get(depId) ?? { name, value: 0 };
            map.set(depId, { name: prev.name, value: prev.value + val });
        }
        for (const d of depositsLista) {
            if (!map.has(d.id)) {
                map.set(d.id, {
                    name: d.locality ? `${d.name} (${d.locality})` : d.name,
                    value: 0,
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.value - a.value);
    }, [baseItemsKpi, cantidadStockReal, depositsById, depositsLista]);

    const itemsStockBajo = useMemo(
        () =>
            baseItemsKpi
                .filter((item) => cantidadStockReal(item) <= Number(item.reorder_point))
                .sort((a, b) => cantidadStockReal(a) - cantidadStockReal(b))
                .slice(0, 8),
        [baseItemsKpi, cantidadStockReal],
    );

    const itemsCuarentena = useMemo(
        () =>
            baseItemsKpi
                .filter((item) => Number(item.stock_quarantine) > 0)
                .sort((a, b) => Number(b.stock_quarantine) - Number(a.stock_quarantine))
                .slice(0, 8),
        [baseItemsKpi],
    );

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
        const slots: { label: string; value: number }[] = [
            { label: 'Valor total', value: statsFiltrados.totalValue },
        ];
        for (const d of valorPorDeposito) {
            slots.push({ label: d.name, value: d.value });
        }
        if (valorPorAlmacen.length && !valorPorDeposito.length) {
            for (const d of valorPorAlmacen) {
                slots.push({ label: d.name, value: d.value });
            }
        }
        return slots;
    }, [statsFiltrados.totalValue, valorPorDeposito, valorPorAlmacen]);

    const valorSlotActual = valorSlots[valorRotateIdx % Math.max(valorSlots.length, 1)] ?? {
        label: 'Valor total',
        value: statsFiltrados.totalValue,
    };

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
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(val);
    };

    const shareInventory = () => {
        const text = `📦 *REPORTE DE INVENTARIO - ${new Date().toLocaleDateString()}*\n\n` +
            filteredItems.map(item => `- ${item.name}: ${cantidadStockReal(item)} ${item.unit}`).join('\n') +
            `\n\n*Valor Total:* ${formatCurrency(statsFiltrados.totalValue)}`;

        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    };

    /** Elimina un ítem del maestro global_inventory (irreversible). */
    const deleteMaterial = async (id: string, label: string) => {
        if (!confirm(`¿Eliminar del inventario?\n\n${label}\n\nEsta acción no se puede deshacer.`)) return;
        setDeletingId(id);
        try {
            const { error } = await supabase.from('global_inventory').delete().eq('id', id);
            if (error) {
                if (error.code === '23503' || error.message?.includes('foreign key')) {
                    alert(
                        'No se puede borrar: hay movimientos, compras u otros registros vinculados a este material. Elimina o ajusta esos datos primero en la base de datos.'
                    );
                } else {
                    alert(error.message || 'Error al borrar');
                }
                return;
            }
            await fetchInventory();
        } finally {
            setDeletingId(null);
        }
    };

    const handleKpiToggle = useCallback((key: StatFlipKey, vista: KpiVista) => {
        const opening = !statFlips[key];
        setStatFlips((prev) => ({ ...prev, [key]: opening }));
        setKpiVista(opening ? vista : 'ninguno');
    }, [statFlips]);

    const handleValorRotate = useCallback(() => {
        if (statFlips.valor) {
            toggleStatFlip('valor');
            return;
        }
        setValorRotateIdx((i) => (i + 1) % Math.max(valorSlots.length, 1));
    }, [statFlips.valor, toggleStatFlip, valorSlots.length]);

    const navBtnClass =
        'inline-flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-zinc-800 transition-all whitespace-nowrap';

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            {/* Header Section */}
            <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-3">ALMACENES</h1>
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
                        return (
                            <Link key={nav.href} href={nav.href!}>
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

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <FlipStatCard
                    flipped={statFlips.valor}
                    onToggle={handleValorRotate}
                    front={
                        <>
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                    <TrendingUp className="text-blue-500" size={18} />
                                </div>
                                <button
                                    type="button"
                                    title="Ver desglose completo"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleStatFlip('valor');
                                    }}
                                    className="p-1 rounded-md text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10"
                                >
                                    <RotateCw size={14} />
                                </button>
                            </div>
                            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-0.5 truncate">
                                {valorSlotActual.label}
                            </p>
                            <h2 className="text-2xl font-black tracking-tight">
                                {formatCurrency(valorSlotActual.value)}
                            </h2>
                            <p className="text-[9px] text-zinc-600 font-bold mt-1 flex items-center gap-1">
                                <RotateCw size={10} />
                                Clic para rotar almacén
                            </p>
                        </>
                    }
                    back={
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">
                                Valor por almacén
                            </p>
                            {(valorPorDeposito.length ? valorPorDeposito : valorPorAlmacen.map((r) => ({ name: r.name, value: r.value }))).length === 0 ? (
                                <p className="text-xs text-zinc-500">Sin datos de almacén</p>
                            ) : (
                                (valorPorDeposito.length
                                    ? valorPorDeposito.map((r) => ({ name: r.name, value: r.value }))
                                    : valorPorAlmacen
                                ).map((row) => (
                                    <div
                                        key={row.name}
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
                                            {cantidadStockReal(item)} / {item.reorder_point}
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
                                En Cuarentena
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
                                Unidades en cuarentena
                            </p>
                            {itemsCuarentena.length === 0 ? (
                                <p className="text-xs text-zinc-500">Sin cuarentena activa</p>
                            ) : (
                                itemsCuarentena.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/almacen/editar/${item.id}`);
                                        }}
                                        className="w-full flex justify-between gap-2 text-left text-[11px] font-bold border-b border-zinc-800/60 pb-1 hover:text-amber-300"
                                    >
                                        <span className="text-zinc-400 truncate">{item.name}</span>
                                        <span className="text-amber-400 shrink-0">
                                            {item.stock_quarantine} {item.unit}
                                        </span>
                                    </button>
                                ))
                            )}
                            <Link
                                href="/almacen/procurement/quality"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-flex text-[10px] font-black uppercase tracking-widest text-amber-400 hover:text-amber-300"
                            >
                                Liberar cuarentena →
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
                                    de {stats.totalItems} en catálogo
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

            {/* Filters & Search */}
            <div className="flex flex-col gap-3 mb-6">
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
                        <span className="text-[10px] font-bold text-zinc-500">
                            Mostrando {filteredItems.length} de {itemsCatalogo.length} ítems
                            {cargandoStockUbicacion && filtroPorUbicacionActivo
                                ? ' · actualizando stock por almacén…'
                                : ''}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1.5 block">
                                Proyecto / obra
                            </span>
                            <select
                                value={filterProyectoId}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    setFilterProyectoId(id);
                                    setFilterPartidaId('');
                                    if (id) {
                                        const pr = proyectos.find((p) => p.id === id);
                                        if (pr?.entidad_id) setFilterEntidadId(pr.entidad_id);
                                    }
                                }}
                                className="w-full rounded-xl border border-sky-500/30 bg-black/50 px-3 py-3 text-sm font-bold text-white"
                            >
                                <option value="">Todos los proyectos</option>
                                {proyectosFiltro.map((p) => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1.5 block">
                                Almacén / depósito
                            </span>
                            <select
                                value={filterDepositId}
                                onChange={(e) => {
                                    setFilterDepositId(e.target.value);
                                    if (e.target.value) setSinAlmacenAsignado(false);
                                }}
                                disabled={sinAlmacenAsignado}
                                className="w-full rounded-xl border border-emerald-500/30 bg-black/50 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
                            >
                                <option value="">Todos los almacenes</option>
                                {depositsLista.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.locality ? `${d.name} (${d.locality})` : d.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/80">
                        <select
                            value={filterEntidadId}
                            onChange={(e) => {
                                setFilterEntidadId(e.target.value);
                                setFilterProyectoId('');
                                setFilterPartidaId('');
                            }}
                            className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 text-xs font-bold text-white min-w-[130px]"
                        >
                            <option value="">Entidad</option>
                            {entidades.map((en) => (
                                <option key={en.id} value={en.id}>{en.nombre}</option>
                            ))}
                        </select>
                        <select
                            value={filterPartidaId}
                            onChange={(e) => setFilterPartidaId(e.target.value)}
                            disabled={!filterProyectoId}
                            className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 text-xs font-bold text-white min-w-[160px] disabled:opacity-50"
                        >
                            <option value="">Partida Lulo</option>
                            {partidasFiltro.map((pt) => (
                                <option key={pt.id} value={pt.id}>{labelPartida(pt)}</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sinClasificacionObra}
                                onChange={(e) => setSinClasificacionObra(e.target.checked)}
                                className="rounded border-zinc-700"
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
                </div>
            </div>

            {/* Items Table */}
            <GlassCard className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-zinc-900/50 border-b border-zinc-800 text-left">
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Material / Info</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Entidad / Obra / Partida</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Ubicación</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Stock Real</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Costo Promedio</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Última Compra</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {loading || (cargandoStockUbicacion && filtroPorUbicacionActivo) ? (
                            [1, 2, 3].map(i => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={7} className="p-8 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading material data...</td>
                                </tr>
                            ))
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-20 text-center">
                                    <div className="flex flex-col items-center">
                                        <Package size={48} className="text-zinc-800 mb-4" />
                                        <p className="text-zinc-500 font-black text-xl tracking-tight">No se encontraron materiales</p>
                                        <p className="text-zinc-600 font-bold text-sm uppercase tracking-widest mt-1">Ajusta tus filtros o registra un nuevo item</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((item) => {
                                const stockMostrar = cantidadStockReal(item);
                                const stockUb = filtroPorUbicacionActivo
                                    ? stockPorUbicacion.get(item.id)
                                    : undefined;

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
                                    className="group hover:bg-white/[0.04] transition-colors cursor-pointer"
                                >
                                    <td className="p-5">
                                        <div className="flex items-center gap-4">
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
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20 uppercase">
                                                        {item.sap_code || 'SIN COD'}
                                                    </span>
                                                </div>
                                                <h4 className="font-black text-zinc-100 leading-tight">{item.name}</h4>
                                                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{item.unit}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5 max-w-[220px]">
                                        <div className="space-y-1 text-[10px] font-bold">
                                            {item.entidad?.nombre ? (
                                                <p className="text-violet-300 truncate" title={item.entidad.nombre}>
                                                    {item.entidad.nombre}
                                                </p>
                                            ) : (
                                                <p className="text-zinc-600 uppercase tracking-wider">Sin entidad</p>
                                            )}
                                            {item.proyecto?.nombre ? (
                                                <p className="text-sky-400/90 truncate" title={item.proyecto.nombre}>
                                                    {item.proyecto.nombre}
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
                                    <td className="p-5">
                                        <div className="flex items-center gap-2 text-zinc-400 font-bold text-sm capitalize">
                                            <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                                            {formatInventoryLocationLabel(
                                                item,
                                                depositsById,
                                                furnitureById
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-5 text-right md:text-left">
                                        <div className="flex flex-col">
                                            <span className={`text-xl font-black ${stockMostrar <= Number(item.reorder_point)
                                                ? 'text-red-500'
                                                : 'text-zinc-100'
                                                }`}>
                                                {stockMostrar}
                                            </span>
                                            {filtroPorUbicacionActivo && stockUb ? (
                                                <span className="text-[10px] font-black text-emerald-500/90 uppercase">
                                                    En almacén filtrado
                                                </span>
                                            ) : null}
                                            {!filtroPorUbicacionActivo && Number(item.stock_quarantine) > 0 && (
                                                <span className="text-[10px] font-black text-amber-500 uppercase">
                                                    + {item.stock_quarantine} Cuarentena
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-bold text-zinc-300">
                                            {formatCurrency(Number(item.average_weighted_cost))}
                                            <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-black">Costo Ponderado</p>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        {item.last_purchase_date ? (
                                            <div>
                                                <p className="text-zinc-300 font-bold text-sm">
                                                    {new Date(item.last_purchase_date).toLocaleDateString()}
                                                </p>
                                                <p className="text-[10px] text-zinc-500 font-bold">
                                                    {formatCurrency(Number(item.last_purchase_price))}
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">Sin registros</span>
                                        )}
                                    </td>
                                    <td className="p-5 text-right w-10" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex gap-1 justify-end items-center">
                                            <Link href={`/almacen/editar/${item.id}`}>
                                                <button
                                                    type="button"
                                                    title="Editar"
                                                    className="p-2 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                                                >
                                                    <ChevronRight size={20} />
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
                                                className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-40"
                                            >
                                                {deletingId === item.id ? (
                                                    <span className="inline-block w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 size={18} />
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
            </GlassCard>
        </div>
    );
}
