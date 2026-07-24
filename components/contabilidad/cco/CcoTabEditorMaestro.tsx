'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  Save,
  Wrench,
} from 'lucide-react';
import { CCO_TIPOS_GASTO } from '@/lib/contabilidad/ccoClasificarGasto';
import { esDescripcionAuditoriaCco } from '@/lib/contabilidad/compraEsAuditoriaCco';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';
import CcoFormRegistroModal from '@/components/contabilidad/cco/CcoFormRegistroModal';
import CcoExportBar from '@/components/contabilidad/cco/CcoExportBar';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFechaV4(iso: string | null): string {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
    return `${s.slice(0, 10)} ${s.slice(11, 19) || '00:00:00'}`;
  }
  return s.slice(0, 19);
}

function sinCapituloAsignado(capitulo: string): boolean {
  const c = String(capitulo ?? '').trim();
  if (!c || c === '—' || c === '-' || c.toLowerCase() === 'none') return true;
  return /^sin\s*(distribuci[oó]n|cap[ií]tulo)/i.test(c);
}

type ColKey =
  | 'sel'
  | 'clase'
  | 'fecha'
  | 'proveedor'
  | 'tipo'
  | 'capitulo'
  | 'subcapitulo'
  | 'descripcion'
  | 'contrato'
  | 'moneda'
  | 'tasa'
  | 'monto_orig'
  | 'admin_pct'
  | 'base'
  | 'honorarios'
  | 'total'
  | 'estado'
  | 'forma_pago';

const COLS: { key: ColKey; label: string; defaultVisible: boolean }[] = [
  { key: 'sel', label: 'Sel', defaultVisible: true },
  { key: 'clase', label: 'CLASE', defaultVisible: true },
  { key: 'fecha', label: 'FECHA', defaultVisible: true },
  { key: 'proveedor', label: 'PROVEEDOR', defaultVisible: true },
  { key: 'tipo', label: 'TIPO', defaultVisible: true },
  { key: 'capitulo', label: 'CAPÍTULO', defaultVisible: true },
  { key: 'subcapitulo', label: 'SUBCAPÍTULO', defaultVisible: true },
  { key: 'descripcion', label: 'DESCRIPCIÓN', defaultVisible: true },
  { key: 'contrato', label: 'CONTRATO_VINCULADO', defaultVisible: true },
  { key: 'moneda', label: 'MONEDA', defaultVisible: true },
  { key: 'tasa', label: 'TASA', defaultVisible: false },
  { key: 'monto_orig', label: 'MONTO_ORIG', defaultVisible: true },
  { key: 'admin_pct', label: 'ADMIN_%', defaultVisible: false },
  { key: 'base', label: 'BASE_USD', defaultVisible: false },
  { key: 'honorarios', label: 'HONORARIOS', defaultVisible: true },
  { key: 'total', label: 'COSTO_TOTAL', defaultVisible: true },
  { key: 'estado', label: 'ESTADO', defaultVisible: false },
  { key: 'forma_pago', label: 'FORMA_PAGO', defaultVisible: false },
];

const LS_COLS = 'ci-cco-editor-maestro-cols-v1';

type Draft = {
  fecha: string;
  proveedor: string;
  tipo: string;
  capitulo: string;
  subcapitulo: string;
  descripcion: string;
  moneda: string;
  tasa: string;
  monto_orig: string;
  admin_pct: string;
  estado: string;
  forma_pago: string;
};

type Vista = CcoLibroFila & {
  selected?: boolean;
  dirty?: boolean;
  draft?: Draft;
};

type EditField = keyof Draft;

function toDraft(f: CcoLibroFila): Draft {
  return {
    fecha: (f.fecha ?? '').slice(0, 10),
    proveedor: f.proveedor ?? '',
    tipo: f.tipo ?? '',
    capitulo: f.capitulo === '—' ? '' : f.capitulo ?? '',
    subcapitulo: f.subcapitulo === '—' ? '' : f.subcapitulo ?? '',
    descripcion: f.descripcion ?? '',
    moneda: f.moneda ?? 'USD',
    tasa: String(f.tasa ?? 0),
    monto_orig: String(f.monto_orig ?? 0),
    admin_pct: String(f.admin_pct ?? 0),
    estado: f.estado ?? 'PAGADO',
    forma_pago: f.forma_pago ?? '',
  };
}

function puedeEditar(f: CcoLibroFila): boolean {
  return f.fuente === 'compra' || f.fuente === 'inyeccion';
}

function honorariosLive(base: number, adminPct: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(adminPct) || adminPct <= 0) return 0;
  return Math.round(base * (adminPct / 100) * 100) / 100;
}

function baseUsdFromDraft(d: Draft): number {
  const monto = Number(d.monto_orig) || 0;
  const tasa = Number(d.tasa) || 0;
  const mon = d.moneda.toUpperCase().startsWith('VE') ? 'VES' : 'USD';
  if (mon === 'VES') return tasa > 0 ? monto / tasa : 0;
  return monto;
}

export default function CcoTabEditorMaestro({
  proyectoId,
  onSaved,
}: {
  proyectoId: string;
  onSaved?: () => void;
}) {
  const [filas, setFilas] = useState<Vista[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [soloSinDist, setSoloSinDist] = useState(false);
  const [claseFiltro, setClaseFiltro] = useState('');
  const [cfgOpen, setCfgOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; field: EditField } | null>(null);
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(() => {
    const o = {} as Record<ColKey, boolean>;
    for (const c of COLS) o[c.key] = c.defaultVisible;
    if (typeof window === 'undefined') return o;
    try {
      const raw = localStorage.getItem(LS_COLS);
      if (!raw) return o;
      const parsed = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
      for (const c of COLS) {
        if (typeof parsed[c.key] === 'boolean') o[c.key] = parsed[c.key]!;
      }
      o.sel = true;
    } catch {
      /* ignore */
    }
    return o;
  });

  const persistCols = (next: Record<ColKey, boolean>) => {
    setVisible(next);
    try {
      localStorage.setItem(LS_COLS, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const qs = new URLSearchParams({ proyecto: proyectoId, limit: '5000' });
      const res = await fetch(`/api/contabilidad/cco/libro?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar libro');
      const rows = ((json.filas ?? []) as CcoLibroFila[])
        .filter((r) => !esDescripcionAuditoriaCco(r.descripcion))
        .map((f) => ({ ...f, selected: false, dirty: false, draft: toDraft(f) }));
      setFilas(rows);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filasVista = useMemo(() => {
    return filas.filter((f) => {
      if (claseFiltro && f.clase !== claseFiltro) return false;
      if (soloSinDist) {
        const cap = f.dirty && f.draft ? f.draft.capitulo : f.capitulo;
        if (!sinCapituloAsignado(cap)) return false;
      }
      return true;
    });
  }, [filas, claseFiltro, soloSinDist]);

  const kpis = useMemo(() => {
    let montoOrig = 0;
    let honorarios = 0;
    let costoTotal = 0;
    let nGastos = 0;
    for (const f of filasVista) {
      if (f.clase !== 'GASTO') continue;
      nGastos += 1;
      const d = f.draft ?? toDraft(f);
      const base = f.dirty ? baseUsdFromDraft(d) : f.monto_base_usd;
      const hon = f.dirty
        ? honorariosLive(base, Number(d.admin_pct) || 0)
        : f.honorarios_usd;
      montoOrig += Number(d.monto_orig) || 0;
      honorarios += hon;
      costoTotal += base + hon;
    }
    return { montoOrig, honorarios, costoTotal, nGastos, totalFilas: filasVista.length };
  }, [filasVista]);

  const dirtyCount = filas.filter((f) => f.dirty).length;
  const selected = filas.filter((f) => f.selected && puedeEditar(f));
  const colsActivas = COLS.filter((c) => visible[c.key]);

  const patchDraft = (id: string, field: EditField, value: string) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.id !== id || !puedeEditar(f)) return f;
        return {
          ...f,
          dirty: true,
          draft: { ...(f.draft ?? toDraft(f)), [field]: value },
        };
      }),
    );
  };

  const toggleSel = (id: string, checked: boolean) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, selected: checked } : f)));
  };

  const toggleAllVista = (checked: boolean) => {
    const ids = new Set(filasVista.filter(puedeEditar).map((f) => f.id));
    setFilas((prev) =>
      prev.map((f) => (ids.has(f.id) ? { ...f, selected: checked } : f)),
    );
  };

  const eliminarSeleccionados = useCallback(async () => {
    const gastos = selected.filter((f) => f.fuente === 'compra').map((f) => f.id);
    const ingresos = selected.filter((f) => f.fuente === 'inyeccion').map((f) => f.id);
    if (!gastos.length && !ingresos.length) {
      setOkMsg('Selecciona filas GASTO o INGRESO para eliminar.');
      return;
    }
    if (
      !window.confirm(
        `¿Eliminar ${gastos.length + ingresos.length} registro(s) del libro maestro? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      let deleted = 0;
      if (gastos.length) {
        const res = await fetch('/api/contabilidad/cco/registros', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            clase: 'GASTO',
            eliminar_ids: gastos,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo eliminar gastos');
        deleted += Number(json.deleted) || 0;
      }
      if (ingresos.length) {
        const res = await fetch('/api/contabilidad/cco/registros', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            clase: 'INGRESO',
            eliminar_ids: ingresos,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo eliminar ingresos');
        deleted += Number(json.deleted) || 0;
      }
      setOkMsg(`Eliminados ${deleted} registro(s).`);
      await cargar();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  }, [selected, proyectoId, cargar, onSaved]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!filas.some((f) => f.selected && puedeEditar(f))) return;
      ev.preventDefault();
      void eliminarSeleccionados();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filas, eliminarSeleccionados]);

  const guardar = async () => {
    const dirty = filas.filter((f) => f.dirty && f.draft && puedeEditar(f));
    if (!dirty.length) {
      setOkMsg('No hay cambios pendientes.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      let updated = 0;
      const gastos = dirty.filter((f) => f.fuente === 'compra');
      const ingresos = dirty.filter((f) => f.fuente === 'inyeccion');

      if (gastos.length) {
        const res = await fetch('/api/contabilidad/cco/registros', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            clase: 'GASTO',
            cambios: gastos.map((f) => {
              const d = f.draft!;
              return {
                id: f.id,
                fecha: d.fecha || undefined,
                proveedor: d.proveedor,
                descripcion: d.descripcion,
                tipo: d.tipo,
                capitulo: d.capitulo,
                subcapitulo: d.subcapitulo,
                moneda: d.moneda,
                tasa: Number(d.tasa) || 0,
                monto_orig: Number(d.monto_orig) || 0,
                admin_pct: Number(d.admin_pct) || null,
                estado: d.estado,
                forma_pago: d.forma_pago || null,
              };
            }),
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar gastos');
        updated += Number(json.updated) || 0;
      }

      if (ingresos.length) {
        const res = await fetch('/api/contabilidad/cco/registros', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: proyectoId,
            clase: 'INGRESO',
            cambios: ingresos.map((f) => {
              const d = f.draft!;
              return {
                id: f.id,
                fecha: d.fecha || undefined,
                proveedor: d.proveedor,
                descripcion: d.descripcion,
                moneda: d.moneda,
                tasa: Number(d.tasa) || 0,
                monto_orig: Number(d.monto_orig) || 0,
                forma_pago: d.forma_pago || null,
              };
            }),
          }),
        });
        const json = await res.json();
        if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar ingresos');
        updated += Number(json.updated) || 0;
      }

      setOkMsg(`Guardados ${updated} cambio(s) en el editor maestro.`);
      await cargar();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const restablecerCols = () => {
    const o = {} as Record<ColKey, boolean>;
    for (const c of COLS) o[c.key] = true;
    persistCols(o);
    setCfgOpen(true);
  };

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Editor Maestro de Base de Datos</h3>
        <p style={muted}>Selecciona una obra para editar el libro unificado (df_maestro).</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={box}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: '#FEE2E2',
                display: 'grid',
                placeItems: 'center',
                color: '#B91C1C',
              }}
            >
              <Wrench size={18} />
            </span>
            Editor Maestro de Base de Datos
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <CcoFormRegistroModal proyectoId={proyectoId} onSaved={() => void cargar().then(() => onSaved?.())} />
            <CcoExportBar proyectoId={proyectoId} />
          </div>
        </div>

        <div
          style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 12,
            fontSize: 13,
            color: '#78350F',
            lineHeight: 1.45,
          }}
        >
          <strong>ZONA DE EDICIÓN:</strong> Aquí puedes comportarte como si estuvieras en Excel. Haz{' '}
          <strong>doble clic</strong> en cualquier celda para <strong>modificar su valor</strong>, o
          selecciona una fila entera (casilla de la izquierda) y presiona <strong>Suprimir</strong> /{' '}
          <strong>Delete</strong> para borrarla.
          {selected.length > 0 ? ` · ${selected.length} seleccionada(s)` : ''}
        </div>

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            color: '#92400E',
            marginBottom: 14,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={soloSinDist}
            onChange={(e) => setSoloSinDist(e.target.checked)}
          />
          ⚠️ Filtrar únicamente registros SIN DISTRIBUCIÓN (Capítulo) asignada
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Kpi title="SUMA MONTO ORIG. (GASTOS)" value={fmtNum(kpis.montoOrig)} />
          <Kpi title="SUMA HONORARIOS (GASTOS)" value={fmtUsd(kpis.honorarios)} />
          <Kpi title="SUMA COSTO TOTAL (GASTOS)" value={fmtUsd(kpis.costoTotal)} />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <select
            value={claseFiltro}
            onChange={(e) => setClaseFiltro(e.target.value)}
            style={select}
          >
            <option value="">Todas las clases</option>
            <option value="GASTO">GASTO</option>
            <option value="INGRESO">INGRESO</option>
            <option value="CONTRATO">CONTRATO</option>
            <option value="PRESUPUESTO">PRESUPUESTO</option>
          </select>
          <button type="button" onClick={() => void cargar()} style={btn}>
            Actualizar
          </button>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
            Mostrando {filasVista.length} de {filas.length} · {kpis.nGastos} gasto(s) en vista
          </span>
        </div>

        <button
          type="button"
          onClick={() => setCfgOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 14,
            color: '#0F172A',
            marginBottom: cfgOpen ? 12 : 10,
          }}
        >
          {cfgOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Eye size={16} color="#64748B" />
          Configurar Columnas Visibles (Editor Maestro)
        </button>
        {cfgOpen ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {COLS.filter((c) => c.key !== 'sel').map((c) => (
              <label
                key={c.key}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600 }}
              >
                <input
                  type="checkbox"
                  checked={!!visible[c.key]}
                  onChange={(e) => persistCols({ ...visible, [c.key]: e.target.checked })}
                />
                {c.label}
              </label>
            ))}
          </div>
        ) : null}

        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {okMsg ? <p style={{ color: '#15803D', fontSize: 13 }}>{okMsg}</p> : null}

        {loading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} /> Cargando libro maestro…
          </div>
        ) : (
          <div
            style={{
              overflow: 'auto',
              maxHeight: 560,
              border: '1px solid #E2E8F0',
              borderRadius: 10,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {colsActivas.map((c) => (
                    <th
                      key={c.key}
                      style={{
                        padding: '8px 6px',
                        position: 'sticky',
                        top: 0,
                        background: '#F1F5F9',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        zIndex: 1,
                      }}
                    >
                      {c.key === 'sel' ? (
                        <input
                          type="checkbox"
                          checked={
                            filasVista.filter(puedeEditar).length > 0 &&
                            filasVista.filter(puedeEditar).every((f) => f.selected)
                          }
                          onChange={(e) => toggleAllVista(e.target.checked)}
                          title="Seleccionar visibles"
                        />
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasVista.map((f, idx) => {
                  const d = f.draft ?? toDraft(f);
                  const editable = puedeEditar(f);
                  const base = f.dirty ? baseUsdFromDraft(d) : f.monto_base_usd;
                  const hon = f.dirty
                    ? honorariosLive(base, Number(d.admin_pct) || 0)
                    : f.honorarios_usd;
                  const total = base + hon;
                  const isEdit = (field: EditField) =>
                    editing?.id === f.id && editing.field === field;

                  const cellEdit = (
                    field: EditField,
                    display: React.ReactNode,
                    input: React.ReactNode,
                  ) => {
                    if (!editable) return <span style={{ color: '#64748B' }}>{display}</span>;
                    return (
                      <div
                        onDoubleClick={() => setEditing({ id: f.id, field })}
                        title="Doble clic para editar"
                        style={{ cursor: 'cell', minHeight: 22 }}
                      >
                        {isEdit(field) ? input : (
                          <span style={{ borderBottom: '1px dashed #94A3B8' }}>{display}</span>
                        )}
                      </div>
                    );
                  };

                  const inputBlur = (
                    <input
                      autoFocus
                      value={d[editing?.field ?? 'proveedor']}
                      onChange={(e) => {
                        if (editing) patchDraft(f.id, editing.field, e.target.value);
                      }}
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditing(null);
                      }}
                      style={inputCell}
                    />
                  );

                  return (
                    <tr
                      key={`${f.fuente}-${f.id}`}
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        background: f.dirty
                          ? '#FFF7ED'
                          : f.selected
                            ? '#FEF2F2'
                            : idx % 2
                              ? '#F8FAFC'
                              : '#fff',
                      }}
                    >
                      {colsActivas.map((c) => {
                        if (c.key === 'sel') {
                          return (
                            <td key={c.key} style={td}>
                              <input
                                type="checkbox"
                                disabled={!editable}
                                checked={!!f.selected}
                                onChange={(e) => toggleSel(f.id, e.target.checked)}
                              />
                            </td>
                          );
                        }
                        if (c.key === 'clase') {
                          return (
                            <td key={c.key} style={td}>
                              <span style={badge(f.clase)}>{f.clase}</span>
                            </td>
                          );
                        }
                        if (c.key === 'fecha') {
                          return (
                            <td key={c.key} style={td}>
                              {cellEdit(
                                'fecha',
                                fmtFechaV4(d.fecha || f.fecha),
                                <input
                                  autoFocus
                                  type="date"
                                  value={d.fecha}
                                  onChange={(e) => patchDraft(f.id, 'fecha', e.target.value)}
                                  onBlur={() => setEditing(null)}
                                  style={inputCell}
                                />,
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'proveedor') {
                          return (
                            <td key={c.key} style={td}>
                              {cellEdit('proveedor', d.proveedor || '—', inputBlur)}
                            </td>
                          );
                        }
                        if (c.key === 'tipo') {
                          return (
                            <td key={c.key} style={{ ...td, minWidth: 120 }}>
                              {cellEdit(
                                'tipo',
                                d.tipo || '—',
                                <select
                                  autoFocus
                                  value={d.tipo}
                                  onChange={(e) => {
                                    patchDraft(f.id, 'tipo', e.target.value);
                                    setEditing(null);
                                  }}
                                  onBlur={() => setEditing(null)}
                                  style={inputCell}
                                >
                                  <option value="">—</option>
                                  {CCO_TIPOS_GASTO.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>,
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'capitulo') {
                          return (
                            <td key={c.key} style={td}>
                              {cellEdit('capitulo', d.capitulo || '—', inputBlur)}
                            </td>
                          );
                        }
                        if (c.key === 'subcapitulo') {
                          return (
                            <td key={c.key} style={td}>
                              {cellEdit('subcapitulo', d.subcapitulo || '—', inputBlur)}
                            </td>
                          );
                        }
                        if (c.key === 'descripcion') {
                          return (
                            <td key={c.key} style={{ ...td, maxWidth: 260 }}>
                              {cellEdit(
                                'descripcion',
                                <span title={d.descripcion}>
                                  {d.descripcion.slice(0, 90) || '—'}
                                  {d.descripcion.length > 90 ? '…' : ''}
                                </span>,
                                inputBlur,
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'contrato') {
                          return (
                            <td key={c.key} style={{ ...td, color: '#94A3B8' }}>
                              {f.contrato_label ?? 'None'}
                            </td>
                          );
                        }
                        if (c.key === 'moneda') {
                          return (
                            <td key={c.key} style={td}>
                              {cellEdit(
                                'moneda',
                                d.moneda || 'USD',
                                <select
                                  autoFocus
                                  value={d.moneda}
                                  onChange={(e) => {
                                    patchDraft(f.id, 'moneda', e.target.value);
                                    setEditing(null);
                                  }}
                                  onBlur={() => setEditing(null)}
                                  style={inputCell}
                                >
                                  <option value="USD">USD</option>
                                  <option value="VES">VES</option>
                                </select>,
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'tasa') {
                          return (
                            <td key={c.key} style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                              {cellEdit('tasa', fmtNum(Number(d.tasa) || 0), inputBlur)}
                            </td>
                          );
                        }
                        if (c.key === 'monto_orig') {
                          return (
                            <td key={c.key} style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                              {cellEdit('monto_orig', fmtNum(Number(d.monto_orig) || 0), inputBlur)}
                            </td>
                          );
                        }
                        if (c.key === 'admin_pct') {
                          return (
                            <td key={c.key} style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                              {f.fuente === 'compra'
                                ? cellEdit('admin_pct', `${fmtNum(Number(d.admin_pct) || 0)}%`, inputBlur)
                                : '—'}
                            </td>
                          );
                        }
                        if (c.key === 'base') {
                          return (
                            <td key={c.key} style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtUsd(base)}
                            </td>
                          );
                        }
                        if (c.key === 'honorarios') {
                          return (
                            <td key={c.key} style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtUsd(hon)}
                            </td>
                          );
                        }
                        if (c.key === 'total') {
                          return (
                            <td
                              key={c.key}
                              style={{
                                ...td,
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: 700,
                              }}
                            >
                              {fmtUsd(total)}
                            </td>
                          );
                        }
                        if (c.key === 'estado') {
                          return (
                            <td key={c.key} style={td}>
                              {f.fuente === 'compra'
                                ? cellEdit('estado', d.estado || '—', inputBlur)
                                : f.estado || '—'}
                            </td>
                          );
                        }
                        if (c.key === 'forma_pago') {
                          return (
                            <td key={c.key} style={td}>
                              {cellEdit('forma_pago', d.forma_pago || '—', inputBlur)}
                            </td>
                          );
                        }
                        return (
                          <td key={c.key} style={td}>
                            —
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filasVista.length === 0 ? (
              <p style={{ ...muted, padding: 12 }}>Sin registros para el filtro actual.</p>
            ) : null}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 14,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={saving || dirtyCount === 0}
              style={{ ...btnSave, opacity: saving || dirtyCount === 0 ? 0.55 : 1 }}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar Cambios del Editor
              {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => void eliminarSeleccionados()}
              disabled={saving || selected.length === 0}
              style={{ ...btnDanger, opacity: saving || selected.length === 0 ? 0.55 : 1 }}
            >
              Eliminar seleccionados
            </button>
          </div>
          <button type="button" onClick={restablecerCols} style={btnLink}>
            <Eye size={14} /> Mostrar Columnas Ocultas / Restablecer Vista
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ ...box, padding: '12px 14px' }}>
      <p style={{ ...muted, margin: 0, fontSize: 11, fontWeight: 800 }}>{title}</p>
      <p style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
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
  padding: 16,
};
const h3: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '8px 0 12px' };
const td: React.CSSProperties = { padding: '7px 6px', verticalAlign: 'middle', color: '#334155' };
const inputCell: React.CSSProperties = {
  width: '100%',
  minWidth: 80,
  border: '1px solid #FCA5A5',
  borderRadius: 6,
  padding: '4px 6px',
  fontSize: 12,
  color: '#0F172A',
  outline: '2px solid #DC2626',
};
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
  background: '#DC2626',
  color: '#fff',
  borderRadius: 10,
  padding: '10px 16px',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 13,
};
const btnDanger: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #FECACA',
  background: '#FEF2F2',
  color: '#991B1B',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 13,
};
const btnLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  background: 'transparent',
  color: '#475569',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 12,
  padding: 4,
};
