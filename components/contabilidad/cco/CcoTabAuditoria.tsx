'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CcoAuditoriaEvento } from '@/lib/contabilidad/cco/cargarAuditoria';
import {
  enriquecerDetalleAuditoria,
  etiquetaActor,
} from '@/lib/contabilidad/cco/auditoriaUi';

export default function CcoTabAuditoria({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [eventos, setEventos] = useState<CcoAuditoriaEvento[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);

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
          placeholder="Buscar acción / detalle / actor…"
          style={input}
        />
        <button type="button" onClick={() => void cargar()} style={btn}>
          Actualizar
        </button>
      </div>
      <p style={muted}>
        Quién hizo qué: actor de sesión + detalle puntual (import, ediciones, contratos, ajustes).{' '}
        {proyectoId ? 'Filtrado por obra.' : 'Todas las obras — selecciona una para acotar.'}
      </p>
      {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
      {loading ? (
        <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando…
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 560 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                {['FECHA', 'ACTOR', 'ACCIÓN', 'DETALLE'].map((h) => (
                  <th key={h} style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const detalle = enriquecerDetalleAuditoria({
                  accion: e.accion,
                  detalle: e.detalle,
                  metadata: e.metadata,
                });
                const abierto = expandido === e.id;
                const corto = detalle.length > 180 && !abierto;
                return (
                  <tr key={e.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748B' }}>{e.fecha || '—'}</td>
                    <td style={td}>
                      <span style={actorBadge} title={e.actor ?? undefined}>
                        {etiquetaActor(e.actor)}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={badge}>{e.accion}</span>
                    </td>
                    <td style={{ ...td, maxWidth: 480, lineHeight: 1.45 }}>
                      <span title={detalle}>
                        {corto ? `${detalle.slice(0, 180)}…` : detalle}
                      </span>
                      {detalle.length > 180 ? (
                        <button
                          type="button"
                          onClick={() => setExpandido(abierto ? null : e.id)}
                          style={linkBtn}
                        >
                          {abierto ? 'menos' : 'más'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
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
const td: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'top', color: '#334155' };
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
const actorBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 8px',
  borderRadius: 8,
  background: '#ECFDF5',
  color: '#065F46',
  fontWeight: 700,
  fontSize: 11,
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const linkBtn: React.CSSProperties = {
  marginLeft: 6,
  border: 'none',
  background: 'transparent',
  color: '#1D4ED8',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
};
