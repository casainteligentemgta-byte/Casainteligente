'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  FileDown,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  mensajeCompartirDocumentoLegal,
  urlCompartirEmailLegal,
  urlCompartirTelegramLegal,
  urlCompartirWhatsAppLegal,
  type DocumentoLegalShare,
} from '@/lib/legal/documentoLegalShare';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  titulo?: string;
};

export default function EnviarDocumentoLegalModal({
  open,
  onOpenChange,
  documentId,
  titulo,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState<DocumentoLegalShare | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const cargar = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setShare(null);
    try {
      const res = await fetch(apiUrl(`/api/legal/documentos/${documentId}?format=share`), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        titulo?: string;
        resumen?: string;
        preview_path?: string;
        preview_url?: string;
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'No se pudo preparar el envío');
        return;
      }
      const path =
        data.preview_path ||
        `/api/legal/documentos/${documentId}?format=preview`;
      setShare({
        titulo: data.titulo || titulo || 'Documento legal',
        resumen: data.resumen,
        previewUrl: apiUrl(path),
      });
    } catch {
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  }, [documentId, titulo]);

  useEffect(() => {
    if (open && documentId) void cargar();
  }, [open, documentId, cargar]);

  async function copiarEnlace() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.previewUrl);
      toast.success('Enlace de vista previa copiado');
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  }

  async function copiarMensaje() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(mensajeCompartirDocumentoLegal(share));
      toast.success('Mensaje copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  async function compartirNativo() {
    if (!share) return;
    if (typeof navigator.share !== 'function') {
      toast.message('Tu navegador no soporta compartir nativo; usa WhatsApp o correo.');
      return;
    }
    try {
      await navigator.share({
        title: share.titulo,
        text: share.resumen || share.titulo,
        url: share.previewUrl,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      toast.error('No se pudo compartir');
    }
  }

  async function descargarPdfYCompartir() {
    if (!documentId) return;
    setPdfBusy(true);
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
          const data = (await response.json()) as { error?: string };
          msg = data.error || msg;
        } catch {
          /* ignore */
        }
        toast.error(msg);
        return;
      }
      const blob = await response.blob();
      const filename = `${(titulo || 'contrato').replace(/[^\w\-]+/g, '_').slice(0, 60)}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: titulo || 'Contrato',
            text: share?.resumen || titulo || 'Documento legal',
            files: [file],
          });
          toast.success('PDF listo para enviar');
          return;
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF descargado — adjúntalo en WhatsApp o correo');
    } catch {
      toast.error('Error al generar PDF');
    } finally {
      setPdfBusy(false);
    }
  }

  const btn =
    'inline-flex w-full items-center justify-start gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/5 disabled:opacity-50';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-amber-500/25 bg-[#0c1018] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <Send className="h-4 w-4 text-amber-300" />
            Enviar contrato
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {(titulo || 'Documento legal').trim()}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparando enlace…
          </p>
        ) : share ? (
          <div className="grid gap-2">
            <a
              href={urlCompartirWhatsAppLegal(share)}
              target="_blank"
              rel="noreferrer"
              className={`${btn} border-emerald-500/35 bg-emerald-950/30 text-emerald-100`}
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              WhatsApp
            </a>
            <a
              href={urlCompartirTelegramLegal(share)}
              target="_blank"
              rel="noreferrer"
              className={`${btn} border-sky-500/35 bg-sky-950/30 text-sky-100`}
            >
              <Send className="h-4 w-4 shrink-0" />
              Telegram
            </a>
            <a href={urlCompartirEmailLegal(share)} className={btn}>
              <Mail className="h-4 w-4 shrink-0" />
              Correo electrónico
            </a>
            <button type="button" className={btn} onClick={() => void copiarEnlace()}>
              <Link2 className="h-4 w-4 shrink-0" />
              Copiar enlace de vista previa
            </button>
            <button type="button" className={btn} onClick={() => void copiarMensaje()}>
              <Copy className="h-4 w-4 shrink-0" />
              Copiar mensaje
            </button>
            <button type="button" className={btn} onClick={() => void compartirNativo()}>
              <Send className="h-4 w-4 shrink-0" />
              Compartir (sistema)
            </button>
            <button
              type="button"
              className={`${btn} border-amber-500/40 bg-amber-500/10 text-amber-100`}
              disabled={pdfBusy}
              onClick={() => void descargarPdfYCompartir()}
            >
              {pdfBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 shrink-0" />
              )}
              {pdfBusy ? 'Generando PDF…' : 'PDF para adjuntar / compartir'}
            </button>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              El enlace de vista previa es para el equipo con acceso al Departamento Legal.
              Para enviar a contraparte u otras personas, usa «PDF para adjuntar / compartir».
            </p>
          </div>
        ) : (
          <p className="py-4 text-sm text-red-300">No se pudo cargar la información de envío.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
