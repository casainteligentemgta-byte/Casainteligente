'use client';

import React, { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import type { ProyectoCatalogo } from '@/lib/proyectos/proyectosUnificados';

type Props = {
  proyectos: ProyectoCatalogo[];
  proyectoIdInicial?: string | null;
  onImportado?: (proyectoId: string) => void;
};

type ImportResult = {
  parsed: number;
  inserted: number;
  skipped: number;
  batches: number;
  replaced: boolean;
  totalEnTabla?: number;
  mode?: string;
};

export default function CcoImportarCsvPanel({
  proyectos,
  proyectoIdInicial,
  onImportado,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const obraHint = (() => {
    if (!proyectoIdInicial) return 'Selecciona una obra en el dashboard antes de importar.';
    const p = proyectos.find((x) => x.id === proyectoIdInicial);
    return p
      ? `Reemplaza el libro CSV de: ${p.nombre}`
      : 'Reemplaza el libro CSV de la obra activa.';
  })();

  const runImport = useCallback(
    async (file: File) => {
      if (!proyectoIdInicial) {
        setError('Selecciona una obra en el dashboard antes de importar el CSV diario.');
        return;
      }
      setBusy(true);
      setError(null);
      setResult(null);
      setFileName(file.name);
      setProgress('Leyendo CSV…');
      try {
        const csvText = await file.text();
        if (!csvText.trim()) throw new Error('El archivo está vacío.');
        setProgress('Reemplazando libro de la obra (sin duplicar)…');

        const res = await fetch('/api/contabilidad/cco/gastos/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvText, proyectoId: proyectoIdInicial }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) {
          throw new Error(json.error ?? 'No se pudo importar el CSV.');
        }

        const out: ImportResult = {
          parsed: Number(json.parsed) || 0,
          inserted: Number(json.inserted) || 0,
          skipped: Number(json.skipped) || 0,
          batches: Number(json.batches) || 0,
          replaced: true,
          totalEnTabla: Number(json.totalEnTabla) || undefined,
          mode: typeof json.mode === 'string' ? json.mode : undefined,
        };
        setResult(out);
        setProgress(null);
        onImportado?.(proyectoIdInicial);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al importar');
        setProgress(null);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onImportado, proyectoIdInicial],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void runImport(file);
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '24px 26px',
        maxWidth: 720,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
        Cargar CSV Diario
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
        Importa el export Antigravity / RANCHO (ej. <code style={code}>RANCHO 20072026.csv</code>)
        directamente a <strong>registros_gastos</strong>. El CSV es un acumulado: cada carga{' '}
        <strong>reemplaza</strong> el libro completo (no duplica). KPIs y libro se refrescan al terminar.
      </p>

      <p style={{ fontSize: 12, color: '#64748B', margin: '12px 0 16px' }}>{obraHint}</p>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!busy) inputRef.current?.click();
          }
        }}
        style={{
          border: `2px dashed ${dragOver ? '#2563EB' : '#94A3B8'}`,
          background: dragOver ? '#EFF6FF' : '#F8FAFC',
          borderRadius: 14,
          padding: '36px 20px',
          textAlign: 'center',
          cursor: busy ? 'wait' : 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {busy ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Loader2 className="animate-spin" size={32} color="#2563EB" />
            <div style={{ fontWeight: 800, color: '#0F172A', fontSize: 15 }}>
              {progress ?? 'Importando…'}
            </div>
            {fileName ? (
              <div style={{ fontSize: 12, color: '#64748B' }}>{fileName}</div>
            ) : null}
          </div>
        ) : (
          <>
            <UploadCloud size={36} color="#2563EB" style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>
              Arrastra el CSV aquí o haz clic para elegir
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#64748B' }}>
              Columnas: CLASE, FECHA, PROVEEDOR, MONTO BASE USD, COSTO TOTAL, …
            </div>
            <div
              style={{
                marginTop: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#2563EB',
                color: '#fff',
                borderRadius: 10,
                padding: '10px 16px',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              <FileSpreadsheet size={16} />
              Cargar CSV Diario
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          disabled={busy}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void runImport(f);
          }}
        />
      </div>

      {error ? (
        <pre
          style={{
            marginTop: 16,
            color: '#B91C1C',
            fontSize: 13,
            whiteSpace: 'pre-wrap',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            padding: 12,
          }}
        >
          {error}
        </pre>
      ) : null}

      {result ? (
        <div
          style={{
            marginTop: 16,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 10,
            padding: 14,
            color: '#14532D',
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ fontSize: 14 }}>Importación completada</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>
              Procesadas: <strong>{result.parsed.toLocaleString('es-VE')}</strong> filas
            </li>
            <li>
              En tabla ahora: <strong>
                {(result.totalEnTabla ?? result.inserted).toLocaleString('es-VE')}
              </strong>{' '}
              (reemplazo limpio, sin duplicar)
            </li>
            {result.skipped > 0 ? <li>Omitidas (vacías): {result.skipped}</li> : null}
            <li>Lotes: {result.batches}{result.mode ? ` · modo ${result.mode}` : ''}</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const code: React.CSSProperties = {
  background: '#F1F5F9',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 12,
};
