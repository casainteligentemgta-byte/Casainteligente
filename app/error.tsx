'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[Error Boundary]', error)
    }, [error])

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '40px 20px',
        }}>
            <div style={{ textAlign: 'center', maxWidth: '420px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
                <h2 style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: 'var(--label-primary)',
                    marginBottom: '8px',
                }}>
                    Algo salió mal
                </h2>
                <p style={{
                    fontSize: '15px',
                    color: 'var(--label-tertiary)',
                    marginBottom: '24px',
                }}>
                    Ocurrió un error al cargar esta sección.
                </p>
                <button
                    onClick={reset}
                    style={{
                        background: 'var(--ios-blue)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '12px 32px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Reintentar
                </button>
            </div>
        </div>
    )
}
