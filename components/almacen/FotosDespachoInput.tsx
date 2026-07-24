'use client';

import { useRef } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';

export type FotoDespachoItem = {
  id: string;
  file: File;
  previewUrl: string;
};

type Props = {
  fotos: FotoDespachoItem[];
  onChange: (fotos: FotoDespachoItem[]) => void;
  disabled?: boolean;
  maxFotos?: number;
};

function newFotoId(): string {
  return `foto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

export function FotosDespachoInput({ fotos, onChange, disabled, maxFotos = 6 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const agregar = (files: FileList | null) => {
    if (!files?.length) return;
    const restantes = maxFotos - fotos.length;
    if (restantes <= 0) return;

    const nuevas: FotoDespachoItem[] = [];
    for (let i = 0; i < Math.min(files.length, restantes); i++) {
      const file = files[i]!;
      if (!file.type.startsWith('image/')) continue;
      nuevas.push({
        id: newFotoId(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (nuevas.length) onChange([...fotos, ...nuevas]);
  };

  const quitar = (id: string) => {
    const hit = fotos.find((f) => f.id === id);
    if (hit) URL.revokeObjectURL(hit.previewUrl);
    onChange(fotos.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-500/25 bg-zinc-500/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-zinc-300" />
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Fotos del material saliente (opcional)
          </p>
        </div>
        <span className="text-[10px] text-zinc-500">
          {fotos.length}/{maxFotos}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        disabled={disabled || fotos.length >= maxFotos}
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-2">
        {fotos.map((f) => (
          <div
            key={f.id}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-white/15"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.previewUrl} alt="Material saliente" className="h-full w-full object-cover" />
            <button
              type="button"
              disabled={disabled}
              onClick={() => quitar(f.id)}
              className="absolute right-0.5 top-0.5 rounded bg-black/70 p-1 text-red-300 hover:text-red-200"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {fotos.length < maxFotos ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 bg-black/30 text-[10px] text-zinc-400 hover:border-white/35 hover:text-zinc-200"
          >
            <ImagePlus className="h-5 w-5" />
            Agregar
          </button>
        ) : null}
      </div>

      <p className="text-[10px] text-zinc-500">
        Puede tomar una o varias fotos con la cámara o elegir desde la galería.
      </p>
    </div>
  );
}

export default FotosDespachoInput;
