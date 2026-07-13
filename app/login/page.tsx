'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { debeCambiarPassword } from '@/lib/auth/passwordPolicy'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const nextRaw = searchParams.get('next')?.trim() || '/'
    const next =
        nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.startsWith('/login')
            ? nextRaw
            : '/'

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const supabase = createClient()
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            })
            if (signInError) {
                setError(
                    signInError.message === 'Invalid login credentials'
                        ? 'Correo o contraseña incorrectos.'
                        : signInError.message,
                )
                return
            }

            if (debeCambiarPassword(data.user?.app_metadata as Record<string, unknown>)) {
                router.push('/cambiar-password')
                router.refresh()
                return
            }

            router.push(next)
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
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
                padding: '24px',
                background: 'var(--bg-primary, #0A0A0F)',
                fontFamily: 'Inter, -apple-system, sans-serif',
            }}
        >
            <div style={{ width: '100%', maxWidth: 420 }}>
                <p
                    style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: '#5AC8FA',
                        textAlign: 'center',
                    }}
                >
                    Casa Inteligente
                </p>
                <h1
                    style={{
                        margin: '10px 0 8px',
                        fontSize: 28,
                        fontWeight: 800,
                        color: 'white',
                        textAlign: 'center',
                    }}
                >
                    Iniciar sesión
                </h1>
                <p
                    style={{
                        margin: '0 0 24px',
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.45)',
                        textAlign: 'center',
                    }}
                >
                    Usa el correo de tu ficha de empleado. La clave temporal es{' '}
                    <strong style={{ color: 'rgba(255,255,255,0.75)' }}>12345678</strong> hasta
                    que la cambies.
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
                        gap: 16,
                    }}
                >
                    <label style={{ display: 'block' }}>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                            }}
                        >
                            Correo
                        </span>
                        <input
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            placeholder="empleado@empresa.com"
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
                                outline: 'none',
                            }}
                        />
                    </label>

                    <label style={{ display: 'block' }}>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                            }}
                        >
                            Contraseña
                        </span>
                        <input
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            placeholder="••••••••"
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
                                outline: 'none',
                            }}
                        />
                    </label>

                    {error ? (
                        <p
                            style={{
                                margin: 0,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,59,48,0.35)',
                                background: 'rgba(255,59,48,0.12)',
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
                            width: '100%',
                            border: 'none',
                            borderRadius: 12,
                            padding: '13px 16px',
                            background: '#007AFF',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? 'Entrando…' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.45)',
                        background: '#0A0A0F',
                    }}
                >
                    Cargando…
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    )
}
