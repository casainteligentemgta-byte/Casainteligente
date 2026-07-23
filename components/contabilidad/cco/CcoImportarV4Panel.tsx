'use client';

import React, { useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import type { CcoV4ImportPayload } from '@/lib/contabilidad/cco/importarMaestroV4';
import { parseCcoV4Csv } from '@/lib/contabilidad/cco/parseCcoV4Csv';

type Props = {
  proyectoId: string;
  onDone?: () => void;
};

type DiarioResult = {
  parsed: number;
  inserted: number;
  skipped: number;
  batches: number;
  replaced: boolean;
};

/**
 * Importador dual:
 * - CSV diario → registros_gastos (fuente primaria del libro CCO)
 * - JSON V4 → pipeline legacy contabilidad_compras (import-v4)
 */
export default function CcoImportarV4Panel({ proyectoId, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function importDiarioCsv(file: File) {
    setProgress('Reemplazando registros_gastos (sin duplicar)…');
    const csvText = await file.text();
    const res = await fetch('/api/contabilidad/cco/gastos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText }),
    });
    const json = (await res.json()) as DiarioResult & {
      ok?: boolean;
      error?: string;
      totalEnTabla?: number;
      mode?: string;
    };
    if (!res.ok || json.ok === false) {
      throw new Error(json.error ?? 'Error al importar CSV diario');
    }
    setLog(
      [
        `Fuente: CSV diario → registros_gastos (reemplazo limpio)`,
        `Archivo: ${file.name}`,
        `Procesadas: ${json.parsed}`,
        `Total en tabla: ${json.totalEnTabla ?? json.inserted}`,
        json.skipped ? `Omitidas: ${json.skipped}` : null,
        `Lotes: ${json.batches}${json.mode ? ` · ${json.mode}` : ''}`,
        'Reimportar el mismo CSV deja el mismo conteo (no duplica).',
      ]
        .filter(Boolean)
        .join('\n'),
    );
    onDone?.();
  }

  async function importLegacyV4(file: File, text: string) {
    setProgress('Importando JSON/CSV al pipeline V4 legacy…');
    const name = file.name.toLowerCase();
    let payload: CcoV4ImportPayload;

    if (name.endsWith('.csv') || text.trimStart().toUpperCase().startsWith('CLASE,')) {
      payload = await parseCcoV4Csv(text, {
        proyecto_id: proyectoId,
        obra_alias: 'RANCHO FLAMBOYANT',
      });
    } else {
      const parsed = JSON.parse(text) as CcoV4ImportPayload;
      payload = {
        ...parsed,
        proyecto_id: proyectoId,
        auto_vincular: parsed.auto_vincular !== false,
      };
    }

    if (!Array.isArray(payload.transacciones)) {
      throw new Error('Archivo inválido: falta transacciones[]');
    }
    const res = await fetch('/api/contabilidad/cco/import-v4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) {
      throw new Error(
        [json.error, json.hint].filter(Boolean).join(' · ') || 'Error de importación',
      );
    }
    setLog(
      [
        `Fuente: ${name.endsWith('.csv') ? 'CSV → import-v4 legacy' : 'JSON V4'}`,
        `Filas: ${payload.transacciones.length}`,
        `Gastos: +${json.gastos?.created ?? 0} creados / ${json.gastos?.updated ?? 0} actualizados`,
        `Contratos: ${json.contratos}`,
        `Ingresos: ${json.ingresos}`,
        `Presupuestos: ${json.presupuestos}`,
        `Estructura: ${json.estructura}`,
        `Vinculados auto: ${json.vinculados}`,
        `Auditoría: ${json.auditoria}`,
        json.errores?.length ? `Avisos: ${json.errores.length}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    onDone?.();
  }

  async function onFile(file: File | null, mode: 'diario' | 'legacy' = 'diario') {
    if (!file) return;
    if (mode === 'legacy' && !proyectoId) {
      setError('Selecciona una obra destino antes de importar al pipeline V4 legacy.');
      return;
    }
    setBusy(true);
    setError(null);
    setLog(null);
    setProgress(null);
    try {
      if (mode === 'diario') {
        await importDiarioCsv(file);
      } else {
        const text = await file.text();
        await importLegacyV4(file, text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: 24,
        maxWidth: 720,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>CSV Diario → registros_gastos</h3>
      <p style={{ color: '#64748B', fontSize: 13, margin: '8px 0 14px', lineHeight: 1.55 }}>
        Arrastra el CSV del Antigravity (ej. <code style={code}>RANCHO 20072026.csv</code>). Cada carga
        reemplaza el libro completo de forma atómica (no duplica al subir el mismo archivo dos veces).
      </p>

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
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void onFile(f, 'diario');
        }}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        style={{
          border: `2px dashed ${dragOver ? '#2563EB' : '#94A3B8'}`,
          background: dragOver ? '#EFF6FF' : '#F8FAFC',
          borderRadius: 14,
          padding: '28px 16px',
          textAlign: 'center',
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Loader2 className="animate-spin" size={28} color="#2563EB" />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{progress ?? 'Importando…'}</span>
          </div>
        ) : (
          <>
            <UploadCloud size={32} color="#2563EB" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 800, fontSize: 14 }}>Cargar CSV Diario</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              Arrastra o haz clic · inserción en registros_gastos
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          style={{ display: 'none' }}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null, 'diario')}
        />
      </div>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#475569' }}>
          Avanzado: pipeline V4 legacy (JSON / CSV → contabilidad_compras)
        </summary>
        <p style={{ color: '#64748B', fontSize: 12, margin: '8px 0 10px', lineHeight: 1.5 }}>
          Requiere obra seleccionada. Migraciones 268 + 269. No es la fuente del libro si ya hay filas
          en registros_gastos.
        </p>
        {!proyectoId ? (
          <p style={{ color: '#B45309', fontSize: 13, fontWeight: 700 }}>
            Selecciona una obra en el filtro del dashboard.
          </p>
        ) : (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px dashed #94A3B8',
              background: '#F8FAFC',
              cursor: busy || !proyectoId ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 13,
              color: '#334155',
              opacity: busy || !proyectoId ? 0.6 : 1,
            }}
          >
            {busy ? 'Importando…' : 'Elegir CSV o JSON V4 (legacy)'}
            <input
              type="file"
              accept=".csv,text/csv,application/json,.json"
              disabled={busy || !proyectoId}
              style={{ display: 'none' }}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null, 'legacy')}
            />
          </label>
        )}
      </details>

      {error ? (
        <pre style={{ marginTop: 14, color: '#B91C1C', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {error}
        </pre>
      ) : null}
      {log ? (
        <pre
          style={{
            marginTop: 14,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 10,
            padding: 12,
            fontSize: 12,
            color: '#14532D',
            whiteSpace: 'pre-wrap',
          }}
        >
          {log}
        </pre>
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
