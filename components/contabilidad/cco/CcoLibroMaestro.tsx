'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CLASES = ['', 'GASTO', 'INGRESO', 'CONTRATO', 'PRESUPUESTO'] as const;

type FilaLibro = CcoLibroFila & {
  draftCapitulo?: string;
  dirty?: boolean;
};

function puedeEditarCapitulo(f: CcoLibroFila): boolean {
  return f.fuente === 'compra' || f.fuente === 'presupuesto';
}

function valorCapitulo(f: FilaLibro): string {
  if (f.draftCapitulo !== undefined) return f.draftCapitulo;
  return f.capitulo === '—' ? '' : f.capitulo;
}

export default function CcoLibroMaestro({
  proyectoId,
  claseFija,
  titulo,
}: {
  proyectoId: string;
  /** Si se pasa, oculta el selector y fija la clase (GASTO / INGRESO / …). */
  claseFija?: string;
  titulo?: string;
}) {
  const [clase, setClase] = useState(claseFija ?? '');
  const [filas, setFilas] = useState<FilaLibro[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (claseFija != null) setClase(claseFija);
  }, [claseFija]);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const qs = new URLSearchParams({ proyecto: proyectoId, limit: '5000' });
      const claseActiva = claseFija ?? clase;
      if (claseActiva) qs.set('clase', claseActiva);
      const res = await fetch(`/api/contabilidad/cco/libro?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setFilas((json.filas ?? []) as FilaLibro[]);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, clase, claseFija]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const dirtyCount = useMemo(() => filas.filter((f) => f.dirty).length, [filas]);

  const capitulosOpts = useMemo(() => {
    const set = new Set<string>();
    for (const f of filas) {
      const cap = valorCapitulo(f).trim();
      if (cap) set.add(cap);
      if (f.capitulo && f.capitulo !== '—') set.add(f.capitulo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [filas]);

  const patchCapitulo = (key: string, capitulo: string) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (`${f.fuente}-${f.id}` !== key || !puedeEditarCapitulo(f)) return f;
        const original = f.capitulo === '—' ? '' : f.capitulo;
        return {
          ...f,
          draftCapitulo: capitulo,
          dirty: capitulo.trim() !== original.trim(),
          capitulo: capitulo.trim() || '—',
        };
      }),
    );
    setOkMsg(null);
  };

  const guardar = async () => {
    const dirty = filas.filter((f) => f.dirty && puedeEditarCapitulo(f));
    if (dirty.length === 0) {
      setOkMsg('No hay cambios pendientes.');
      return;
    }

    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const gastos = dirty.filter((f) => f.fuente === 'compra');
      const presupuestos = dirty.filter((f) => f.fuente === 'presupuesto');
      let updated = 0;

      if (gastos.length > 0) {
        const res = await fetch('/api/contabilidad/cco/registros', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            clase: 'GASTO',
            cambios: gastos.map((f) => ({
              id: f.id,
              capitulo: valorCapitulo(f).trim(),
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) {
          throw new Error(json.error ?? 'No se pudo guardar capítulos de gastos');
        }
        updated += Number(json.updated) || gastos.length;
      }

      if (presupuestos.length > 0) {
        const res = await fetch('/api/contabilidad/cco/presupuestos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            cambios: presupuestos.map((f) => ({
              id: f.id,
              capitulo: valorCapitulo(f).trim() || 'SIN CAPÍTULO',
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) {
          throw new Error(json.error ?? 'No se pudo guardar capítulos de presupuestos');
        }
        updated += Number(json.updated) || presupuestos.length;
      }

      setOkMsg(`Guardados ${updated} cambio(s) de capítulo.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>{titulo ?? 'Libro maestro'}</h3>
        <p style={muted}>Selecciona una obra para ver el libro unificado (df_maestro).</p>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ ...h3, margin: 0, flex: 1 }}>{titulo ?? 'Libro maestro'}</h3>
        {claseFija == null ? (
          <select value={clase} onChange={(e) => setClase(e.target.value)} style={select}>
            {CLASES.map((c) => (
              <option key={c || 'all'} value={c}>
                {c || 'Todas las clases'}
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" onClick={() => void cargar()} style={btn}>
          Actualizar
        </button>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={saving || dirtyCount === 0}
          style={{
            ...btnSave,
            opacity: saving || dirtyCount === 0 ? 0.55 : 1,
          }}
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Guardar capítulos
          {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
        </button>
      </div>
      <p style={muted}>
        {claseFija
          ? `Movimientos clase ${claseFija} · ${total} filas`
          : `Vista unificada V4: gastos + ingresos + contratos + presupuestos · ${total} filas`}
        {' · '}
        Edita la columna CAPÍTULO en gastos y presupuestos; luego guarda.
      </p>
      {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
      {okMsg ? <p style={{ color: '#15803D', fontSize: 13 }}>{okMsg}</p> : null}
      {loading ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748B' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando…
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 520 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                {['CLASE', 'FECHA', 'PROVEEDOR', 'TIPO', 'CAPÍTULO', 'DESCRIPCIÓN', 'BASE USD', 'HONOR.', 'TOTAL'].map(
                  (h) => (
                    <th key={h} style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const rowKey = `${f.fuente}-${f.id}`;
                const editable = puedeEditarCapitulo(f);
                return (
                  <tr
                    key={rowKey}
                    style={{
                      borderTop: '1px solid #E2E8F0',
                      background: f.dirty ? '#FFFBEB' : undefined,
                    }}
                  >
                    <td style={td}>
                      <span style={badge(f.clase)}>{f.clase}</span>
                    </td>
                    <td style={td}>{f.fecha ?? '—'}</td>
                    <td style={td}>{f.proveedor}</td>
                    <td style={td}>{f.tipo}</td>
                    <td style={td}>
                      {editable ? (
                        <input
                          list={`libro-cap-${proyectoId}`}
                          value={valorCapitulo(f)}
                          onChange={(e) => patchCapitulo(rowKey, e.target.value)}
                          placeholder="Capítulo"
                          style={{
                            ...inputCell,
                            borderColor: f.dirty ? '#F59E0B' : '#CBD5E1',
                            background: f.dirty ? '#FFFBEB' : '#fff',
                          }}
                          aria-label={`Capítulo fila ${f.display_id}`}
                        />
                      ) : (
                        f.capitulo
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 220 }} title={f.descripcion}>
                      {f.descripcion.slice(0, 80)}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(f.monto_base_usd)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(f.honorarios_usd)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {fmtUsd(f.costo_total_usd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id={`libro-cap-${proyectoId}`}>
            {capitulosOpts.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {filas.length === 0 ? <p style={muted}>Sin filas para el filtro actual.</p> : null}
        </div>
      )}
    </div>
  );
}

function badge(clase: string): React.CSSProperties {
  const bg =
    clase === 'GASTO'
      ? '#FEE2E2'
      : clase === 'INGRESO'
        ? '#DCFCE7'
        : clase === 'CONTRATO'
          ? '#DBEAFE'
          : clase === 'PRESUPUESTO'
            ? '#F3E8FF'
            : '#F1F5F9';
  return {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 6,
    background: bg,
    fontWeight: 800,
    fontSize: 10,
  };
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
};

const h3: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '0 0 12px' };
const td: React.CSSProperties = { padding: '7px 6px', verticalAlign: 'top', color: '#334155' };
const select: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 13,
  fontWeight: 600,
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
const btnSave: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  background: '#0F172A',
  color: '#fff',
  borderRadius: 8,
  padding: '7px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const inputCell: React.CSSProperties = {
  width: '100%',
  minWidth: 110,
  maxWidth: 180,
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid #CBD5E1',
  fontSize: 12,
  fontWeight: 600,
  color: '#0F172A',
  boxSizing: 'border-box',
};
