'use client';

import React from 'react';
import Link from 'next/link';

export default function ContabilidadPage() {
    const glass = {
        background: 'rgba(28, 28, 30, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
    };

    const modules = [
        {
            title: 'Procuras',
            description: 'Gestión de abastecimiento y pedidos',
            icon: '📦',
            href: '/almacen', // Procuras leads to inventory/procurement usually
            color: '#FF3B30'
        },
        {
            title: 'Compras',
            description: 'Registro de facturas y egresos',
            icon: '🛒',
            href: '/contabilidad/compras',
            color: '#5856D6'
        },
        {
            title: 'Facturación',
            description: 'Emisión y control de facturas',
            icon: '📄',
            href: '#',
            color: '#007AFF'
        },
        {
            title: 'Tesorería',
            description: 'Manejo de flujo de caja y bancos',
            icon: '🏦',
            href: '#',
            color: '#34C759'
        },
        {
            title: 'Cuentas x Cobrar',
            description: 'Seguimiento de cobranzas',
            icon: '⏳',
            href: '#',
            color: '#FF9500'
        },
        {
            title: 'Nómina',
            description: 'Pagos y gestión de personal',
            icon: '👥',
            href: '#',
            color: '#AF52DE'
        },
        {
            title: 'Impuestos',
            description: 'Obligaciones y tributos',
            icon: '🏛️',
            href: '#',
            color: '#FF2D55'
        },
        {
            title: 'Auditoría Interna',
            description: 'Control y cumplimiento',
            icon: '🔍',
            href: '#',
            color: '#8E8E93'
        },
        {
            title: 'Reportes',
            description: 'Análisis financiero detallado',
            icon: '📊',
            href: '#',
            color: '#5AC8FA'
        }
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            {/* Header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
                padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
                <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 800 }}>Contabilidad</h1>
            </div>

            <div style={{ padding: '20px' }}>
                {/* Stats Summary Panel */}
                <div style={{ ...glass, padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(88,86,214,0.1) 0%, rgba(0,0,0,0) 100%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 600 }}>BALANCE MENSUAL</p>
                            <h2 style={{ color: 'white', fontSize: '32px', fontWeight: 800 }}>$0.00</h2>
                        </div>
                        <div style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                            +0% vs mes ant.
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '16px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700 }}>INGRESOS</p>
                            <p style={{ color: '#34C759', fontSize: '17px', fontWeight: 800 }}>$0.00</p>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '16px' }}>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700 }}>EGRESOS</p>
                            <p style={{ color: '#FF3B30', fontSize: '17px', fontWeight: 800 }}>$0.00</p>
                        </div>
                    </div>
                </div>

                {/* Modules Grid */}
                <h3 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 700, marginBottom: '16px', marginLeft: '4px' }}>MÓDULOS</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {modules.map((m) => (
                        <Link key={m.title} href={m.href} style={{ textDecoration: 'none' }}>
                            <div style={{
                                ...glass,
                                padding: '20px',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                border: `1px solid ${m.color}33`, // Added 20% opacity of the module color
                                boxShadow: `0 4px 20px ${m.color}15`
                            }}>
                                <span style={{ fontSize: '32px', marginBottom: '4px' }}>{m.icon}</span>
                                <div>
                                    <h4 style={{ color: 'white', fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>{m.title}</h4>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', lineHeight: '1.3' }}>{m.description}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
