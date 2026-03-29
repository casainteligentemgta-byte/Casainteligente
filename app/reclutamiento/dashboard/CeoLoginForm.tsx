'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CeoLoginForm() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/recruitment/ceo-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        setError('Clave incorrecta o servicio no disponible.');
        setLoading(false);
        return;
      }
      setSecret('');
      router.refresh();
    } catch {
      setError('No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-zinc-600 bg-zinc-900/80 p-4 mb-8 space-y-3"
    >
      <p className="text-sm text-zinc-300">
        Esta vista está protegida. Introduce la clave interna (variable{' '}
        <code className="text-zinc-400">RECRUITMENT_CEO_SECRET</code>) o, si en el servidor tienes{' '}
        <code className="text-zinc-400">RECRUITMENT_ALLOW_SUPABASE_USER=true</code>, inicia sesión en la
        app con tu cuenta Supabase y vuelve aquí.
      </p>
      <input
        type="password"
        autoComplete="current-password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="Clave CEO"
        className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white"
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading || !secret.trim()}
        className="rounded-xl px-4 py-2 text-sm font-medium bg-sky-600 text-white disabled:opacity-40"
      >
        {loading ? 'Entrando…' : 'Acceder'}
      </button>
    </form>
  );
}
