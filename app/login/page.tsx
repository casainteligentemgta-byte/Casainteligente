'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/nexus/GlassCard';
import { apiUrl } from '@/lib/http/apiUrl';
import { homeHrefParaRolesEmpresa } from '@/lib/auth/permisosCatalogo';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get('next')?.trim() || '/';
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') && !nextRaw.startsWith('/login')
      ? nextRaw
      : '/';
  const errorQuery = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorQuery === 'auth_callback'
      ? 'No se pudo completar el acceso. Intente de nuevo.'
      : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        const msg =
          signInError.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos.'
            : signInError.message;
        setError(msg);
        return;
      }

      let dest = next;
      if (dest === '/') {
        try {
          const res = await fetch(apiUrl('/api/auth/permisos'), {
            cache: 'no-store',
            credentials: 'include',
          });
          if (res.ok) {
            const data = (await res.json()) as { roles_empresa?: string[] };
            dest = homeHrefParaRolesEmpresa(data.roles_empresa ?? []);
          }
        } catch {
          /* usa next */
        }
      }

      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5AC8FA]">
            Casa Inteligente
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Accede con el correo de tu equipo para usar contabilidad, almacén y proyectos.
          </p>
        </div>

        <GlassCard className="!p-6 sm:!p-8">
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Correo
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[#007AFF]/60 focus:ring-2 focus:ring-[#007AFF]/20"
                placeholder="tu@empresa.com"
                disabled={loading}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Contraseña
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[#007AFF]/60 focus:ring-2 focus:ring-[#007AFF]/20"
                placeholder="••••••••"
                disabled={loading}
              />
            </label>

            {error ? (
              <p className="rounded-lg border border-[#FF3B30]/30 bg-[#FF3B30]/10 px-3 py-2 text-sm text-[#FF6B6B]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#007AFF] py-3 text-sm font-bold text-white transition hover:bg-[#0062CC] disabled:opacity-50"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {next !== '/' ? (
            <p className="mt-4 text-center text-xs text-zinc-500">
              Tras iniciar sesión volverás a{' '}
              <span className="font-mono text-zinc-400">{next}</span>
            </p>
          ) : null}
        </GlassCard>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Si no tienes usuario, pide acceso al administrador en Configuración → Equipo.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
