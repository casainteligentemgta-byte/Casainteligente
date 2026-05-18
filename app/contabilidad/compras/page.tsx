'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { FileText, Loader2, RefreshCw } from 'lucide-react';

type CompraRow = {
    id: string;
    purchase_invoice_id: string | null;
    invoice_number: string;
    supplier_rif: string;
    supplier_name: string;
    fecha: string;
    total_amount: number;
    origen: string;
    estado: string;
    document_file_name: string | null;
    created_at: string;
    contabilidad_compra_lineas?: { count: number }[];
};

const glass = {
    background: 'rgba(28, 28, 30, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
};

function lineCount(row: CompraRow): number {
    const nested = row.contabilidad_compra_lineas;
    if (Array.isArray(nested) && nested[0] && typeof nested[0].count === 'number') {
        return nested[0].count;
    }
    return 0;
}

export default function ComprasPage() {
    const [compras, setCompras] = useState<CompraRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            const { data, error: qErr } = await supabase
                .from('contabilidad_compras')
                .select(
                    'id,purchase_invoice_id,invoice_number,supplier_rif,supplier_name,fecha,total_amount,origen,estado,document_file_name,created_at,contabilidad_compra_lineas(count)'
                )
                .order('fecha', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(200);

            if (qErr) {
                if (
                    qErr.message.includes('contabilidad_compras') ||
                    qErr.message.includes('does not exist')
                ) {
                    throw new Error(
                        'Tabla de compras no encontrada. Ejecute la migración 135_contabilidad_compras_recepcion.sql en Supabase.'
                    );
                }
                throw qErr;
            }
            setCompras((data ?? []) as CompraRow[]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudieron cargar las compras.');
            setCompras([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const totalEgresos = compras.reduce((acc, c) => acc + Number(c.total_amount || 0), 0);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(20px)',
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link
                        href="/contabilidad"
                        style={{ color: '#5856D6', textDecoration: 'none', fontSize: '20px' }}
                    >
                        ←
                    </Link>
                    <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 800 }}>Compras</h1>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                    }}
                    aria-label="Actualizar lista"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div style={{ padding: '20px' }}>
                <div style={{ ...glass, padding: '20px', marginBottom: '20px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700 }}>
                        EGRESOS REGISTRADOS
                    </p>
                    <p style={{ color: '#FF3B30', fontSize: '28px', fontWeight: 800 }}>
                        ${totalEgresos.toFixed(2)}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '8px' }}>
                        Las facturas se registran al finalizar la recepción de mercancía en Almacén.
                    </p>
                    <Link
                        href="/almacen/procurement"
                        style={{
                            display: 'inline-block',
                            marginTop: '12px',
                            color: '#5856D6',
                            fontSize: '13px',
                            fontWeight: 700,
                            textDecoration: 'none',
                        }}
                    >
                        Ir a recepción de mercancía →
                    </Link>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', marginTop: '60px', color: 'rgba(255,255,255,0.4)' }}>
                        <Loader2 className="animate-spin mx-auto mb-3" size={32} />
                        <p>Cargando compras…</p>
                    </div>
                ) : error ? (
                    <div
                        style={{
                            ...glass,
                            padding: '20px',
                            color: '#FF6B6B',
                            fontSize: '14px',
                            fontWeight: 600,
                        }}
                    >
                        {error}
                    </div>
                ) : compras.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '60px', color: 'rgba(255,255,255,0.2)' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🧾</div>
                        <p style={{ fontSize: '18px', fontWeight: 700 }}>No hay compras registradas</p>
                        <p style={{ fontSize: '14px', marginTop: '4px' }}>
                            Finalice una captura en Almacén → Recepción de mercancía.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {compras.map((c) => (
                            <div key={c.id} style={{ ...glass, padding: '18px' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '12px',
                                    }}
                                >
                                    <div>
                                        <p
                                            style={{
                                                color: 'white',
                                                fontSize: '17px',
                                                fontWeight: 800,
                                                marginBottom: '4px',
                                            }}
                                        >
                                            {c.supplier_name}
                                        </p>
                                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                                            Factura #{c.invoice_number} · {c.supplier_rif}
                                        </p>
                                        <p
                                            style={{
                                                color: 'rgba(255,255,255,0.35)',
                                                fontSize: '11px',
                                                marginTop: '6px',
                                            }}
                                        >
                                            {c.fecha} · {lineCount(c)} línea(s) · {c.origen.replace(/_/g, ' ')}
                                        </p>
                                        {c.document_file_name ? (
                                            <p
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    color: '#5856D6',
                                                    fontSize: '11px',
                                                    marginTop: '8px',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                <FileText size={14} />
                                                {c.document_file_name}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p
                                            style={{
                                                color: '#FF3B30',
                                                fontSize: '20px',
                                                fontWeight: 800,
                                            }}
                                        >
                                            ${Number(c.total_amount).toFixed(2)}
                                        </p>
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                marginTop: '6px',
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                fontSize: '10px',
                                                fontWeight: 800,
                                                background: 'rgba(88,86,214,0.15)',
                                                color: '#a5a3ff',
                                            }}
                                        >
                                            {c.estado}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
