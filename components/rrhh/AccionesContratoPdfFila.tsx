'use client';

import { useCallback, useState } from 'react';
import { Copy, FileText, Link2, Loader2, MessageCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { assertHttpOrigin } from '@/lib/http/apiUrl';
import {
  mensajeWhatsAppContratoPdf,
  resolverUrlPdfContratoFila,
  urlCompartirContratoPdf,
} from '@/lib/rrhh/contratoPdfEnlace';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  empleadoRowId: string;
  nombreObrero: string;
  /** Si true, solo icono de documento (tabla compacta). */
  soloIcono?: boolean;
};

export default function AccionesContratoPdfFila({
  empleadoRowId,
  nombreObrero,
  soloIcono = true,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarUrl = useCallback(async () => {
    setCargando(true);
    setErrorMsg(null);
    const res = await resolverUrlPdfContratoFila(empleadoRowId);
    setCargando(false);
    if (res.error || !res.url) {
      const msg = res.error ?? 'No se encontró el PDF del contrato.';
      setErrorMsg(msg);
      setPdfUrl(null);
      setShareUrl(null);
      toast.error(msg);
      return null;
    }
    setPdfUrl(res.url);
    setShareUrl(urlCompartirContratoPdf(res) ?? res.url);
    return res.url;
  }, [empleadoRowId]);

  const abrirMenu = () => {
    setAbierto(true);
    setPdfUrl(null);
    setShareUrl(null);
    setErrorMsg(null);
    void cargarUrl();
  };

  const onDialogOpenChange = (open: boolean) => {
    setAbierto(open);
    if (!open) {
      setPdfUrl(null);
      setShareUrl(null);
      setErrorMsg(null);
    }
  };

  const verPdf = async () => {
    const url = pdfUrl ?? (await cargarUrl());
    if (!url) return;
    const err = assertHttpOrigin();
    if (err) {
      toast.error(err);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const imprimir = async () => {
    const url = pdfUrl ?? (await cargarUrl());
    if (!url) return;
    const err = assertHttpOrigin();
    if (err) {
      toast.error(err);
      return;
    }
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      toast.error('Permite ventanas emergentes para imprimir.');
      return;
    }
    w.addEventListener('load', () => {
      try {
        w.print();
      } catch {
        /* el visor PDF del navegador puede bloquear print() cross-origin */
      }
    });
  };

  const copiarEnlace = async () => {
    if (!pdfUrl) await cargarUrl();
    const url = shareUrl ?? pdfUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace del PDF copiado.');
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  };

  const whatsapp = async () => {
    if (!pdfUrl) await cargarUrl();
    const url = shareUrl ?? pdfUrl;
    if (!url) return;
    const text = mensajeWhatsAppContratoPdf(nombreObrero, url);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={soloIcono ? 'icon' : 'sm'}
        className="h-8 w-8 shrink-0 border-emerald-500/35 bg-emerald-950/30 text-emerald-100 hover:bg-emerald-900/45"
        title="Contrato en PDF — ver, imprimir o compartir"
        aria-label="Contrato en PDF"
        onClick={abrirMenu}
      >
        <FileText className="h-4 w-4" aria-hidden />
      </Button>

      <Dialog open={abierto} onOpenChange={onDialogOpenChange}>
        <DialogContent className="max-w-sm border-emerald-500/25 bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-base text-white">Contrato en PDF</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {(nombreObrero || 'Trabajador').trim()}
            </DialogDescription>
          </DialogHeader>

          {cargando ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando documento…
            </p>
          ) : pdfUrl ? (
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 border-white/15 bg-white/5 text-zinc-100"
                onClick={() => void verPdf()}
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                Ver PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 border-white/15 bg-white/5 text-zinc-100"
                onClick={() => void imprimir()}
              >
                <Printer className="h-4 w-4 shrink-0" aria-hidden />
                Imprimir
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 border-white/15 bg-white/5 text-zinc-100"
                onClick={() => void copiarEnlace()}
              >
                <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                Copiar enlace
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 border-emerald-500/40 bg-emerald-950/40 text-emerald-100"
                onClick={() => void whatsapp()}
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                Enviar por WhatsApp
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-300">
                {errorMsg ?? 'No se pudo cargar el PDF.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/15 text-zinc-200"
                onClick={() => void cargarUrl()}
              >
                Reintentar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
