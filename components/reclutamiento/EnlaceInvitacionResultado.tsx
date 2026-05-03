'use client';

import { useEffect, useMemo, useState } from 'react';

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
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
  const waText = useMemo(() => {
    const n = nombreCandidato.trim() || 'candidato';
    return `Hola ${n}, enlace CASA INTELIGENTE: primero hoja de vida y cargas; luego la evaluación (prueba). El contrato es después, si RRHH aprueba: ${onboardingUrl}`;
  }, [onboardingUrl, nombreCandidato]);
  const waHref = waPhone && waText ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}` : '';

  async function copiar(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
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
            El obrero escanea el QR o abre el enlace, completa datos y carga cédula, y puede descargar la hoja de vida en
            PDF. Después debe hacer la <span className="text-zinc-200 font-medium">evaluación</span> (prueba). El{' '}
            <span className="text-zinc-200 font-medium">contrato</span> es un paso posterior y solo si RRHH aprueba tras
            esa evaluación.
          </p>
          <code className="block break-all text-[11px] text-sky-300 bg-black/40 p-2 rounded-lg">{onboardingUrl}</code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copiar(onboardingUrl)}
              className="rounded-lg px-3 py-1.5 bg-zinc-800 text-zinc-100 text-[11px] font-medium"
            >
              Copiar enlace
            </button>
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-1.5 bg-emerald-700 text-white text-[11px] font-medium"
              >
                Enviar por WhatsApp
              </a>
            ) : (
              <span className="text-zinc-500 text-[11px]">Añade WhatsApp arriba para habilitar envío directo.</span>
            )}
          </div>
          {examUrl ? (
            <p className="text-zinc-500 pt-1">
              Tras el registro, la prueba usa el mismo token:{' '}
              <span className="text-zinc-400 break-all">{examUrl}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
