'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Filter, Search, X } from 'lucide-react';
import type { PeriodoCompras } from '@/lib/contabilidad/comprasFiltros';
import type { FiltroFuenteCompra } from '@/lib/contabilidad/mapCanalPendienteCompra';
import type { EstadoLogisticaCompra } from '@/lib/contabilidad/estadoLogisticaCompra';
import { etiquetaEstadoLogistica } from '@/lib/contabilidad/estadoLogisticaCompra';
import {
    esProyectoSmartRrhhPorNombre,
    type ProyectoCatalogo,
} from '@/lib/proyectos/proyectosUnificados';
import type { ProveedorOpcion } from '@/lib/contabilidad/comprasQueryFiltros';

export type FiltroActivoChip = { id: string; label: string };

export function buildComprasFiltrosChips(input: {
    fuenteFiltro: FiltroFuenteCompra;
    periodo: PeriodoCompras;
    periodoLabel: string;
    proyectoFiltro: string;
    proyectoFiltroEtiqueta: string;
    entidadFiltro: string;
    entidadFiltroEtiqueta: string;
    proveedorFiltro: string;
    rifFiltro: string;
    articuloFiltro: string;
    busquedaAplicada: string;
    montoMinBs: string;
    montoMaxBs: string;
    montoMinUsd: string;
    montoMaxUsd: string;
    cantidadMin: string;
    cantidadMax: string;
    estadoLogisticaFiltro: EstadoLogisticaCompra | '';
}): FiltroActivoChip[] {
    const chips: FiltroActivoChip[] = [];
    if (input.fuenteFiltro !== 'todos') {
        chips.push({
            id: 'fuente',
            label: input.fuenteFiltro === 'telegram' ? 'Telegram' : 'App / recepción',
        });
    }
    if (input.periodo !== 'todas' && input.periodoLabel) {
        chips.push({ id: 'periodo', label: input.periodoLabel });
    }
    if (input.proyectoFiltro) {
        chips.push({ id: 'proyecto', label: input.proyectoFiltroEtiqueta });
    }
    if (input.entidadFiltro) {
        chips.push({ id: 'entidad', label: input.entidadFiltroEtiqueta });
    }
    if (input.proveedorFiltro) {
        chips.push({ id: 'proveedor', label: input.proveedorFiltro });
    }
    if (input.rifFiltro.trim()) {
        chips.push({ id: 'rif', label: `RIF ${input.rifFiltro.trim()}` });
    }
    if (input.articuloFiltro.trim()) {
        chips.push({ id: 'articulo', label: `Artículo: ${input.articuloFiltro.trim()}` });
    }
    if (input.busquedaAplicada) {
        chips.push({ id: 'busqueda', label: `«${input.busquedaAplicada}»` });
    }
    if (input.montoMinBs || input.montoMaxBs || input.montoMinUsd || input.montoMaxUsd) {
        chips.push({ id: 'monto', label: 'Monto' });
    }
    if (input.cantidadMin || input.cantidadMax) {
        chips.push({ id: 'cantidad', label: 'Cantidad' });
    }
    if (input.estadoLogisticaFiltro) {
        chips.push({
            id: 'logistica',
            label: etiquetaEstadoLogistica(input.estadoLogisticaFiltro),
        });
    }
    return chips;
}

const glass: React.CSSProperties = {
    background: 'rgba(28, 28, 30, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '12px 14px',
    color: 'white',
    fontWeight: 700,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
};

const inputMontoStyle: React.CSSProperties = {
    ...inputStyle,
    padding: '8px 10px',
    fontSize: '13px',
    borderRadius: '10px',
    minWidth: 0,
};

const periodBtn = (active: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: '12px',
    border: active ? '1px solid #5856D6' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(88,86,214,0.25)' : 'rgba(255,255,255,0.05)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
});

const sectionLabel: React.CSSProperties = {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '10px',
    fontWeight: 700,
    marginBottom: '8px',
};

const ESTADOS_LOGISTICA: { key: EstadoLogisticaCompra | ''; label: string }[] = [
    { key: '', label: 'Todos' },
    { key: 'registrada', label: 'Registrada' },
    { key: 'cuarentena', label: 'Tránsito' },
    { key: 'en_almacen_parcial', label: 'Almacén parcial' },
    { key: 'en_almacen', label: 'En almacén' },
    { key: 'rechazo_cuarentena', label: 'Rechazada' },
    { key: 'sin_documento', label: 'Sin documento' },
];

export type ComprasFiltrosValores = {
    fuenteFiltro: FiltroFuenteCompra;
    periodo: PeriodoCompras;
    fechaRefActiva: string;
    fechaDesde: string;
    fechaHasta: string;
    entidadFiltro: string;
    entidadFiltroEtiqueta: string;
    proyectoFiltro: string;
    proyectoFiltroEtiqueta: string;
    proveedorFiltro: string;
    rifFiltro: string;
    articuloFiltro: string;
    cantidadMin: string;
    cantidadMax: string;
    montoMinBs: string;
    montoMaxBs: string;
    montoMinUsd: string;
    montoMaxUsd: string;
    estadoLogisticaFiltro: EstadoLogisticaCompra | '';
    busqueda: string;
    busquedaAplicada: string;
};

type ProyectoOpcion = ProyectoCatalogo;

export type EntidadOpcion = { id: string; nombre: string };

function ProyectoSelectOptions({
    proyectos,
    entidadFiltro,
}: {
    proyectos: ProyectoOpcion[];
    entidadFiltro: string;
}) {
    const proyectosVisibles = React.useMemo(() => {
        if (!entidadFiltro || entidadFiltro === 'sin_entidad') return proyectos;
        return proyectos.filter((p) => p.entidad_id === entidadFiltro);
    }, [proyectos, entidadFiltro]);

    const proyectosPrincipales = proyectosVisibles.filter((p) => esProyectoSmartRrhhPorNombre(p.nombre));
    const proyectosResto = proyectosVisibles.filter((p) => !esProyectoSmartRrhhPorNombre(p.nombre));

    return (
        <>
            <option value="">Todas las obras</option>
            <option value="sin_proyecto">Sin proyecto asignado</option>
            {proyectosPrincipales.length > 0 ? (
                <optgroup label="Obras principales">
                    {proyectosPrincipales.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nombre}
                        </option>
                    ))}
                </optgroup>
            ) : null}
            {proyectosResto.length > 0 ? (
                <optgroup label="Otros proyectos">
                    {proyectosResto.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nombre}
                        </option>
                    ))}
                </optgroup>
            ) : null}
        </>
    );
}

/** Selectores siempre visibles: entidad y obra/proyecto. */
export function ComprasFiltrosSeleccionObra({
    entidades,
    proyectos,
    entidadFiltro,
    proyectoFiltro,
    proyectoFiltroEtiqueta,
    onEntidadChange,
    onProyectoChange,
    onAbrirMasFiltros,
    filtrosExtraCount = 0,
}: {
    entidades: EntidadOpcion[];
    proyectos: ProyectoOpcion[];
    entidadFiltro: string;
    proyectoFiltro: string;
    proyectoFiltroEtiqueta: string;
    onEntidadChange: (id: string) => void;
    onProyectoChange: (id: string) => void;
    onAbrirMasFiltros: () => void;
    filtrosExtraCount?: number;
}) {
    return (
        <div
            className="compras-no-imprimir"
            style={{
                ...glass,
                padding: '16px 18px',
                marginBottom: '16px',
                border: '1px solid rgba(88,86,214,0.35)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '12px',
                }}
            >
                <p style={{ color: 'white', fontSize: '13px', fontWeight: 800, margin: 0 }}>
                    Ver compras de…
                </p>
                <button
                    type="button"
                    onClick={onAbrirMasFiltros}
                    style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#c4b5fd',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(88,86,214,0.45)',
                        background: 'rgba(88,86,214,0.15)',
                        cursor: 'pointer',
                    }}
                >
                    Más filtros{filtrosExtraCount > 0 ? ` (${filtrosExtraCount})` : ''}
                </button>
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                }}
            >
                <div>
                    <label htmlFor="compras-filtro-entidad" style={sectionLabel}>
                        ENTIDAD / PATRONO
                    </label>
                    <select
                        id="compras-filtro-entidad"
                        value={entidadFiltro}
                        onChange={(e) => onEntidadChange(e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">Todas las entidades</option>
                        <option value="sin_entidad">Sin entidad asignada</option>
                        {entidades.map((e) => (
                            <option key={e.id} value={e.id}>
                                {e.nombre}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="compras-filtro-obra" style={sectionLabel}>
                        OBRA / PROYECTO
                    </label>
                    <select
                        id="compras-filtro-obra"
                        value={proyectoFiltro}
                        onChange={(e) => onProyectoChange(e.target.value)}
                        style={inputStyle}
                        aria-label="Filtrar compras por obra o proyecto"
                    >
                        <ProyectoSelectOptions proyectos={proyectos} entidadFiltro={entidadFiltro} />
                    </select>
                </div>
            </div>
            {proyectoFiltro ? (
                <p style={{ color: '#5856D6', fontSize: '11px', fontWeight: 700, marginTop: '10px', marginBottom: 0 }}>
                    Mostrando compras de: {proyectoFiltroEtiqueta}
                </p>
            ) : entidadFiltro ? (
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', marginTop: '10px', marginBottom: 0 }}>
                    Elija una obra para acotar el cuadro (p. ej. Rancho Flamboyant).
                </p>
            ) : (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '10px', marginBottom: 0 }}>
                    Elija entidad y obra para filtrar. Deje «Todas las obras» para ver todo el cuadro.
                </p>
            )}
        </div>
    );
}

export function ComprasFiltrosActivosBar({
    chips,
    onAbrirFiltros,
    onLimpiarTodos,
    onQuitarChip,
}: {
    chips: FiltroActivoChip[];
    onAbrirFiltros: () => void;
    onLimpiarTodos: () => void;
    onQuitarChip: (id: string) => void;
}) {
    if (!chips.length) return null;
    return (
        <div
            className="compras-no-imprimir"
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '14px',
                border: '1px solid rgba(88,86,214,0.25)',
                background: 'rgba(88,86,214,0.08)',
            }}
        >
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', fontWeight: 800 }}>
                Filtros:
            </span>
            {chips.map((chip) => (
                <button
                    key={chip.id}
                    type="button"
                    onClick={() => onQuitarChip(chip.id)}
                    title="Quitar filtro"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '8px',
                        background: 'rgba(88,86,214,0.2)',
                        color: '#c4b5fd',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    {chip.label}
                    <X size={11} aria-hidden />
                </button>
            ))}
            <button
                type="button"
                onClick={onAbrirFiltros}
                style={{
                    marginLeft: 'auto',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(88,86,214,0.45)',
                    background: 'transparent',
                    color: '#a78bfa',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                }}
            >
                Editar
            </button>
            <button
                type="button"
                onClick={onLimpiarTodos}
                style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                }}
            >
                Limpiar
            </button>
        </div>
    );
}

export default function ComprasFiltrosPanel({
    valores,
    entidades,
    proyectos,
    proveedores,
    fuenteFiltro,
    periodo,
    periodoLabel,
    onClose,
    onLimpiarTodos,
    setFuenteFiltro,
    setPeriodo,
    setFechaRef,
    setFechaDesde,
    setFechaHasta,
    setEntidadFiltro,
    setProyectoFiltro,
    setProveedorFiltro,
    setRifFiltro,
    setArticuloFiltro,
    setCantidadMin,
    setCantidadMax,
    setMontoMinBs,
    setMontoMaxBs,
    setMontoMinUsd,
    setMontoMaxUsd,
    setEstadoLogisticaFiltro,
    setBusqueda,
}: {
    valores: ComprasFiltrosValores;
    entidades: EntidadOpcion[];
    proyectos: ProyectoOpcion[];
    proveedores: ProveedorOpcion[];
    fuenteFiltro: FiltroFuenteCompra;
    periodo: PeriodoCompras;
    periodoLabel: string;
    onClose: () => void;
    onLimpiarTodos: () => void;
    setFuenteFiltro: (v: FiltroFuenteCompra) => void;
    setPeriodo: (v: PeriodoCompras) => void;
    setFechaRef: (v: string) => void;
    setFechaDesde: (v: string) => void;
    setFechaHasta: (v: string) => void;
    setEntidadFiltro: (v: string) => void;
    setProyectoFiltro: (v: string) => void;
    setProveedorFiltro: (v: string) => void;
    setRifFiltro: (v: string) => void;
    setArticuloFiltro: (v: string) => void;
    setCantidadMin: (v: string) => void;
    setCantidadMax: (v: string) => void;
    setMontoMinBs: (v: string) => void;
    setMontoMaxBs: (v: string) => void;
    setMontoMinUsd: (v: string) => void;
    setMontoMaxUsd: (v: string) => void;
    setEstadoLogisticaFiltro: (v: EstadoLogisticaCompra | '') => void;
    setBusqueda: (v: string) => void;
}) {
    const router = useRouter();
    const {
        fechaRefActiva,
        fechaDesde,
        fechaHasta,
        entidadFiltro,
        entidadFiltroEtiqueta,
        proyectoFiltro,
        proyectoFiltroEtiqueta,
    } = valores;

    return (
        <div className="compras-no-imprimir" style={{ ...glass, padding: '20px', marginBottom: '16px' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginBottom: '14px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} style={{ color: '#5856D6' }} />
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: 800, margin: 0 }}>
                        FILTROS
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                        type="button"
                        onClick={onLimpiarTodos}
                        style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        Limpiar todo
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(88,86,214,0.45)',
                            background: 'rgba(88,86,214,0.2)',
                            color: '#c4b5fd',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>

            <p style={sectionLabel}>ENTIDAD / PATRONO</p>
            <div style={{ marginBottom: '16px' }}>
                <select
                    value={entidadFiltro}
                    onChange={(e) => setEntidadFiltro(e.target.value)}
                    style={inputStyle}
                    aria-label="Filtrar por entidad o patrono"
                >
                    <option value="">Todas las entidades</option>
                    <option value="sin_entidad">Sin entidad asignada</option>
                    {entidades.map((e) => (
                        <option key={e.id} value={e.id}>
                            {e.nombre}
                        </option>
                    ))}
                </select>
                {entidadFiltro ? (
                    <p style={{ color: '#5856D6', fontSize: '11px', fontWeight: 700, marginTop: '8px' }}>
                        {entidadFiltroEtiqueta}
                    </p>
                ) : null}
            </div>

            <p style={sectionLabel}>OBRA / PROYECTO</p>
            <div style={{ marginBottom: '16px' }}>
                <select
                    value={proyectoFiltro}
                    onChange={(e) => setProyectoFiltro(e.target.value)}
                    style={inputStyle}
                    aria-label="Filtrar por proyecto u obra"
                >
                    <ProyectoSelectOptions proyectos={proyectos} entidadFiltro={entidadFiltro} />
                </select>
                {proyectoFiltro ? (
                    <p style={{ color: '#5856D6', fontSize: '11px', fontWeight: 700, marginTop: '8px' }}>
                        {proyectoFiltroEtiqueta}
                    </p>
                ) : null}
            </div>

            <p style={sectionLabel}>PERÍODO</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {(
                    [
                        ['todas', 'Todas'],
                        ['dia', 'Día'],
                        ['semana', 'Semana'],
                        ['mes', 'Mes'],
                        ['rango', 'Rango'],
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        style={periodBtn(periodo === key)}
                        onClick={() => setPeriodo(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {periodo === 'dia' || periodo === 'semana' || periodo === 'mes' ? (
                <div style={{ marginBottom: '16px' }}>
                    <label style={sectionLabel}>
                        {periodo === 'dia' ? 'FECHA' : periodo === 'semana' ? 'SEMANA DEL' : 'MES DE'}
                    </label>
                    <input
                        type="date"
                        value={fechaRefActiva}
                        onChange={(e) => setFechaRef(e.target.value)}
                        suppressHydrationWarning
                        style={{ ...inputStyle, marginTop: '6px' }}
                    />
                </div>
            ) : null}

            {periodo === 'rango' ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginBottom: '16px',
                    }}
                >
                    <div>
                        <label style={sectionLabel}>DESDE</label>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                            style={{ ...inputStyle, marginTop: '6px' }}
                        />
                    </div>
                    <div>
                        <label style={sectionLabel}>HASTA</label>
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={(e) => setFechaHasta(e.target.value)}
                            style={{ ...inputStyle, marginTop: '6px' }}
                        />
                    </div>
                </div>
            ) : null}

            <p style={sectionLabel}>PROVEEDOR</p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '16px',
                }}
            >
                <div>
                    <select
                        value={valores.proveedorFiltro}
                        onChange={(e) => setProveedorFiltro(e.target.value)}
                        style={inputStyle}
                        aria-label="Proveedor"
                    >
                        <option value="">Todos</option>
                        {proveedores.map((p) => (
                            <option key={p.nombre} value={p.nombre}>
                                {p.nombre}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <input
                        type="search"
                        value={valores.rifFiltro}
                        onChange={(e) => setRifFiltro(e.target.value)}
                        placeholder="RIF proveedor"
                        style={inputStyle}
                        aria-label="RIF"
                    />
                </div>
            </div>

            <p style={sectionLabel}>PRODUCTO / ARTÍCULO</p>
            <div style={{ marginBottom: '10px' }}>
                <input
                    type="search"
                    value={valores.articuloFiltro}
                    onChange={(e) => setArticuloFiltro(e.target.value)}
                    placeholder="Descripción o código SAP"
                    style={inputStyle}
                />
            </div>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    marginBottom: '16px',
                }}
            >
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Cant. mín."
                    value={valores.cantidadMin}
                    onChange={(e) => setCantidadMin(e.target.value)}
                    style={inputMontoStyle}
                />
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Cant. máx."
                    value={valores.cantidadMax}
                    onChange={(e) => setCantidadMax(e.target.value)}
                    style={inputMontoStyle}
                />
            </div>

            <p style={sectionLabel}>MONTO TOTAL</p>
            <p
                style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: '10px',
                    margin: '-4px 0 8px',
                }}
            >
                Bolívares
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    marginBottom: '10px',
                }}
            >
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Mín. Bs"
                    value={valores.montoMinBs}
                    onChange={(e) => setMontoMinBs(e.target.value)}
                    style={inputMontoStyle}
                />
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Máx. Bs"
                    value={valores.montoMaxBs}
                    onChange={(e) => setMontoMaxBs(e.target.value)}
                    style={inputMontoStyle}
                />
            </div>
            <p
                style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: '10px',
                    margin: '0 0 8px',
                }}
            >
                Dólares (equivalente)
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    marginBottom: '16px',
                }}
            >
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Mín. USD"
                    value={valores.montoMinUsd}
                    onChange={(e) => setMontoMinUsd(e.target.value)}
                    style={inputMontoStyle}
                />
                <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Máx. USD"
                    value={valores.montoMaxUsd}
                    onChange={(e) => setMontoMaxUsd(e.target.value)}
                    style={inputMontoStyle}
                />
            </div>

            <p style={sectionLabel}>ESTADO LOGÍSTICO</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {ESTADOS_LOGISTICA.map(({ key, label }) => (
                    <button
                        key={key || 'todos'}
                        type="button"
                        style={periodBtn(valores.estadoLogisticaFiltro === key)}
                        onClick={() => setEstadoLogisticaFiltro(key)}
                    >
                        {key ? etiquetaEstadoLogistica(key) : label}
                    </button>
                ))}
            </div>

            <p style={sectionLabel}>ORIGEN</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {(
                    [
                        ['todos', 'Todas'],
                        ['app', 'App / recepción'],
                        ['telegram', 'Telegram'],
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => {
                            setFuenteFiltro(key);
                            router.replace(
                                key === 'todos'
                                    ? '/contabilidad/compras'
                                    : `/contabilidad/compras?fuente=${key}`,
                            );
                        }}
                        style={periodBtn(fuenteFiltro === key)}
                    >
                        {label}
                    </button>
                ))}
                <Link
                    href="/contabilidad/compras/canal"
                    style={{
                        ...periodBtn(false),
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                    }}
                >
                    Cola Telegram
                </Link>
            </div>

            <p style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search size={12} /> BÚSQUEDA RÁPIDA
            </p>
            <input
                type="search"
                value={valores.busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nº factura, proveedor, RIF, monto…"
                style={inputStyle}
            />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', marginTop: '8px', lineHeight: 1.4 }}>
                Complementa los filtros anteriores. Los cambios se aplican al escribir.
            </p>

            {periodoLabel || valores.busquedaAplicada ? (
                <p style={{ color: '#5856D6', fontSize: '11px', fontWeight: 700, marginTop: '14px' }}>
                    {periodoLabel ? `Período: ${periodoLabel}` : ''}
                    {periodoLabel && valores.busquedaAplicada ? ' · ' : ''}
                    {valores.busquedaAplicada ? `Búsqueda: «${valores.busquedaAplicada}»` : ''}
                </p>
            ) : null}
        </div>
    );
}
