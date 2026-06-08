'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Loader2, Plus, RefreshCw } from 'lucide-react';
import {
  COLOR_ESTADO_PROCURA,
  ESTADOS_PROCURA,
  etiquetaEstadoProcura,
  type EstadoProcura,
} from '@/lib/procuras/procuraEstados';

type EntidadRow = { id: string; nombre: string };
type ProyectoRow = { id: string; nombre: string };

type ProcuraRow = {
  id: string;
  ticket: string;
  estado: string;
  material_txt: string;
  cantidad: number;
  unidad: string;
  proyecto_id: string | null;
  entidad_id: string | null;
  motivo_ultimo: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
  ci_entidades?: { nombre: string } | { nombre: string }[] | null;
};

function relNombre(v: ProcuraRow['ci_proyectos']): string {
  if (!v) return '—';
  if (Array.isArray(v)) return v[0]?.nombre ?? '—';
  return v.nombre ?? '—';
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(28, 28, 30, 0.7)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px',
  padding: '16px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'white',
  fontSize: '14px',
};

const btnPrimary: React.CSSProperties = {
  background: '#FF3B30',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  padding: '10px 16px',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
};

export default function ProcurasPage() {
  const [procuras, setProcuras] = useState<ProcuraRow[]>([]);
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroProyecto, setFiltroProyecto] = useState('');
  const [filtroEntidad, setFiltroEntidad] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nuevoEstado, setNuevoEstado] = useState<EstadoProcura>('aprobada');
  const [motivoLote, setMotivoLote] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [msgOk, setMsgOk] = useState<string | null>(null);
  const [showNueva, setShowNueva] = useState(false);
  const [creando, setCreando] = useState(false);

  const [formMaterial, setFormMaterial] = useState('');
  const [formCantidad, setFormCantidad] = useState('1');
  const [formUnidad, setFormUnidad] = useState('UND');
  const [formProyectoId, setFormProyectoId] = useState('');
  const [formEntidadId, setFormEntidadId] = useState('');
  const [formObs, setFormObs] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [eRes, pRes] = await Promise.all([
          fetch('/api/almacen/entidades', { cache: 'no-store' }),
          fetch('/api/almacen/proyectos', { cache: 'no-store' }),
        ]);
        const eJson = (await eRes.json()) as { entidades?: EntidadRow[] };
        const pJson = (await pRes.json()) as { proyectos?: ProyectoRow[] };
        setEntidades(eJson.entidades ?? []);
        setProyectos(pJson.proyectos ?? []);
      } catch {
        /* opcional */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMsgOk(null);
    try {
      const q = new URLSearchParams();
      if (filtroEstado) q.set('estado', filtroEstado);
      if (filtroProyecto) q.set('proyecto_id', filtroProyecto);
      if (filtroEntidad) q.set('entidad_id', filtroEntidad);
      const res = await fetch(`/api/procuras?${q}`, { cache: 'no-store' });
      const json = (await res.json()) as {
        ok?: boolean;
        procuras?: ProcuraRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) throw new Error([json.error, json.hint].filter(Boolean).join(' — '));
      setProcuras(json.procuras ?? []);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      setProcuras([]);
    } finally {
      setLoading(false);
    }
  }, [filtroEntidad, filtroEstado, filtroProyecto]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = procuras.length > 0 && selected.size === procuras.length;
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(procuras.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resumenEstados = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of procuras) {
      m.set(p.estado, (m.get(p.estado) ?? 0) + 1);
    }
    return m;
  }, [procuras]);

  const procesarLote = async () => {
    if (!someSelected) return;
    setProcesando(true);
    setError(null);
    setMsgOk(null);
    try {
      const res = await fetch('/api/procuras/procesar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selected),
          nuevoEstado,
          motivo: motivoLote.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        count?: number;
        telegram?: { enviados: number; omitidos: number };
        error?: string;
        hint?: string;
      };
      if (!res.ok) throw new Error([json.error, json.hint].filter(Boolean).join(' — '));
      const tg = json.telegram;
      setMsgOk(
        `Actualizadas ${json.count ?? 0} procura(s). Telegram: ${tg?.enviados ?? 0} enviados, ${tg?.omitidos ?? 0} omitidos.`,
      );
      setMotivoLote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar lote');
    } finally {
      setProcesando(false);
    }
  };

  const crearProcura = async () => {
    setCreando(true);
    setError(null);
    setMsgOk(null);
    try {
      const res = await fetch('/api/procuras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_txt: formMaterial,
          cantidad: formCantidad,
          unidad: formUnidad,
          proyecto_id: formProyectoId || null,
          entidad_id: formEntidadId || null,
          observaciones: formObs.trim() || null,
          estado: 'solicitada',
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        procura?: { ticket?: string };
        error?: string;
        hint?: string;
      };
      if (!res.ok) throw new Error([json.error, json.hint].filter(Boolean).join(' — '));
      setMsgOk(`Procura ${json.procura?.ticket ?? ''} creada.`);
      setFormMaterial('');
      setFormCantidad('1');
      setFormObs('');
      setShowNueva(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setCreando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '120px' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <Link
              href="/contabilidad"
              style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', textDecoration: 'none' }}
            >
              ← Contabilidad
            </Link>
            <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>Procuras</h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              ...btnPrimary,
              background: 'rgba(255,255,255,0.08)',
              padding: '8px 12px',
            }}
            title="Actualizar"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error ? (
          <div style={{ ...cardStyle, borderColor: 'rgba(255,59,48,0.4)', color: '#FF6961' }}>{error}</div>
        ) : null}
        {msgOk ? (
          <div style={{ ...cardStyle, borderColor: 'rgba(52,199,89,0.4)', color: '#34C759' }}>{msgOk}</div>
        ) : null}

        <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {ESTADOS_PROCURA.map((e) => {
            const n = resumenEstados.get(e) ?? 0;
            if (!n && filtroEstado !== e) return null;
            const color = COLOR_ESTADO_PROCURA[e];
            return (
              <button
                key={e}
                type="button"
                onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
                style={{
                  background: filtroEstado === e ? `${color}33` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${filtroEstado === e ? color : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '999px',
                  padding: '6px 12px',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {etiquetaEstadoProcura(e)} ({n})
              </button>
            );
          })}
        </div>

        <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>OBRA</label>
            <select
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
              style={{ ...inputStyle, marginTop: '6px' }}
            >
              <option value="">Todas</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>ENTIDAD</label>
            <select
              value={filtroEntidad}
              onChange={(e) => setFiltroEntidad(e.target.value)}
              style={{ ...inputStyle, marginTop: '6px' }}
            >
              <option value="">Todas</option>
              {entidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={cardStyle}>
          <button
            type="button"
            onClick={() => setShowNueva((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Nueva procura
            </span>
            {showNueva ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showNueva ? (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                  MATERIAL / DESCRIPCIÓN
                </label>
                <input
                  value={formMaterial}
                  onChange={(e) => setFormMaterial(e.target.value)}
                  placeholder="Ej. Cemento gris 42.5 kg"
                  style={{ ...inputStyle, marginTop: '6px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px' }}>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                    CANTIDAD
                  </label>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={formCantidad}
                    onChange={(e) => setFormCantidad(e.target.value)}
                    style={{ ...inputStyle, marginTop: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                    UNIDAD
                  </label>
                  <input
                    value={formUnidad}
                    onChange={(e) => setFormUnidad(e.target.value)}
                    style={{ ...inputStyle, marginTop: '6px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                    OBRA (opcional si hay entidad)
                  </label>
                  <select
                    value={formProyectoId}
                    onChange={(e) => setFormProyectoId(e.target.value)}
                    style={{ ...inputStyle, marginTop: '6px' }}
                  >
                    <option value="">—</option>
                    {proyectos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                    ENTIDAD (opcional si hay obra)
                  </label>
                  <select
                    value={formEntidadId}
                    onChange={(e) => setFormEntidadId(e.target.value)}
                    style={{ ...inputStyle, marginTop: '6px' }}
                  >
                    <option value="">—</option>
                    {entidades.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                  OBSERVACIONES
                </label>
                <textarea
                  value={formObs}
                  onChange={(e) => setFormObs(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, marginTop: '6px', resize: 'vertical' }}
                />
              </div>
              <button
                type="button"
                onClick={() => void crearProcura()}
                disabled={creando || !formMaterial.trim()}
                style={{ ...btnPrimary, opacity: creando ? 0.6 : 1 }}
              >
                {creando ? <Loader2 size={16} className="animate-spin" /> : null}
                Crear solicitud
              </button>
            </div>
          ) : null}
        </div>

        {someSelected ? (
          <div style={{ ...cardStyle, borderColor: 'rgba(255,59,48,0.35)' }}>
            <p style={{ color: 'white', fontWeight: 700, marginBottom: '12px' }}>
              Cambiar estado — {selected.size} seleccionada(s)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                  NUEVO ESTADO
                </label>
                <select
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value as EstadoProcura)}
                  style={{ ...inputStyle, marginTop: '6px' }}
                >
                  {ESTADOS_PROCURA.map((e) => (
                    <option key={e} value={e}>
                      {etiquetaEstadoProcura(e)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 700 }}>
                  MOTIVO (opcional)
                </label>
                <input
                  value={motivoLote}
                  onChange={(e) => setMotivoLote(e.target.value)}
                  placeholder="Nota para historial y Telegram"
                  style={{ ...inputStyle, marginTop: '6px' }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void procesarLote()}
              disabled={procesando}
              style={{ ...btnPrimary, opacity: procesando ? 0.6 : 1 }}
            >
              {procesando ? <Loader2 size={16} className="animate-spin" /> : null}
              Aplicar y notificar
            </button>
          </div>
        ) : null}

        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : procuras.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>
              No hay procuras con estos filtros.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todas" />
                    </th>
                    <th style={{ padding: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>Ticket</th>
                    <th style={{ padding: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>Material</th>
                    <th style={{ padding: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>Cant.</th>
                    <th style={{ padding: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>Obra / Entidad</th>
                    <th style={{ padding: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>Estado</th>
                    <th style={{ padding: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {procuras.map((p) => {
                    const color = COLOR_ESTADO_PROCURA[p.estado as EstadoProcura] ?? '#8E8E93';
                    const destino = [relNombre(p.ci_proyectos), relNombre(p.ci_entidades)]
                      .filter((x) => x !== '—')
                      .join(' · ');
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px' }}>
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                            aria-label={`Seleccionar ${p.ticket}`}
                          />
                        </td>
                        <td style={{ padding: '12px', color: 'white', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {p.ticket}
                        </td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.85)', maxWidth: '180px' }}>
                          {p.material_txt}
                          {p.motivo_ultimo ? (
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', marginTop: '4px' }}>
                              {p.motivo_ultimo}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                          {Number(p.cantidad).toLocaleString('es-VE')} {p.unidad}
                        </td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.55)', fontSize: '11px' }}>
                          {destino || '—'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              background: `${color}22`,
                              color,
                              padding: '4px 8px',
                              borderRadius: '999px',
                              fontWeight: 700,
                              fontSize: '10px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {etiquetaEstadoProcura(p.estado)}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                          {new Date(p.updated_at).toLocaleString('es-VE', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
