'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CeoLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch('/api/recruitment/ceo-auth', { method: 'DELETE' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={loading}
      className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 disabled:opacity-40"
    >
      {loading ? 'Cerrando…' : 'Cerrar sesión CEO'}
    </button>
  );
}
