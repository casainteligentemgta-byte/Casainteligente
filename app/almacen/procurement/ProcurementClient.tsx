'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';
import {
    registerCompraDesdeRecepcion,
    type LineaCompraContabilidadInput,
} from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { calcularGastoBimonetario } from '@/lib/finanzas/currency-converter';
import { resolverTasaBcvVesPorUsd } from '@/lib/finanzas/bcvTasaPorFecha';
import {
    payloadCompraBimonetario,
    resolverMontosCompraBimonetario,
} from '@/lib/contabilidad/comprasBimonetario';
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
    const hintMigraciones =
        'Ejecute supabase/manual_migraciones_132_a_138.sql y 141_procurement_schema_repair.sql en Supabase → SQL Editor, luego Settings → API → Reload schema.';

    if (error && typeof error === 'object' && 'message' in error) {
        const msg = String((error as { message: string }).message);
        const code =
            'code' in error ? String((error as { code?: string }).code ?? '') : '';
        const details =
            'details' in error && (error as { details?: string }).details
                ? String((error as { details?: string }).details)
                : '';
        const full = [msg, details].filter(Boolean).join(' — ');

        if (code === '42501' || /row-level security/i.test(full)) {
            return `${full} Sin permiso (RLS): migración 134 o 141.`;
        }
        if (
            /column.*does not exist|schema cache|could not find.*column|relation.*does not exist|contabilidad_compras|proyecto_id/i.test(
                full,
            )
        ) {
            return `${full} ${hintMigraciones}`;
        }
        if (/fetch failed/i.test(full)) {
            return 'No se pudo conectar con Supabase. Reinicie npm run dev o use npm run dev:tls (ver docs/ERROR-FETCH-FAILED-SUPABASE.md).';
        }
        return full;
    }
    if (error instanceof Error) {
        const m = error.message;
        if (/contabilidad|proyecto_id|schema cache|does not exist/i.test(m)) {
            return `${m} ${hintMigraciones}`;
        }
        return m;
    }
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
    const [tasaBcv, setTasaBcv] = useState<number | null>(null);
    const [tasaBcvFuente, setTasaBcvFuente] = useState<string | null>(null);
    const [cargandoTasa, setCargandoTasa] = useState(false);
    /** Si el usuario editó el total a mano, no sobrescribir al cambiar líneas. */
    const [totalManual, setTotalManual] = useState(false);
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

    const sumaLineas = () =>
        items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);

    const totalVes = () => {
        const suma = sumaLineas();
        if (totalManual && invoice.total_amount > 0) return invoice.total_amount;
        if (invoice.total_amount > 0) return invoice.total_amount;
        return suma;
    };

    const diferenciaTotalLineas = () => {
        const suma = sumaLineas();
        const total = totalVes();
        if (suma <= 0 || total <= 0) return 0;
        return Math.abs(total - suma);
    };

    const totalUsdPreview = () => {
        if (!tasaBcv || tasaBcv <= 0) return null;
        return calcularGastoBimonetario(totalVes(), 'VES', tasaBcv).montoUsd;
    };

    const refrescarTasaBcv = async (fecha: string) => {
        if (!fecha?.trim()) return;
        setCargandoTasa(true);
        try {
            const res = await resolverTasaBcvVesPorUsd(fecha);
            setTasaBcv(res.tasa_bcv_ves_por_usd);
            setTasaBcvFuente(res.fuente);
        } catch {
            setTasaBcv(null);
            setTasaBcvFuente(null);
        } finally {
            setCargandoTasa(false);
        }
    };

    useEffect(() => {
        void refrescarTasaBcv(invoice.date);
    }, [invoice.date]);

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
            const totalBolivares = totalVes();
            const montos = await resolverMontosCompraBimonetario({
                montoTotal: totalBolivares,
                moneda: 'VES',
                fecha: invoice.date,
                tasaBcvDigitada: tasaBcv,
            });
            setTasaBcv(montos.tasaApplied);

            const payload = {
                invoice_number: invoice.invoice_number.trim(),
                supplier_rif: invoice.supplier_rif.trim() || 'S/R',
                supplier_name: invoice.supplier_name.trim(),
                date: invoice.date,
                status: 'PENDIENTE',
                proyecto_id: proyectoId,
                ...payloadCompraBimonetario(montos),
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
                const materialBase: Record<string, unknown> = {
                    name: desc,
                    unit: (line.unit || 'UND').trim() || 'UND',
                    stock_quarantine: line.quantity,
                    last_purchase_price: line.unit_price,
                    last_purchase_date: invoice.date,
                };
                if (defaultDepositId) {
                    materialBase.deposit_id = defaultDepositId;
                }

                let newMaterial: { id: string };
                const matRes = await supabase
                    .from('global_inventory')
                    .insert(materialBase)
                    .select('id')
                    .single();

                if (matRes.error && /deposit_id/i.test(matRes.error.message)) {
                    const { deposit_id: _d, ...sinDeposito } = materialBase;
                    const retry = await supabase
                        .from('global_inventory')
                        .insert(sinDeposito)
                        .select('id')
                        .single();
                    if (retry.error) throw retry.error;
                    newMaterial = retry.data as { id: string };
                } else if (matRes.error) {
                    throw matRes.error;
                } else {
                    newMaterial = matRes.data as { id: string };
                }

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
                total_amount: montos.totalAmountLegacy,
                moneda: montos.monedaOriginal,
                tasa_bcv_ves_por_usd: montos.tasaApplied,
                total_amount_usd: montos.montoUsd,
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

            const totalAi =
                payload.total_amount != null && Number(payload.total_amount) > 0
                    ? Number(payload.total_amount)
                    : lineTotal;
            setInvoice({
                invoice_number: payload.invoice_number?.trim() || '',
                supplier_rif: payload.supplier_rif?.trim() || '',
                supplier_name: payload.supplier_name?.trim() || '',
                date: payload.date || todayIsoDate(),
                total_amount: totalAi,
            });
            setTotalManual(Math.abs(totalAi - lineTotal) > 0.02);
            setItems(mappedItems);
            setMode('MANUAL');
            void refrescarTasaBcv(payload.date || todayIsoDate());

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
            parts.push(
                'Montos en bolívares: revise total, líneas y tasa BCV antes de guardar'
            );
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
                            <h3 className="text-lg font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                                <FileText size={18} />
                                Encabezado de Factura
                            </h3>
                            <p className="text-xs font-bold text-zinc-500 mb-6">
                                Montos en <span className="text-amber-200">bolívares (Bs)</span>. Si la
                                lectura automática falló, corrija total, líneas o tasa BCV antes de guardar.
                            </p>
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
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                        Total factura (Bs)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={invoice.total_amount > 0 ? invoice.total_amount : ''}
                                        onChange={(e) => {
                                            setTotalManual(true);
                                            setInvoice({
                                                ...invoice,
                                                total_amount: Number(e.target.value) || 0,
                                            });
                                        }}
                                        placeholder="Total en bolívares"
                                        className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTotalManual(false);
                                                setInvoice({
                                                    ...invoice,
                                                    total_amount: sumaLineas(),
                                                });
                                            }}
                                            className="text-[10px] font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2"
                                        >
                                            Usar suma de líneas
                                            {items.length > 0
                                                ? ` (Bs. ${sumaLineas().toLocaleString('es-VE', { minimumFractionDigits: 2 })})`
                                                : ''}
                                        </button>
                                        {diferenciaTotalLineas() > 0.02 && items.length > 0 ? (
                                            <span className="text-[10px] font-bold text-amber-400">
                                                Difiere de líneas
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                        Tasa BCV (Bs / USD)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={tasaBcv ?? ''}
                                            onChange={(e) => {
                                                const v = Number(e.target.value);
                                                setTasaBcv(Number.isFinite(v) && v > 0 ? v : null);
                                                setTasaBcvFuente('manual');
                                            }}
                                            placeholder="Bs por 1 USD"
                                            className="min-w-0 flex-1 bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void refrescarTasaBcv(invoice.date)}
                                            disabled={cargandoTasa}
                                            className="shrink-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-[10px] font-black uppercase tracking-wide text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                                        >
                                            {cargandoTasa ? '…' : 'BCV'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] font-bold text-zinc-500">
                                        {cargandoTasa
                                            ? 'Consultando tasa del día…'
                                            : tasaBcv
                                              ? `Fuente: ${tasaBcvFuente ?? 'bcv'} · editable si la fecha no coincide`
                                              : 'Indique tasa o pulse BCV para la fecha de la factura'}
                                    </p>
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
                                                    min={0}
                                                    step="0.01"
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
                                                    Precio unit. (Bs)
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
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
                                                    Bs.{' '}
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

                            {items.length > 0 || invoice.total_amount > 0 ? (
                                <div className="mt-8 p-6 bg-zinc-900/50 rounded-3xl border border-zinc-800 space-y-2">
                                    <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">
                                        Resumen (bolívares)
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        Suma líneas: Bs.{' '}
                                        {sumaLineas().toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                        {totalManual ? ' · total manual en encabezado' : ''}
                                    </p>
                                    <h4 className="text-2xl font-black text-zinc-200">
                                        Total a guardar: Bs.{' '}
                                        {totalVes().toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                    </h4>
                                    {totalUsdPreview() != null ? (
                                        <p className="text-emerald-400 font-black text-xl">
                                            ≈ ${totalUsdPreview()!.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                                            USD
                                            {tasaBcv
                                                ? ` (tasa ${tasaBcv.toLocaleString('es-VE', { maximumFractionDigits: 2 })} Bs/USD)`
                                                : ''}
                                        </p>
                                    ) : null}
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
