'use client';

import { useEffect, type CSSProperties } from 'react';

type ClasificacionPresupuesto =
    | 'no_enviado'
    | 'enviado'
    | 'aprobado'
    | 'no_aprobado'
    | 'cobrado'
    | 'parcialmente_pagado'
    | 'pagado';

type SortBy = 'fecha' | 'status' | 'nomenclatura';

const CLASIFICACION_LABELS: Record<ClasificacionPresupuesto, string> = {
    no_enviado: 'No enviado',
    enviado: 'Enviado',
    aprobado: 'Aprobado',
    no_aprobado: 'No aprobado',
    cobrado: 'Por Pagar',
    parcialmente_pagado: 'Parcial',
    pagado: 'Pagado',
};

type Props = {
    open: boolean;
    onClose: () => void;
    filter: 'todos' | ClasificacionPresupuesto;
    onFilterChange: (f: 'todos' | ClasificacionPresupuesto) => void;
    sortBy: SortBy;
    onSortByChange: (s: SortBy) => void;
    filtroNombre: string;
    onFiltroNombreChange: (v: string) => void;
    filtroRif: string;
    onFiltroRifChange: (v: string) => void;
    filtroNumero: string;
    onFiltroNumeroChange: (v: string) => void;
    filtroFechaDesde: string;
    onFiltroFechaDesdeChange: (v: string) => void;
    filtroFechaHasta: string;
    onFiltroFechaHastaChange: (v: string) => void;
    hayFiltrosActivos: boolean;
    onLimpiar: () => void;
    panelStyle: CSSProperties;
    inputStyle: CSSProperties;
    labelStyle: CSSProperties;
};

export default function PresupuestosFiltrosModal({
    open,
    onClose,
    filter,
    onFilterChange,
    sortBy,
    onSortByChange,
    filtroNombre,
    onFiltroNombreChange,
    filtroRif,
    onFiltroRifChange,
    filtroNumero,
    onFiltroNumeroChange,
    filtroFechaDesde,
    onFiltroFechaDesdeChange,
    filtroFechaHasta,
    onFiltroFechaHastaChange,
    hayFiltrosActivos,
    onLimpiar,
    panelStyle,
    inputStyle,
    labelStyle,
}: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="presentation"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: 'rgba(15,23,42,0.45)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                padding: '16px',
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="filtros-presupuestos-titulo"
                onClick={(e) => e.stopPropagation()}
                style={{
                    ...panelStyle,
                    width: '100%',
                    maxWidth: '480px',
                    maxHeight: 'min(85vh, 640px)',
                    overflowY: 'auto',
                    padding: '18px',
                    marginBottom: 'env(safe-area-inset-bottom, 0)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 id="filtros-presupuestos-titulo" style={{ color: '#0F172A', fontSize: '18px', fontWeight: 800, margin: 0 }}>
                        Filtrar y ordenar
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar filtros"
                        style={{
                            background: '#F1F5F9',
                            color: '#64748B',
                            border: 'none',
                            borderRadius: '10px',
                            width: '36px',
                            height: '36px',
                            fontSize: '18px',
                            cursor: 'pointer',
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                    <div>
                        <label style={labelStyle}>Cliente</label>
                        <input
                            type="text"
                            placeholder="Nombre del cliente"
                            value={filtroNombre}
                            onChange={(e) => onFiltroNombreChange(e.target.value)}
                            style={inputStyle}
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Identificación</label>
                        <input
                            type="text"
                            placeholder="RIF / cédula / ID"
                            value={filtroRif}
                            onChange={(e) => onFiltroRifChange(e.target.value)}
                            style={inputStyle}
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Número de presupuesto</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Ej. 565 o P-565"
                            value={filtroNumero}
                            onChange={(e) => onFiltroNumeroChange(e.target.value)}
                            style={inputStyle}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <p style={{ ...labelStyle, marginBottom: '8px' }}>Fecha y lapso</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                        <label style={labelStyle}>Desde</label>
                        <input
                            type="date"
                            value={filtroFechaDesde}
                            onChange={(e) => onFiltroFechaDesdeChange(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Hasta</label>
                        <input
                            type="date"
                            value={filtroFechaHasta}
                            min={filtroFechaDesde || undefined}
                            onChange={(e) => onFiltroFechaHastaChange(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                </div>

                <label style={labelStyle}>Ordenar por</label>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '6px',
                        marginBottom: '14px',
                        width: '100%',
                    }}
                >
                    {(
                        [
                            { id: 'fecha', label: 'Fecha' },
                            { id: 'status', label: 'Status' },
                            { id: 'nomenclatura', label: 'Número' },
                        ] as const
                    ).map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onSortByChange(opt.id)}
                            style={{
                                flex: '1 1 0',
                                width: 0,
                                minWidth: 0,
                                background: sortBy === opt.id ? '#DBEAFE' : '#F8FAFC',
                                color: sortBy === opt.id ? '#007AFF' : '#475569',
                                border: sortBy === opt.id ? '1px solid rgba(0,122,255,0.35)' : '1px solid #E2E8F0',
                                borderRadius: '999px',
                                padding: '8px 6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <label style={labelStyle}>Status</label>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        marginBottom: '18px',
                        width: '100%',
                    }}
                >
                    {([
                        ['todos', 'no_enviado', 'enviado', 'aprobado'],
                        ['no_aprobado', 'cobrado', 'parcialmente_pagado', 'pagado'],
                    ] as const).map((row, rowIdx) => (
                        <div
                            key={rowIdx}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '6px',
                                width: '100%',
                                minWidth: 0,
                            }}
                        >
                            {row.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => onFilterChange(f)}
                                    style={{
                                        flex: '1 1 0',
                                        width: 0,
                                        minWidth: 0,
                                        boxSizing: 'border-box',
                                        background: filter === f ? '#DBEAFE' : '#F8FAFC',
                                        color: filter === f ? '#007AFF' : '#475569',
                                        border: filter === f ? '1px solid rgba(0,122,255,0.35)' : '1px solid #E2E8F0',
                                        borderRadius: '999px',
                                        padding: '8px 4px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        lineHeight: 1.15,
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {f === 'todos' ? 'Todos' : CLASIFICACION_LABELS[f]}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {hayFiltrosActivos ? (
                        <button
                            type="button"
                            onClick={onLimpiar}
                            style={{
                                flex: 1,
                                background: '#F8FAFC',
                                color: '#475569',
                                border: '1px solid #E2E8F0',
                                borderRadius: '12px',
                                padding: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Limpiar
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            flex: 1,
                            background: '#007AFF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '12px',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
}
