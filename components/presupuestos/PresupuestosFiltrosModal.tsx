'use client';

import { useEffect, type CSSProperties } from 'react';

type ClasificacionPresupuesto =
    | 'no_enviado'
    | 'enviado'
    | 'aprobado'
    | 'no_aprobado'
    | 'cobrado'
    | 'pagado';

const CLASIFICACION_LABELS: Record<ClasificacionPresupuesto, string> = {
    no_enviado: 'No enviado',
    enviado: 'Enviado',
    aprobado: 'Aprobado',
    no_aprobado: 'No aprobado',
    cobrado: 'Cobrado',
    pagado: 'Pagado',
};

type Props = {
    open: boolean;
    onClose: () => void;
    filter: 'todos' | ClasificacionPresupuesto;
    onFilterChange: (f: 'todos' | ClasificacionPresupuesto) => void;
    filtroNombre: string;
    onFiltroNombreChange: (v: string) => void;
    filtroRif: string;
    onFiltroRifChange: (v: string) => void;
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
    filtroNombre,
    onFiltroNombreChange,
    filtroRif,
    onFiltroRifChange,
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
                background: 'rgba(0,0,0,0.65)',
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
                    <h2 id="filtros-presupuestos-titulo" style={{ color: 'white', fontSize: '18px', fontWeight: 800, margin: 0 }}>
                        Filtrar presupuestos
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar filtros"
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.7)',
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
                        <label style={labelStyle}>Nombre / cliente</label>
                        <input
                            type="text"
                            placeholder="Ej. María Pérez"
                            value={filtroNombre}
                            onChange={(e) => onFiltroNombreChange(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>RIF</label>
                        <input
                            type="text"
                            placeholder="Ej. J-12345678"
                            value={filtroRif}
                            onChange={(e) => onFiltroRifChange(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div>
                        <label style={labelStyle}>Fecha desde</label>
                        <input
                            type="date"
                            value={filtroFechaDesde}
                            onChange={(e) => onFiltroFechaDesdeChange(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Fecha hasta</label>
                        <input
                            type="date"
                            value={filtroFechaHasta}
                            min={filtroFechaDesde || undefined}
                            onChange={(e) => onFiltroFechaHastaChange(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                </div>

                <label style={labelStyle}>Clasificación</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
                    {(['todos', 'no_enviado', 'enviado', 'aprobado', 'no_aprobado', 'cobrado', 'pagado'] as const).map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => onFilterChange(f)}
                            style={{
                                background: filter === f ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.04)',
                                color: filter === f ? '#007AFF' : 'rgba(255,255,255,0.55)',
                                border: filter === f ? '1px solid rgba(0,122,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '999px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {f === 'todos' ? 'Todos' : CLASIFICACION_LABELS[f]}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {hayFiltrosActivos ? (
                        <button
                            type="button"
                            onClick={onLimpiar}
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.06)',
                                color: 'rgba(255,255,255,0.75)',
                                border: '1px solid rgba(255,255,255,0.12)',
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
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
