'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type {
    FilaEgresoObra,
    FilaIngresoEntidad,
    ResumenBalanceContabilidad,
} from '@/lib/contabilidad/resumenBalanceContabilidad';

type ModuloContabilidad = {
    title: string;
    description: string;
    icon: string;
    href: string;
    color: string;
    active: boolean;
};

function fmtUsd(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtUsdCompact(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return fmtUsd(n);
}

function etiquetaMes(fechaDesde: string): string {
    try {
        const d = new Date(`${fechaDesde}T12:00:00`);
        return d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
    } catch {
        return 'mes actual';
    }
}

function FilaDesglose({
    nombre,
    montoUsd,
    count,
    href,
    color,
}: {
    nombre: string;
    montoUsd: number;
    count: number;
    href?: string;
    color: string;
}) {
    const inner = (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                cursor: href ? 'pointer' : 'default',
            }}
        >
            <div style={{ minWidth: 0, flex: 1 }}>
                <p
                    style={{
                        color: 'rgba(255,255,255,0.85)',
                        fontSize: '12px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {nombre}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>
                    {count} {count === 1 ? 'movimiento' : 'movimientos'}
                </p>
            </div>
            <span style={{ color, fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                {fmtUsdCompact(montoUsd)}
            </span>
        </div>
    );

    if (href) {
        return (
            <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
                {inner}
            </Link>
        );
    }
    return inner;
}

function PanelDesglose({
    titulo,
    subtitulo,
    color,
    filas,
    vacio,
    verMasHref,
    renderHref,
}: {
    titulo: string;
    subtitulo: string;
    color: string;
    filas: Array<FilaIngresoEntidad | FilaEgresoObra>;
    vacio: string;
    verMasHref?: string;
    renderHref?: (fila: FilaIngresoEntidad | FilaEgresoObra) => string | undefined;
}) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '16px' }}>
            <div style={{ marginBottom: '10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700 }}>{titulo}</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px' }}>{subtitulo}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {filas.length === 0 ? (
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', padding: '8px 4px' }}>{vacio}</p>
                ) : (
                    filas.slice(0, 6).map((f) => {
                        const esObra = 'proyecto_id' in f;
                        const nombre = esObra
                            ? (f as FilaEgresoObra).proyecto_nombre
                            : (f as FilaIngresoEntidad).entidad_nombre;
                        const key = esObra
                            ? (f as FilaEgresoObra).proyecto_id
                            : (f as FilaIngresoEntidad).entidad_id;
                        return (
                            <FilaDesglose
                                key={key}
                                nombre={nombre}
                                montoUsd={f.total_usd}
                                count={f.count}
                                color={color}
                                href={renderHref?.(f)}
                            />
                        );
                    })
                )}
            </div>
            {verMasHref && filas.length > 0 ? (
                <Link
                    href={verMasHref}
                    style={{
                        display: 'inline-block',
                        marginTop: '8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.45)',
                        textDecoration: 'none',
                    }}
                >
                    Ver detalle →
                </Link>
            ) : null}
        </div>
    );
}

export default function ContabilidadPage() {
    const glass = {
        background: 'rgba(28, 28, 30, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
    };

    const [balance, setBalance] = useState<ResumenBalanceContabilidad | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(true);
    const [errorBalance, setErrorBalance] = useState<string | null>(null);

    const cargarBalance = useCallback(async () => {
        setLoadingBalance(true);
        setErrorBalance(null);
        try {
            const res = await fetch('/api/contabilidad/balance-mensual', { cache: 'no-store' });
            const json = (await res.json()) as ResumenBalanceContabilidad & { ok?: boolean; error?: string };
            if (!res.ok || json.ok === false) {
                throw new Error(json.error ?? 'No se pudo cargar el balance');
            }
            setBalance(json);
        } catch (e) {
            setErrorBalance(e instanceof Error ? e.message : 'Error al cargar balance');
            setBalance(null);
        } finally {
            setLoadingBalance(false);
        }
    }, []);

    useEffect(() => {
        void cargarBalance();
    }, [cargarBalance]);

    const modules: ModuloContabilidad[] = [
        {
            title: 'CCO Obra',
            description: 'Libro maestro · KPIs y gráficos V4',
            icon: '📒',
            href: '/contabilidad/cco',
            color: '#2563EB',
            active: true,
        },
        {
            title: 'Procuras',
            description: 'Gestión de abastecimiento y pedidos',
            icon: '📦',
            href: '/contabilidad/procuras',
            color: '#FF3B30',
            active: true,
        },
        {
            title: 'Compras',
            description: 'Registro de facturas y egresos',
            icon: '🛒',
            href: '/contabilidad/compras',
            color: '#5856D6',
            active: true,
        },
        {
            title: 'Gastos entidad',
            description: 'OpEx del patrono por tipo y periodo',
            icon: '🏢',
            href: '/contabilidad/gastos-entidad',
            color: '#AF52DE',
            active: true,
        },
        {
            title: 'Registro de facturas',
            description: 'Ingreso de facturas de proveedor (IA o manual)',
            icon: '📄',
            href: '#',
            color: '#10B981',
            active: false,
        },
        {
            title: 'Facturación',
            description: 'Emisión y control de facturas de venta',
            icon: '🧾',
            href: '#',
            color: '#007AFF',
            active: false,
        },
        {
            title: 'Inyecciones de capital',
            description: 'Auditoría: transferencias y efectivo en patio',
            icon: '💰',
            href: '/contabilidad/inyecciones',
            color: '#FF9500',
            active: true,
        },
        {
            title: 'Tesorería',
            description: 'Manejo de flujo de caja y bancos',
            icon: '🏦',
            href: '#',
            color: '#34C759',
            active: false,
        },
        {
            title: 'Nómina e impuestos',
            description: 'Pagos de personal y obligaciones tributarias',
            icon: '👥',
            href: '#',
            color: '#AF52DE',
            active: false,
        },
        {
            title: 'Auditoría interna',
            description: 'Control y cumplimiento',
            icon: '🔍',
            href: '#',
            color: '#8E8E93',
            active: false,
        },
        {
            title: 'Reportes',
            description: 'Análisis financiero detallado',
            icon: '📊',
            href: '#',
            color: '#5AC8FA',
            active: false,
        },
    ];

    function ModuloCard({ m }: { m: ModuloContabilidad }) {
        const card = (
            <div
                style={{
                    ...glass,
                    padding: '20px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    border: m.active ? `1px solid ${m.color}55` : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: m.active ? `0 4px 20px ${m.color}25` : 'none',
                    opacity: m.active ? 1 : 0.58,
                    cursor: m.active ? 'pointer' : 'default',
                    filter: m.active ? 'none' : 'grayscale(0.2) saturate(0.85)',
                    pointerEvents: m.active ? 'auto' : 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <span
                        style={{
                            fontSize: '32px',
                            marginBottom: '4px',
                            lineHeight: 1,
                            opacity: m.active ? 1 : 0.88,
                        }}
                    >
                        {m.icon}
                    </span>
                    {!m.active ? (
                        <span
                            style={{
                                fontSize: '9px',
                                fontWeight: 800,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: 'rgba(255,255,255,0.45)',
                                background: 'rgba(255,255,255,0.07)',
                                padding: '4px 8px',
                                borderRadius: '999px',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Próximamente
                        </span>
                    ) : null}
                </div>
                <div>
                    <h4
                        style={{
                            color: m.active ? 'white' : 'rgba(255,255,255,0.72)',
                            fontSize: '17px',
                            fontWeight: 700,
                            marginBottom: '4px',
                        }}
                    >
                        {m.title}
                    </h4>
                    <p
                        style={{
                            color: m.active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.38)',
                            fontSize: '11px',
                            lineHeight: '1.3',
                        }}
                    >
                        {m.description}
                    </p>
                </div>
            </div>
        );

        if (!m.active) {
            return (
                <div aria-disabled="true" title="Módulo no disponible aún">
                    {card}
                </div>
            );
        }

        return (
            <Link href={m.href} style={{ textDecoration: 'none' }}>
                {card}
            </Link>
        );
    }

    const balanceUsd = balance?.balanceUsd ?? 0;
    const balancePositivo = balanceUsd >= 0;

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
                }}
            >
                <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 800 }}>Contabilidad</h1>
            </div>

            <div style={{ padding: '20px' }}>
                <Link
                    href="/contabilidad/cco"
                    style={{
                        display: 'block',
                        textDecoration: 'none',
                        marginBottom: '16px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: '1px solid rgba(37,99,235,0.45)',
                        background: 'linear-gradient(135deg, rgba(37,99,235,0.22) 0%, rgba(0,0,0,0) 100%)',
                    }}
                >
                    <p
                        style={{
                            color: '#93C5FD',
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            marginBottom: '4px',
                        }}
                    >
                        Principal · CCO V4
                    </p>
                    <p style={{ color: 'white', fontSize: '15px', fontWeight: 700 }}>
                        Control Contable de Obra
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: '2px' }}>
                        KPIs BCV/Real, gráficos y menú como tu sistema · datos vivos →
                    </p>
                </Link>

                <div
                    style={{
                        ...glass,
                        padding: '24px',
                        marginBottom: '24px',
                        background: 'linear-gradient(135deg, rgba(88,86,214,0.1) 0%, rgba(0,0,0,0) 100%)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '16px',
                            gap: '12px',
                        }}
                    >
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 600 }}>
                                BALANCE MENSUAL
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '2px' }}>
                                {balance ? etiquetaMes(balance.fechaDesde) : 'Cargando…'}
                            </p>
                            {loadingBalance ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                    <Loader2 size={20} color="#5856D6" className="animate-spin" />
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Calculando…</span>
                                </div>
                            ) : (
                                <h2 style={{ color: 'white', fontSize: '32px', fontWeight: 800, marginTop: '4px' }}>
                                    {fmtUsd(balanceUsd)}
                                </h2>
                            )}
                        </div>
                        {!loadingBalance && balance ? (
                            <div
                                style={{
                                    background: balancePositivo ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.12)',
                                    color: balancePositivo ? '#34C759' : '#FF3B30',
                                    padding: '6px 12px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textAlign: 'right',
                                    lineHeight: 1.4,
                                }}
                            >
                                Ingresos − Egresos
                                <br />
                                <span style={{ opacity: 0.85 }}>
                                    {fmtUsdCompact(balance.totalIngresosUsd)} −{' '}
                                    {fmtUsdCompact(balance.totalEgresosUsd)}
                                </span>
                            </div>
                        ) : null}
                    </div>

                    {errorBalance ? (
                        <p style={{ color: '#FF9500', fontSize: '12px', marginBottom: '12px' }}>{errorBalance}</p>
                    ) : null}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <PanelDesglose
                            titulo="INGRESOS"
                            subtitulo={
                                balance?.countInyecciones
                                    ? `Inyecciones de capital · ${balance.countInyecciones} en el mes`
                                    : 'Inyecciones de capital · por entidad'
                            }
                            color="#34C759"
                            filas={balance?.ingresosPorEntidad ?? []}
                            vacio="Sin inyecciones este mes"
                            verMasHref="/contabilidad/inyecciones"
                        />
                        <PanelDesglose
                            titulo="EGRESOS"
                            subtitulo="Compras imputadas · por obra"
                            color="#FF3B30"
                            filas={balance?.egresosPorObra ?? []}
                            vacio="Sin compras de obra este mes"
                            verMasHref="/contabilidad/compras?periodo=mes"
                            renderHref={(f) => {
                                const obra = f as FilaEgresoObra;
                                return `/contabilidad/compras?proyecto=${encodeURIComponent(obra.proyecto_id)}&periodo=mes`;
                            }}
                        />
                    </div>
                </div>

                <h3
                    style={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '14px',
                        fontWeight: 700,
                        marginBottom: '16px',
                        marginLeft: '4px',
                    }}
                >
                    MÓDULOS
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {modules.map((m) => (
                        <ModuloCard key={m.title} m={m} />
                    ))}
                </div>
            </div>
        </div>
    );
}
