'use client';

import React, { useRef } from 'react';
import { Camera, FolderOpen } from 'lucide-react';

type Props = {
  disabled?: boolean;
  loading?: boolean;
  onSelect: (file: File) => void;
  variant?: 'primary' | 'secondary';
};

export function ProcurementDocumentAttach({
  disabled = false,
  loading = false,
  onSelect,
  variant = 'secondary',
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const blocked = disabled || loading;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onSelect(file);
  };

  const baseBtn =
    'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm transition-all disabled:opacity-50 disabled:pointer-events-none';

  const cameraBtn =
    variant === 'primary'
      ? `${baseBtn} bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20`
      : `${baseBtn} bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700`;

  const fileBtn =
    variant === 'primary'
      ? `${baseBtn} bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/10`
      : `${baseBtn} bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-700`;

  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center w-full max-w-md mx-auto">
      <button
        type="button"
        className={cameraBtn}
        disabled={blocked}
        onClick={() => cameraRef.current?.click()}
      >
        <Camera size={20} aria-hidden />
        {loading ? 'Procesando…' : 'Tomar foto'}
      </button>
      <button
        type="button"
        className={fileBtn}
        disabled={blocked}
        onClick={() => fileRef.current?.click()}
      >
        <FolderOpen size={20} aria-hidden />
        PDF o galería
      </button>

      <input
        ref={cameraRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        disabled={blocked}
        aria-label="Tomar foto de la factura con la cámara"
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/*"
        onChange={onChange}
        disabled={blocked}
        aria-label="Elegir PDF o imagen desde archivos"
      />
    </div>
  );
}

