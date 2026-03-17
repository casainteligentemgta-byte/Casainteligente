'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
    ShieldCheck,
    Search,
    CheckCircle2,
    XCircle,
    Info,
    Truck,
    ArrowLeft,
    ArrowRight,
    ClipboardCheck
} from 'lucide-react';
import { QualityInspection } from '@/types/inventory';
import { InventoryService } from '@/lib/services/inventory';
import Link from 'next/link';

export default function QualityDashboard() {
    const [inspections, setInspections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    const supabase = createClient();

    useEffect(() => {
        fetchInspections();
    }, []);

    const fetchInspections = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('quality_inspections')
                .select(`
          *,
          global_inventory(name, unit, sap_code),
          purchase_invoices(invoice_number, supplier_name)
        `)
                .eq('status', 'PENDIENTE')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInspections(data || []);
        } catch (error) {
            console.error('Error fetching inspections:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        setProcessing(id);
        try {
            // Use the service to handle complex logic (101 movement, cost update, etc.)
            // Note: We need the user ID. For now, we use a placeholder or get it from auth.
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            await InventoryService.approveQuality(id, user.id);

            // Refresh list
            setInspections(prev => prev.filter(i => i.id !== id));
            alert('Internamiento exitoso (Movimiento 101 registrado)');
        } catch (error) {
            console.error('Error approving quality:', error);
            alert('Error en el internamiento. Ver consola.');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (id: string) => {
        // In a real app, this might trigger a return process or just change status
        const { error } = await supabase
            .from('quality_inspections')
            .update({ status: 'RECHAZADO' })
            .eq('id', id);

        if (!error) {
            setInspections(prev => prev.filter(i => i.id !== id));
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/almacen">
                            <button className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all">
                                <ArrowLeft size={20} />
                            </button>
                        </Link>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter">CUARENTENA</h1>
                            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                                <ShieldCheck size={14} className="text-amber-500" />
                                Stage 2: Quality Gate & Inspection
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Pendientes por Validar</p>
                            <h4 className="text-2xl font-black text-amber-500">{inspections.length} Ítems</h4>
                        </div>
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
                            <ClipboardCheck className="text-amber-500" />
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-3xl mb-8 flex gap-4 items-start">
                    <Info className="text-blue-500 shrink-0" size={24} />
                    <p className="text-blue-200/80 font-bold text-sm leading-relaxed">
                        La mercancía en esta lista ha sido capturada por compras pero aún no forma parte del Stock Disponible.
                        El Jefe de Almacén debe validar físicamente el estado de los materiales para proceder con el <span className="text-blue-400 font-black">INTERNAMIENTO (Movimiento 101)</span>.
                    </p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <GlassCard key={i} className="h-48 animate-pulse" />
                        ))}
                    </div>
                ) : inspections.length === 0 ? (
                    <div className="text-center py-32">
                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShieldCheck size={48} className="text-zinc-800" />
                        </div>
                        <h2 className="text-2xl font-black text-zinc-500 tracking-tight">Zona de Cuarentena Vacía</h2>
                        <p className="text-zinc-700 font-bold uppercase text-xs tracking-widest mt-2">Todo el material recibido ha sido procesado</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {inspections.map((insp) => (
                            <GlassCard key={insp.id} className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex gap-4">
                                        <div className="w-14 h-14 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center text-zinc-400">
                                            <Truck size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[9px] font-black bg-zinc-100 text-black px-2 py-0.5 rounded">
                                                    {insp.global_inventory?.sap_code || 'N/A'}
                                                </span>
                                                <span className="text-[9px] font-black border border-zinc-700 text-zinc-500 px-2 py-0.5 rounded uppercase">
                                                    RECUPERADO
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-black">{insp.global_inventory?.name}</h3>
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                                {insp.purchase_invoices?.supplier_name} • Factura #{insp.purchase_invoices?.invoice_number}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Cantidad</p>
                                        <p className="text-3xl font-black text-zinc-100">{insp.quantity}</p>
                                        <p className="text-[10px] font-bold text-zinc-500">{insp.global_inventory?.unit}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-6 border-t border-zinc-800/50">
                                    <button
                                        onClick={() => handleReject(insp.id)}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                                    >
                                        <XCircle size={18} />
                                        RECHAZAR
                                    </button>
                                    <button
                                        onClick={() => handleApprove(insp.id)}
                                        disabled={processing === insp.id}
                                        className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                                    >
                                        {processing === insp.id ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={18} />
                                                APROBAR Y SUMAR STOCK (101)
                                            </>
                                        )}
                                    </button>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
