'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';
import { prepareInvoiceDocument } from '@/lib/almacen/cropInvoiceImage';
import { aplicarStockTransitoDesdeLineasCuarentena } from '@/lib/almacen/stockTransitoCompra';
import {
    registerCompraDesdeRecepcion,
    type LineaCompraContabilidadInput,
} from '@/lib/contabilidad/registerCompraDesdeRecepcion';
import { calcularGastoBimonetario } from '@/lib/finanzas/currency-converter';
import EtiquetaBimonetariaCompra from '@/components/contabilidad/EtiquetaBimonetariaCompra';
import SelectorUnidadMedida from '@/components/almacen/SelectorUnidadMedida';
import { formatearBs, vesAUsdConTasa } from '@/lib/contabilidad/comprasMontos';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { ProcurementDocumentAttach } from '@/components/almacen/ProcurementDocumentAttach';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { useContratoAdProyecto } from '@/hooks/useContratoAdProyecto';
import ProyectoAdLogisticaBanner from '@/components/proyectos/ProyectoAdLogisticaBanner';
import {
    actualizarMaterialExistenteCompra,
    resolverMaterialParaLineaCompra,
    type MaterialCompraResuelto,
} from '@/lib/almacen/resolverMaterialParaCompra';
import {
    asegurarCategoriasCompraSugeridas,
    resolverCategoriaPorDefecto,
    type MaterialCategoryRow,
} from '@/lib/almacen/categoriasMaterialCompra';
import SelectorCategoriaMaterial from '@/components/almacen/SelectorCategoriaMaterial';
import { validarCompraProcurement } from '@/lib/almacen/validarCompraProcurement';
import {
    buildExtractedFromProcurementForm,
    intentarFastTrackProcurementApp,
} from '@/lib/almacen/intentarFastTrackProcurementApp';
type PurchaseLine = {
    description: string;
    item_code: string;
    unit: string;
    quantity: number;
    unit_price: number;
    category_id: string;
};

function lineaCompraVacia(categoryId: string): PurchaseLine {
    return {
        description: '',
        item_code: '',
        unit: 'UND',
        quantity: 1,
        unit_price: 0,
        category_id: categoryId,
    };
}

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
    const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
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
    const [preparingDocument, setPreparingDocument] = useState(false);
    const [documentRecortado, setDocumentRecortado] = useState(false);
    const { isSubmitting: isSaving, runLocked } = useSyncSubmitLock();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [proyectoId, setProyectoId] = useState('');
    const {
        autorizado: logisticaAutorizada,
        loading: cargandoContratoAd,
    } = useContratoAdProyecto(proyectoId || undefined);
    const [proyectoBloqueado, setProyectoBloqueado] = useState(false);
    const [ubicacionDestinoId, setUbicacionDestinoId] = useState('');
    const [tasaBcv, setTasaBcv] = useState<number | null>(null);
    const [tasaBcvFuente, setTasaBcvFuente] = useState<string | null>(null);
    const [cargandoTasa, setCargandoTasa] = useState(false);
    /** Si el usuario editó el total a mano, no sobrescribir al cambiar líneas. */
    const [totalManual, setTotalManual] = useState(false);
    /** Confianza OCR (Gemini) para evaluar Fast-Track en app. */
    const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
    const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
    const [materialMatches, setMaterialMatches] = useState<
        Record<number, MaterialCompraResuelto | null>
    >({});
    const [materialCategories, setMaterialCategories] = useState<MaterialCategoryRow[]>([]);
    const [defaultCategoryId, setDefaultCategoryId] = useState('');
    const [saveNotice, setSaveNotice] = useState<string | null>(null);
    const [proyectos, setProyectos] = useState<Array<{ id: string; nombre: string }>>([]);
    const documentPreviewRef = useRef<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const proyectoIdParam = searchParams.get('proyectoId')?.trim() || '';
    const resultadoGuardado = searchParams.get('resultado');

    useEffect(() => {
        if (resultadoGuardado === 'fasttrack') {
            setSaveNotice(
                'Fast-Track: factura aprobada e ingresada al almacén. Stock disponible en inventario.',
            );
        } else if (resultadoGuardado === 'cuarentena') {
            setSaveNotice('Factura guardada. Revise y apruebe las líneas en tránsito.');
        }
    }, [resultadoGuardado]);

    const bloquearProyectoParam =
        searchParams.get('bloquearProyecto') === '1' ||
        searchParams.get('fromProject') === '1';

    const applyExtractedPayload = (
        payload: {
            invoice_number?: string;
            supplier_rif?: string;
            supplier_name?: string;
            date?: string;
            total_amount?: number | null;
            confidence_score?: number;
            items?: Array<{
                description: string;
                item_code?: string;
                unit?: string;
                quantity: number;
                unit_price: number;
            }>;
        },
        successPrefix?: string,
    ) => {
        const extractedItems = Array.isArray(payload.items) ? payload.items : [];
        const mappedItems: PurchaseLine[] = extractedItems.map((it) => ({
            description: (it.description || '').trim(),
            item_code: (it.item_code || '').trim(),
            unit: (it.unit || 'UND').trim() || 'UND',
            quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
            unit_price: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
            category_id: defaultCategoryId,
        }));
        const lineTotal = mappedItems.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
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
        if (payload.confidence_score != null && Number.isFinite(Number(payload.confidence_score))) {
            setOcrConfidence(Number(payload.confidence_score));
        }
        void refrescarTasaBcv(payload.date || todayIsoDate());
        setAiSuccess(
            (successPrefix ? `${successPrefix}. ` : '') +
                'Revise datos y guarde la factura.',
        );
    };

    useEffect(() => {
        void (async () => {
            try {
                const supabase = createClient();
                const cats = await asegurarCategoriasCompraSugeridas(supabase);
                const defId = resolverCategoriaPorDefecto(cats);
                setMaterialCategories(cats);
                setDefaultCategoryId(defId);
                setItems((prev) =>
                    prev.map((line) =>
                        line.category_id ? line : { ...line, category_id: defId },
                    ),
                );
            } catch {
                /* categorías opcionales al cargar */
            }
        })();
    }, []);

    useEffect(() => {
        const fromTelegram = searchParams.get('fromTelegram');
        if (!fromTelegram) return;

        const raw =
            typeof window !== 'undefined'
                ? sessionStorage.getItem('telegram_pending_invoice')
                : null;
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as {
                    pendingId?: string;
                    extracted?: Parameters<typeof applyExtractedPayload>[0];
                };
                if (parsed.pendingId === fromTelegram && parsed.extracted) {
                    applyExtractedPayload(
                        parsed.extracted,
                        'Factura cargada desde Telegram',
                    );
                    return;
                }
            } catch {
                /* fetch API */
            }
        }

        void (async () => {
            try {
                const res = await fetch(`/api/facturas-canal/pendientes/${fromTelegram}`);
                const data = await res.json();
                if (!res.ok || !data.extracted) {
                    setAiError(data.error ?? 'No se encontró la factura de Telegram');
                    return;
                }
                if (data.proyecto_id) setProyectoId(String(data.proyecto_id));
                if (data.ubicacion_destino_id) {
                    setUbicacionDestinoId(String(data.ubicacion_destino_id));
                }
                if (data.estado === 'aprobado_sistema') {
                    setAiSuccess(
                        'Fast-Track: factura aprobada por sistema (OCR >95%, SKU exacto, monto < $100 USD). Stock impactado en inventario.',
                    );
                }
                applyExtractedPayload(
                    data.extracted as Parameters<typeof applyExtractedPayload>[0],
                    'Factura cargada desde Telegram',
                );
            } catch {
                setAiError('Error al cargar factura de Telegram');
            }
        })();
    }, [searchParams]);

    useEffect(() => {
        if (!proyectoIdParam) return;
        setProyectoId(proyectoIdParam);
        setProyectoBloqueado(bloquearProyectoParam);
    }, [proyectoIdParam, bloquearProyectoParam]);

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
                if (!proyectoIdParam) setProyectoId(saved);
                return;
            }
            const principal = lista.find((p) => esProyectoSmartRrhhPorNombre(p.nombre));
            if (principal?.id) {
                if (!proyectoIdParam) setProyectoId(principal.id);
            } else if (lista[0]?.id) {
                if (!proyectoIdParam) setProyectoId(lista[0].id);
            }
        })();
    }, [proyectoIdParam]);

    useEffect(() => {
        if (proyectoId && typeof window !== 'undefined') {
            sessionStorage.setItem('procurement_proyecto_id', proyectoId);
        }
    }, [proyectoId]);

    const applySourceDocumentPreview = (file: File | null, recortado = false) => {
        if (documentPreviewRef.current) {
            URL.revokeObjectURL(documentPreviewRef.current);
            documentPreviewRef.current = null;
        }
        setSourceDocument(file);
        setDocumentRecortado(recortado);
        if (file && file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            documentPreviewRef.current = url;
            setDocumentPreviewUrl(url);
        } else {
            setDocumentPreviewUrl(null);
        }
    };

    const attachSourceDocument = async (raw: File | null): Promise<File | null> => {
        if (!raw) {
            applySourceDocumentPreview(null);
            return null;
        }
        setPreparingDocument(true);
        try {
            const prepared = await prepareInvoiceDocument(raw);
            applySourceDocumentPreview(prepared, prepared !== raw);
            return prepared;
        } finally {
            setPreparingDocument(false);
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
        setItems([...items, lineaCompraVacia(defaultCategoryId)]);
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

    useEffect(() => {
        if (!items.length) {
            setMaterialMatches({});
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            void (async () => {
                try {
                    const supabase = createClient();
                    const next: Record<number, MaterialCompraResuelto | null> = {};
                    for (let i = 0; i < items.length; i++) {
                        const it = items[i];
                        if (!it.description.trim() && !it.item_code.trim()) {
                            next[i] = null;
                            continue;
                        }
                        next[i] = await resolverMaterialParaLineaCompra(supabase, {
                            item_code: it.item_code,
                            description: it.description,
                            proyectoId: proyectoId || undefined,
                        });
                    }
                    if (!cancelled) {
                        setMaterialMatches(next);
                        setItems((prev) =>
                            prev.map((line, i) => {
                                const cat = next[i]?.category_id;
                                return cat ? { ...line, category_id: cat } : line;
                            }),
                        );
                    }
                } catch {
                    /* preview opcional */
                }
            })();
        }, 450);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [items, proyectoId]);

    useEffect(() => {
        if (!items.length && !invoice.invoice_number.trim()) {
            setValidationWarnings([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            void (async () => {
                try {
                    const supabase = createClient();
                    const v = await validarCompraProcurement(supabase, {
                        invoice_number: invoice.invoice_number,
                        supplier_rif: invoice.supplier_rif,
                        supplier_name: invoice.supplier_name,
                        total_amount: totalVes(),
                        tasa_bcv: tasaBcv,
                        lineas: items,
                    });
                    if (!cancelled) setValidationWarnings(v.advertencias);
                } catch {
                    if (!cancelled) setValidationWarnings([]);
                }
            })();
        }, 500);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [items, invoice, tasaBcv, totalManual]);

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
        if (proyectoId && !logisticaAutorizada) {
            setSubmitError(
                'Registre el Contrato de Administración Delegada (AD) en la ficha del proyecto antes de comprar.',
            );
            return;
        }
        if (!ubicacionDestinoId) {
            setSubmitError('Seleccione el almacén donde ingresará el material.');
            return;
        }

        const validLines = items.filter((it) => it.description.trim());
        if (validLines.length === 0) {
            setSubmitError(
                'Agregue al menos un artículo con descripción (botón + en Artículos de la factura).'
            );
            return;
        }

        if (validLines.some((l) => !l.category_id?.trim())) {
            setSubmitError('Seleccione la categoría de material en cada línea de la factura.');
            return;
        }

        if (!tasaBcv || tasaBcv <= 0) {
            setSubmitError('Indique la tasa BCV (pulse BCV o escríbala manualmente).');
            return;
        }

        await runLocked(async () => {
        let supabase;
        try {
            supabase = createClient();
        } catch (envErr) {
            setSubmitError(formatProcurementSaveError(envErr));
            return;
        }

        try {
            const validacion = await validarCompraProcurement(supabase, {
                invoice_number: invoice.invoice_number,
                supplier_rif: invoice.supplier_rif,
                supplier_name: invoice.supplier_name,
                total_amount: totalVes(),
                tasa_bcv: tasaBcv,
                lineas: validLines,
            });

            if (!validacion.ok) {
                setSubmitError(validacion.errores.join(' '));
                return;
            }

            if (validacion.advertencias.length) {
                const continuar = window.confirm(
                    validacion.advertencias.join('\n\n') + '\n\n¿Desea continuar con el registro?',
                );
                if (!continuar) return;
            }

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
                ubicacion_destino_id: ubicacionDestinoId,
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
            let depositIdMaterial: string | null = null;
            const { data: ubDestino } = await supabase
                .from('inv_ubicaciones')
                .select('deposit_id')
                .eq('id', ubicacionDestinoId)
                .maybeSingle();
            if (ubDestino?.deposit_id) {
                depositIdMaterial = String(ubDestino.deposit_id);
            } else {
                depositIdMaterial = await fetchDefaultDepositId(supabase);
            }

            for (const line of validLines) {
                const desc = line.description.trim();
                const resuelto = await resolverMaterialParaLineaCompra(supabase, {
                    item_code: line.item_code,
                    description: desc,
                    proyectoId,
                });

                let materialId: string;

                if (resuelto) {
                    materialId = resuelto.id;
                    await actualizarMaterialExistenteCompra(supabase, materialId, {
                        unitPrice: line.unit_price,
                        purchaseDate: invoice.date,
                        proyectoId,
                        depositId: depositIdMaterial,
                        sapCode: line.item_code.trim() || undefined,
                        categoryId: line.category_id,
                    });
                } else {
                    const materialBase: Record<string, unknown> = {
                        name: desc,
                        unit: (line.unit || 'UND').trim() || 'UND',
                        stock_available: 0,
                        stock_quarantine: 0,
                        reorder_point: 0,
                        average_weighted_cost: line.unit_price,
                        last_purchase_price: line.unit_price,
                        last_purchase_date: invoice.date,
                        proyecto_id: proyectoId,
                        category_id: line.category_id,
                    };
                    if (line.item_code.trim()) {
                        materialBase.sap_code = line.item_code.trim();
                    }
                    if (depositIdMaterial) {
                        materialBase.deposit_id = depositIdMaterial;
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
                    materialId = newMaterial.id;
                }

                const detailRow: Record<string, unknown> = {
                    invoice_id: invData.id,
                    material_id: materialId,
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
                    material_id: materialId,
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
                    material_id: materialId,
                    descripcion: desc,
                    item_code: line.item_code.trim() || null,
                    unidad: (line.unit || 'UND').trim() || 'UND',
                    cantidad: line.quantity,
                    precio_unitario: line.unit_price,
                });

            }

            /* Stock físico disponible: al liberar tránsito (inventario_stock), no en global_inventory. */

            await aplicarStockTransitoDesdeLineasCuarentena(supabase, {
                ubicacionDestinoId,
                purchaseInvoiceId: invData.id,
                lineas: lineasContabilidad
                    .filter((l) => l.material_id)
                    .map((l) => ({
                        material_id: l.material_id!,
                        cantidad: l.cantidad,
                    })),
            });

            const fromTelegram = searchParams.get('fromTelegram');

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
                origen: fromTelegram ? 'TELEGRAM' : 'RECEPCION_MERCANCIA',
                ubicacion_destino_id: ubicacionDestinoId,
            });
            if (fromTelegram) {
                try {
                    await fetch(`/api/facturas-canal/pendientes/${fromTelegram}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            estado: 'confirmado',
                            purchase_invoice_id: invData.id,
                            proyecto_id: proyectoId,
                            ubicacion_destino_id: ubicacionDestinoId,
                        }),
                    });
                    sessionStorage.removeItem('telegram_pending_invoice');
                } catch {
                    /* no bloquear flujo */
                }
            }

            const extractedForm = buildExtractedFromProcurementForm({
                invoice_number: payload.invoice_number,
                supplier_rif: payload.supplier_rif,
                supplier_name: payload.supplier_name,
                date: payload.date,
                total_amount: totalBolivares,
                items: validLines,
                confidence_score: ocrConfidence ?? undefined,
            });

            const fastTrack = await intentarFastTrackProcurementApp(supabase, {
                purchaseInvoiceId: invData.id,
                proyectoId,
                extracted: extractedForm,
            });

            if (fastTrack.aplicado) {
                router.push(
                    `/almacen/procurement?resultado=fasttrack&factura=${encodeURIComponent(payload.invoice_number)}`,
                );
                return;
            }

            try {
                await fetch('/api/almacen/quality/notificar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ purchaseInvoiceId: invData.id }),
                });
            } catch {
                /* no bloquear flujo */
            }

            router.push('/almacen/procurement/quality?resultado=cuarentena');
        } catch (error) {
            console.error('Error saving invoice:', error);
            setSubmitError(formatProcurementSaveError(error));
        }
        });
    };

    const processInvoiceWithAI = async (raw: File) => {
        const file = await attachSourceDocument(raw);
        if (!file) return;

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
                confidence_score?: number;
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

            applyExtractedPayload(payload);
            if (payload.confidence_score != null && Number.isFinite(Number(payload.confidence_score))) {
                setOcrConfidence(Number(payload.confidence_score));
            }
            const mappedItems = Array.isArray(payload.items)
                ? payload.items.map((it) => ({
                      description: (it.description || '').trim(),
                  }))
                : [];
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
                        REGISTRO DE FACTURAS
                    </h1>
                </div>

                {saveNotice ? (
                    <div className="mb-6 p-4 rounded-2xl bg-emerald-600/10 border border-emerald-600/30 space-y-3">
                        <div className="flex items-start gap-2 text-emerald-400 text-sm font-bold">
                            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                            <span>{saveNotice}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide">
                            <Link
                                href="/almacen"
                                className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                            >
                                Ver inventario
                            </Link>
                            <Link
                                href="/contabilidad/compras"
                                className="px-3 py-1.5 rounded-lg border border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
                            >
                                Ver en compras
                            </Link>
                            {resultadoGuardado !== 'fasttrack' ? (
                                <Link
                                    href="/almacen/procurement/quality"
                                    className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                                >
                                    Tránsito
                                </Link>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                <div className="mb-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <span className={mode === 'AUTO' ? 'text-blue-400' : ''}>1 · Documento</span>
                    <span>→</span>
                    <span className={mode === 'MANUAL' ? 'text-white' : ''}>2 · Revisar y guardar</span>
                    <span>→</span>
                    <span>3 · Almacén</span>
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
                                {isUploading || preparingDocument ? (
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                                ) : (
                                    <Upload className="text-blue-500" size={36} />
                                )}
                            </div>
                            <h2 className="text-2xl font-black mb-2">Sube tu Factura</h2>
                            <p className="text-zinc-500 font-bold mb-8 max-w-sm">
                                Tome una foto con la cámara, elija una imagen de la fototeca del celular
                                o cargue un PDF/archivo. Las fotos se recortan automáticamente (solo la factura).
                                La IA leerá proveedor, artículos, cantidades y precios.
                            </p>
                            <ProcurementDocumentAttach
                                variant="primary"
                                loading={isUploading || preparingDocument}
                                onSelect={(f) => void processInvoiceWithAI(f)}
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
                        {proyectoId && !cargandoContratoAd && !logisticaAutorizada ? (
                            <ProyectoAdLogisticaBanner
                                proyectoId={proyectoId}
                                autorizado={logisticaAutorizada}
                            />
                        ) : null}
                        <ProcPanel className="p-6">
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">
                                Archivo de factura o presupuesto
                            </h3>
                            <p className="text-zinc-600 text-xs font-bold mb-4">
                                Tome una foto, elija de la fototeca del celular o adjunte PDF/imagen desde
                                archivos. Al guardar, se recorta automáticamente dejando solo la factura.
                            </p>
                            <ProcurementDocumentAttach
                                variant="secondary"
                                loading={preparingDocument}
                                onSelect={(f) => void attachSourceDocument(f)}
                            />
                            {sourceDocument ? (
                                <div className="mt-4 p-4 bg-black/40 rounded-xl border border-zinc-800">
                                    {documentRecortado ? (
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/90 mb-2">
                                            Recorte automático: solo la factura (sin fondo)
                                        </p>
                                    ) : null}
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
                                            PDF adjunto (vista previa al guardar en tránsito)
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
                                {proyectoBloqueado ? (
                                    <p className="text-[11px] font-bold text-emerald-400">
                                        Proyecto fijado por contexto del módulo de proyecto.
                                    </p>
                                ) : null}
                                <select
                                    value={proyectoId}
                                    onChange={(e) => {
                                        setProyectoId(e.target.value);
                                        setUbicacionDestinoId('');
                                    }}
                                    disabled={proyectoBloqueado}
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
                            <div className="space-y-2 mt-6">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                                    Almacén de ingreso
                                </label>
                                <UbicacionInventarioSelect
                                    proyectoId={proyectoId}
                                    value={ubicacionDestinoId}
                                    onChange={setUbicacionDestinoId}
                                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                                    placeholder="Seleccione almacén…"
                                />
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
                                            className="text-[10px] font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 text-left"
                                        >
                                            Usar suma de líneas
                                            {items.length > 0 ? (
                                                <EtiquetaBimonetariaCompra
                                                    usd={
                                                        tasaBcv && tasaBcv > 0
                                                            ? calcularGastoBimonetario(
                                                                  sumaLineas(),
                                                                  'VES',
                                                                  tasaBcv,
                                                              ).montoUsd
                                                            : null
                                                    }
                                                    bs={sumaLineas()}
                                                    tasa={tasaBcv}
                                                    layout="stack"
                                                    style={{
                                                        display: 'block',
                                                        marginTop: 4,
                                                        fontSize: 10,
                                                        alignItems: 'flex-start',
                                                    }}
                                                />
                                            ) : null}
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
                                        Si el código/SKU coincide con el catálogo, se reutiliza el material
                                        existente. Si no, se crea uno nuevo al guardar.
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
                                            {materialMatches[index] ? (
                                                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-400/90">
                                                    Material existente (
                                                    {materialMatches[index]?.matchedBy === 'sku'
                                                        ? 'SKU'
                                                        : 'nombre'}
                                                    ): {materialMatches[index]?.name}
                                                </p>
                                            ) : item.description.trim() || item.item_code.trim() ? (
                                                <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                                                    Material nuevo al guardar
                                                </p>
                                            ) : null}
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
                                            <SelectorCategoriaMaterial
                                                value={item.category_id}
                                                onChange={(categoryId) =>
                                                    updateItem(index, 'category_id', categoryId)
                                                }
                                                categories={materialCategories}
                                                onCategoriesChange={(cats) => {
                                                    setMaterialCategories(cats);
                                                    if (!defaultCategoryId && cats.length) {
                                                        setDefaultCategoryId(
                                                            resolverCategoriaPorDefecto(cats),
                                                        );
                                                    }
                                                }}
                                            />
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
                                                    <SelectorUnidadMedida
                                                        value={item.unit}
                                                        onChange={(unit) =>
                                                            updateItem(index, 'unit', unit)
                                                        }
                                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
                                                        inputClassName="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all uppercase"
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
                                            <div className="w-36 space-y-2">
                                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">
                                                    Subtotal
                                                </label>
                                                <div className="p-3 bg-zinc-900/50 rounded-xl font-black text-sm">
                                                    <EtiquetaBimonetariaCompra
                                                        usd={
                                                            tasaBcv && tasaBcv > 0
                                                                ? vesAUsdConTasa(
                                                                      item.quantity * item.unit_price,
                                                                      tasaBcv,
                                                                  )
                                                                : null
                                                        }
                                                        bs={item.quantity * item.unit_price}
                                                        tasa={tasaBcv}
                                                        layout="stack"
                                                        style={{ fontSize: 11, alignItems: 'flex-start' }}
                                                    />
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
                                        Resumen bimonetario
                                    </p>
                                    {totalUsdPreview() != null || totalVes() > 0 ? (
                                        <EtiquetaBimonetariaCompra
                                            usd={totalUsdPreview()}
                                            bs={totalVes()}
                                            tasa={tasaBcv}
                                            layout="stack"
                                            style={{ fontSize: 22, alignItems: 'flex-start' }}
                                        />
                                    ) : (
                                        <p className="text-amber-400 text-sm font-bold">
                                            Indique la tasa BCV para ver el equivalente en dólares.
                                        </p>
                                    )}
                                    <p className="text-xs text-zinc-500">
                                        Suma líneas: {formatearBs(sumaLineas())}
                                        {totalManual ? ' · total manual en encabezado' : ''}
                                    </p>
                                </div>
                            ) : null}
                        </ProcPanel>

                        {validationWarnings.length > 0 ? (
                            <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-600/10 border border-amber-600/30 text-amber-300 text-sm font-bold">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    {validationWarnings.map((w) => (
                                        <li key={w}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {submitError ? (
                            <div className="flex items-start gap-2 p-4 rounded-2xl bg-red-600/10 border border-red-600/30 text-red-400 text-sm font-bold">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <span>{submitError}</span>
                            </div>
                        ) : null}

                        <div className="sticky bottom-4 z-20 mt-4 p-4 rounded-3xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl">
                            <button
                                type="button"
                                onClick={() => {
                                    if (isSaving) return;
                                    void handleSubmit();
                                }}
                                disabled={isSaving || (Boolean(proyectoId) && !logisticaAutorizada)}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:pointer-events-none text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                ) : (
                                    <Save size={20} />
                                )}
                                {isSaving ? (
                                    'GUARDANDO…'
                                ) : (
                                    <span className="flex flex-col items-center gap-1">
                                        <span>FINALIZAR</span>
                                        <EtiquetaBimonetariaCompra
                                            usd={totalUsdPreview()}
                                            bs={totalVes()}
                                            tasa={tasaBcv}
                                            layout="inline"
                                            style={{ fontSize: 11, fontWeight: 800 }}
                                        />
                                    </span>
                                )}
                            </button>
                            <p className="text-center text-[10px] text-zinc-600 font-bold mt-2 uppercase tracking-widest">
                                Fast-Track automático si OCR &gt;95%, SKU en catálogo y monto bajo umbral
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
