'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, Eye, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Kind = 'documento' | 'plantilla';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  id: string | null;
  titulo?: string;
};

export default function PrevisualizarDocumentoLegalModal({
  open,
  onOpenChange,
  kind,
  id,
  titulo,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [archivoUrl, setArchivoUrl] = useState<string | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !id) {
      setSrc(null);
      setArchivoUrl(null);
      setArchivoNombre(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      setSrc(null);
      setArchivoUrl(null);
      setArchivoNombre(null);
      try {
        const previewPath =
          kind === 'documento'
            ? `/api/legal/documentos/${id}?format=preview`
            : `/api/legal/plantillas/${id}?format=preview`;

        const res = await fetch(apiUrl(previewPath), {
          credentials: 'include',
          cache: 'no-store',
        });

        if (res.ok) {
          const html = await res.text();
          objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
          if (!cancelled) setSrc(objectUrl);
        } else {
          let msg = 'No se pudo previsualizar';
          try {
            const data = (await res.json()) as { error?: string; hint?: string };
            msg = [data.error, data.hint].filter(Boolean).join(' — ') || msg;
          } catch {
            /* ignore */
          }
          if (!cancelled) setError(msg);
        }

        if (kind === 'plantilla') {
          const ar = await fetch(apiUrl(`/api/legal/plantillas/${id}?format=archivo`), {
            credentials: 'include',
            cache: 'no-store',
          });
          if (ar.ok) {
            const data = (await ar.json()) as {
              url?: string;
              nombre?: string | null;
            };
            if (!cancelled && data.url) {
              setArchivoUrl(data.url);
              setArchivoNombre(data.nombre ?? null);
            }
          }
        }
      } catch {
        if (!cancelled) setError('Error de red al cargar la vista previa');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, id, kind]);

  const printHref =
    kind === 'documento' && id
      ? apiUrl(`/api/legal/documentos/${id}?format=print`)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-amber-500/25 bg-[#0c1018] p-0 sm:max-w-[min(96vw,880px)]">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <Eye className="h-4 w-4 text-amber-300" />
            Vista previa
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {(titulo || 'Contrato / documento').trim()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b border-white/5 px-5 py-3">
          {printHref ? (
            <a
              href={printHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/5"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </a>
          ) : null}
          {archivoUrl ? (
            <a
              href={archivoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
            >
              <Download className="h-3.5 w-3.5" />
              {archivoNombre ? `Archivo: ${archivoNombre}` : 'Abrir archivo original'}
            </a>
          ) : null}
          {src ? (
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir en pestaña
            </a>
          ) : null}
        </div>

        <div className="bg-zinc-900/50 px-3 pb-4 pt-2">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando vista previa…
            </p>
          ) : src ? (
            <iframe
              title="Vista previa del contrato"
              src={src}
              className="h-[min(68vh,640px)] w-full rounded-xl border border-white/10 bg-white"
            />
          ) : (
            <div className="space-y-3 px-2 py-10 text-center">
              <p className="text-sm text-red-300">{error || 'Sin contenido para previsualizar.'}</p>
              {archivoUrl ? (
                <a
                  href={archivoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:underline"
                  onClick={() => toast.message('Abriendo archivo original…')}
                >
                  <Download className="h-4 w-4" />
                  Ver archivo subido
                </a>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
