'use client';

import { useRouter } from 'next/navigation';
import NuevoProductoForm from '@/components/productos/NuevoProductoForm';

export default function NuevoProductoPage() {
    const router = useRouter();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>

            {/* Header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
            }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '10px',
                        width: '34px', height: '34px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1 }}>
                        Nuevo Producto
                    </h1>
                    <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '2px' }}>
                        Agregar al catálogo
                    </p>
                </div>
            </div>

            <NuevoProductoForm isEditing={false} />
        </div>
    );
}
