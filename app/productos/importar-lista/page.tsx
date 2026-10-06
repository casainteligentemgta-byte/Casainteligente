'use client';

import Link from 'next/link';
import ImportarListaPrecios from '@/components/productos/ImportarListaPrecios';

export default function ImportarListaPreciosPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    background: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
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
                        background: 'rgba(255,255,255,0.08)',
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
                        <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </Link>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1 }}>
                        Importar lista de precios
                    </h1>
                    <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>
                        Costos, disponibilidad y fotos del proveedor
                    </p>
                </div>
            </div>
            <ImportarListaPrecios />
        </div>
    );
}
