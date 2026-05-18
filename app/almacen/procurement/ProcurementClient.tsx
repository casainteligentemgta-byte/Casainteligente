'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';
import {
    registerCompraDesdeRecepcion,
    type LineaCompraContabilidadInput,
} from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { fetchDefaultDepositId } from '@/lib/almacen/formatInventoryLocation';
import {
    esProyectoSmartRrhhPorNombre,
    loadCatalogoProyectosApp,
} from '@/lib/proyectos/proyectosUnificados';
import {
    FileText,
    Upload,
    Plus,
    Trash2,
    Save,
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProcurementDocumentAttach } from '@/components/almacen/ProcurementDocumentAttach';
type PurchaseLine = {
    description: string;
    item_code: string;
    unit: string;
    quantity: number;
    unit_price: number;
};

const panelStyle: React.CSSProperties = {
    background: 'rgba(28, 28, 30, 0.6)',
    backdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
};

function ProcPanel({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`glass overflow-hidden ${className}`} style={panelStyle}>
            {children}
        </div>
    );
}

function todayIsoDate(): string {
    return new Date().toISOString().split('T')[0];
}

function formatProcurementSaveError(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
        const msg = String((error as { message: string }).message);
        const code =
            'code' in error ? String((error as { code?: string }).code ?? '') : '';
        if (code === '42501' || /row-level security/i.test(msg)) {
            return 'Sin permiso en Supabase (RLS). Ejecute la migración 134_procurement_rls_anon.sql en el SQL Editor y vuelva a intentar.';
        }
        if (/column.*does not exist/i.test(msg) || /contabilidad_compras|proyecto_id/i.test(msg)) {
            return 'Faltan tablas o columnas en la base de datos. Ejecute las migraciones 132 a 138 en Supabase.';
        }
        if (/fetch failed/i.test(msg)) {
            return 'No se pudo conectar con Supabase. Reinicie npm run dev o use npm run dev:tls (ver docs/ERROR-FETCH-FAILED-SUPABASE.md).';
        }
        return msg;
    }
    if (error instanceof Error) return error.message;
    return 'Error desconocido al guardar la factura.';
}

export default function ProcurementClient() {
    const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('MANUAL');
    const [invoice, setInvoice] = useState({
        invoice_number: '',
        supplier_rif: '',
        supplier_name: '',
        date: todayIsoDate(),
        total_amount: 0,
    });
    const [items, setItems] = useState<PurchaseLine[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSuccess, setAiSuccess] = useState<string | null>(null);
    const [sourceDocument, setSourceDocument] = useState<File | null>(null);
    const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [proyectoId, setProyectoId] = useState('');
    const [proyectos, setProyectos] = useState<Array<{ id: string; nombre: string }>>([]);
    const documentPreviewRef = useRef<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const supabase = createClient();
        void (async () => {
            const { proyectos: lista, error: catErr } = await loadCatalogoProyectosApp(supabase);
            if (catErr || !lista.length) return;
            setProyectos(lista);
            const saved =
                typeof window !== 'undefined'
                    ? sessionStorage.getItem('procurement_proyecto_id')
                    : null;
            if (saved && lista.some((p) => p.id === saved)) {
                setProyectoId(saved);
                return;
            }
            const principal = lista.find((p) => esProyectoSmartRrhhPorNombre(p.nombre));
            if (principal?.id) {
                setProyectoId(principal.id);
            } else if (lista[0]?.id) {
                setProyectoId(lista[0].id);
            }
        })();
    }, []);

    useEffect(() => {
        if (proyectoId && typeof window !== 'undefined') {
            sessionStorage.setItem('procurement_proyecto_id', proyectoId);
        }
    }, [proyectoId]);

    const attachSourceDocument = (file: File | null) => {
        if (documentPreviewRef.current) {
            URL.revokeObjectURL(documentPreviewRef.current);
            documentPreviewRef.current = null;
        }
        setSourceDocument(file);
        if (file && file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            documentPreviewRef.current = url;
            setDocumentPreviewUrl(url);
        } else {
            setDocumentPreviewUrl(null);
        }
    };

    useEffect(() => {
        return () => {
            if (documentPreviewRef.current) {
                URL.revokeObjectURL(documentPreviewRef.current);
            }
        };
    }, []);

    const handleAddItem = () => {
        setItems([
            ...items,
            { description: '', item_code: '', unit: 'UND', quantity: 1, unit_price: 0 },
        ]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: string, value: string | number | null) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
    };

    const handleSubmit = async () => {
        setSubmitError(null);

        if (!invoice.invoice_number.trim()) {
            setSubmitError('Indique el número de factura en el encabezado.');
            return;
        }
        if (!invoice.supplier_name.trim()) {
            setSubmitError('Indique el nombre del proveedor.');
            return;
        }
        if (!proyectoId) {
            setSubmitError('Seleccione el proyecto al que pertenece esta compra.');
            return;
        }

        const validLines = items.filter((it) => it.description.trim());
        if (validLines.length === 0) {
            setSubmitError(
                'Agregue al menos un artículo con descripción (botón + en Artículos de la factura).'
            );
            return;
        }

        setIsSaving(true);
        let supabase;
        try {
            supabase = createClient();
        } catch (envErr) {
            setSubmitError(formatProcurementSaveError(envErr));
            setIsSaving(false);
            return;
        }

        try {
            const payload = {
                invoice_number: invoice.invoice_number.trim(),
                supplier_rif: invoice.supplier_rif.trim() || 'S/R',
                supplier_name: invoice.supplier_name.trim(),
                date: invoice.date,
                total_amount: calculateTotal(),
                status: 'PENDIENTE',
                proyecto_id: proyectoId,
            };

            const { data: invData, error: invError } = await supabase
                .from('purchase_invoices')
                .insert(payload)
                .select()
                .single();

            if (invError) throw invError;

            let documentStoragePath: string | null = null;
            let documentFileName: string | null = null;

            if (sourceDocument) {
                try {
                    const uploaded = await uploadProcurementDocument(
                        supabase,
                        invData.id,
                        sourceDocument
                    );
                    documentStoragePath = uploaded.path;
                    documentFileName = uploaded.fileName;
                    const { error: docMetaError } = await supabase
                        .from('purchase_invoices')
                        .update({
                            document_storage_path: uploaded.path,
                            document_file_name: uploaded.fileName,
                            document_mime_type: uploaded.mimeType,
                        })
                        .eq('id', invData.id);
                    if (docMetaError) {
                        console.warn(
                            '[procurement] documento en storage pero metadata no guardada:',
                            docMetaError.message
                        );
                    }
                } catch (docErr) {
                    console.error('[procurement] error subiendo documento:', docErr);
                    alert(
                        'Factura guardada, pero no se pudo adjuntar el PDF/foto. Puede reintentar desde soporte.'
                    );
                }
            }

            const lineasContabilidad: LineaCompraContabilidadInput[] = [];
            const defaultDepositId = await fetchDefaultDepositId(supabase);

            for (const line of validLines) {
                const desc = line.description.trim();
                const { data: newMaterial, error: matError } = await supabase
                    .from('global_inventory')
                    .insert({
                        name: desc,
                        unit: (line.unit || 'UND').trim() || 'UND',
                        stock_quarantine: line.quantity,
                        last_purchase_price: line.unit_price,
                        last_purchase_date: invoice.date,
                        deposit_id: defaultDepositId,
                    })
                    .select('id')
                    .single();

                if (matError) throw matError;

                const detailRow: Record<string, unknown> = {
                    invoice_id: invData.id,
                    material_id: newMaterial.id,
                    description: desc,
                    item_code: line.item_code.trim() || null,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    total_price: line.quantity * line.unit_price,
                };

                const { data: detailData, error: detailError } = await supabase
                    .from('purchase_details')
                    .insert(detailRow)
                    .select()
                    .single();

                if (detailError) throw detailError;

                const qualityRow: Record<string, unknown> = {
                    invoice_id: invData.id,
                    material_id: newMaterial.id,
                    quantity: line.quantity,
                    purchase_detail_id: detailData.id,
                    status: 'PENDIENTE',
                    line_description: desc,
                };

                const { error: qualityError } = await supabase
                    .from('quality_inspections')
                    .insert(qualityRow);

                if (qualityError) throw qualityError;

                lineasContabilidad.push({
                    purchase_detail_id: detailData.id,
                    material_id: newMaterial.id,
                    descripcion: desc,
                    item_code: line.item_code.trim() || null,
                    unidad: (line.unit || 'UND').trim() || 'UND',
                    cantidad: line.quantity,
                    precio_unitario: line.unit_price,
                });
            }

            await registerCompraDesdeRecepcion(supabase, {
                purchase_invoice_id: invData.id,
                proyecto_id: proyectoId,
                invoice_number: payload.invoice_number,
                supplier_rif: payload.supplier_rif,
                supplier_name: payload.supplier_name,
                fecha: payload.date,
                total_amount: payload.total_amount,
                document_storage_path: documentStoragePath,
                document_file_name: documentFileName,
                lineas: lineasContabilidad,
            });

            router.push('/almacen/procurement/quality');
        } catch (error) {
            console.error('Error saving invoice:', error);
            setSubmitError(formatProcurementSaveError(error));
        } finally {
            setIsSaving(false);
        }
    };

    const processInvoiceWithAI = async (file: File) => {
        attachSourceDocument(file);

        setIsUploading(true);
        setAiError(null);
        setAiSuccess(null);

        try {
            const form = new FormData();
            form.append('file', file);

            let res: Response;
            try {
                res = await fetch('/api/almacen/procurement/extract-invoice', {
                    method: 'POST',
                    body: form,
                    signal: AbortSignal.timeout(180_000),
                });
            } catch (networkErr) {
                const hint =
                    networkErr instanceof Error && networkErr.name === 'TimeoutError'
                        ? 'La extracción tardó demasiado. Pruebe un PDF más pequeño o reinicie el servidor.'
                        : 'No se pudo conectar con el servidor. Compruebe que `npm run dev` está activo y reinícielo si acaba de cambiar .env.local.';
                throw new Error(hint);
            }

            const contentType = res.headers.get('content-type') ?? '';
            let payload: {
                error?: string;
                invoice_number?: string;
                supplier_rif?: string;
                supplier_name?: string;
                date?: string;
                total_amount?: number | null;
                items?: Array<{
                    description: string;
                    item_code?: string;
                    unit?: string;
                    quantity: number;
                    unit_price: number;
                }>;
            };

            if (contentType.includes('application/json')) {
                payload = (await res.json()) as typeof payload;
            } else {
                const text = (await res.text()).trim();
                throw new Error(
                    text.slice(0, 240) ||
                        `El servidor respondió con error ${res.status}. Reinicie npm run dev.`
                );
            }

            if (!res.ok) {
                throw new Error(payload.error || 'No se pudo extraer la factura.');
            }

            const extractedItems = Array.isArray(payload.items) ? payload.items : [];
            const mappedItems: PurchaseLine[] = extractedItems.map((it) => ({
                description: (it.description || '').trim(),
                item_code: (it.item_code || '').trim(),
                unit: (it.unit || 'UND').trim() || 'UND',
                quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
                unit_price: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
            }));

            const lineTotal = mappedItems.reduce(
                (acc, it) => acc + it.quantity * it.unit_price,
                0
            );

            setInvoice({
                invoice_number: payload.invoice_number?.trim() || '',
                supplier_rif: payload.supplier_rif?.trim() || '',
                supplier_name: payload.supplier_name?.trim() || '',
                date: payload.date || todayIsoDate(),
                total_amount:
                    payload.total_amount != null && Number(payload.total_amount) > 0
                        ? Number(payload.total_amount)
                        : lineTotal,
            });
            setItems(mappedItems);
            setMode('MANUAL');

            const withDesc = mappedItems.filter((it) => it.description).length;
            const headerOk =
                Boolean(payload.invoice_number?.trim()) &&
                Boolean(payload.supplier_name?.trim());
            const parts: string[] = [];
            if (headerOk) {
                parts.push('Encabezado extraído');
            } else {
                parts.push(
                    'Revise número de factura y proveedor (no se leyeron con claridad)'
                );
            }
            if (withDesc > 0) {
                parts.push(`${withDesc} artículo(s) de la factura cargados`);
            } else {
                parts.push('Agregue los artículos manualmente si faltan en el detalle');
            }
            parts.push('Documento listo para guardarse al finalizar');
            setAiSuccess(parts.join('. ') + '.');
        } catch (err) {
            let message =
                err instanceof Error ? err.message : 'Error al procesar el documento.';
            if (/^fetch failed$/i.test(message.trim())) {
                message =
                    'No se pudo conectar con el servidor. Reinicie `npm run dev` (o `npm run dev:tls` si usa Supabase en Windows) y vuelva a intentar.';
            }
            setAiError(message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/almacen">
                        <button
                            type="button"
                            className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    </Link>
                    <h1 className="text-3xl font-black tracking-tighter">
                        RECEPCIÓN DE MERCANCÍA
                    </h1>
                </div>

                <div className="flex gap-4 mb-8">
                    <button
                        type="button"
                        onClick={() => {
                            setMode('AUTO');
                            setAiError(null);
                            setAiSuccess(null);
                        }}
                        className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
                            mode === 'AUTO'
                                ? 'border-blue-600 bg-blue-600/10 text-white'
                                : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700'
                        }`}
                    >
                        <Sparkles size={32} className={mode === 'AUTO' ? 'text-blue-500' : ''} />
                        <span className="font-black text-sm uppercase tracking-widest">Modo IA</span>
                        <span className="text-xs font-bold opacity-60">
                            Escanear factura con Gemini
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('MANUAL')}
                        className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
                            mode === 'MANUAL'
                                ? 'border-white bg-white/5 text-white'
                                : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-700'
                        }`}
                    >
                        <FileText size={32} className={mode === 'MANUAL' ? 'text-white' : ''} />
                        <span className="font-black text-sm uppercase tracking-widest">
                            Modo Manual
                        </span>
                        <span className="text-xs font-bold opacity-60">
                            Ingreso profesional de datos
                        </span>
                    </button>
                </div>

                {mode === 'AUTO' ? (
                    <ProcPanel className="p-12 text-center border-dashed border-2 border-zinc-700 bg-zinc-900/20">
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mb-6">
                                {isUploading ? (
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                                ) : (
                                    <Upload className="text-blue-500" size={36} />
                                )}
                            </div>
                            <h2 className="text-2xl font-black mb-2">Sube tu Factura</h2>
                            <p className="text-zinc-500 font-bold mb-8 max-w-sm">
                                Tome una foto con la cámara o elija un PDF desde su dispositivo.
                                La IA leerá proveedor, artículos, cantidades y precios.
                            </p>
                            <ProcurementDocumentAttach
                                variant="primary"
                                loading={isUploading}
                                onSelect={processInvoiceWithAI}
                            />
                            {aiError ? (
                                <div className="mt-6 flex items-start gap-2 text-red-400 text-sm font-bold max-w-md text-left">
                                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                    <span>{aiError}</span>
                                </div>
                            ) : null}
                            <div className="mt-8 flex items-center gap-2 text-zinc-600 text-xs font-black uppercase tracking-widest">
                                <ShieldCheck size={14} />
                                Powered by Google Gemini 2.5 Flash
                            </div>
                        </div>
                    </ProcPanel>
                ) : (
                    <div className="space-y-6">
                        <ProcPanel className="p-6">
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">
                                Archivo de factura o presupuesto
                            </h3>
                            <p className="text-zinc-600 text-xs font-bold mb-4">
                                Tome una foto con la cámara o adjunte PDF/imagen. Se guardará al
                                finalizar la captura.
                            </p>
                            <ProcurementDocumentAttach
                                variant="secondary"
                                onSelect={attachSourceDocument}
                            />
                            {sourceDocument ? (
                                <div className="mt-4 p-4 bg-black/40 rounded-xl border border-zinc-800">
                                    <p className="text-sm font-bold text-zinc-300 truncate">
                                        {sourceDocument.name}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        {(sourceDocument.size / 1024).toFixed(0)} KB ·{' '}
                                        {sourceDocument.type || 'archivo'}
                                    </p>
                                    {documentPreviewUrl ? (
                                        <img
                                            src={documentPreviewUrl}
                                            alt="Vista previa factura"
                                            className="mt-3 max-h-48 rounded-lg border border-zinc-700 object-contain w-full"
                                        />
                                    ) : (
                                        <p className="text-xs text-zinc-500 mt-2">
                                            PDF adjunto (vista previa al guardar en cuarentena)
                                        </p>
                                    )}
                                </div>
                            ) : null}
                        </ProcPanel>
                        {aiSuccess ? (
                            <div className="flex items-start gap-2 p-4 rounded-2xl bg-emerald-600/10 border border-emerald-600/30 text-emerald-400 text-sm font-bold">
                                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                                <span>{aiSuccess}</span>
                            </div>
                        ) : null}
                        <ProcPanel className="p-8">
                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500 mb-6">
                                Proyecto de la compra
                            </h3>
                            <div className="space-y-2 mb-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                    Imputar a proyecto / obra
                                </label>
                                <select
                                    value={proyectoId}
                                    onChange={(e) => setProyectoId(e.target.value)}
                                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                >
                                    <option value="">Seleccione proyecto…</option>
                                    {proyectos.filter((p) => esProyectoSmartRrhhPorNombre(p.nombre)).length > 0 ? (
                                        <optgroup label="Obras principales">
                                            {proyectos
                                                .filter((p) => esProyectoSmartRrhhPorNombre(p.nombre))
                                                .map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.nombre}
                                                    </option>
                                                ))}
                                        </optgroup>
                                    ) : null}
                                    {proyectos.filter((p) => !esProyectoSmartRrhhPorNombre(p.nombre)).length > 0 ? (
                                        <optgroup label="Otros proyectos">
                                            {proyectos
                                                .filter((p) => !esProyectoSmartRrhhPorNombre(p.nombre))
                                                .map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.nombre}
                                                    </option>
                                                ))}
                                        </optgroup>
                                    ) : null}
                                </select>
                                {proyectos.length === 0 ? (
                                    <p className="text-xs font-bold text-amber-500">
                                        No hay proyectos en ci_proyectos. Cree uno en Proyectos.
                                    </p>
                                ) : null}
                            </div>
                        </ProcPanel>

                        <ProcPanel className="p-8">
                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                                <FileText size={18} />
                                Encabezado de Factura
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                        Número de Factura
                                    </label>
                                    <input
                                        type="text"
                                        value={invoice.invoice_number}
                                        onChange={(e) =>
                                            setInvoice({
                                                ...invoice,
                                                invoice_number: e.target.value,
                                            })
                                        }
                                        placeholder="Ej: 001-2034"
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                        RIF Proveedor
                                    </label>
                                    <input
                                        type="text"
                                        value={invoice.supplier_rif}
                                        onChange={(e) =>
                                            setInvoice({
                                                ...invoice,
                                                supplier_rif: e.target.value,
                                            })
                                        }
                                        placeholder="J-12345678-0"
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                        Nombre Comercial
                                    </label>
                                    <input
                                        type="text"
                                        value={invoice.supplier_name}
                                        onChange={(e) =>
                                            setInvoice({
                                                ...invoice,
                                                supplier_name: e.target.value,
                                            })
                                        }
                                        placeholder="Nombre del Proveedor"
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                        Fecha
                                    </label>
                                    <input
                                        type="date"
                                        value={invoice.date}
                                        onChange={(e) =>
                                            setInvoice({ ...invoice, date: e.target.value })
                                        }
                                        suppressHydrationWarning
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                </div>
                            </div>
                        </ProcPanel>

                        <ProcPanel className="p-8">
                            <div className="flex justify-between items-start mb-6 gap-4">
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                        <Plus size={18} />
                                        Artículos de la factura
                                    </h3>
                                    <p className="text-zinc-600 text-xs font-bold mt-1">
                                        Compra nueva: se registran los productos tal como vienen en el
                                        documento (no se eligen del almacén actual).
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {items.length === 0 ? (
                                    <div className="text-center py-12 bg-black/30 rounded-2xl border-2 border-dashed border-zinc-800">
                                        <p className="text-zinc-600 font-bold uppercase text-xs tracking-widest">
                                            No hay ítems registrados
                                        </p>
                                    </div>
                                ) : (
                                    items.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex flex-col gap-4 bg-black/40 p-4 rounded-2xl border border-zinc-800/50"
                                        >
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                                    Descripción del artículo
                                                </label>
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) =>
                                                        updateItem(
                                                            index,
                                                            'description',
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="Como aparece en la factura"
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                                        Código / Ref.
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.item_code}
                                                        onChange={(e) =>
                                                            updateItem(
                                                                index,
                                                                'item_code',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Opcional"
                                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                                        Unidad
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.unit}
                                                        onChange={(e) =>
                                                            updateItem(
                                                                index,
                                                                'unit',
                                                                e.target.value.toUpperCase()
                                                            )
                                                        }
                                                        placeholder="UND"
                                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                            <div className="w-28 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                                    Cantidad
                                                </label>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        updateItem(
                                                            index,
                                                            'quantity',
                                                            Number(e.target.value)
                                                        )
                                                    }
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                />
                                            </div>
                                            <div className="w-32 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                                    Precio unit. ($)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={(e) =>
                                                        updateItem(
                                                            index,
                                                            'unit_price',
                                                            Number(e.target.value)
                                                        )
                                                    }
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                />
                                            </div>
                                            <div className="w-32 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                                    Subtotal
                                                </label>
                                                <div className="p-3 bg-zinc-900/50 rounded-xl font-black text-sm text-zinc-400">
                                                    $
                                                    {(item.quantity * item.unit_price).toFixed(2)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(index)}
                                                className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {items.length > 0 ? (
                                <div className="mt-8 p-6 bg-zinc-900/50 rounded-3xl border border-zinc-800">
                                    <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest mb-1">
                                        Total de Compra
                                    </p>
                                    <h4 className="text-3xl font-black">
                                        ${calculateTotal().toFixed(2)}
                                    </h4>
                                </div>
                            ) : null}
                        </ProcPanel>

                        {submitError ? (
                            <div className="flex items-start gap-2 p-4 rounded-2xl bg-red-600/10 border border-red-600/30 text-red-400 text-sm font-bold">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <span>{submitError}</span>
                            </div>
                        ) : null}

                        <div className="sticky bottom-4 z-20 mt-4 p-4 rounded-3xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl">
                            <button
                                type="button"
                                onClick={() => void handleSubmit()}
                                disabled={isSaving}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:pointer-events-none text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                ) : (
                                    <Save size={20} />
                                )}
                                {isSaving ? 'GUARDANDO…' : 'FINALIZAR CAPTURA'}
                            </button>
                            <p className="text-center text-[10px] text-zinc-600 font-bold mt-2 uppercase tracking-widest">
                                Requiere encabezado completo y al menos un artículo
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
