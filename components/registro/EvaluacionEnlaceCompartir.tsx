'use client';

import { useMemo, useState } from 'react';

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

async function copiarAlPortapapeles(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export type EvaluacionEnlaceCompartirProps = {
  examUrl: string;
  /** Nombre del postulante (texto del mensaje WhatsApp). */
  nombre?: string;
  /** Si viene el móvil del formulario, se puede abrir wa.me directo. */
  whatsappDigitsOrRaw?: string;
};

export function EvaluacionEnlaceCompartir({
  examUrl,
  nombre = '',
  whatsappDigitsOrRaw = '',
}: EvaluacionEnlaceCompartirProps) {
  const [copiado, setCopiado] = useState(false);
  const waPhone = useMemo(() => onlyDigits(whatsappDigitsOrRaw), [whatsappDigitsOrRaw]);
  const waText = useMemo(() => {
    const n = nombre.trim() || 'Hola';
    return `${n}, tu evaluación técnica CASA INTELIGENTE (enlace único; al abrirla tienes tiempo limitado para enviarla): ${examUrl}`;
  }, [examUrl, nombre]);

  const waHrefDirecto =
    waPhone.length >= 10 ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}` : '';
  const waHrefCompartir = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;

  async function copiar() {
    const ok = await copiarAlPortapapeles(examUrl);
    setCopiado(ok);
    if (ok) window.setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div className="mt-6 rounded-xl border border-emerald-600/35 bg-emerald-950/25 p-4 text-left text-sm">
      <p className="font-semibold text-emerald-200">Evaluación en línea</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
        Cuando hayas terminado la planilla, abre este enlace para la prueba. Puedes copiarlo o enviarlo por WhatsApp.
      </p>
      <a
        href={examUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
      >
        Abrir evaluación
      </a>
      <code className="mt-2 block break-all rounded-lg bg-black/40 p-2 text-[11px] text-emerald-200/90">{examUrl}</code>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copiar()}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-[11px] font-medium text-zinc-100"
        >
          {copiado ? 'Copiado ✓' : 'Copiar enlace'}
        </button>
        {waHrefDirecto ? (
          <a
            href={waHrefDirecto}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-medium text-white"
          >
            WhatsApp al número
          </a>
        ) : null}
        <a
          href={waHrefCompartir}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-emerald-800/90 px-3 py-1.5 text-[11px] font-medium text-white"
        >
          WhatsApp (elegir contacto)
        </a>
      </div>
    </div>
  );
}
