'use client';

import { useId, useRef, useState } from 'react';
import { Camera, FileUp, Loader2 } from 'lucide-react';
import { compressImageForUpload } from '@/lib/reclutamiento/compressImageForUpload';

export type DocumentUploadResult = {
  file: File;
  publicUrl?: string;
};

type DocumentUploadProps = {
  label: string;
  onUploadSuccess: (result: DocumentUploadResult) => void;
  onUploadError?: (error: string) => void;
  currentFileName?: string | null;
  /** Si se define, sube al bucket al elegir archivo (comprime imágenes antes). */
  uploadOnSelect?: (file: File) => Promise<{ publicUrl?: string } | void>;
  /** Muestra botón de cámara trasera en móvil (recomendado para cédula). */
  preferCamera?: boolean;
  acceptFiles?: string;
};

async function prepareFileForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }
  const blob = await compressImageForUpload(file);
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  return new File([blob], file.name.replace(/\.\w+$/, '') || `captura.${ext}`, {
    type: blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
  });
}

export default function DocumentUpload({
  label,
  onUploadSuccess,
  onUploadError,
  currentFileName,
  uploadOnSelect,
  preferCamera = true,
  acceptFiles = 'image/*,application/pdf',
}: DocumentUploadProps) {
  const cameraInputId = useId();
  const fileInputId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastName, setLastName] = useState<string | null>(currentFileName ?? null);

  async function handleFile(raw: File | undefined) {
    if (!raw || uploading) return;
    setUploading(true);
    try {
      const file = await prepareFileForUpload(raw);
      let publicUrl: string | undefined;
      if (uploadOnSelect) {
        const out = await uploadOnSelect(file);
        publicUrl = out?.publicUrl;
      }
      setLastName(file.name);
      onUploadSuccess({ file, publicUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo subir el archivo';
      onUploadError?.(msg);
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const displayName = lastName ?? currentFileName;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm font-medium text-zinc-300">{label}</p>
      {displayName ? (
        <p className="truncate text-xs text-amber-500">Archivo: {displayName}</p>
      ) : (
        <p className="text-xs text-zinc-500">Toma una foto clara o elige un archivo (JPG, PNG o PDF).</p>
      )}

      <input
        ref={cameraRef}
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture={preferCamera ? 'environment' : undefined}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        id={fileInputId}
        type="file"
        accept={acceptFiles}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        {preferCamera ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50 min-w-[140px]"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {uploading ? 'Subiendo…' : 'Tomar foto'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50 min-w-[140px]"
        >
          {uploading && !preferCamera ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          Elegir archivo
        </button>
      </div>
    </div>
  );
}
