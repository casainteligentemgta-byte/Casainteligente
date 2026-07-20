'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import type { CcoAuditoriaEvento } from '@/lib/contabilidad/cco/cargarAuditoria';
import {
  fmtBytes,
  fmtResumen,
  type CcoSnapshotMeta,
} from '@/lib/contabilidad/cco/snapshotsUi';

export default function CcoTabAuditoria({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [eventos, setEventos] = useState<CcoAuditoriaEvento[]>([]);
  const [snapshots, setSnapshots] = useState<CcoSnapshotMeta[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapBusy, setSnapBusy] = useState<string | null>(null);
  const [snapError, setSnapError] = useState<string | null>(null);

  const cargarEventos = useCallback(async () => {
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

  const cargarSnapshots = useCallback(async () => {
    if (!proyectoId) {
      setSnapshots([]);
      return;
    }
    setSnapLoading(true);
    setSnapError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/snapshots?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error([json.error, json.hint].filter(Boolean).join(' · ') || 'Error');
      }
      setSnapshots(json.snapshots ?? []);
    } catch (e) {
      setSnapError(e instanceof Error ? e.message : 'Error');
      setSnapshots([]);
    } finally {
      setSnapLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargarEventos();
  }, [cargarEventos]);

  useEffect(() => {
    void cargarSnapshots();
  }, [cargarSnapshots]);

  const crearPunto = async () => {
    if (!proyectoId) return;
    setSnapBusy('create');
    setOkMsg(null);
    setSnapError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, motivo: 'manual' }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error([json.error, json.hint].filter(Boolean).join(' · ') || 'No se pudo crear');
      }
      setOkMsg(`Punto de restauración creado: ${json.snapshot?.label ?? 'ok'}`);
      await Promise.all([cargarSnapshots(), cargarEventos()]);
    } catch (e) {
      setSnapError(e instanceof Error ? e.message : 'Error al crear snapshot');
    } finally {
      setSnapBusy(null);
    }
  };

  const restaurar = async (snap: CcoSnapshotMeta) => {
    if (!proyectoId) return;
    const ok = window.confirm(
      [
        `¿Restablecer el libro CCO de esta obra al punto:`,
        `«${snap.label ?? snap.id.slice(0, 8)}»`,
        `(${String(snap.punto_en_tiempo).slice(0, 19).replace('T', ' ')})?`,
        '',
        'Se creará un snapshot de seguridad antes.',
        'No se modifica stock/almacén.',
        'Gastos de Telegram/canal protegidos no se borran.',
      ].join('\n'),
    );
    if (!ok) return;

    setSnapBusy(snap.id);
    setOkMsg(null);
    setSnapError(null);
    try {
      const res = await fetch(`/api/contabilidad/cco/snapshots/${snap.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, confirmar: true }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        const aviso =
          Array.isArray(json.avisos) && json.avisos.length
            ? ` Avisos: ${json.avisos.slice(0, 2).join('; ')}`
            : '';
        throw new Error((json.error || 'Restauración incompleta') + aviso);
      }
      const r = json.restaurado ?? {};
      setOkMsg(
        [
          `Restaurado «${snap.label ?? ''}».`,
          `Gastos ${Number(r.gastos_upsert ?? 0) + Number(r.gastos_insert ?? 0)}`,
          `ingresos ${r.ingresos ?? 0}`,
          `contratos ${r.contratos ?? 0}`,
          r.gastos_protegidos ? `(${r.gastos_protegidos} protegidos)` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      );
      await Promise.all([cargarSnapshots(), cargarEventos()]);
    } catch (e) {
      setSnapError(e instanceof Error ? e.message : 'Error al restaurar');
    } finally {
      setSnapBusy(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Puntos de restauración */}
      <div style={box}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, flex: 1 }}>
            Puntos de restauración
          </h3>
          <button
            type="button"
            onClick={() => void crearPunto()}
            disabled={!proyectoId || snapBusy === 'create'}
            style={{
              ...btnPrimary,
              opacity: !proyectoId || snapBusy === 'create' ? 0.55 : 1,
            }}
          >
            {snapBusy === 'create' ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Save size={14} />
            )}
            Crear punto ahora
          </button>
          <button type="button" onClick={() => void cargarSnapshots()} style={btn}>
            Actualizar
          </button>
        </div>
        <p style={muted}>
          Guarda el libro CCO de la obra (gastos obra, ingresos, contratos, presupuestos, config) para
          volver a un día o momento anterior. <strong>No toca stock</strong>. Cron diario a las 00:00
          Caracas aprox. Requiere migración <code>275</code>.
          {!proyectoId ? ' Selecciona una obra arriba.' : null}
        </p>
        {snapError ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{snapError}</p> : null}
        {okMsg ? <p style={{ color: '#15803D', fontSize: 13 }}>{okMsg}</p> : null}
        {!proyectoId ? (
          <p style={muted}>Selecciona una obra para ver y crear puntos de restauración.</p>
        ) : snapLoading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} /> Cargando puntos…
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 280 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {['FECHA', 'ETIQUETA', 'MOTIVO', 'CONTENIDO', 'TAMAÑO', 'ACTOR', ''].map((h) => (
                    <th
                      key={h || 'act'}
                      style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748B' }}>
                      {String(s.punto_en_tiempo).slice(0, 19).replace('T', ' ')}
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>{s.label ?? '—'}</td>
                    <td style={td}>
                      <span style={motivoBadge(s.motivo)}>{s.motivo}</span>
                    </td>
                    <td style={td}>{fmtResumen(s.resumen)}</td>
                    <td style={td}>{fmtBytes(s.bytes_aprox)}</td>
                    <td style={td}>{s.creado_por ?? '—'}</td>
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => void restaurar(s)}
                        disabled={snapBusy === s.id}
                        style={{
                          ...btnRestore,
                          opacity: snapBusy === s.id ? 0.55 : 1,
                        }}
                        title="Restablecer libro CCO a este punto"
                      >
                        {snapBusy === s.id ? (
                          <Loader2 className="animate-spin" size={13} />
                        ) : (
                          <RotateCcw size={13} />
                        )}
                        Restablecer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshots.length === 0 ? (
              <p style={muted}>Sin puntos aún. Crea uno manual o espera el cron diario.</p>
            ) : null}
          </div>
        )}
      </div>

      {/* Eventos */}
      <div style={box}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, flex: 1 }}>Auditoría CCO</h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar acción / detalle / actor…"
            style={input}
          />
          <button type="button" onClick={() => void cargarEventos()} style={btn}>
            Actualizar
          </button>
        </div>
        <p style={muted}>
          Eventos append-only (import, ediciones, snapshots, restauraciones).{' '}
          {proyectoId ? 'Filtrado por obra.' : 'Todas las obras — selecciona una para acotar.'}
        </p>
        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {loading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {['FECHA', 'ACTOR', 'ACCIÓN', 'DETALLE'].map((h) => (
                    <th
                      key={h}
                      style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748B' }}>{e.fecha || '—'}</td>
                    <td style={td}>
                      <span style={actorBadge}>{e.actor?.trim() || 'Sin actor'}</span>
                    </td>
                    <td style={td}>
                      <span style={badge}>{e.accion}</span>
                    </td>
                    <td style={{ ...td, maxWidth: 420 }} title={e.detalle ?? ''}>
                      {(e.detalle ?? '—').slice(0, 200)}
                      {(e.detalle ?? '').length > 200 ? '…' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {eventos.length === 0 ? <p style={muted}>Sin eventos para el filtro actual.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function motivoBadge(motivo: string): React.CSSProperties {
  const bg =
    motivo === 'diario'
      ? '#DBEAFE'
      : motivo === 'pre_restore'
        ? '#FEF3C7'
        : motivo === 'manual'
          ? '#DCFCE7'
          : '#F1F5F9';
  return {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 6,
    background: bg,
    fontWeight: 800,
    fontSize: 10,
    textTransform: 'uppercase',
  };
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
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  background: '#0F172A',
  color: '#fff',
  borderRadius: 8,
  padding: '7px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const btnRestore: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: '1px solid #F59E0B',
  background: '#FFFBEB',
  color: '#92400E',
  borderRadius: 8,
  padding: '5px 10px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 11,
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
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
