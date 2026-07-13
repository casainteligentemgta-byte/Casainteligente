'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CambiarPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (password.length < 8) {
            setError('La nueva clave debe tener al menos 8 caracteres')
            return
        }
        if (password === '12345678') {
            setError('No puedes reutilizar la clave temporal')
            return
        }
        if (password !== confirm) {
            setError('Las claves no coinciden')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/auth/me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password }),
            })
            const data = (await res.json().catch(() => ({}))) as { error?: string }
            if (!res.ok) {
                setError(data.error || 'No se pudo cambiar la clave')
                return
            }
            router.push('/')
            router.refresh()
        } catch {
            setError('Error de red al cambiar la clave')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                background: '#0A0A0F',
                fontFamily: 'Inter, -apple-system, sans-serif',
                color: 'white',
            }}
        >
            <div style={{ width: '100%', maxWidth: 420 }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, textAlign: 'center' }}>
                    Cambia tu clave
                </h1>
                <p
                    style={{
                        margin: '0 0 24px',
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.45)',
                        textAlign: 'center',
                    }}
                >
                    Por seguridad debes reemplazar la clave temporal antes de continuar.
                </p>

                <form
                    onSubmit={(e) => void onSubmit(e)}
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 20,
                        padding: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                    }}
                >
                    <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                            NUEVA CLAVE
                        </span>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            style={{
                                marginTop: 8,
                                width: '100%',
                                boxSizing: 'border-box',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(0,0,0,0.35)',
                                color: 'white',
                                padding: '12px 14px',
                                fontSize: 14,
                            }}
                        />
                    </label>
                    <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                            CONFIRMAR CLAVE
                        </span>
                        <input
                            type="password"
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            disabled={loading}
                            style={{
                                marginTop: 8,
                                width: '100%',
                                boxSizing: 'border-box',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(0,0,0,0.35)',
                                color: 'white',
                                padding: '12px 14px',
                                fontSize: 14,
                            }}
                        />
                    </label>

                    {error ? (
                        <p
                            style={{
                                margin: 0,
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: 'rgba(255,59,48,0.12)',
                                border: '1px solid rgba(255,59,48,0.35)',
                                color: '#FF6B6B',
                                fontSize: 13,
                            }}
                        >
                            {error}
                        </p>
                    ) : null}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 4,
                            border: 'none',
                            borderRadius: 12,
                            padding: '13px 16px',
                            background: '#34C759',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? 'Guardando…' : 'Guardar nueva clave'}
                    </button>
                </form>
            </div>
        </div>
    )
}
