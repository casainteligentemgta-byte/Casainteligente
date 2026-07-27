'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/nexus/GlassCard';
import { apiUrl } from '@/lib/http/apiUrl';
import { validarNuevaPassword } from '@/lib/auth/passwordPolicy';

export default function CambiarPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const invalid = validarNuevaPassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (password !== confirm) {
      setError('Las claves no coinciden');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/cambiar-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'No se pudo cambiar la clave');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Error de red al cambiar la clave');
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
          <h1 className="mt-2 text-2xl font-bold text-white">Cambia tu clave</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Por seguridad debes definir una clave nueva antes de continuar.
          </p>
        </div>

        <GlassCard className="!p-6 sm:!p-8">
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Nueva clave
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[#007AFF]/60 focus:ring-2 focus:ring-[#007AFF]/20"
                placeholder="Mínimo 10 caracteres, letras y números"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Confirmar clave
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[#007AFF]/60 focus:ring-2 focus:ring-[#007AFF]/20"
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#34C759] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? 'Guardando…' : 'Guardar nueva clave'}
            </button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
