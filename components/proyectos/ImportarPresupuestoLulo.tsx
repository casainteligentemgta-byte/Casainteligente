'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, Database, Table2, Search, Settings } from 'lucide-react';

function EngranajeProcesando({ texto, grande = false }: { texto: string; grande?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 ${grande ? 'flex-col py-4' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={texto}
    >
      <Settings
        className={`animate-spin shrink-0 text-sky-400 ${grande ? 'h-9 w-9' : 'h-3.5 w-3.5'}`}
        aria-hidden
      />
      <span className={`text-zinc-400 ${grande ? 'text-xs text-center' : 'text-xs'}`}>{texto}</span>
    </div>
  );
}
import { toast } from 'sonner';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { LuloMapeoColumnasElite } from '@/components/proyectos/LuloMapeoColumnasElite';
import { LuloSeleccionTablaElite } from '@/components/proyectos/LuloSeleccionTablaElite';
import type { LuloCustomPartidaMapping } from '@/lib/proyectos/luloStandardColumns';

type ImportarProps = {
  proyectoId: string;
  onSuccess?: () => void;
  className?: string;
};

type TablaInspeccion = {
  name: string;
  rowCount: number;
  columns: string[];
  partidaScore?: number;
  gastoScore?: number;
};

type ImportResponse = {
  success?: boolean;
  requireMapping?: boolean;
  requireTableSelection?: boolean;
  availableTables?: string[];
  detectedColumns?: string[];
  suggestedTable?: string | null;
  hint?: string;
  error?: string;
  message?: string;
  partidas?: number;
  gastos?: number;
  presupuestoTotalUsd?: number;
  meta?: {
    partidasTable?: string | null;
    gastosTable?: string | null;
    tableNames?: string[];
    diagnosticoResumen?: string;
    tablasDiagnostico?: TablaInspeccion[];
  };
  tables?: TablaInspeccion[];
  diagnosticoResumen?: string;
};

type MappingPending = {
  detectedColumns: string[];
  suggestedTable: string | null;
  hint?: string;
};

type TableSelectionPending = {
  availableTables: string[];
  hint?: string;
};

export default function ImportarPresupuestoLulo({ proyectoId, onSuccess, className = '' }: ImportarProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reemplazar, setReemplazar] = useState(false);
  const [importarGastos, setImportarGastos] = useState(true);
  const [ultimoResumen, setUltimoResumen] = useState<string | null>(null);
  const [inspeccionando, setInspeccionando] = useState(false);
  const [inspeccion, setInspeccion] = useState<string | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [mappingPending, setMappingPending] = useState<MappingPending | null>(null);
  const [tableSelectionPending, setTableSelectionPending] = useState<TableSelectionPending | null>(
    null,
  );
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const esMdb = file?.name.toLowerCase().endsWith('.mdb') || file?.name.toLowerCase().endsWith('.accdb');
  const procesando = uploading || inspeccionando;

  const handleInspeccionar = async () => {
    if (!file || !esMdb) {
      toast.error('Selecciona un archivo .mdb o .accdb');
      return;
    }
    setInspeccionando(true);
    setInspeccion(null);
    setErrorDetalle(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/proyectos/presupuesto/inspeccionar-mdb', {
        method: 'POST',
        body: formData,
      });
      const data = await parseFetchJson<ImportResponse>(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo inspeccionar el MDB');
      const lineas: string[] = [];
      if (data.diagnosticoResumen) lineas.push(data.diagnosticoResumen);
      for (const t of data.tables ?? []) {
        lineas.push(
          `• ${t.name}: ${t.rowCount} filas, columnas [${t.columns.slice(0, 8).join(', ')}${t.columns.length > 8 ? '…' : ''}]`,
        );
      }
      setInspeccion(lineas.join('\n') || 'MDB leído; no hay tablas con datos.');
      toast.success('Vista previa del MDB lista');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(message);
    } finally {
      setInspeccionando(false);
    }
  };

  const runImport = async (
    customMapping?: LuloCustomPartidaMapping,
    tableOverride?: string,
  ) => {
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
    setErrorDetalle(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('proyectoId', proyectoId.trim());
    if (reemplazar) formData.append('reemplazar', '1');
    if (!importarGastos) formData.append('importarGastos', '0');
    const tabla = tableOverride ?? selectedTable ?? customMapping?.tableName;
    if (tabla) formData.append('tableName', tabla);
    if (customMapping) {
      formData.append('customMapping', JSON.stringify(customMapping));
    }

    try {
      const res = await fetch('/api/proyectos/presupuesto/importar-lulo', {
        method: 'POST',
        body: formData,
      });

      const data = await parseFetchJson<ImportResponse>(res);

      if (res.status === 422 && data.requireTableSelection) {
        const tables =
          data.availableTables?.length
            ? data.availableTables
            : data.meta?.tableNames ?? [];
        setTableSelectionPending({ availableTables: tables, hint: data.hint });
        setMappingPending(null);
        toast.message('Selecciona la tabla del presupuesto', {
          description: data.hint ?? 'El MDB no tiene tabla Partidas ni Presupuesto.',
        });
        return;
      }

      if (res.status === 422 && data.requireMapping) {
        const cols =
          data.detectedColumns?.length
            ? data.detectedColumns
            : data.meta?.tablasDiagnostico?.[0]?.columns ?? [];
        setMappingPending({
          detectedColumns: cols,
          suggestedTable:
            data.suggestedTable ?? data.meta?.partidasTable ?? selectedTable ?? null,
          hint: data.hint,
        });
        setTableSelectionPending(null);
        toast.message('Mapeo de columnas requerido', {
          description: data.hint ?? 'Empareja las columnas del MDB antes de importar.',
        });
        return;
      }

      if (!res.ok) {
        const detalle =
          data.meta?.diagnosticoResumen ||
          data.meta?.tablasDiagnostico
            ?.slice(0, 4)
            .map((t) => `${t.name} (${t.rowCount} filas, score ${t.partidaScore})`)
            .join(' · ');
        if (detalle) setErrorDetalle(detalle);
        throw new Error(data.error || data.hint || 'Error en la carga');
      }

      setMappingPending(null);
      setTableSelectionPending(null);

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

  const handleUpload = () => void runImport();

  const handleImportWithMapping = (mapping: LuloCustomPartidaMapping) => {
    void runImport({
      ...mapping,
      tableName: mapping.tableName ?? selectedTable ?? undefined,
    });
  };

  const handleTableSelected = (tableName: string) => {
    setSelectedTable(tableName);
    setTableSelectionPending(null);
    void runImport(undefined, tableName);
  };

  if (tableSelectionPending) {
    return (
      <div
        className={`w-full max-w-xl mx-auto text-white ${className}`.trim()}
        data-lulo-step="table-selection"
      >
        <LuloSeleccionTablaElite
          availableTables={tableSelectionPending.availableTables}
          hint={tableSelectionPending.hint}
          fileName={file?.name ?? null}
          importing={uploading}
          onCancel={() => {
            setTableSelectionPending(null);
            setSelectedTable(null);
          }}
          onConfirm={handleTableSelected}
        />
      </div>
    );
  }

  if (mappingPending) {
    return (
      <div className={`text-white w-full max-w-lg mx-auto ${className}`.trim()}>
        <LuloMapeoColumnasElite
          detectedColumns={mappingPending.detectedColumns}
          suggestedTable={mappingPending.suggestedTable}
          hint={mappingPending.hint}
          fileName={file?.name ?? null}
          importing={uploading}
          onCancel={() => {
            setMappingPending(null);
            setSelectedTable(null);
          }}
          onConfirm={handleImportWithMapping}
        />
      </div>
    );
  }

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
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setInspeccion(null);
            setErrorDetalle(null);
            setMappingPending(null);
            setTableSelectionPending(null);
            setSelectedTable(null);
          }}
          className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-white hover:file:bg-white/10"
        />

        {procesando ? (
          <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-3">
            <EngranajeProcesando
              grande
              texto={
                inspeccionando
                  ? 'Leyendo tablas del Access…'
                  : esMdb
                    ? 'Analizando e importando el MDB…'
                    : 'Procesando el presupuesto CSV…'
              }
            />
          </div>
        ) : null}

        {esMdb ? (
          <>
            <p className="text-[11px] text-sky-400/90">
              MDB detectado: se analizarán tablas de partidas y gastos automáticamente.
            </p>
            <button
              type="button"
              onClick={handleInspeccionar}
              disabled={inspeccionando || !file}
              className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {inspeccionando ? (
                <EngranajeProcesando texto="Inspeccionando…" />
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  Inspeccionar MDB (sin importar)
                </>
              )}
            </button>
          </>
        ) : null}

        {inspeccion ? (
          <pre className="text-[10px] leading-relaxed text-zinc-500 whitespace-pre-wrap max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
            {inspeccion}
          </pre>
        ) : null}

        {errorDetalle ? (
          <p className="text-[10px] leading-relaxed text-amber-400/90 border border-amber-500/20 rounded-lg p-2 bg-amber-500/5">
            {errorDetalle}
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
            <EngranajeProcesando texto={esMdb ? 'Importando…' : 'Procesando…'} />
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
