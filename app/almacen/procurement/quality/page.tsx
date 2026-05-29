'use client';

import React, { useState, useEffect } from 'react';
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
import {
    formatApproveError,
} from '@/lib/almacen/approveQualityInspection';
import { apiUrl } from '@/lib/http/apiUrl';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

type InspeccionCuarentenaUi = {
    id: string;
    invoice_id: string;
    quantity: number;
    line_description: string | null;
    global_inventory?: { name: string | null; unit: string | null; sap_code: string | null };
    purchase_details?: { description: string | null; item_code: string | null };
    purchase_invoices?: {
        supplier_name: string | null;
        invoice_number: string | null;
        document_storage_path: string | null;
        document_file_name: string | null;
        ubicacion_destino_id: string | null;
    };
};

export default function QualityDashboard() {
    const [inspections, setInspections] = useState<InspeccionCuarentenaUi[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const { isSubmitting, runLocked } = useSyncSubmitLock();

    useEffect(() => {
        fetchInspections();
    }, []);

    const fetchInspections = async () => {
        setLoading(true);
        setActionError(null);
        try {
            const res = await fetch(apiUrl('/api/almacen/quality/pendientes'), { cache: 'no-store' });
            const json = (await res.json()) as {
                items?: Array<{
                    id: string;
                    invoice_id: string;
                    quantity: number;
                    line_description: string | null;
                    material_name: string | null;
                    material_unit: string | null;
                    invoice_number: string | null;
                    supplier_name: string | null;
                    document_storage_path: string | null;
                    document_file_name: string | null;
                    ubicacion_destino_id: string | null;
                }>;
                error?: string;
            };
            if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar la cuarentena.');

            setInspections(
                (json.items ?? []).map((row) => ({
                    id: row.id,
                    invoice_id: row.invoice_id,
                    quantity: row.quantity,
                    line_description: row.line_description,
                    global_inventory: {
                        name: row.material_name,
                        unit: row.material_unit,
                        sap_code: null,
                    },
                    purchase_details: { description: null, item_code: null },
                    purchase_invoices: {
                        supplier_name: row.supplier_name,
                        invoice_number: row.invoice_number,
                        document_storage_path: row.document_storage_path,
                        document_file_name: row.document_file_name,
                        ubicacion_destino_id: row.ubicacion_destino_id,
                    },
                })),
            );
        } catch (error) {
            console.error('Error fetching inspections:', error);
            setActionError(
                error instanceof Error ? error.message : 'Error al cargar inspecciones pendientes.',
            );
            setInspections([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        if (isSubmitting) return;
        setProcessingId(id);
        setActionError(null);
        await runLocked(async () => {
            try {
                const res = await fetch(apiUrl(`/api/almacen/quality/${encodeURIComponent(id)}/aprobar`), {
                    method: 'POST',
                });
                const json = (await res.json()) as { error?: string; hint?: string };
                if (!res.ok) {
                    const detalle = json.hint ? `${json.error ?? ''} ${json.hint}`.trim() : json.error;
                    throw new Error(detalle ?? 'No se pudo liberar el material.');
                }
                setInspections((prev) => prev.filter((i) => i.id !== id));
                toast.success('Material liberado al stock del almacén asignado.');
            } catch (error) {
                console.error('Error approving quality:', error);
                setActionError(formatApproveError(error));
            } finally {
                setProcessingId(null);
            }
        });
    };

    const openInvoiceDocument = async (invoiceId: string) => {
        try {
            const res = await fetch(apiUrl(`/api/almacen/procurement/invoices/${invoiceId}/document`));
            const data = (await res.json()) as { url?: string; error?: string };
            if (!res.ok || !data.url) {
                throw new Error(data.error || 'No se pudo abrir el documento.');
            }
            window.open(data.url, '_blank', 'noopener,noreferrer');
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error al abrir documento.');
        }
    };

    const handleReject = async (id: string) => {
        if (isSubmitting) return;
        setProcessingId(id);
        setActionError(null);
        await runLocked(async () => {
            try {
                const res = await fetch(apiUrl(`/api/almacen/quality/${encodeURIComponent(id)}/rechazar`), {
                    method: 'POST',
                });
                const json = (await res.json()) as { error?: string };
                if (!res.ok) throw new Error(json.error ?? 'No se pudo rechazar la inspección.');
                setInspections((prev) => prev.filter((i) => i.id !== id));
                toast.message('Inspección rechazada (sin ingreso a stock).');
            } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Error al rechazar.');
            } finally {
                setProcessingId(null);
            }
        });
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

                {actionError ? (
                    <div className="bg-red-600/10 border border-red-600/30 p-4 rounded-2xl mb-6 flex gap-3 items-start text-red-400 text-sm font-bold">
                        <XCircle size={20} className="shrink-0 mt-0.5" />
                        <span>{actionError}</span>
                    </div>
                ) : null}

                {/* Info Box */}
                <div className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-3xl mb-8 flex gap-4 items-start">
                    <Info className="text-blue-500 shrink-0" size={24} />
                            <p className="text-blue-200/80 font-bold text-sm leading-relaxed">
                        La mercancía en esta lista fue recepcionada por compras y aún no forma parte del stock disponible.
                        El <span className="text-blue-400 font-black">depositario</span> o jefe de almacén puede liberarla aquí
                        o con <span className="text-blue-400 font-black">/liberar</span> en Telegram (movimiento 101).
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
                                            <h3 className="text-xl font-black">
                                                {insp.line_description ||
                                                    insp.purchase_details?.description ||
                                                    insp.global_inventory?.name}
                                            </h3>
                                            {insp.purchase_details?.item_code ? (
                                                <p className="text-[10px] font-bold text-zinc-600 mt-1">
                                                    Ref: {insp.purchase_details.item_code}
                                                </p>
                                            ) : null}
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                                                {insp.purchase_invoices?.supplier_name} • Factura #{insp.purchase_invoices?.invoice_number}
                                            </p>
                                            {!insp.purchase_invoices?.ubicacion_destino_id ? (
                                                <p className="mt-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                                    Sin almacén destino — asigne ubicación en recepción o Telegram antes de liberar
                                                </p>
                                            ) : null}
                                            {insp.purchase_invoices?.document_storage_path ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openInvoiceDocument(insp.invoice_id)
                                                    }
                                                    className="mt-2 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                                                >
                                                    Ver factura / presupuesto
                                                    {insp.purchase_invoices?.document_file_name
                                                        ? ` (${insp.purchase_invoices.document_file_name})`
                                                        : ''}
                                                </button>
                                            ) : null}
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
                                        type="button"
                                        onClick={() => void handleReject(insp.id)}
                                        disabled={isSubmitting}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all disabled:opacity-50"
                                    >
                                        <XCircle size={18} />
                                        RECHAZAR
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleApprove(insp.id)}
                                        disabled={
                                            isSubmitting ||
                                            !insp.purchase_invoices?.ubicacion_destino_id
                                        }
                                        title={
                                            !insp.purchase_invoices?.ubicacion_destino_id
                                                ? 'Falta almacén destino en la factura'
                                                : 'Suma cantidad a inventario_stock (mov. 101)'
                                        }
                                        className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {processingId === insp.id && isSubmitting ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={18} />
                                                APROBAR Y LIBERAR STOCK (101)
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
