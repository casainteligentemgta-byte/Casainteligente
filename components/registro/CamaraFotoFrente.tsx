'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

/**
 * Cámara frontal con silueta de busto (cabeza + hombros).
 * El obrero acerca el teléfono hasta llenar el contorno.
 */
export default function CamaraFotoFrente({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const maskId = useId().replace(/:/g, '');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const detener = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setListo(false);
  }, []);

  useEffect(() => {
    if (!open) {
      detener();
      return;
    }
    let cancel = false;
    setError(null);
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Este teléfono no permite cámara en el navegador. Elige una foto de la galería.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancel) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.setAttribute('playsinline', 'true');
          await video.play();
          setListo(true);
        }
      } catch {
        setError('No se pudo abrir la cámara. Permite el acceso o elige una foto de la galería.');
      }
    })();
    return () => {
      cancel = true;
      detener();
    };
  }, [open, detener]);

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-frente-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        detener();
        onClose();
      },
      'image/jpeg',
      0.9,
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black" role="dialog" aria-modal aria-label="Foto de frente">
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
          playsInline
          muted
          autoPlay
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice">
          <defs>
            <mask id={maskId}>
              <rect width="100" height="160" fill="white" />
              <path
                d="M50 16 C36 16 26 28 26 46 C26 60 32 70 39 76 C24 84 14 104 12 160 L88 160 C86 104 76 84 61 76 C68 70 74 60 74 46 C74 28 64 16 50 16 Z"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100" height="160" fill="rgba(0,0,0,0.58)" mask={`url(#${maskId})`} />
          <path
            d="M50 16 C36 16 26 28 26 46 C26 60 32 70 39 76 C24 84 14 104 12 160 L88 160 C86 104 76 84 61 76 C68 70 74 60 74 46 C74 28 64 16 50 16 Z"
            fill="none"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="1.15"
          />
        </svg>
        <p className="absolute inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] rounded-xl bg-black/55 px-3 py-2 text-center text-[13px] font-semibold leading-snug text-white">
          Acerca el teléfono hasta que tu cara y hombros llenen la silueta.
        </p>
        {error ? (
          <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl border border-amber-500/40 bg-zinc-950/90 px-4 py-3 text-center text-sm text-amber-100">
            {error}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 items-center bg-black px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => {
            detener();
            onClose();
          }}
          className="inline-flex items-center justify-self-start gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-200"
        >
          <X className="h-4 w-4" aria-hidden />
          Cancelar
        </button>
        <button
          type="button"
          disabled={!listo || Boolean(error)}
          onClick={capturar}
          className="inline-flex h-16 w-16 items-center justify-center justify-self-center rounded-full border-4 border-white bg-[#FF9500] text-black shadow-lg disabled:opacity-40"
          aria-label="Tomar foto"
        >
          <Camera className="h-7 w-7" aria-hidden />
        </button>
        <span aria-hidden />
      </div>
    </div>
  );
}
