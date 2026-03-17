'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
    ArrowLeft,
    Save,
    Package,
    Tag,
    Hash,
    MapPin,
    Droplets,
    Wrench,
    Fuel,
    Truck,
    ShieldCheck as ShieldSafe
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
    { id: 'her', name: 'Herramientas', icon: Wrench },
    { id: 'mat', name: 'Materiales', icon: Package },
    { id: 'maq', name: 'Maquinaria', icon: Truck },
    { id: 'com', name: 'Combustibles', icon: Fuel },
    { id: 'epp', name: 'EPP', icon: ShieldSafe },
];

export default function NewInventoryItemPage() {
    const [item, setItem] = useState({
        sap_code: '',
        name: '',
        category_id: 'her',
        unit: 'UND',
        reorder_point: 0,
        location: '',
        // Tool-specific
        brand: '',
        model: '',
        serial_number: '',
        last_purchase_date: '',
        status: 'OPERATIVO',
        observations: '',
    });
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('global_inventory')
                .insert([{
                    ...item,
                    stock_available: item.category_id === 'her' ? 1 : 0, // Tools usually start with 1 if registered individually
                    stock_quarantine: 0,
                    average_weighted_cost: 0,
                    last_purchase_date: item.last_purchase_date || null
                }]);

            if (error) throw error;
            router.push('/almacen');
        } catch (error) {
            console.error('Error creating item:', error);
            alert('Error al crear el material/herramienta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/almacen">
                        <button className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all">
                            <ArrowLeft size={20} />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter">ALTA DE ACTIVO</h1>
                        <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Maestro de Inventario & Herramental</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <GlassCard className="p-8">
                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nombre / Descripción</label>
                                <div className="relative">
                                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                    <input
                                        type="text"
                                        required
                                        value={item.name}
                                        onChange={(e) => setItem({ ...item, name: e.target.value })}
                                        placeholder="Ej: Taladro Percutor Milwaukee 18V"
                                        className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:bg-white focus:text-black focus:border-blue-500 transition-all text-lg"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Categoría Principal</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {CATEGORIES.map((cat) => {
                                        const Icon = cat.icon;
                                        const isActive = item.category_id === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setItem({ ...item, category_id: cat.id })}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${isActive
                                                    ? 'border-blue-600 bg-blue-600/10 text-white'
                                                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700'
                                                    }`}
                                            >
                                                <Icon size={20} />
                                                <span className="text-[9px] font-black uppercase tracking-tighter">{cat.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Conditional fields for Tools */}
                            {item.category_id === 'her' && (
                                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Marca</label>
                                            <input
                                                type="text"
                                                value={item.brand}
                                                onChange={(e) => setItem({ ...item, brand: e.target.value })}
                                                placeholder="Ej: Milwaukee"
                                                className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Modelo</label>
                                            <input
                                                type="text"
                                                value={item.model}
                                                onChange={(e) => setItem({ ...item, model: e.target.value })}
                                                placeholder="Ej: 2804-20"
                                                className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Número de Serial</label>
                                            <input
                                                type="text"
                                                value={item.serial_number}
                                                onChange={(e) => setItem({ ...item, serial_number: e.target.value })}
                                                placeholder="S/N: XXXXXXXX"
                                                className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Estatus</label>
                                            <select
                                                value={item.status}
                                                onChange={(e) => setItem({ ...item, status: e.target.value })}
                                                className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:bg-white focus:text-black focus:border-blue-500 transition-all"
                                            >
                                                <option value="OPERATIVO" className="text-black">OPERATIVO</option>
                                                <option value="EN REPARACION" className="text-black">EN REPARACIÓN</option>
                                                <option value="BAJA" className="text-black">FUERA DE SERVICIO (BAJA)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Fecha de Ingreso/Compra</label>
                                        <input
                                            type="date"
                                            value={item.last_purchase_date}
                                            onChange={(e) => setItem({ ...item, last_purchase_date: e.target.value })}
                                            className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Observaciones Técnicas</label>
                                        <textarea
                                            value={item.observations}
                                            onChange={(e) => setItem({ ...item, observations: e.target.value })}
                                            rows={3}
                                            placeholder="Detalles sobre el estado, accesorios incluidos..."
                                            className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:bg-white focus:text-black focus:border-blue-500 resize-none transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Código Interno / SAP</label>
                                    <div className="relative">
                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                        <input
                                            type="text"
                                            value={item.sap_code}
                                            onChange={(e) => setItem({ ...item, sap_code: e.target.value })}
                                            placeholder="Ej: HER-001"
                                            className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:border-white transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ubicación (Pasillo/Estante)</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                                        <input
                                            type="text"
                                            value={item.location}
                                            onChange={(e) => setItem({ ...item, location: e.target.value })}
                                            placeholder="Ej: Taller 1 - Estante A"
                                            className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:border-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                                ) : (
                                    <>
                                        <Save size={24} />
                                        CREAR MATERIAL
                                    </>
                                )}
                            </button>
                        </div>
                    </GlassCard>
                </form>
            </div>
        </div>
    );
}
