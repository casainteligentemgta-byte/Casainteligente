'use client';

import { useId, useRef } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import {
  COSTADOS_ACTIVO,
  ETIQUETA_COSTADO,
  type CostadoActivo,
} from '@/lib/proyectos/activoFotosCostados';

export type FotoCostadoLocal = {
  file: File;
  previewUrl: string;
};

type Props = {
  value: Partial<Record<CostadoActivo, FotoCostadoLocal | null>>;
  onChange: (next: Partial<Record<CostadoActivo, FotoCostadoLocal | null>>) => void;
  disabled?: boolean;
  /** URLs ya guardadas (solo lectura / referencia). */
  existentes?: Partial<Record<CostadoActivo, { url: string } | null>>;
};

export default function FotosCostadosActivo({ value, onChange, disabled, existentes }: Props) {
  const baseId = useId();

  function setLado(lado: CostadoActivo, local: FotoCostadoLocal | null) {
    const prev = value[lado];
    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
    onChange({ ...value, [lado]: local });
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
        Fotos por los 4 costados
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COSTADOS_ACTIVO.map((lado) => (
          <SlotCostado
            key={lado}
            inputId={`${baseId}-${lado}`}
            label={ETIQUETA_COSTADO[lado]}
            local={value[lado] ?? null}
            existenteUrl={existentes?.[lado]?.url}
            disabled={disabled}
            onPick={(file) => {
              if (!file?.type.startsWith('image/')) return;
              setLado(lado, { file, previewUrl: URL.createObjectURL(file) });
            }}
            onClear={() => setLado(lado, null)}
          />
        ))}
      </div>
    </div>
  );
}

function SlotCostado({
  inputId,
  label,
  local,
  existenteUrl,
  disabled,
  onPick,
  onClear,
}: {
  inputId: string;
  label: string;
  local: FotoCostadoLocal | null;
  existenteUrl?: string;
  disabled?: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const preview = local?.previewUrl ?? existenteUrl ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <p className="border-b border-white/5 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="relative aspect-square bg-black/30">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => ref.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-500 hover:bg-white/5 disabled:opacity-50"
          >
            <Camera className="h-5 w-5 text-[#FFD60A]" />
            <span className="text-[10px]">Foto</span>
          </button>
        )}
        {preview ? (
          <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/55 p-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => ref.current?.click()}
              className="flex-1 rounded-md bg-white/10 py-1 text-[10px] font-semibold text-white hover:bg-white/20 disabled:opacity-50"
            >
              Cambiar
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="rounded-md bg-red-950/50 px-1.5 py-1 text-red-300 hover:bg-red-900/50 disabled:opacity-50"
              aria-label={`Quitar foto ${label}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
      <input
        ref={ref}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
