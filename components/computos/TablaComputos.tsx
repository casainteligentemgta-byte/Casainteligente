'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Pencil, Plus, Ruler, Trash2, Upload, X } from 'lucide-react';
import {
  createComputo,
  deleteComputo,
  getComputosByCapitulo,
  getComputosByGastoId,
  updateComputo,
} from '@/lib/actions/computos';
import {
  calcularTotalComputado,
  UNIDADES_MEDIDA_COMPUTO,
  type ComputoMetrico,
  type UnidadMedidaComputo,
} from '@/types/computos';

export type TablaComputosProps = {
  /** Capítulo inicial / fijo (drawer o filtro). */
  capitulo?: string;
  subcapitulo?: string | null;
  /** Si viene de un gasto del libro, se asocia al crear. */
  gastoId?: number | null;
  /** Si true, no muestra el filtro de capítulo editable. */
  capituloFijo?: boolean;
  /** Título opcional del panel. */
  titulo?: string;
};

type FormState = {
  descripcion_elemento: string;
  ubicacion: string;
  unidad_medida: UnidadMedidaComputo;
  cantidad: string;
  largo: string;
  ancho: string;
  alto_profundidad: string;
  partida_codigo: string;
  observaciones: string;
  soporte_url: string;
  capitulo: string;
  subcapitulo: string;
};

function emptyForm(defaults?: {
  capitulo?: string;
  subcapitulo?: string | null;
}): FormState {
  return {
    descripcion_elemento: '',
    ubicacion: '',
    unidad_medida: 'm2',
    cantidad: '1',
    largo: '',
    ancho: '',
    alto_profundidad: '',
    partida_codigo: '',
    observaciones: '',
    soporte_url: '',
    capitulo: defaults?.capitulo ?? '',
    subcapitulo: defaults?.subcapitulo ?? '',
  };
}

function fromComputo(c: ComputoMetrico): FormState {
  const n = (v: number) => (Number.isFinite(v) ? String(v) : '');
  const u = String(c.unidad_medida || 'm2').toLowerCase() as UnidadMedidaComputo;
  return {
    descripcion_elemento: c.descripcion_elemento,
    ubicacion: c.ubicacion ?? '',
    unidad_medida: UNIDADES_MEDIDA_COMPUTO.includes(u) ? u : 'm2',
    cantidad: n(c.cantidad) || '1',
    largo: n(c.largo),
    ancho: n(c.ancho),
    alto_profundidad: n(c.alto_profundidad),
    partida_codigo: c.partida_codigo ?? '',
    observaciones: c.observaciones ?? '',
    soporte_url: c.soporte_url ?? '',
    capitulo: c.capitulo,
    subcapitulo: c.subcapitulo ?? '',
  };
}

function parseNum(s: string, fallback = 0): number {
  if (!s.trim()) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function fmtNum(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 4 });
}

export default function TablaComputos({
  capitulo: capituloProp = '',
  subcapitulo: subcapituloProp = null,
  gastoId = null,
  capituloFijo = false,
  titulo = 'Cómputos métricos',
}: TablaComputosProps) {
  const [capituloFiltro, setCapituloFiltro] = useState(capituloProp);
  const [rows, setRows] = useState<ComputoMetrico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComputoMetrico | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm({ capitulo: capituloProp, subcapitulo: subcapituloProp }),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setCapituloFiltro(capituloProp);
  }, [capituloProp]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let list: ComputoMetrico[] = [];
      if (gastoId != null && Number.isFinite(Number(gastoId))) {
        list = await getComputosByGastoId(Number(gastoId));
      } else if (capituloFiltro.trim()) {
        list = await getComputosByCapitulo(capituloFiltro.trim());
      } else {
        list = [];
      }
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar cómputos');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [capituloFiltro, gastoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalAcumulado = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.total_computado) || 0), 0),
    [rows],
  );

  const preview = useMemo(() => {
    return calcularTotalComputado({
      unidad_medida: form.unidad_medida,
      cantidad: parseNum(form.cantidad, 1),
      largo: parseNum(form.largo),
      ancho: parseNum(form.ancho),
      alto_profundidad: parseNum(form.alto_profundidad),
    });
  }, [form]);

  function openCreate() {
    setEditing(null);
    setForm(
      emptyForm({
        capitulo: capituloFiltro || capituloProp,
        subcapitulo: subcapituloProp,
      }),
    );
    setError(null);
    setModalOpen(true);
  }

  function openEdit(c: ComputoMetrico) {
    setEditing(c);
    setForm(fromComputo(c));
    setError(null);
    setModalOpen(true);
  }

  async function uploadSoporte(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('tipo', 'computo');
      if (gastoId != null) fd.set('gastoId', String(gastoId));
      else if (editing?.id) fd.set('gastoId', String(editing.id));
      const res = await fetch('/api/contabilidad/cco/gastos/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al subir');
      setForm((f) => ({ ...f, soporte_url: String(json.url) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir foto');
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cap = form.capitulo.trim() || capituloFiltro.trim();
    if (!cap) {
      setError('Indica un capítulo.');
      return;
    }
    if (!form.descripcion_elemento.trim()) {
      setError('La descripción es requerida.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        gasto_id: gastoId ?? editing?.gasto_id ?? null,
        capitulo: cap,
        subcapitulo: form.subcapitulo.trim() || null,
        partida_codigo: form.partida_codigo.trim() || null,
        descripcion_elemento: form.descripcion_elemento.trim(),
        ubicacion: form.ubicacion.trim() || null,
        cantidad: parseNum(form.cantidad, 1),
        largo: parseNum(form.largo),
        ancho: parseNum(form.ancho),
        alto_profundidad: parseNum(form.alto_profundidad),
        unidad_medida: form.unidad_medida,
        formula_expresion: preview.formula,
        total_computado: preview.total,
        soporte_url: form.soporte_url.trim() || null,
        observaciones: form.observaciones.trim() || null,
      };

      if (editing) {
        await updateComputo(editing.id, payload);
      } else {
        await createComputo(payload);
        if (!capituloFiltro.trim()) setCapituloFiltro(cap);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm('¿Eliminar esta línea de cómputo?')) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteComputo(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const puedeListar = Boolean(capituloFiltro.trim()) || gastoId != null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ruler size={18} color="#2563EB" />
            {titulo}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
            Calculadora de cantidades por capítulo
            {gastoId != null ? ` · gasto #${gastoId}` : ''}
          </p>
        </div>
        <button type="button" onClick={openCreate} style={btnPrimary}>
          <Plus size={15} /> Nuevo cómputo
        </button>
      </div>

      <div
        style={{
          background: 'linear-gradient(90deg, #0F766E 0%, #0D9488 55%, #14B8A6 100%)',
          borderRadius: 12,
          padding: '14px 18px',
          color: '#fff',
          boxShadow: '0 6px 18px rgba(13,148,136,0.28)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.9 }}>
            TOTAL ACUMULADO COMPUTADO
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {fmtNum(totalAcumulado)}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, opacity: 0.95 }}>
          {rows.length} línea{rows.length === 1 ? '' : 's'}
          {capituloFiltro ? ` · ${capituloFiltro}` : ''}
        </p>
      </div>

      {!capituloFijo ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={lab}>
            Capítulo
            <input
              value={capituloFiltro}
              onChange={(e) => setCapituloFiltro(e.target.value)}
              placeholder="Ej. MOVIMIENTO DE TIERRA"
              style={{ ...inp, minWidth: 260 }}
            />
          </label>
          <button type="button" onClick={() => void load()} style={btnGhost} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Buscar
          </button>
        </div>
      ) : null}

      {error && !modalOpen ? (
        <p style={{ color: '#B91C1C', fontSize: 13, margin: 0 }}>{error}</p>
      ) : null}

      {!puedeListar ? (
        <p style={{ color: '#64748B', fontSize: 13 }}>Indica un capítulo para listar cómputos.</p>
      ) : loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13 }}>
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 12, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                {['Descripción', 'Ubicación', 'Und', 'Cant.', 'L', 'A', 'H', 'Fórmula', 'Total', 'Soporte', ''].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 12px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#64748B',
                        letterSpacing: '0.03em',
                        borderBottom: '1px solid #E2E8F0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                    Sin cómputos para este filtro. Crea el primero.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={td}>{r.descripcion_elemento}</td>
                    <td style={td}>{r.ubicacion || '—'}</td>
                    <td style={td}>{r.unidad_medida}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.cantidad)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.largo)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.ancho)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(r.alto_profundidad)}</td>
                    <td style={{ ...td, color: '#64748B', fontSize: 12 }}>{r.formula_expresion || '—'}</td>
                    <td style={{ ...td, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtNum(r.total_computado)}
                    </td>
                    <td style={td}>
                      {r.soporte_url ? (
                        <a href={r.soporte_url} target="_blank" rel="noreferrer" style={linkInline}>
                          <ExternalLink size={13} /> Ver
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" title="Editar" onClick={() => openEdit(r)} style={iconBtn}>
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => void remove(r.id)}
                          disabled={deletingId === r.id}
                          style={{ ...iconBtn, color: '#B91C1C' }}
                        >
                          {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !saving && setModalOpen(false)}
        >
          <form
            onSubmit={(e) => void save(e)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              maxHeight: '92vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {editing ? 'Editar cómputo' : 'Nuevo cómputo'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} style={iconBtn} disabled={saving}>
                <X size={16} />
              </button>
            </div>

            <label style={lab}>
              Descripción del elemento *
              <input
                required
                value={form.descripcion_elemento}
                onChange={set('descripcion_elemento')}
                style={inp}
                placeholder="Ej. Losa de entrepiso"
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={lab}>
                Capítulo *
                <input
                  required
                  value={form.capitulo}
                  onChange={set('capitulo')}
                  disabled={capituloFijo && Boolean(capituloProp)}
                  style={inp}
                />
              </label>
              <label style={lab}>
                Subcapítulo
                <input value={form.subcapitulo} onChange={set('subcapitulo')} style={inp} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={lab}>
                Ubicación
                <input
                  value={form.ubicacion}
                  onChange={set('ubicacion')}
                  style={inp}
                  placeholder="Ej. Nivel 2 · Eje A-B"
                />
              </label>
              <label style={lab}>
                Unidad de medida
                <select value={form.unidad_medida} onChange={set('unidad_medida')} style={inp}>
                  {UNIDADES_MEDIDA_COMPUTO.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <label style={lab}>
                Cantidad
                <input type="number" step="any" value={form.cantidad} onChange={set('cantidad')} style={inp} />
              </label>
              <label style={lab}>
                Largo
                <input type="number" step="any" value={form.largo} onChange={set('largo')} style={inp} />
              </label>
              <label style={lab}>
                Ancho
                <input type="number" step="any" value={form.ancho} onChange={set('ancho')} style={inp} />
              </label>
              <label style={lab}>
                Alto / Prof.
                <input
                  type="number"
                  step="any"
                  value={form.alto_profundidad}
                  onChange={set('alto_profundidad')}
                  style={inp}
                  disabled={form.unidad_medida === 'm2' || form.unidad_medida === 'ml' || form.unidad_medida === 'kg' || form.unidad_medida === 'und'}
                />
              </label>
            </div>

            <div
              style={{
                background: '#F0FDFA',
                border: '1px solid #99F6E4',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#0F766E' }}>TOTAL COMPUTADO (vivo)</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>{preview.formula}</p>
              </div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F766E', fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(preview.total)} <span style={{ fontSize: 13 }}>{form.unidad_medida}</span>
              </p>
            </div>

            <label style={lab}>
              Código partida
              <input value={form.partida_codigo} onChange={set('partida_codigo')} style={inp} />
            </label>

            <label style={lab}>
              Observaciones
              <textarea value={form.observaciones} onChange={set('observaciones')} style={{ ...inp, minHeight: 56 }} />
            </label>

            <div>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#64748B' }}>Foto / soporte</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {form.soporte_url ? (
                  <a href={form.soporte_url} target="_blank" rel="noreferrer" style={linkBtn}>
                    <ExternalLink size={14} /> Ver archivo
                  </a>
                ) : null}
                <label style={linkBtn}>
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Adjuntar
                  <input
                    type="file"
                    accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.heic"
                    style={{ display: 'none' }}
                    disabled={uploading || saving}
                    onChange={(e) => void uploadSoporte(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            {error ? <p style={{ color: '#B91C1C', fontSize: 13, margin: 0 }}>{error}</p> : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={btnGhost} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" style={btnPrimary} disabled={saving || uploading}>
                {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const lab: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
};
const inp: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 13,
  fontWeight: 600,
  color: '#0F172A',
  width: '100%',
  boxSizing: 'border-box',
};
const td: React.CSSProperties = {
  padding: '10px 12px',
  color: '#0F172A',
  verticalAlign: 'top',
};
const btnPrimary: React.CSSProperties = {
  background: '#2563EB',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '9px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
const btnGhost: React.CSSProperties = {
  background: '#fff',
  color: '#334155',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
const iconBtn: React.CSSProperties = {
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: 6,
  cursor: 'pointer',
  color: '#334155',
  display: 'inline-flex',
  alignItems: 'center',
};
const linkBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  color: '#1D4ED8',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
};
const linkInline: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: '#1D4ED8',
  fontWeight: 700,
  textDecoration: 'none',
  fontSize: 12,
};
