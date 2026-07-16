'use client';

import React, { useState } from 'react';

type Props = {
  proyectoId: string;
  disabled?: boolean;
};

export default function CcoExportBar({ proyectoId, disabled }: Props) {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function descargar(kind: 'excel' | 'pdf') {
    if (!proyectoId || disabled) return;
    setBusy(kind);
    setError(null);
    try {
      const path =
        kind === 'excel'
          ? `/api/contabilidad/cco/export/excel?proyecto=${encodeURIComponent(proyectoId)}`
          : `/api/contabilidad/cco/export/pdf-rubros?proyecto=${encodeURIComponent(proyectoId)}`;
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Error HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const m = /filename="?([^"]+)"?/.exec(cd);
      const filename =
        m?.[1] ?? (kind === 'excel' ? 'CCO_maestro.xls' : 'CCO_rubros.pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        disabled={!proyectoId || disabled || busy !== null}
        onClick={() => void descargar('excel')}
        style={btn('#15803D')}
        title={!proyectoId ? 'Selecciona una obra' : 'Exportar libro a Excel'}
      >
        {busy === 'excel' ? 'Excel…' : '⬇ Excel maestro'}
      </button>
      <button
        type="button"
        disabled={!proyectoId || disabled || busy !== null}
        onClick={() => void descargar('pdf')}
        style={btn('#1D4ED8')}
        title={!proyectoId ? 'Selecciona una obra' : 'PDF rubros por subcontratista'}
      >
        {busy === 'pdf' ? 'PDF…' : '⬇ PDF rubros'}
      </button>
      {error ? <span style={{ color: '#B91C1C', fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '8px 12px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
    opacity: 1,
  };
}
