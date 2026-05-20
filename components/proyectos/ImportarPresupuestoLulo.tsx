'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, Loader2, Database, Table2 } from 'lucide-react';
import { toast } from 'sonner';

type ImportarProps = {
  proyectoId: string;
  onSuccess?: () => void;
  className?: string;
};

type ImportResponse = {
  error?: string;
  message?: string;
  partidas?: number;
  gastos?: number;
  presupuestoTotalUsd?: number;
  meta?: {
    partidasTable?: string | null;
    gastosTable?: string | null;
    tableNames?: string[];
  };
};

export default function ImportarPresupuestoLulo({ proyectoId, onSuccess, className = '' }: ImportarProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reemplazar, setReemplazar] = useState(false);
  const [importarGastos, setImportarGastos] = useState(true);
  const [ultimoResumen, setUltimoResumen] = useState<string | null>(null);

  const esMdb = file?.name.toLowerCase().endsWith('.mdb') || file?.name.toLowerCase().endsWith('.accdb');

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecciona un archivo primero');
      return;
    }
    if (!proyectoId.trim()) {
      toast.error('Proyecto no válido');
      return;
    }

    setUploading(true);
    setUltimoResumen(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('proyectoId', proyectoId.trim());
    if (reemplazar) formData.append('reemplazar', '1');
    if (!importarGastos) formData.append('importarGastos', '0');

    try {
      const res = await fetch('/api/proyectos/presupuesto/importar-lulo', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ImportResponse;
      if (!res.ok) throw new Error(data.error || 'Error en la carga');

      const lineas: string[] = [];
      if (data.partidas != null) lineas.push(`${data.partidas} partidas`);
      if (data.gastos != null && data.gastos > 0) lineas.push(`${data.gastos} gastos`);
      if (data.presupuestoTotalUsd != null) {
        lineas.push(
          `Presupuesto total ~${data.presupuestoTotalUsd.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
          })}`,
        );
      }
      if (data.meta?.partidasTable) lineas.push(`Tabla partidas: ${data.meta.partidasTable}`);
      if (data.meta?.gastosTable) lineas.push(`Tabla gastos: ${data.meta.gastosTable}`);

      const resumen = lineas.join(' · ');
      setUltimoResumen(resumen);
      toast.success(data.message || 'Importación completada.');
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
      className={`bg-[#0A0A0F] border border-white/10 p-5 rounded-xl text-white max-w-md ${className}`.trim()}
    >
      <div className="flex items-center gap-2 mb-3">
        {esMdb ? (
          <Database className="text-sky-400 h-5 w-5 shrink-0" />
        ) : (
          <FileSpreadsheet className="text-[#34C759] h-5 w-5 shrink-0" />
        )}
        <h4 className="text-sm font-semibold">Importar desde Lulo Software</h4>
      </div>

      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
        Sube el archivo <strong className="text-zinc-300">.mdb / .accdb</strong> de Lulo (Access) o un{' '}
        <strong className="text-zinc-300">.csv</strong> exportado. Se importan{' '}
        <span className="text-emerald-400">partidas de presupuesto</span>
        {importarGastos ? (
          <>
            {' '}
            y <span className="text-sky-400">gastos de obra</span>
          </>
        ) : null}{' '}
        vinculados a este proyecto.
      </p>

      <div className="space-y-3">
        <input
          type="file"
          accept=".csv,text/csv,.mdb,.accdb"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-white hover:file:bg-white/10"
        />

        {esMdb ? (
          <p className="text-[11px] text-sky-400/90">
            MDB detectado: se analizarán tablas de partidas y gastos automáticamente.
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={reemplazar}
            onChange={(e) => setReemplazar(e.target.checked)}
            className="rounded border-white/20 bg-white/5"
          />
          Reemplazar importaciones Lulo anteriores de este proyecto
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={importarGastos}
            onChange={(e) => setImportarGastos(e.target.checked)}
            className="rounded border-white/20 bg-white/5"
          />
          Importar gastos de obra (si el MDB los incluye)
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
              {esMdb ? 'Analizar e importar MDB' : 'Procesar presupuesto CSV'}
            </>
          )}
        </button>

        {ultimoResumen ? (
          <p className="text-[11px] leading-relaxed text-zinc-500 border-t border-white/10 pt-3">
            Última importación: {ultimoResumen}
          </p>
        ) : null}

        <Link
          href={`/proyectos/modulo/${proyectoId}/lulo`}
          className="flex items-center justify-center gap-2 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10"
        >
          <Table2 className="h-3.5 w-3.5" />
          Ver y editar tablas importadas
        </Link>
      </div>
    </div>
  );
}
