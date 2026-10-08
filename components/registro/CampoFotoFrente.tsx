'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import CamaraFotoFrente from '@/components/registro/CamaraFotoFrente';

type Props = {
  label?: string;
  required?: boolean;
  file: File | null;
  onFile: (file: File | null) => void;
  labelClass?: string;
};

export default function CampoFotoFrente({
  label = 'Foto de frente',
  required = true,
  file,
  onFile,
  labelClass = 'text-[10px] font-bold uppercase tracking-wide text-zinc-500',
}: Props) {
  const [camara, setCamara] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? ' *' : ''}
      </label>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        Abre la cámara y acerca el teléfono hasta que tu cara llene el óvalo.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCamara(true)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF9500] px-3 py-2.5 text-sm font-semibold text-black min-w-[140px]"
        >
          <Camera className="h-4 w-4" aria-hidden />
          Abrir cámara
        </button>
        <button
          type="button"
          onClick={() => galeriaRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-zinc-200"
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          Galería
        </button>
      </div>
      <input
        ref={galeriaRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file && preview ? (
        <div className="mt-2 flex items-center gap-2">
          <img
            src={preview}
            alt="Foto de frente"
            className="h-14 w-14 rounded-full object-cover object-top ring-1 ring-white/20"
          />
          <p className="truncate text-xs text-emerald-400/90">Foto de frente lista</p>
        </div>
      ) : null}
      <CamaraFotoFrente open={camara} onClose={() => setCamara(false)} onCapture={(f) => onFile(f)} />
    </div>
  );
}
