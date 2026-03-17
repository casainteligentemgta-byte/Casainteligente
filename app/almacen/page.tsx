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
    MoreVertical,
    ArrowUpRight,
    ArrowDownRight,
    Share2
} from 'lucide-react';
import { InventoryItem, UnitType } from '@/types/inventory';
import Link from 'next/link';

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

    const supabase = createClient();

    useEffect(() => {
        fetchInventory();
    }, [activeCategory]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            let query = supabase.from('global_inventory').select('*');

            if (activeCategory !== 'Todos') {
                // Assuming we join with categories or have category names here
                // For now, let's just fetch all or filter if we had categories
            }

            const { data, error } = await query.order('name');

            if (error) throw error;

            const inventoryItems = data as InventoryItem[];
            setItems(inventoryItems);

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
                            <th className="p-5"></th>
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
                                            <div className="w-12 h-12 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center shrink-0">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="text-zinc-700" size={20} />
                                                )}
                                            </div>
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
                                        <div className="flex gap-2">
                                            <Link href={`/almacen/editar/${item.id}`}>
                                                <button className="p-2 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded-lg transition-all">
                                                    <ChevronRight size={20} />
                                                </button>
                                            </Link>
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
