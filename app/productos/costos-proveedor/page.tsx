'use client';

import Link from 'next/link';
import CostosProveedorWeb from '@/components/productos/CostosProveedorWeb';
import { tinta } from '@/lib/tema/tinta';

export default function CostosProveedorPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    background: 'var(--barra-fondo)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderBottom: `1px solid ${tinta(0.07)}`,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}
            >
                <Link
                    href="/productos"
                    aria-label="Volver al catálogo"
                    style={{
                        background: tinta(0.08),
                        borderRadius: '10px',
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18l-6-6 6-6" stroke="var(--label-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </Link>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1 }}>
                        Costos del proveedor
                    </h1>
                    <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>
                        Lee el precio de cada producto en la web de su proveedor.
                    </p>
                </div>
            </div>
            <CostosProveedorWeb />
        </div>
    );
}
