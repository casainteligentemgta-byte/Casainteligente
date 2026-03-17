'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
    History,
    Search,
    ArrowLeft,
    ArrowUpRight,
    ArrowDownRight,
    TrendingDown,
    TrendingUp,
    RotateCcw,
    GitCompare,
    Box
} from 'lucide-react';
import Link from 'next/link';

const MOVEMENT_LABELS: Record<string, { label: string, color: string, icon: any }> = {
    '101': { label: 'Entrada por Compra', color: 'text-green-500', icon: ArrowUpRight },
    '201': { label: 'Salida para Consumo', color: 'text-red-500', icon: ArrowDownRight },
    '311': { label: 'Traspaso entre Almacenes', color: 'text-blue-500', icon: GitCompare },
    '501': { label: 'Entrada por Sobrante', color: 'text-amber-500', icon: RotateCcw },
    '601': { label: 'Reingreso (Devolución)', color: 'text-purple-500', icon: Box },
};

export default function KardexPage() {
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchMovements();
    }, []);

    const fetchMovements = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('inventory_movements')
            .select(`
        *,
        global_inventory(name, unit, sap_code)
      `)
            .order('created_at', { ascending: false });

        if (!error) setMovements(data || []);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/almacen">
                        <button className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all">
                            <ArrowLeft size={20} />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter">KARDEX</h1>
                        <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Historial Completo de Movimientos de Material</p>
                    </div>
                </div>

                <GlassCard className="overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-zinc-900/50 border-b border-zinc-800 text-left">
                                <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Fecha / Hora</th>
                                <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Clase Mov.</th>
                                <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500">Material</th>
                                <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500 text-right">Cant.</th>
                                <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500 text-right">Stock Final</th>
                                <th className="p-5 font-black text-[10px] uppercase tracking-widest text-zinc-500 text-right">Costo Act.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {loading ? (
                                <tr><td colSpan={6} className="p-10 text-center text-zinc-600 font-bold">Cargando trazabilidad...</td></tr>
                            ) : movements.length === 0 ? (
                                <tr><td colSpan={6} className="p-20 text-center text-zinc-700 font-black text-xl uppercase tracking-tighter">Sin movimientos registrados</td></tr>
                            ) : (
                                movements.map((mv) => {
                                    const info = MOVEMENT_LABELS[mv.movement_type_code] || { label: 'Desconocido', color: 'text-zinc-500', icon: Box };
                                    const Icon = info.icon;
                                    return (
                                        <tr key={mv.id} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="p-5">
                                                <p className="font-bold text-zinc-300 text-sm">{new Date(mv.created_at).toLocaleDateString()}</p>
                                                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{new Date(mv.created_at).toLocaleTimeString()}</p>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg bg-zinc-900 border border-zinc-800 ${info.color}`}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1">{mv.movement_type_code}</p>
                                                        <p className={`font-black text-xs uppercase tracking-tight ${info.color}`}>{info.label}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <p className="font-black text-zinc-100">{mv.global_inventory?.name}</p>
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase">{mv.global_inventory?.sap_code || 'SIN SAP'}</p>
                                            </td>
                                            <td className="p-5 text-right">
                                                <span className={`text-lg font-black ${mv.quantity > 0 && mv.movement_type_code === '101' ? 'text-green-500' : (mv.movement_type_code === '201' ? 'text-red-500' : 'text-zinc-100')}`}>
                                                    {mv.movement_type_code === '201' ? '-' : '+'}{mv.quantity}
                                                </span>
                                            </td>
                                            <td className="p-5 text-right font-black text-zinc-300">
                                                {mv.new_stock}
                                            </td>
                                            <td className="p-5 text-right font-bold text-zinc-500 text-sm">
                                                ${Number(mv.new_cost).toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </GlassCard>
            </div>
        </div>
    );
}
