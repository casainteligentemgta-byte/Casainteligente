'use client';

import React, { useState } from 'react';
import type { CcoV4ImportPayload } from '@/lib/contabilidad/cco/importarMaestroV4';

type Props = {
  proyectoId: string;
  onDone?: () => void;
};

export default function CcoImportarV4Panel({ proyectoId, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    if (!proyectoId) {
      setError('Selecciona una obra destino antes de importar.');
      return;
    }
    setBusy(true);
    setError(null);
    setLog(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CcoV4ImportPayload;
      const payload: CcoV4ImportPayload = {
        ...parsed,
        proyecto_id: proyectoId,
        auto_vincular: parsed.auto_vincular !== false,
      };
      if (!Array.isArray(payload.transacciones)) {
        throw new Error('JSON inválido: falta transacciones[]');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: 24,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Importar V4 lite</h3>
      <p style={{ color: '#64748B', fontSize: 13, margin: '8px 0 14px', lineHeight: 1.55 }}>
        Importación ligera desde JSON exportado del CCO V4 (SQLite → ETL).
        <br />
        1) Genera el JSON con{' '}
        <code style={code}>python scripts/etl_cco_v4_sqlite.py --out tmp/cco_v4.json</code>
        <br />
        2) Aplica migraciones <code style={code}>268</code> + <code style={code}>269</code> en Supabase
        <br />
        3) Elige la obra destino arriba y sube el JSON aquí (sin tocar stock).
      </p>
      {!proyectoId ? (
        <p style={{ color: '#B45309', fontSize: 13, fontWeight: 700 }}>
          Selecciona una obra en el filtro del dashboard antes de importar.
        </p>
      ) : null}
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
        {busy ? 'Importando…' : 'Elegir cco_v4_import.json'}
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy || !proyectoId}
          style={{ display: 'none' }}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error ? (
        <pre style={{ marginTop: 14, color: '#B91C1C', fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</pre>
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
