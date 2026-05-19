'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ImportarProps = {
  proyectoId: string;
  onSuccess?: () => void;
  className?: string;
};

export default function ImportarPresupuestoLulo({ proyectoId, onSuccess, className = '' }: ImportarProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reemplazar, setReemplazar] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecciona un archivo CSV primero');
      return;
    }
    if (!proyectoId.trim()) {
      toast.error('Proyecto no válido');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('proyectoId', proyectoId.trim());
    if (reemplazar) formData.append('reemplazar', '1');

    try {
      const res = await fetch('/api/proyectos/presupuesto/importar-lulo', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || 'Error en la carga');

      toast.success(data.message || 'Presupuesto cargado correctamente.');
      setFile(null);
      onSuccess?.();
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error de importación: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`bg-[#0A0A0F] border border-white/10 p-5 rounded-xl text-white max-w-sm ${className}`.trim()}
    >
      <div className="flex items-center gap-2 mb-3">
        <FileSpreadsheet className="text-[#34C759] h-5 w-5 shrink-0" />
        <h4 className="text-sm font-semibold">Importar desde Lulo Software</h4>
      </div>

      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
        Exporta tu presupuesto de Lulo a Excel, guárdalo como formato `.csv` e impórtalo para fijar el
        costo tope del proyecto.
      </p>

      <div className="space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-white hover:file:bg-white/10"
        />

        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={reemplazar}
            onChange={(e) => setReemplazar(e.target.checked)}
            className="rounded border-white/20 bg-white/5"
          />
          Reemplazar partidas Lulo anteriores de este proyecto
        </label>

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full bg-[#34C759] hover:bg-[#2eb04f] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-medium py-2 px-4 rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Procesar presupuesto meta
            </>
          )}
        </button>
      </div>
    </div>
  );
}
