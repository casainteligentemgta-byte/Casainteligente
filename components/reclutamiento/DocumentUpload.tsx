'use client';

import { useState } from 'react';

type DocumentUploadProps = {
  label: string;
  onUploadSuccess: (file: File) => void;
  onUploadError?: (error: string) => void;
  currentFileName?: string | null;
};

// Componente de carga optimizado para capturar fotos en móvil
export default function DocumentUpload({ label, onUploadSuccess, currentFileName }: DocumentUploadProps) {
  return (
    <div className="flex flex-col gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <label className="text-sm font-medium text-zinc-300">{label}</label>
      {currentFileName ? (
        <div className="text-xs text-amber-500 mb-2 truncate">Archivo actual: {currentFileName}</div>
      ) : null}
      <input 
        type="file" 
        accept="image/*,application/pdf"
        capture="environment" // Esto abre la cámara trasera directamente en muchos dispositivos móviles
        className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onUploadSuccess(file);
          }
        }}
      />
    </div>
  );
}
