'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PRESUPUESTO_BRAND, textoMetodosPago } from '@/lib/presupuesto/brand';
import { DEMO_PRESUPUESTO } from '@/lib/presupuesto/demo-data';
import { lineaPresupuestoTitulo, textoPresupuesto, tituloPresupuestoPlano } from '@/lib/presupuesto/presentacion';
import type { PresupuestoVista } from '@/lib/presupuesto/types';
import { createClient } from '@/lib/supabase/client';

function isBudgetUuid(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Fila `budgets` → mismo shape que guardamos en `presupuesto_preview` (localStorage). */
function budgetRowToPreviewPayload(
    budget: Record<string, unknown>,
    extra: { telefono?: string; email?: string; direccion?: string },
): Record<string, unknown> {
    const itemsRaw = Array.isArray(budget.items) ? budget.items : [];
    const items = itemsRaw.map((row) => {
        const r = row as Record<string, unknown>;
        const pd =
            r.product_data && typeof r.product_data === 'object'
                ? (r.product_data as Record<string, unknown>)
                : {};
        const nombreBruto =
            typeof pd.nombre === 'string' ? pd.nombre : pd.nombre != null ? String(pd.nombre) : '';
        return {
            nombre: tituloPresupuestoPlano(nombreBruto),
            qty: r.qty,
            unitPrice: r.unit_price,
            discount: r.discount ?? 0,
            costo: pd.costo,
        };
    });
    const id = String(budget.id ?? '');
    const created = budget.created_at ? new Date(String(budget.created_at)) : new Date();
    const correlativoRaw = (budget as any).numero_correlativo as unknown;
    const correlativoNum =
        typeof correlativoRaw === 'number'
            ? correlativoRaw
            : typeof correlativoRaw === 'string'
                ? Number(correlativoRaw)
                : null;

    return {
        cliente: budget.customer_name ?? '',
        rif: budget.customer_rif ?? '',
        notas: budget.notes ?? '',
        items,
        subtotal: Number(budget.subtotal) || 0,
        totalCost: Number(budget.total_cost) || 0,
        totalProfit: Number(budget.total_profit) || 0,
        marginPct: Number(budget.margin_pct) || 0,
        showZelle: budget.show_zelle !== false,
        fecha: created.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }),
        numero:
            correlativoNum != null && !Number.isNaN(correlativoNum)
                ? `P-${correlativoNum}`
                : id
                    ? `P-${id.slice(0, 4)}`
                    : 'P-—',
        telefono: extra.telefono,
        email: extra.email,
        direccion: extra.direccion,
    };
}

function looksLikeImageUrl(s: string) {
    const t = s.trim();
    if (!t) return false;
    if (/^data:image\//i.test(t)) return true;
    if (!/^https?:\/\//i.test(t)) return false;
    return /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(t);
}

function pickItemNombre(o: Record<string, unknown>): string {
    const tryName = (v: unknown) => {
        if (typeof v !== 'string') return '';
        const x = v.trim();
        if (!x || looksLikeImageUrl(x)) return '';
        return x;
    };
    const n = tryName(o.nombre);
    if (n) return n;
    const prod = o.product;
    if (prod && typeof prod === 'object') {
        const pn = tryName((prod as Record<string, unknown>).nombre);
        if (pn) return pn;
    }
    return '';
}

/** Solo campos permitidos en ítems (evita datos viejos con `imagen` u otros en localStorage). */
function sanitizePreviewItems(raw: unknown): PresupuestoVista['items'] {
    if (!Array.isArray(raw)) return [];
    return raw.map((it) => {
        const o = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
        const nombre = pickItemNombre(o);
        return {
            nombre,
            categoria: null,
            descripcion: null,
            qty: Number(o.qty) || 0,
            unitPrice: Number(o.unitPrice) || 0,
            discount: Number(o.discount) || 0,
            costo: o.costo != null && o.costo !== '' ? Number(o.costo) : null,
        };
    });
}

function normalizePresupuestoVista(raw: Record<string, unknown>): PresupuestoVista {
    return {
        cliente: String(raw.cliente ?? ''),
        rif: String(raw.rif ?? ''),
        notas: String(raw.notas ?? ''),
        items: sanitizePreviewItems(raw.items),
        subtotal: Number(raw.subtotal) || 0,
        totalCost: Number(raw.totalCost) || 0,
        totalProfit: Number(raw.totalProfit) || 0,
        marginPct: Number(raw.marginPct) || 0,
        showZelle: raw.showZelle !== false,
        fecha: String(raw.fecha ?? ''),
        numero: String(raw.numero ?? ''),
        telefono: raw.telefono != null ? String(raw.telefono) : undefined,
        email: raw.email != null ? String(raw.email) : undefined,
        direccion: raw.direccion != null ? String(raw.direccion) : undefined,
    };
}

function fmt(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineTotal(item: PresupuestoVista['items'][0]) {
    return item.unitPrice * (1 - item.discount / 100) * item.qty;
}

export default function PreviewPage() {
    const [data, setData] = useState<PresupuestoVista | null>(null);
    const [isDemo, setIsDemo] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('demo') === '1') {
                if (!cancelled) {
                    const d = { ...DEMO_PRESUPUESTO, items: sanitizePreviewItems(DEMO_PRESUPUESTO.items) };
                    setData(d);
                    setIsDemo(true);
                }
                return;
            }

            const idParam = params.get('id')?.trim() ?? '';
            if (idParam && isBudgetUuid(idParam)) {
                setLoading(true);
                const supabase = createClient();
                const { data: budget, error } = await supabase
                    .from('budgets')
                    .select('*')
                    .eq('id', idParam)
                    .single();
                if (cancelled) return;
                setLoading(false);

                if (!error && budget) {
                    let telefono = '';
                    let email = '';
                    let direccion = '';
                    const cid = budget.customer_id as string | null | undefined;
                    if (cid) {
                        const { data: c } = await supabase
                            .from('customers')
                            .select('movil, email, direccion')
                            .eq('id', cid)
                            .single();
                        if (!cancelled && c) {
                            telefono = (c.movil as string) || '';
                            email = (c.email as string) || '';
                            direccion = (c.direccion as string) || '';
                        }
                    }
                    if (cancelled) return;
                    const payload = budgetRowToPreviewPayload(budget as Record<string, unknown>, {
                        telefono,
                        email,
                        direccion,
                    });
                    const vista = normalizePresupuestoVista(payload);
                    setData(vista);
                    setIsDemo(false);
                    try {
                        localStorage.setItem('presupuesto_preview', JSON.stringify(payload));
                    } catch {
                        /* cuota / modo privado */
                    }
                    return;
                }
            }

            const raw = localStorage.getItem('presupuesto_preview');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw) as Record<string, unknown>;
                    if (!cancelled) setData(normalizePresupuestoVista(parsed));
                } catch {
                    if (!cancelled) setData(null);
                }
            } else if (!cancelled) {
                setData(null);
            }
        }

        void run();
        return () => {
            cancelled = true;
        };
    }, []);

    /** Actualiza notas en el documento y en localStorage (flujo real desde Ventas). */
    function setNotasPresupuesto(notas: string) {
        setData((prev) => {
            if (!prev) return prev;
            const next = { ...prev, notas };
            if (!isDemo) {
                try {
                    localStorage.setItem('presupuesto_preview', JSON.stringify(next));
                } catch {
                    /* ignorar cuota / privado */
                }
            }
            return next;
        });
    }

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', background: '#0A0A0F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Inter, -apple-system, sans-serif',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px' }}>Cargando presupuesto…</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{
                minHeight: '100vh', background: '#0A0A0F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Inter, -apple-system, sans-serif',
            }}>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', maxWidth: '380px', padding: '20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                    <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)' }}>No hay presupuesto para mostrar.</p>
                    <p style={{ fontSize: '13px', marginTop: '10px', lineHeight: 1.5 }}>
                        Esta pantalla necesita datos: o bien los envía <strong>Ventas</strong> al pulsar <strong>Vista previa</strong> (misma sesión del navegador), o bien abres un guardado con su enlace{' '}
                        <code style={{ fontSize: '11px', color: '#5AC8FA' }}>?id=…</code> desde <strong>Presupuestos</strong>.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px', alignItems: 'center' }}>
                        <Link
                            href="/ventas"
                            style={{
                                display: 'inline-block', padding: '12px 22px',
                                background: 'linear-gradient(135deg, #34C759, #30D158)', borderRadius: '12px',
                                color: 'white', fontSize: '14px', fontWeight: 700, textDecoration: 'none',
                            }}
                        >
                            Ir a Ventas
                        </Link>
                        <Link
                            href="/presupuestos"
                            style={{
                                display: 'inline-block', padding: '10px 18px',
                                background: 'rgba(0,122,255,0.2)', borderRadius: '12px',
                                color: '#5AC8FA', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                                border: '1px solid rgba(0,122,255,0.35)',
                            }}
                        >
                            Ver presupuestos guardados
                        </Link>
                        <Link
                            href="/ventas/preview?demo=1"
                            style={{
                                display: 'inline-block', marginTop: '4px', padding: '10px 18px',
                                background: 'linear-gradient(135deg, #007AFF, #5856D6)', borderRadius: '12px',
                                color: 'white', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                            }}
                        >
                            Ver ejemplo (demo)
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const totalItems = data.items.reduce((s, i) => s + i.qty, 0);
    const descuento = 0; // puede extenderse

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0A0A0F',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            color: 'white',
            paddingBottom: '40px',
        }}>

            {/* Modo demo: cómo editar el diseño */}
            {isDemo && (
                <div className="no-print" style={{
                    background: 'linear-gradient(90deg, rgba(0,122,255,0.2), rgba(88,86,214,0.15))',
                    borderBottom: '1px solid rgba(0,122,255,0.25)',
                    padding: '10px 20px', fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5,
                }}>
                    <strong style={{ color: '#5AC8FA' }}>Modo ejemplo (local)</strong>
                    {' · '}Datos en <code style={{ fontSize: '11px', color: '#FF9500' }}>lib/presupuesto/demo-data.ts</code>
                    {' · '}Marca y textos legales: <code style={{ fontSize: '11px', color: '#34C759' }}>lib/presupuesto/brand.ts</code>
                    {' · '}Vista impresa/PDF: <code style={{ fontSize: '11px', color: '#AF52DE' }}>lib/presupuesto/html-impresion.ts</code>
                    <span style={{ display: 'block', marginTop: '6px', opacity: 0.75 }}>
                        Las <strong>notas</strong> puedes editarlas abajo en esta pantalla (solo en memoria en modo ejemplo). Tras cambiar código en Cursor, recarga (F5).
                    </span>
                </div>
            )}

            {/* ── Toolbar (no se imprime) ── */}
            <div className="no-print" style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(10,10,15,0.9)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                padding: '12px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isDemo ? (
                        <Link
                            href="/presupuestos"
                            style={{
                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '10px', padding: '8px 14px',
                                color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Volver
                        </Link>
                    ) : (
                        <button
                            type="button"
                            onClick={() => window.close()}
                            style={{
                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '10px', padding: '8px 14px',
                                color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Volver
                        </button>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                        Presupuesto {data.numero}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => {
                            const notasBloque = data.notas?.trim() ? `\nNotas: ${data.notas.trim()}\n` : '';
                            const text = `PRESUPUESTO ${PRESUPUESTO_BRAND.nombreLegal}\nNro: ${data.numero}\nFecha: ${data.fecha}\nCliente: ${data.cliente} ${data.rif ? `(${data.rif})` : ''}${notasBloque}${'─'.repeat(50)}\n${data.items.map((i) => {
                                const nom = lineaPresupuestoTitulo(i.nombre);
                                const desc = i.descripcion ? textoPresupuesto(tituloPresupuestoPlano(i.descripcion)) : '';
                                return `${i.qty}x ${nom}${desc ? ` — ${desc}` : ''} — $${fmt(lineTotal(i))}`;
                            }).join('\n')}\n${'─'.repeat(50)}\nTOTAL: $${fmt(data.subtotal)}`;
                            navigator.clipboard.writeText(text);
                        }}
                        style={{
                            background: 'rgba(0,122,255,0.15)', border: '1px solid rgba(0,122,255,0.3)',
                            borderRadius: '12px', padding: '10px 18px',
                            color: '#007AFF', fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <rect x="9" y="9" width="13" height="13" rx="2" stroke="#007AFF" strokeWidth="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="#007AFF" strokeWidth="2" />
                        </svg>
                        Copiar
                    </button>
                    <button
                        onClick={() => {
                            const notasWa = data.notas?.trim() ? `\n*Notas:* ${data.notas.trim()}\n` : '';
                            const text = `*PRESUPUESTO ${PRESUPUESTO_BRAND.nombreLegal}*\n\n*Nro:* ${data.numero}\n*Fecha:* ${data.fecha}\n*Cliente:* ${data.cliente} ${data.rif ? `(${data.rif})` : ''}${notasWa}\n${data.items.map((i) => {
                                const nom = lineaPresupuestoTitulo(i.nombre);
                                const desc = i.descripcion ? textoPresupuesto(tituloPresupuestoPlano(i.descripcion)) : '';
                                return `• ${i.qty}x ${nom}${desc ? ` — ${desc}` : ''} — $${fmt(lineTotal(i))}`;
                            }).join('\n')}\n\n*TOTAL: $${fmt(data.subtotal)}*\n\n_Generado por Casa Inteligente APP_`;
                            const phone = data.telefono ? data.telefono.replace(/\D/g, '') : '';
                            window.open(`https://wa.me/${phone.startsWith('58') ? phone : '58' + phone}?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        style={{
                            background: '#25D366', border: 'none',
                            borderRadius: '12px', padding: '10px 18px',
                            color: 'white', fontSize: '13px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 4px 12px rgba(37,211,102,0.3)',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.758.459 3.474 1.33 4.982L2 22l5.167-1.357a9.945 9.945 0 004.845 1.259h.004c5.507 0 9.99-4.478 9.991-9.984 0-2.667-1.037-5.176-2.922-7.062A9.92 9.92 0 0012.012 2z" />
                        </svg>
                        WhatsApp
                    </button>
                    <button
                        onClick={() => window.print()}
                        style={{
                            background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 18px',
                            border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '13px',
                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" rx="1" />
                        </svg>
                        PDF
                    </button>
                    <button
                        onClick={() => {
                            // Simple text download fallback or just print
                            window.print();
                        }}
                        style={{
                            background: 'linear-gradient(135deg, #FF9500, #FF6B00)',
                            border: 'none', borderRadius: '12px', padding: '10px 20px',
                            color: 'white', fontSize: '13px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 4px 16px rgba(255,149,0,0.4)',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        Descargar
                    </button>
                </div>
            </div>

            {/* ── Documento ── */}
            <div style={{
                maxWidth: '800px', margin: '32px auto 0',
                padding: '0 20px',
            }}>
                <div
                    className="presupuesto-sin-fotos-producto"
                    style={{
                    background: 'linear-gradient(160deg, #111118 0%, #0D0D14 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                }}
                >

                    {/* ── Header del documento ── */}
                    <div style={{
                        background: 'linear-gradient(135deg, #0D1B2A 0%, #0A1628 100%)',
                        padding: '28px 32px 24px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            {/* Logo + empresa */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div
                                    style={{
                                        width: '52px',
                                        height: '52px',
                                        borderRadius: '14px',
                                        flexShrink: 0,
                                        boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                                        border: '1px solid rgba(255,255,255,0.14)',
                                        background: 'linear-gradient(145deg, #1a2a3a 0%, #0A1628 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    title="Casa Inteligente"
                                >
                                    <img
                                        className="logo-casa-inteligente"
                                        src="/logo-casa-inteligente.png"
                                        alt="Casa Inteligente"
                                        width={52}
                                        height={52}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block',
                                            mixBlendMode: 'multiply',
                                        }}
                                    />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                        {PRESUPUESTO_BRAND.nombreLegal}
                                    </h2>
                                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px', letterSpacing: '0.5px' }}>
                                        {PRESUPUESTO_BRAND.tagline} RIF {PRESUPUESTO_BRAND.rifEmpresa}
                                    </p>
                                </div>
                            </div>

                            {/* Fecha + número */}
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>{data.fecha}</p>
                                <div style={{
                                    background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                                    borderRadius: '10px', padding: '6px 14px',
                                    display: 'inline-block',
                                }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', letterSpacing: '0.3px' }}>
                                        Presupuesto Nro. {data.numero}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Cliente */}
                        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {data.cliente ? (
                                    <>
                                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>
                                            {data.cliente.toUpperCase()}
                                        </h1>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {/* RIF / ID */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="3" y="4" width="18" height="16" rx="2" />
                                                        <circle cx="9" cy="10" r="2" />
                                                        <path d="M15 8h2M15 12h2M7 16h10" />
                                                    </svg>
                                                </div>
                                                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                                                    {data.rif || 'Sin identificación'}
                                                </span>
                                            </div>

                                            {/* Teléfono */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                                        <line x1="12" y1="18" x2="12.01" y2="18" />
                                                    </svg>
                                                </div>
                                                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                                                    {data.telefono || 'Teléfono no disp.'}
                                                </span>
                                            </div>

                                            {/* Email */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '20px', display: 'flex', justifyContent: 'center' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                                        <polyline points="22,6 12,13 2,6" />
                                                    </svg>
                                                </div>
                                                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                                                    {data.email || 'Correo no especificado'}
                                                </span>
                                            </div>

                                            {data.direccion ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <div style={{ width: '20px', display: 'flex', justifyContent: 'center', flexShrink: 0, paddingTop: '2px' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                            <circle cx="12" cy="10" r="3" />
                                                        </svg>
                                                    </div>
                                                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.35 }}>
                                                        {data.direccion}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </>
                                ) : (
                                    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Información de cliente no disponible</p>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>Total Pagar</p>
                                <p style={{ fontSize: '40px', fontWeight: 800, color: '#34C759', letterSpacing: '-0.04em', lineHeight: 1 }}>
                                    <span style={{ fontSize: '20px', fontWeight: 600 }}>$</span>
                                    {fmt(data.subtotal)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Tabla de productos ── */}
                    <div style={{ padding: '0' }}>
                        {/* Encabezado tabla */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 100px 60px 110px',
                            padding: '12px 32px',
                            background: 'linear-gradient(90deg, rgba(0,122,255,0.25), rgba(88,86,214,0.15))',
                            borderBottom: '1px solid rgba(0,122,255,0.2)',
                        }}>
                            {['Descripción', 'Precio', 'Cant', 'SubTotal'].map((h, i) => (
                                <span key={h} style={{
                                    fontSize: '11px', fontWeight: 700, color: 'white',
                                    letterSpacing: '0.5px', textTransform: 'uppercase',
                                    textAlign: i > 0 ? 'right' : 'left',
                                }}>
                                    {h}
                                </span>
                            ))}
                        </div>

                        {/* Filas */}
                        {data.items.map((item, idx) => {
                            const total = lineTotal(item);
                            return (
                                <div key={idx} style={{
                                    display: 'grid', gridTemplateColumns: '1fr 100px 60px 110px',
                                    padding: '14px 32px',
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                    transition: 'background 0.15s',
                                }}>
                                    {/* Solo texto: sin miniatura junto a la descripción */}
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'white', lineHeight: 1.3 }}>
                                            {lineaPresupuestoTitulo(item.nombre)}
                                            {item.qty > 1 && (
                                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginLeft: '6px' }}>
                                                    (x{item.qty})
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', textAlign: 'right', alignSelf: 'center' }}>
                                        ${fmt(item.unitPrice)}
                                    </p>
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', textAlign: 'right', alignSelf: 'center' }}>
                                        {item.qty}
                                    </p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'white', textAlign: 'right', alignSelf: 'center' }}>
                                        ${fmt(total)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Footer: condiciones + totales ── */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr auto',
                        gap: '24px', padding: '24px 32px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(0,0,0,0.2)',
                    }}>
                        {/* Condiciones */}
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                CONDICIONES:
                            </p>
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: '380px' }}>
                                {PRESUPUESTO_BRAND.condicionesDefault.replace(/\s+/g, ' ').trim()}
                            </p>
                            {data.showZelle !== false && (
                                <>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px', marginTop: '12px', marginBottom: '4px' }}>
                                        MÉTODO DE PAGO:
                                    </p>
                                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                                        {textoMetodosPago()}
                                    </p>
                                </>
                            )}
                            <div style={{ marginTop: '12px' }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                    NOTAS / CONDICIONES DEL PRESUPUESTO
                                </p>
                                <textarea
                                    className="preview-notas-field"
                                    value={data.notas ?? ''}
                                    onChange={(e) => setNotasPresupuesto(e.target.value)}
                                    placeholder="Ej.: plazo de entrega, horario de instalación, exclusiones…"
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        maxWidth: '420px',
                                        boxSizing: 'border-box',
                                        fontSize: '11px',
                                        lineHeight: 1.6,
                                        color: 'rgba(255,255,255,0.85)',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        fontFamily: 'inherit',
                                        resize: 'vertical',
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Totales */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                            {[
                                { label: 'SUB-Total', value: `$${fmt(data.subtotal)}`, highlight: false },
                                { label: 'Descuento', value: `$${fmt(descuento)}`, highlight: false },
                                { label: 'Items', value: data.items.length.toString(), highlight: false },
                                { label: 'Artículos', value: totalItems.toString(), highlight: false },
                            ].map(row => (
                                <div key={row.label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '10px', padding: '10px 14px',
                                }}>
                                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{row.label}</span>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{row.value}</span>
                                </div>
                            ))}

                            {/* Total grande */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(52,199,89,0.2), rgba(52,199,89,0.08))',
                                border: '1px solid rgba(52,199,89,0.3)',
                                borderRadius: '12px', padding: '12px 14px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginTop: '4px',
                            }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#34C759' }}>TOTAL</span>
                                <span style={{ fontSize: '18px', fontWeight: 800, color: '#34C759' }}>${fmt(data.subtotal)}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Action Buttons Footer (Mobile Friendly) ── */}
                    <div className="no-print" style={{
                        padding: '24px 32px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        <button
                            onClick={() => window.print()}
                            style={{
                                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px', padding: '16px 12px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2">
                                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" rx="1" />
                            </svg>
                            Imprimir
                        </button>

                        <button
                            onClick={() => {
                                // Simple PDF trigger using print
                                window.print();
                            }}
                            style={{
                                background: 'rgba(255,149,0,0.15)', border: '1px solid rgba(255,149,0,0.3)',
                                borderRadius: '16px', padding: '16px 12px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                color: '#FF9500', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Descargar
                        </button>

                        <button
                            onClick={() => {
                                const notasWa2 = data.notas?.trim() ? `\n*Notas:* ${data.notas.trim()}\n` : '';
                                const text = `*PRESUPUESTO ${PRESUPUESTO_BRAND.nombreLegal}*\n\n*Nro:* ${data.numero}\n*Fecha:* ${data.fecha}\n*Cliente:* ${data.cliente} ${data.rif ? `(${data.rif})` : ''}${notasWa2}\n${data.items.map((i) => `• ${i.qty}x ${lineaPresupuestoTitulo(i.nombre)} — $${fmt(lineTotal(i))}`).join('\n')}\n\n*TOTAL: $${fmt(data.subtotal)}*`;
                                const phone = data.telefono ? data.telefono.replace(/\D/g, '') : '';
                                window.open(`https://wa.me/${phone.startsWith('58') ? phone : '58' + phone}?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            style={{
                                background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.3)',
                                borderRadius: '16px', padding: '16px 12px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                color: '#34C759', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.758.459 3.474 1.33 4.982L2 22l5.167-1.357a9.945 9.945 0 004.845 1.259h.004c5.507 0 9.99-4.478 9.991-9.984 0-2.667-1.037-5.176-2.922-7.062A9.92 9.92 0 0012.012 2z" />
                            </svg>
                            WhatsApp
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                /* Nunca mostrar fotos de producto dentro del documento (ni extensiones ni HTML residual). */
                .presupuesto-sin-fotos-producto img:not(.logo-casa-inteligente),
                .presupuesto-sin-fotos-producto picture {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: #0A0A0F !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { margin: 0; size: A4; }
                    textarea.preview-notas-field {
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                        resize: none !important;
                        color: rgba(255,255,255,0.45) !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
