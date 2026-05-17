'use client';

import { FileDown, Link2, MessageCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiUrl, assertHttpOrigin } from '@/lib/http/apiUrl';

type Props = {
  proyectoModuloId?: string;
  proyectoObraId?: string;
  alcanceNombre?: string | null;
  /** Solo iconos, sin etiquetas de texto. */
  iconsOnly?: boolean;
};

function queryResumenDocumento(proyectoModuloId?: string, proyectoObraId?: string): string | null {
  const p = new URLSearchParams();
  const pm = (proyectoModuloId ?? '').trim();
  const po = (proyectoObraId ?? '').trim();
  if (pm) p.set('proyecto_modulo', pm);
  else if (po) p.set('proyecto', po);
  else return null;
  return p.toString();
}

export function ResumenSolicitadosOficiosToolbar({
  proyectoModuloId,
  proyectoObraId,
  alcanceNombre,
  iconsOnly = false,
}: Props) {
  const qs = queryResumenDocumento(proyectoModuloId, proyectoObraId);
  if (!qs) return null;

  const htmlUrl = apiUrl(`/api/rrhh/solicitados-resumen/documento?${qs}`);
  const pdfUrl = `${htmlUrl}&format=pdf`;

  const imprimir = () => {
    const err = assertHttpOrigin();
    if (err) {
      toast.error(err);
      return;
    }
    const url = `${htmlUrl}&print=1`;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      toast.error('Permite ventanas emergentes para imprimir.');
    }
  };

  const guardarPdf = async () => {
    const err = assertHttpOrigin();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      const res = await fetch(pdfUrl, { credentials: 'include' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const blob = await res.blob();
      const slug =
        (alcanceNombre ?? 'solicitados')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s-]/g, '')
          .trim()
          .slice(0, 40) || 'solicitados';
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = `resumen-solicitados-${slug}.pdf`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('PDF descargado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    }
  };

  const copiarEnlacePdf = async () => {
    try {
      await navigator.clipboard.writeText(pdfUrl);
      toast.success('Enlace del PDF copiado. Quien lo abra debe tener sesión en la aplicación.');
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  };

  const enviarWhatsAppPdf = () => {
    const titulo = alcanceNombre
      ? `Resumen solicitados por oficio — ${alcanceNombre}`
      : 'Resumen solicitados por oficio';
    const text = `${titulo}\n\nEnlace al PDF:\n${pdfUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const violetBtn =
    'border-violet-400/40 bg-violet-950/40 text-violet-100 hover:bg-violet-900/50';
  const waBtn = 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100 hover:bg-emerald-900/40';

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      <Button
        type="button"
        variant="outline"
        size={iconsOnly ? 'icon' : 'sm'}
        className={violetBtn}
        onClick={imprimir}
        title="Imprimir"
        aria-label="Imprimir"
      >
        <Printer className={iconsOnly ? 'h-4 w-4' : 'mr-1.5 h-3.5 w-3.5'} />
        {iconsOnly ? null : 'Imprimir'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={iconsOnly ? 'icon' : 'sm'}
        className={violetBtn}
        onClick={() => void guardarPdf()}
        title="Guardar PDF"
        aria-label="Guardar PDF"
      >
        <FileDown className={iconsOnly ? 'h-4 w-4' : 'mr-1.5 h-3.5 w-3.5'} />
        {iconsOnly ? null : 'Guardar PDF'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={iconsOnly ? 'icon' : 'sm'}
        className={violetBtn}
        onClick={() => void copiarEnlacePdf()}
        title="Copiar enlace al PDF (requiere sesión)"
        aria-label="Copiar enlace al PDF"
      >
        <Link2 className={iconsOnly ? 'h-4 w-4' : 'mr-1.5 h-3.5 w-3.5'} />
        {iconsOnly ? null : 'Enlace PDF'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={iconsOnly ? 'icon' : 'sm'}
        className={waBtn}
        onClick={enviarWhatsAppPdf}
        title="Compartir enlace del PDF por WhatsApp"
        aria-label="Enviar por WhatsApp"
      >
        <MessageCircle className={iconsOnly ? 'h-4 w-4' : 'mr-1.5 h-3.5 w-3.5'} />
        {iconsOnly ? null : 'WhatsApp'}
      </Button>
    </div>
  );
}
