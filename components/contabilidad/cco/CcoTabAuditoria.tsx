'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CcoAuditoriaEvento } from '@/lib/contabilidad/cco/cargarAuditoria';

export default function CcoTabAuditoria({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [eventos, setEventos] = useState<CcoAuditoriaEvento[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: '400' });
      if (proyectoId) qs.set('proyecto', proyectoId);
      if (q.trim()) qs.set('q', q.trim());
      const res = await fetch(`/api/contabilidad/cco/auditoria?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setEventos(json.eventos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, q]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div style={box}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, flex: 1 }}>Auditoría CCO</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar acción / detalle…"
          style={input}
        />
        <button type="button" onClick={() => void cargar()} style={btn}>
          Actualizar
        </button>
      </div>
      <p style={muted}>
        Eventos append-only (import V4, contratos, ajustes, backfill).{' '}
        {proyectoId ? 'Filtrado por obra.' : 'Todas las obras — selecciona una para acotar.'}
      </p>
      {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
      {loading ? (
        <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando…
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 520 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                {['FECHA', 'ACCIÓN', 'DETALLE', 'ACTOR'].map((h) => (
                  <th key={h} style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={td}>{e.fecha || '—'}</td>
                  <td style={td}>
                    <span style={badge}>{e.accion}</span>
                  </td>
                  <td style={{ ...td, maxWidth: 360 }} title={e.detalle ?? ''}>
                    {(e.detalle ?? '—').slice(0, 120)}
                  </td>
                  <td style={td}>{e.actor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {eventos.length === 0 ? <p style={muted}>Sin eventos para el filtro actual.</p> : null}
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
};
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '0 0 12px' };
const td: React.CSSProperties = { padding: '7px 6px', verticalAlign: 'top', color: '#334155' };
const input: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 13,
  minWidth: 200,
};
const btn: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 6,
  background: '#EEF2FF',
  color: '#3730A3',
  fontWeight: 800,
  fontSize: 10,
};
