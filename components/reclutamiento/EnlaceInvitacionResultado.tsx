'use client';

import { useEffect, useMemo, useState } from 'react';

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

export type EnlaceInvitacionResultadoProps = {
  onboardingUrl: string;
  examUrl?: string | null;
  nombreCandidato: string;
  whatsappDigitsOrRaw?: string;
  titulo?: string;
};

export function EnlaceInvitacionResultado({
  onboardingUrl,
  examUrl,
  nombreCandidato,
  whatsappDigitsOrRaw = '',
  titulo = 'Enlace listo',
}: EnlaceInvitacionResultadoProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQrLoading(true);
    setQrDataUrl(null);
    void import('qrcode')
      .then((mod) =>
        mod.default.toDataURL(onboardingUrl, {
          width: 200,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        }),
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onboardingUrl]);

  const waPhone = useMemo(() => onlyDigits(whatsappDigitsOrRaw), [whatsappDigitsOrRaw]);
  /** Texto corto: evita límites de longitud en wa.me y deja claro que es la hoja de vida. */
  const waText = useMemo(() => {
    const n = nombreCandidato.trim() || 'Hola';
    const hoja = `${n}, completa tu hoja de vida CASA INTELIGENTE aquí: ${onboardingUrl}`;
    if (examUrl?.trim()) {
      return `${hoja}\n\nCuando termines la planilla, entra a la evaluación en línea aquí: ${examUrl.trim()}`;
    }
    return hoja;
  }, [examUrl, onboardingUrl, nombreCandidato]);

  const waHrefDirecto =
    waPhone.length >= 10 ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}` : '';
  /** Sin número: abre WhatsApp con el texto para que elijas el contacto (móvil / web). */
  const waHrefCompartir = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;

  async function copiar(text: string) {
    const ok = await copiarAlPortapapeles(text);
    setCopiado(ok);
    if (ok) window.setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <div className="rounded-xl border border-sky-600/40 bg-sky-950/20 p-3 text-xs space-y-3">
      <p className="text-sky-200 font-medium">{titulo}</p>
      <div className="flex flex-wrap gap-4 items-start">
        <div className="shrink-0 rounded-lg border border-white/10 bg-white p-2 w-[216px] h-[216px] flex items-center justify-center">
          {qrLoading ? (
            <span className="text-zinc-500 text-[11px] text-center px-2">Generando código QR…</span>
          ) : qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} width={200} height={200} alt="Código QR del enlace de onboarding" className="block" />
          ) : (
            <span className="text-zinc-500 text-[11px] text-center px-2">
              No se pudo generar el QR; usa el enlace o copiar.
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-zinc-400">
            El obrero abre el enlace, completa la <span className="text-zinc-200 font-medium">hoja de vida</span> y puede
            descargar el PDF. Después sigue la evaluación; el contrato es solo si RRHH aprueba.
          </p>
          <a
            href={onboardingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-lg bg-sky-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-sky-600"
          >
            Abrir hoja de vida (probar enlace)
          </a>
          <code className="block break-all text-[11px] text-sky-300 bg-black/40 p-2 rounded-lg">{onboardingUrl}</code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copiar(onboardingUrl)}
              className="rounded-lg px-3 py-1.5 bg-zinc-800 text-zinc-100 text-[11px] font-medium"
            >
              {copiado ? 'Copiado ✓' : 'Copiar enlace'}
            </button>
            {waHrefDirecto ? (
              <a
                href={waHrefDirecto}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-1.5 bg-emerald-700 text-white text-[11px] font-medium"
              >
                WhatsApp al número
              </a>
            ) : null}
            <a
              href={waHrefCompartir}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-1.5 bg-emerald-800/90 text-white text-[11px] font-medium"
            >
              WhatsApp (elegir contacto)
            </a>
          </div>
          {!waHrefDirecto ? (
            <p className="text-zinc-500 text-[11px]">
              Opcional: añade el móvil arriba para abrir el chat directo con ese número (código país, ej. 58412…).
            </p>
          ) : null}
          {examUrl ? (
            <p className="text-zinc-500 pt-1">
              Tras la hoja de vida, la prueba:{' '}
              <a href={examUrl} className="text-sky-400 break-all underline" target="_blank" rel="noopener noreferrer">
                abrir evaluación
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
