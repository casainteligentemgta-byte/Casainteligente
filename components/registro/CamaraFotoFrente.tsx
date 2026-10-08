'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SwitchCamera, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

type Facing = 'user' | 'environment';

/**
 * Cámara con óvalo de encuadre (cara). El obrero acerca el teléfono hasta llenar el óvalo.
 */
export default function CamaraFotoFrente({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [facing, setFacing] = useState<Facing>('user');

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
        detener();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
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
  }, [open, facing, detener]);

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
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
      <p className="px-6 pt-[max(1rem,env(safe-area-inset-top))] text-center text-[13px] leading-snug text-zinc-400">
        Acerca el teléfono hasta que tu cara llene el óvalo.
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center px-7 py-4">
        <div className="relative aspect-[3/4] w-full max-w-[22rem] overflow-hidden rounded-2xl border border-dashed border-white/35 bg-zinc-950">
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
            playsInline
            muted
            autoPlay
          />
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 300 400"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <ellipse cx="150" cy="158" rx="92" ry="118" fill="none" stroke="white" strokeWidth="2.4" />
          </svg>
          {error ? (
            <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl border border-amber-500/40 bg-zinc-950/90 px-4 py-3 text-center text-sm text-amber-100">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 items-center px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          onClick={() => {
            detener();
            onClose();
          }}
          className="justify-self-start p-2 text-white"
          aria-label="Cancelar"
        >
          <X className="h-7 w-7" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          disabled={!listo || Boolean(error)}
          onClick={capturar}
          className="justify-self-center h-[3.25rem] w-[3.25rem] rounded-full border-[3px] border-white bg-transparent disabled:opacity-40"
          aria-label="Tomar foto"
        />
        <button
          type="button"
          disabled={Boolean(error)}
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          className="justify-self-end p-2 text-white disabled:opacity-40"
          aria-label="Cambiar cámara"
        >
          <SwitchCamera className="h-7 w-7" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
