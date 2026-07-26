'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { compartirDocumentoUrl } from '@/lib/configuracion/compartirDocumentoUrl';

type Props = {
  url?: string | null;
  file?: File | null;
  titulo: string;
  texto?: string;
  className?: string;
};

/** Botón compacto para compartir actas / RIF / PDFs de permisos del patrono. */
export default function BotonCompartirDocumento({
  url,
  file,
  titulo,
  texto,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const puede = Boolean((url && url.trim()) || file);

  if (!puede) return null;

  return (
    <button
      type="button"
      disabled={busy}
      title="Compartir documento"
      aria-label={`Compartir ${titulo}`}
      className={
        className ??
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-[#7cb9ff] hover:bg-[#007AFF]/15 hover:text-[#9fcbff] disabled:opacity-50'
      }
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            const r = await compartirDocumentoUrl({ url, file, titulo, texto });
            if (r.ok) {
              if (r.modo === 'copiado') toast.success('Enlace copiado');
              else if (r.modo === 'whatsapp') toast.success('Abriendo WhatsApp…');
              else toast.success('Listo para compartir');
              return;
            }
            if (!r.cancelado) toast.error(r.error);
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden />
      {busy ? '…' : 'Compartir'}
    </button>
  );
}
