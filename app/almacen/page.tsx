'use client';

import React, { useState, useEffect } from 'react';
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
    MoreVertical,
    Trash2,
    ArrowUpRight,
    ArrowDownRight,
    Share2
} from 'lucide-react';
import { InventoryItem } from '@/types/inventory';
import Link from 'next/link';

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

    return (
        <div className="w-12 h-12 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center shrink-0">
            {resolved && !failed ? (
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

    const supabase = createClient();

    useEffect(() => {
        fetchInventory();
    }, [activeCategory]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const invQuery = supabase.from('global_inventory').select('*').order('name');

            if (activeCategory !== 'Todos') {
                // Assuming we join with categories or have category names here
                // For now, let's just fetch all or filter if we had categories
            }

            const [invRes, prodRes] = await Promise.all([
                invQuery,
                supabase.from('products').select('nombre, imagen').not('imagen', 'is', null),
            ]);

            if (invRes.error) throw invRes.error;

            const inventoryItems = invRes.data as InventoryItem[];
            setItems(inventoryItems);

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

            // Calculate stats
            const totalVal = inventoryItems.reduce((acc, item) =>
                acc + (Number(item.stock_available) * Number(item.average_weighted_cost)), 0);
            const lowStock = inventoryItems.filter(item =>
                Number(item.stock_available) <= Number(item.reorder_point)).length;
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

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sap_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(val);
    };

    const shareInventory = () => {
        const text = `📦 *REPORTE DE INVENTARIO - ${new Date().toLocaleDateString()}*\n\n` +
            filteredItems.map(item => `- ${item.name}: ${item.stock_available} ${item.unit}`).join('\n') +
            `\n\n*Valor Total:* ${formatCurrency(stats.totalValue)}`;

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

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter mb-1">INVENTARIO</h1>
                    <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Global Assets & Stock Management</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/almacen/kardex">
                        <button className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all">
                            <History size={18} />
                            <span className="hidden sm:inline">Kardex</span>
                        </button>
                    </Link>
                    <Link href="/almacen/maestros">
                        <button className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all">
                            <Settings2 size={18} />
                            <span className="hidden sm:inline">Maestros</span>
                        </button>
                    </Link>
                    <button
                        onClick={shareInventory}
                        className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                    >
                        <Share2 size={18} />
                        <span className="hidden sm:inline">Compartir</span>
                    </button>
                    <Link href="/almacen/procurement">
                        <button className="flex items-center gap-2 bg-blue-600 px-6 py-3 rounded-2xl font-black text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
                            <Truck size={18} />
                            <span>COMPRAS</span>
                        </button>
                    </Link>
                    <Link href="/almacen/nuevo">
                        <button className="flex items-center gap-2 bg-white px-6 py-3 rounded-2xl font-black text-black hover:bg-zinc-200 transition-all shadow-lg shadow-white/10">
                            <Plus size={18} />
                            <span>NUEVO</span>
                        </button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <GlassCard className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <TrendingUp className="text-blue-500" size={24} />
                        </div>
                        <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-1 rounded-lg">ACTIVO</span>
                    </div>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-1">Valor Total</p>
                    <h2 className="text-3xl font-black tracking-tight">{formatCurrency(stats.totalValue)}</h2>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                            <AlertTriangle className="text-red-500" size={24} />
                        </div>
                        {stats.lowStockCount > 0 && (
                            <span className="text-[10px] font-black bg-red-500 text-white px-2 py-1 rounded-lg">CRÍTICO</span>
                        )}
                    </div>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-1">Stock Bajo</p>
                    <h2 className="text-3xl font-black tracking-tight text-red-500">{stats.lowStockCount} <span className="text-sm text-zinc-600 font-bold uppercase tracking-widest">Items</span></h2>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                            <ShieldCheck className="text-amber-500" size={24} />
                        </div>
                    </div>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-1">En Cuarentena</p>
                    <h2 className="text-3xl font-black tracking-tight text-amber-500">{stats.quarantineCount} <span className="text-sm text-zinc-600 font-bold uppercase tracking-widest">Unidades</span></h2>
                </GlassCard>

                <GlassCard className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-zinc-100/10 rounded-2xl border border-zinc-100/20">
                            <Package className="text-white" size={24} />
                        </div>
                    </div>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-1">Total SKU</p>
                    <h2 className="text-3xl font-black tracking-tight">{stats.totalItems}</h2>
                </GlassCard>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, código SAP o ubicación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    {['Todos', 'Herramientas', 'Materiales', 'Maquinaria', 'Combustibles', 'EPP'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-zinc-700'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Items Table */}
            <GlassCard className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-zinc-900/50 border-b border-zinc-800 text-left">
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Material / Info</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Ubicación</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Stock Real</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Costo Promedio</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Última Compra</th>
                            <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={6} className="p-8 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading material data...</td>
                                </tr>
                            ))
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-20 text-center">
                                    <div className="flex flex-col items-center">
                                        <Package size={48} className="text-zinc-800 mb-4" />
                                        <p className="text-zinc-500 font-black text-xl tracking-tight">No se encontraron materiales</p>
                                        <p className="text-zinc-600 font-bold text-sm uppercase tracking-widest mt-1">Ajusta tus filtros o registra un nuevo item</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map(item => (
                                <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
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
                                    <td className="p-5">
                                        <div className="flex items-center gap-2 text-zinc-400 font-bold text-sm capitalize">
                                            <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                                            {item.location || 'No asignada'}
                                        </div>
                                    </td>
                                    <td className="p-5 text-right md:text-left">
                                        <div className="flex flex-col">
                                            <span className={`text-xl font-black ${Number(item.stock_available) <= Number(item.reorder_point)
                                                ? 'text-red-500'
                                                : 'text-zinc-100'
                                                }`}>
                                                {item.stock_available}
                                            </span>
                                            {Number(item.stock_quarantine) > 0 && (
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
                                    <td className="p-5 text-right w-10">
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
                                                onClick={() => deleteMaterial(item.id, item.name)}
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
                            ))
                        )}
                    </tbody>
                </table>
            </GlassCard>
        </div>
    );
}
