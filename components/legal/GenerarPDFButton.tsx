'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';

type Props = {
  documentId: string;
  className?: string;
  label?: string;
};

export default function GenerarPDFButton({
  documentId,
  className,
  label = 'Generar PDF Final',
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!documentId || loading) return;
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/legal/documentos/generate-pdf'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        let msg = 'Error al generar PDF';
        try {
          const data = (await response.json()) as { error?: string; hint?: string };
          msg = [data.error, data.hint].filter(Boolean).join(' — ') || msg;
        } catch {
          /* blob error */
        }
        toast.error(msg);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Liberar más tarde (la pestaña ya tiene el blob)
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar PDF');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleGenerate()}
      disabled={loading || !documentId}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2 text-sm font-bold text-black shadow hover:brightness-105 disabled:opacity-50 transition'
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}
