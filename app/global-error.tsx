'use client'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html lang="es">
            <body style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                background: '#000000',
                color: '#FFFFFF',
                margin: 0,
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '420px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
                        Error inesperado
                    </h1>
                    <p style={{ fontSize: '15px', color: 'rgba(235,235,245,0.6)', marginBottom: '24px' }}>
                        Algo salió mal. Por favor intenta de nuevo.
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            background: '#007AFF',
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
            </body>
        </html>
    )
}
