'use client';

import Link from 'next/link';
import { useState } from 'react';

type ClienteStatus = 'activo' | 'inactivo' | 'pendiente';
type ClienteTipo = 'V' | 'J' | 'E';
type ClienteCategoria = 'personal' | 'empresa';

interface Cliente {
    id: string;
    nombre: string;
    rif: string;
    tipo: ClienteTipo;
    categoria: ClienteCategoria;
    status: ClienteStatus;
    email: string;
    telefono: string;
    movil?: string;
    direccion?: string;
    initials: string;
    color: string;
    imagen?: string;
}

const statusConfig: Record<ClienteStatus, { label: string; dot: string; bg: string; text: string }> = {
    activo: { label: 'Activo', dot: '#34C759', bg: 'rgba(52,199,89,0.10)', text: '#1A7F3C' },
    inactivo: { label: 'Inactivo', dot: '#FF3B30', bg: 'rgba(255,59,48,0.10)', text: '#C0392B' },
    pendiente: { label: 'Pendiente', dot: '#FF9500', bg: 'rgba(255,149,0,0.10)', text: '#B8620A' },
};

const tipoConfig: Record<ClienteTipo, { bg: string; text: string; border: string }> = {
    V: { bg: 'rgba(0,122,255,0.10)', text: '#007AFF', border: 'rgba(0,122,255,0.25)' },
    J: { bg: 'rgba(255,149,0,0.10)', text: '#B8620A', border: 'rgba(255,149,0,0.25)' },
    E: { bg: 'rgba(52,199,89,0.10)', text: '#1A7F3C', border: 'rgba(52,199,89,0.25)' },
};

function AvatarCircle({ initials, color, categoria, imagen }: { initials: string; color: string; categoria: ClienteCategoria; imagen?: string }) {
    return (
        <div className="relative flex-shrink-0" style={{ width: '54px', height: '54px' }}>
            <div className="absolute inset-0 rounded-full" style={{ background: `${color}20`, transform: 'scale(1.08)' }} />
            <div
                className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${color}CC, ${color}88)`, boxShadow: `0 4px 12px ${color}40` }}
            >
                {imagen ? (
                    <img src={imagen} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : categoria === 'empresa' ? (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <rect x="3" y="8" width="16" height="12" rx="2" stroke="white" strokeWidth="1.6" fill="rgba(255,255,255,0.2)" />
                        <path d="M7 8V6a4 4 0 018 0v2" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                        <rect x="9" y="12" width="4" height="4" rx="1" fill="white" />
                    </svg>
                ) : (
                    <span className="font-bold text-white" style={{ fontSize: '18px', letterSpacing: '-0.02em' }}>
                        {initials}
                    </span>
                )}
            </div>
            <div
                className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
                style={{ width: '14px', height: '14px', background: categoria === 'empresa' ? '#FF9500' : '#007AFF' }}
            />
        </div>
    );
}

// ── Mini tarjeta modal ──────────────────────────────────────────────
function ClienteModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
    const status = statusConfig[cliente.status];
    const tipo = tipoConfig[cliente.tipo];
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'flex-end',
                animation: 'fadeIn 0.2s ease',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '540px', margin: '0 auto',
                    background: 'rgba(28,28,30,0.98)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    borderRadius: '28px 28px 0 0',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0 0 48px',
                    animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                }}
            >
                {/* Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                    <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
                </div>

                {/* Header */}
                <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <AvatarCircle initials={cliente.initials} color={cliente.color} categoria={cliente.categoria} imagen={cliente.imagen} />
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: tipo.bg, color: tipo.text, border: `1px solid ${tipo.border}` }}>
                                {cliente.tipo}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: status.bg, color: status.text, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: status.dot, display: 'inline-block' }} />
                                {status.label}
                            </span>
                        </div>
                        <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, lineHeight: 1.2 }}>{cliente.nombre}</h2>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '2px' }}>{cliente.rif}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '20px 24px' }} />

                {/* Fields */}
                <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {[
                        { icon: '✉️', label: 'Email', value: cliente.email },
                        { icon: '📱', label: 'Móvil', value: cliente.movil || cliente.telefono },
                        { icon: '📍', label: 'Dirección', value: cliente.direccion },
                    ].filter(f => f.value).map(f => (
                        <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{f.icon}</span>
                            <div>
                                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</p>
                                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', marginTop: '2px', lineHeight: 1.4 }}>{f.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action buttons */}
                <div style={{ padding: '24px 24px 0', display: 'flex', gap: '10px' }}>
                    <a href={`tel:${cliente.movil || cliente.telefono}`} style={{
                        flex: 1, padding: '12px', borderRadius: '14px', textDecoration: 'none',
                        background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.25)',
                        color: '#34C759', fontSize: '13px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#34C759" strokeWidth="1.8" />
                        </svg>
                        Llamar
                    </a>
                    <a href={`mailto:${cliente.email}`} style={{
                        flex: 1, padding: '12px', borderRadius: '14px', textDecoration: 'none',
                        background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.25)',
                        color: '#007AFF', fontSize: '13px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#007AFF" strokeWidth="1.8" />
                            <path d="M22 6l-10 7L2 6" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        Email
                    </a>
                </div>
            </div>
        </div>
    );
}

// ── Main Card ──────────────────────────────────────────────────────
export default function ClienteCard({ cliente, onDelete }: { cliente: Cliente; onDelete?: (id: string) => void }) {
    const status = statusConfig[cliente.status];
    const tipo = tipoConfig[cliente.tipo];
    const [showModal, setShowModal] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleDelete = () => {
        if (confirmDelete) {
            onDelete?.(cliente.id);
            setConfirmDelete(false);
        } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
        }
    };

    return (
        <>
            <div
                className="relative overflow-hidden"
                style={{
                    background: 'rgba(28,28,30,0.95)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.10)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s cubic-bezier(0.25,0.46,0.45,0.94)',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.45)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
                }}
            >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${cliente.color}40, transparent)` }} />

                {/* Main info row */}
                <div className="flex items-center gap-4 px-4 pt-4 pb-3">
                    <AvatarCircle initials={cliente.initials} color={cliente.color} categoria={cliente.categoria} imagen={cliente.imagen} />

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h3 className="font-semibold truncate"
                                    style={{ fontSize: '16px', color: 'var(--label-primary)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                                    {cliente.nombre}
                                </h3>
                                <p className="text-sm mt-0.5 font-medium" style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>
                                    {cliente.rif}
                                </p>
                                {cliente.email && (
                                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--label-tertiary)', fontSize: '12px' }}>
                                        {cliente.email}
                                    </p>
                                )}
                                {cliente.movil && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                                            <rect x="7" y="2" width="10" height="20" rx="2" stroke="#8E8E93" strokeWidth="1.8" />
                                            <circle cx="12" cy="18" r="1" fill="#8E8E93" />
                                        </svg>
                                        <p style={{ color: 'var(--label-tertiary)', fontSize: '12px' }}>{cliente.movil}</p>
                                    </div>
                                )}
                                {cliente.direccion && (
                                    <div className="flex items-start gap-1 mt-1">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#8E8E93" strokeWidth="1.8" />
                                            <circle cx="12" cy="9" r="2.5" stroke="#8E8E93" strokeWidth="1.6" />
                                        </svg>
                                        <p className="truncate" style={{ color: 'var(--label-tertiary)', fontSize: '12px', lineHeight: 1.3 }}>
                                            {cliente.direccion}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Badges */}
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: status.bg }}>
                                    <div className="rounded-full" style={{ width: '5px', height: '5px', background: status.dot }} />
                                    <span className="font-medium" style={{ color: status.text, fontSize: '11px' }}>{status.label}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Action buttons row ── */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

                    {/* Presupuesto — botón destacado full width */}
                    <Link
                        href={`/ventas?cliente=${encodeURIComponent(cliente.nombre)}&rif=${encodeURIComponent(cliente.rif)}`}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            width: '100%', padding: '11px 0',
                            background: 'rgba(52,199,89,0.10)',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            textDecoration: 'none',
                            color: '#34C759', fontSize: '13px', fontWeight: 700,
                            transition: 'background 0.15s',
                            letterSpacing: '-0.01em',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,199,89,0.18)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(52,199,89,0.10)')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#34C759" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Crear Presupuesto
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14M12 5l7 7-7 7" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </Link>

                    {/* Fila secundaria: Ver · Editar · Eliminar */}
                    <div style={{ display: 'flex' }}>
                        {/* Ver tarjeta */}
                        <button
                            onClick={() => setShowModal(true)}
                            style={{
                                flex: 1, padding: '9px 0',
                                background: 'transparent', border: 'none',
                                borderRight: '1px solid rgba(255,255,255,0.07)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                color: '#007AFF', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,122,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="3" stroke="#007AFF" strokeWidth="2" />
                                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="#007AFF" strokeWidth="2" />
                            </svg>
                            Ver
                        </button>

                        {/* Editar */}
                        <Link
                            href={`/clientes/${cliente.id}/editar`}
                            style={{
                                flex: 1, padding: '9px 0',
                                background: 'transparent',
                                borderRight: '1px solid rgba(255,255,255,0.07)',
                                textDecoration: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                color: '#FF9500', fontSize: '11px', fontWeight: 600,
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,149,0,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#FF9500" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            Editar
                        </Link>

                        {/* Eliminar */}
                        <button
                            onClick={handleDelete}
                            style={{
                                flex: 1, padding: '9px 0',
                                background: confirmDelete ? 'rgba(255,59,48,0.10)' : 'transparent',
                                border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                color: '#FF3B30', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => !confirmDelete && (e.currentTarget.style.background = 'rgba(255,59,48,0.06)')}
                            onMouseLeave={e => !confirmDelete && (e.currentTarget.style.background = 'transparent')}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <polyline points="3 6 5 6 21 6" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" />
                                <path d="M10 11v6M14 11v6" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            {confirmDelete ? '¿Confirmar?' : 'Eliminar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal tarjeta */}
            {showModal && <ClienteModal cliente={cliente} onClose={() => setShowModal(false)} />}

            <style>{`
                @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
            `}</style>
        </>
    );
}
