'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
    FileText,
    Upload,
    Plus,
    Trash2,
    Save,
    ArrowLeft,
    Sparkles,
    Search,
    CheckCircle2,
    AlertCircle,
    ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ProcurementPage() {
    const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');
    const [invoice, setInvoice] = useState({
        invoice_number: '',
        supplier_rif: '',
        supplier_name: '',
        date: new Date().toISOString().split('T')[0],
        total_amount: 0
    });
    const [items, setItems] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]); // Assuming InventoryItem is an array of any for now
    const [isUploading, setIsUploading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        supabase.from('global_inventory').select('*').then(({ data }) => {
            if (data) setMaterials(data);
        });
    }, []);

    const handleAddItem = () => {
        setItems([...items, { name: '', quantity: 1, unit_price: 0, material_id: null }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    };

    const handleSubmit = async () => {
        const supabase = createClient();

        try {
            // 1. Create Invoice record
            const { data: invData, error: invError } = await supabase
                .from('purchase_invoices')
                .insert({
                    ...invoice,
                    total_amount: calculateTotal(),
                    status: 'PENDIENTE'
                })
                .select()
                .single();

            if (invError) throw invError;

            // 2. Create Purchase Details & Quality Inspections
            for (const item of items) {
                // Here we'd typically map names to global_inventory IDs
                // For simplicity in this demo, let's assume material_id is selected or created

                const { data: detailData, error: detailError } = await supabase
                    .from('purchase_details')
                    .insert({
                        invoice_id: invData.id,
                        material_id: item.material_id, // This should be pre-resolved in real app
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: item.quantity * item.unit_price
                    })
                    .select()
                    .single();

                if (detailError) throw detailError;

                // Add to Quality Staging
                const { error: qualityError } = await supabase
                    .from('quality_inspections')
                    .insert({
                        invoice_id: invData.id,
                        material_id: item.material_id,
                        quantity: item.quantity,
                        purchase_detail_id: detailData.id,
                        status: 'PENDIENTE'
                    });

                if (qualityError) throw qualityError;

                // Increment Quarantine Stock
                const { data: currentItem } = await supabase
                    .from('global_inventory')
                    .select('stock_quarantine')
                    .eq('id', item.material_id)
                    .single();

                await supabase
                    .from('global_inventory')
                    .update({
                        stock_quarantine: (Number(currentItem?.stock_quarantine) || 0) + Number(item.quantity)
                    })
                    .eq('id', item.material_id);
            }

            router.push('/almacen/procurement/quality');
        } catch (error) {
            console.error('Error saving invoice:', error);
            alert('Error saving invoice. Check console.');
        }
    };

    // AI Scanning Simulation
    const handleAIUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setIsUploading(true);

        // Simulate Gemini API processing
        setTimeout(() => {
            setInvoice({
                invoice_number: 'FAC-2024-089',
                supplier_rif: 'J-31234567-8',
                supplier_name: 'Aceros del Norte C.A.',
                date: '2024-08-15',
                total_amount: 450.00
            });
            setItems([
                { name: 'Cabilla 1/2"', quantity: 20, unit_price: 15.00, material_id: null },
                { name: 'Arena Lavada', quantity: 5, unit_price: 30.00, material_id: null }
            ]);
            setMode('MANUAL');
            setIsUploading(false);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/almacen">
                        <button className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all">
                            <ArrowLeft size={20} />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter">RECEPCIÓN DE MERCANCÍA</h1>
                        <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Procurement Module — Stage 1: Capture</p>
                    </div>
                </div>

                {/* Mode Selector */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setMode('AUTO')}
                        className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${mode === 'AUTO'
                            ? 'border-blue-600 bg-blue-600/10 text-white'
                            : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700'
                            }`}
                    >
                        <Sparkles size={32} className={mode === 'AUTO' ? 'text-blue-500' : ''} />
                        <div className="text-center">
                            <span className="block font-black text-sm uppercase tracking-widest mb-1">Modo IA</span>
                            <span className="text-xs font-bold opacity-60">Escanear factura con Gemini</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setMode('MANUAL')}
                        className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${mode === 'MANUAL'
                            ? 'border-white bg-white/5 text-white'
                            : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700'
                            }`}
                    >
                        <FileText size={32} className={mode === 'MANUAL' ? 'text-white' : ''} />
                        <div className="text-center">
                            <span className="block font-black text-sm uppercase tracking-widest mb-1">Modo Manual</span>
                            <span className="text-xs font-bold opacity-60">Ingreso profesional de datos</span>
                        </div>
                    </button>
                </div>

                {mode === 'AUTO' ? (
                    <GlassCard className="p-12 text-center border-dashed border-2 border-zinc-700 bg-zinc-900/20">
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mb-6">
                                {isUploading ? (
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                ) : (
                                    <Upload className="text-blue-500" size={36} />
                                )}
                            </div>
                            <h2 className="text-2xl font-black mb-2">Sube tu Factura</h2>
                            <p className="text-zinc-500 font-bold mb-8 max-w-sm">Nuestra IA extraerá automáticamente ítems, precios y datos fiscales del proveedor.</p>

                            <label className="bg-white text-black px-8 py-4 rounded-2xl font-black cursor-pointer hover:bg-zinc-200 transition-all shadow-xl shadow-white/10">
                                {isUploading ? 'PROCESANDO...' : 'SELECCIONAR PDF/IMAGEN'}
                                <input type="file" className="hidden" onChange={handleAIUpload} disabled={isUploading} />
                            </label>

                            <div className="mt-8 flex items-center gap-2 text-zinc-600 text-xs font-black uppercase tracking-widest">
                                <ShieldCheck size={14} />
                                Powered by Google Gemini 1.5 Pro
                            </div>
                        </div>
                    </GlassCard>
                ) : (
                    <div className="space-y-6">
                        <GlassCard className="p-8">
                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                                <FileText size={18} />
                                Encabezado de Factura
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Número de Factura</label>
                                    <input
                                        type="text"
                                        value={invoice.invoice_number}
                                        onChange={(e) => setInvoice({ ...invoice, invoice_number: e.target.value })}
                                        placeholder="Ej: 001-2034"
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">RIF Proveedor</label>
                                    <input
                                        type="text"
                                        value={invoice.supplier_rif}
                                        onChange={(e) => setInvoice({ ...invoice, supplier_rif: e.target.value })}
                                        placeholder="J-12345678-0"
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nombre Comercial</label>
                                    <input
                                        type="text"
                                        value={invoice.supplier_name}
                                        onChange={(e) => setInvoice({ ...invoice, supplier_name: e.target.value })}
                                        placeholder="Nombre del Proveedor"
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                </div>
                            </div>
                        </GlassCard>

                        <GlassCard className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                    <Plus size={18} />
                                    Detalle de Ítems
                                </h3>
                                <button
                                    onClick={handleAddItem}
                                    className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {items.length === 0 ? (
                                    <div className="text-center py-12 bg-black/30 rounded-2xl border-2 border-dashed border-zinc-800">
                                        <p className="text-zinc-600 font-bold uppercase text-xs tracking-widest">No hay ítems registrados</p>
                                    </div>
                                ) : (
                                    items.map((item, index) => (
                                        <div key={index} className="flex flex-col md:flex-row gap-4 items-end bg-black/40 p-4 rounded-2xl border border-zinc-800/50">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Material (Auto-Mapping)</label>
                                                <select
                                                    value={item.material_id || ''}
                                                    onChange={(e) => {
                                                        const mat = materials.find(m => m.id === e.target.value);
                                                        updateItem(index, 'material_id', e.target.value);
                                                        updateItem(index, 'name', mat?.name || '');
                                                    }}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black focus:border-blue-500 appearance-none text-white transition-all"
                                                >
                                                    <option value="">Seleccionar material...</option>
                                                    {materials.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name} [{m.sap_code || 'S/C'}]</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-24 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Cant.</label>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                />
                                            </div>
                                            <div className="w-32 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Unitário ($)</label>
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                />
                                            </div>
                                            <div className="w-32 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Subtotal</label>
                                                <div className="p-3 bg-zinc-900/50 rounded-xl font-black text-sm text-zinc-400 border border-transparent">
                                                    ${(item.quantity * item.unit_price).toFixed(2)}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeItem(index)}
                                                className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all mb-[1px]"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {items.length > 0 && (
                                <div className="mt-8 flex justify-between items-center p-6 bg-zinc-900/50 rounded-3xl border border-zinc-800">
                                    <div>
                                        <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mb-1">Total de Compra</p>
                                        <h4 className="text-3xl font-black">${calculateTotal().toFixed(2)}</h4>
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all"
                                    >
                                        <Save size={20} />
                                        FINALIZAR CAPTURA
                                    </button>
                                </div>
                            )}
                        </GlassCard>
                    </div>
                )}
            </div>
        </div>
    );
}
