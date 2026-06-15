'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
    ShieldCheck,
    CheckCircle2,
    XCircle,
    Info,
    Truck,
    ArrowLeft,
    ClipboardCheck,
    Package,
} from 'lucide-react';
import {
    formatApproveError,
} from '@/lib/almacen/approveQualityInspection';
import { agruparInspeccionesPorFactura } from '@/lib/almacen/agruparInspeccionesCuarentena';
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
    const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const { isSubmitting, runLocked } = useSyncSubmitLock();

    const gruposFactura = useMemo(() => {
        const rows = inspections.map((insp) => ({
            id: insp.id,
            quantity: insp.quantity,
            material_id: '',
            invoice_id: insp.invoice_id,
            line_description: insp.line_description,
            material_name: insp.global_inventory?.name ?? null,
            material_unit: insp.global_inventory?.unit ?? null,
            invoice_number: insp.purchase_invoices?.invoice_number ?? null,
            supplier_name: insp.purchase_invoices?.supplier_name ?? null,
            document_storage_path: insp.purchase_invoices?.document_storage_path ?? null,
            document_file_name: insp.purchase_invoices?.document_file_name ?? null,
            ubicacion_destino_id: insp.purchase_invoices?.ubicacion_destino_id ?? null,
            created_at: null,
        }));
        return agruparInspeccionesPorFactura(rows);
    }, [inspections]);

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
            if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar el tránsito.');

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

    const handleApproveInvoice = async (invoiceId: string, lineIds: string[]) => {
        if (isSubmitting) return;
        setProcessingInvoiceId(invoiceId);
        setActionError(null);
        await runLocked(async () => {
            try {
                const res = await fetch(
                    apiUrl(`/api/almacen/quality/factura/${encodeURIComponent(invoiceId)}/aprobar`),
                    { method: 'POST' },
                );
                const json = (await res.json()) as { error?: string; aprobadas?: number };
                if (!res.ok) throw new Error(json.error ?? 'No se pudo liberar la factura.');
                setInspections((prev) => prev.filter((i) => !lineIds.includes(i.id)));
                toast.success(
                    `Factura liberada: ${json.aprobadas ?? lineIds.length} línea(s) ingresadas al almacén.`,
                );
            } catch (error) {
                console.error('Error approving invoice:', error);
                setActionError(formatApproveError(error));
            } finally {
                setProcessingInvoiceId(null);
            }
        });
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
        const motivo = window.prompt(
            'Motivo del rechazo (obligatorio):\n\nDescriba por qué no se libera este material al stock.',
        );
        if (motivo === null) return;
        const motivoTrim = motivo.trim();
        if (motivoTrim.length < 5) {
            setActionError('El motivo del rechazo debe tener al menos 5 caracteres.');
            return;
        }
        setProcessingId(id);
        setActionError(null);
        await runLocked(async () => {
            try {
                const res = await fetch(apiUrl(`/api/almacen/quality/${encodeURIComponent(id)}/rechazar`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ motivo: motivoTrim }),
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
                            <h1 className="text-4xl font-black tracking-tighter">TRÁNSITO</h1>
                            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                                <ShieldCheck size={14} className="text-amber-500" />
                                Stage 2: Quality Gate & Inspection
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Pendientes</p>
                            <h4 className="text-2xl font-black text-amber-500">
                                {gruposFactura.length} factura(s) · {inspections.length} ítems
                            </h4>
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
                        Agrupe por factura y use <span className="text-blue-400 font-black">Liberar factura completa</span> cuando
                        la mercancía coincida con el documento. También puede liberar línea por línea desde esta pantalla.
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
                        <h2 className="text-2xl font-black text-zinc-500 tracking-tight">Sin mercancía en tránsito</h2>
                        <p className="text-zinc-700 font-bold uppercase text-xs tracking-widest mt-2">Todo el material recibido ha sido procesado</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {gruposFactura.map((grupo) => {
                            const lineIds = grupo.lineas.map((l) => l.id);
                            const sinUbicacion = !grupo.ubicacion_destino_id;
                            const procesandoFactura = processingInvoiceId === grupo.invoice_id;

                            return (
                                <GlassCard key={grupo.invoice_id} className="p-6 border border-zinc-800/80">
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6 pb-6 border-b border-zinc-800/60">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
                                                Factura en tránsito
                                            </p>
                                            <h2 className="text-2xl font-black tracking-tight">
                                                #{grupo.invoice_number ?? 'S/N'}
                                            </h2>
                                            <p className="text-sm font-bold text-zinc-400 mt-1">
                                                {grupo.supplier_name ?? 'Proveedor'}
                                            </p>
                                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-2">
                                                {grupo.lineas.length} línea(s) · {grupo.totalUnidades} unidades
                                            </p>
                                            {sinUbicacion ? (
                                                <p className="mt-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                                    Sin almacén destino — asigne ubicación antes de liberar
                                                </p>
                                            ) : null}
                                            {grupo.document_storage_path ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openInvoiceDocument(grupo.invoice_id)}
                                                    className="mt-2 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                                                >
                                                    Ver factura / presupuesto
                                                    {grupo.document_file_name
                                                        ? ` (${grupo.document_file_name})`
                                                        : ''}
                                                </button>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            disabled={isSubmitting || sinUbicacion}
                                            onClick={() =>
                                                void handleApproveInvoice(grupo.invoice_id, lineIds)
                                            }
                                            className="shrink-0 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-black text-sm bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {procesandoFactura && isSubmitting ? (
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                            ) : (
                                                <CheckCircle2 size={18} />
                                            )}
                                            LIBERAR FACTURA COMPLETA
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {grupo.lineas.map((linea) => {
                                            const insp = inspections.find((i) => i.id === linea.id);
                                            if (!insp) return null;
                                            return (
                                                <div
                                                    key={linea.id}
                                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-zinc-800/50"
                                                >
                                                    <div className="flex gap-3 min-w-0">
                                                        <div className="w-10 h-10 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                                                            <Package size={18} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="font-black text-zinc-100 truncate">
                                                                {linea.line_description ||
                                                                    linea.material_name ||
                                                                    'Material'}
                                                            </h3>
                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase">
                                                                {linea.quantity}{' '}
                                                                {linea.material_unit ?? 'UND'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleReject(linea.id)}
                                                            disabled={isSubmitting}
                                                            className="px-4 py-2.5 rounded-lg font-black text-xs bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500/30 transition-all disabled:opacity-50"
                                                        >
                                                            Rechazar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleApprove(linea.id)}
                                                            disabled={
                                                                isSubmitting || sinUbicacion
                                                            }
                                                            className="px-4 py-2.5 rounded-lg font-black text-xs bg-zinc-800 text-zinc-200 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                                                        >
                                                            {processingId === linea.id && isSubmitting
                                                                ? '…'
                                                                : 'Línea'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
