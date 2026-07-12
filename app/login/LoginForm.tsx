'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/agenda';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(next.startsWith('/') ? next : '/agenda');
        router.refresh();
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (signUpError) throw signUpError;
      setMessage('Revisa tu correo para confirmar la cuenta, o inicia sesión si ya está activa.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h1 className="font-bold text-2xl mb-1" style={{ color: 'var(--label-primary)' }}>
          Casa Inteligente
        </h1>
        <p className="mb-6" style={{ color: 'var(--label-secondary)', fontSize: '14px' }}>
          Inicia sesión para usar tu agenda personal
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--bg-tertiary)',
                color: 'var(--label-primary)',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--label-tertiary)' }}>Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--bg-tertiary)',
                color: 'var(--label-primary)',
              }}
            />
          </div>

          {error ? <p style={{ color: '#FF3B30', fontSize: '13px', margin: 0 }}>{error}</p> : null}
          {message ? <p style={{ color: '#34C759', fontSize: '13px', margin: 0 }}>{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: '#007AFF',
              color: 'white',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Espere…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          style={{
            marginTop: '16px',
            background: 'none',
            border: 'none',
            color: '#007AFF',
            fontSize: '14px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>

        <Link
          href="/"
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: '20px',
            color: 'var(--label-tertiary)',
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
