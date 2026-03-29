'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function SessionShareBar({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const dashboardHref = `/reclutamiento/dashboard?session=${encodeURIComponent(sessionId)}`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copyId()}
        className="text-[11px] rounded-lg px-2 py-1 bg-zinc-800 text-zinc-200 border border-zinc-600"
      >
        {copied ? 'Copiado' : 'Copiar ID'}
      </button>
      <Link
        href={dashboardHref}
        className="text-[11px] rounded-lg px-2 py-1 bg-sky-900/50 text-sky-200 border border-sky-700/60"
      >
        Abrir panel evaluador
      </Link>
    </div>
  );
}
