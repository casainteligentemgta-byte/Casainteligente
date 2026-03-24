'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ComprasPage() {
    const glass = {
        background: 'rgba(28, 28, 30, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
    };

    const [compras, setCompras] = useState([]);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            {/* Header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
                padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link href="/contabilidad" style={{ color: '#5856D6', textDecoration: 'none', fontSize: '20px' }}>←</Link>
                    <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 800 }}>Compras</h1>
                </div>
                <button style={{
                    background: '#5856D6', color: 'white', border: 'none',
                    borderRadius: '12px', padding: '10px 16px', fontWeight: 700,
                    fontSize: '13px', cursor: 'pointer'
                }}>
                    + Factura
                </button>
            </div>

            <div style={{ padding: '20px' }}>
                {compras.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '80px', color: 'rgba(255,255,255,0.2)' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🧾</div>
                        <p style={{ fontSize: '18px', fontWeight: 700 }}>No hay compras registradas</p>
                        <p style={{ fontSize: '14px', marginTop: '4px' }}>Toca el botón &ldquo;+&rdquo; para subir tu primera factura.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {/* List items will go here */}
                    </div>
                )}
            </div>
        </div>
    );
}
