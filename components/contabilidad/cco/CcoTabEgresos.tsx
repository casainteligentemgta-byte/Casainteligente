'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Eye,
  HelpCircle,
  Loader2,
  Save,
} from 'lucide-react';
import { aplicarHonorariosABase } from '@/lib/contabilidad/cco/honorarios';
import { CCO_TIPOS_GASTO } from '@/lib/contabilidad/ccoClasificarGasto';
import {
  EGRESOS_COLUMNAS,
  EGRESOS_ESTADOS,
  FORMAS_PAGO_CCO,
  baseDescripcionSinPct,
  defaultVisibleCols,
  storageKeyColumnas,
  type EgresosColKey,
} from '@/lib/contabilidad/cco/egresosVista';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';
import EgresoFacturaCell from '@/components/contabilidad/cco/EgresoFacturaCell';
import EgresoCargaSoportesPanel from '@/components/contabilidad/cco/EgresoCargaSoportesPanel';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

type Draft = {
  fecha: string;
  proveedor: string;
  descripcion: string;
  moneda: string;
  tasa: string;
  monto_orig: string;
  admin_pct: string;
  tipo: string;
  capitulo: string;
  subcapitulo: string;
  estado: string;
  forma_pago: string;
};

type VistaFila = CcoLibroFila & {
  _groupIds?: string[];
  _agrupada?: boolean;
  dirty?: boolean;
  draft?: Draft;
};

function toDraft(f: CcoLibroFila): Draft {
  return {
    fecha: f.fecha ?? '',
    proveedor: f.proveedor,
    descripcion: f.descripcion,
    moneda: f.moneda || 'USD',
    tasa: f.tasa > 0 ? String(f.tasa) : '',
    monto_orig: String(f.monto_orig ?? f.monto_base_usd),
    admin_pct: String(f.admin_pct ?? ''),
    tipo: f.tipo || '',
    capitulo: f.capitulo === '—' ? '' : f.capitulo,
    subcapitulo: f.subcapitulo === '—' ? '' : f.subcapitulo,
    estado: f.estado || 'PAGADO',
    forma_pago: f.forma_pago ?? '',
  };
}

function noneLabel(v: string | null | undefined): string {
  const t = String(v ?? '').trim();
  return t ? t : 'None';
}

function EstadoBadge({ estado }: { estado: string }) {
  const e = String(estado || '').toUpperCase();
  const ok = e === 'PAGADO';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: ok ? '#DCFCE7' : e === 'PENDIENTE' ? '#FEF3C7' : '#F1F5F9',
        color: ok ? '#166534' : e === 'PENDIENTE' ? '#92400E' : '#475569',
        fontWeight: 800,
        fontSize: 11,
      }}
    >
      {ok ? <CheckCircle2 size={12} /> : null}
      {e || '—'}
    </span>
  );
}

function recalcFromDraft(
  base: CcoLibroFila,
  draft: Draft,
  pctGlobal: number,
): Pick<CcoLibroFila, 'monto_base_usd' | 'honorarios_usd' | 'costo_total_usd' | 'admin_pct' | 'tasa' | 'monto_orig' | 'moneda'> {
  const moneda = draft.moneda.toUpperCase().startsWith('VE') ? 'VES' : 'USD';
  const tasa = Number(draft.tasa) || 0;
  const montoOrig = Number(draft.monto_orig) || 0;
  let montoUsd = base.monto_base_usd;
  if (moneda === 'VES') {
    montoUsd = tasa > 0 ? montoOrig / tasa : montoUsd;
  } else {
    montoUsd = montoOrig;
  }
  const adminRaw = Number(draft.admin_pct);
  const calc = aplicarHonorariosABase(
    montoUsd,
    Number.isFinite(adminRaw) && adminRaw > 0 ? adminRaw : null,
    pctGlobal,
  );
  return {
    moneda,
    tasa,
    monto_orig: montoOrig,
    monto_base_usd: montoUsd,
    admin_pct: calc.adminPct,
    honorarios_usd: calc.honorariosUsd,
    costo_total_usd: calc.costoTotalUsd,
  };
}

function agruparFilas(filas: VistaFila[]): VistaFila[] {
  const groups = new Map<string, VistaFila[]>();
  const singles: VistaFila[] = [];
  for (const f of filas) {
    if (!f.split_group_key) {
      singles.push(f);
      continue;
    }
    const list = groups.get(f.split_group_key) ?? [];
    list.push(f);
    groups.set(f.split_group_key, list);
  }
  const out: VistaFila[] = [...singles];
  for (const parts of Array.from(groups.values())) {
    if (parts.length < 2) {
      out.push(...parts);
      continue;
    }
    const sorted = [...parts].sort((a, b) =>
      String(b.display_id).localeCompare(String(a.display_id), undefined, { numeric: true }),
    );
    const head = sorted[0];
    const montoBase = parts.reduce((s: number, p: VistaFila) => s + p.monto_base_usd, 0);
    const honor = parts.reduce((s: number, p: VistaFila) => s + p.honorarios_usd, 0);
    const montoOrig = parts.reduce((s: number, p: VistaFila) => s + p.monto_orig, 0);
    out.push({
      ...head,
      descripcion: baseDescripcionSinPct(head.descripcion) || head.descripcion,
      monto_base_usd: montoBase,
      honorarios_usd: honor,
      costo_total_usd: montoBase + honor,
      monto_orig: montoOrig,
      pct_distribucion: 100,
      _agrupada: true,
      _groupIds: parts.map((p: VistaFila) => p.id),
      dirty: false,
      draft: undefined,
    });
  }
  out.sort((a, b) => {
    const fa = a.fecha ?? '';
    const fb = b.fecha ?? '';
    if (fa !== fb) return fb.localeCompare(fa);
    return String(b.display_id).localeCompare(String(a.display_id), undefined, { numeric: true });
  });
  return out;
}

function KpiSuma({
  title,
  value,
  accent,
  icon,
}: {
  title: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        minHeight: 96,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: accent,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: '#fff',
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: '#64748B',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 26,
            fontWeight: 800,
            color: '#0F172A',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export default function CcoTabEgresos({ proyectoId }: { proyectoId: string }) {
  const [filas, setFilas] = useState<VistaFila[]>([]);
  const [totalApi, setTotalApi] = useState(0);
  const [pctGlobal, setPctGlobal] = useState(15);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [agrupar, setAgrupar] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [visible, setVisible] = useState<Record<EgresosColKey, boolean>>(defaultVisibleCols);
  const [sortKey, setSortKey] = useState<EgresosColKey>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!proyectoId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKeyColumnas(proyectoId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<EgresosColKey, boolean>>;
      setVisible((prev) => ({ ...prev, ...parsed }));
    } catch {
      /* ignore */
    }
  }, [proyectoId]);

  const persistCols = useCallback(
    (next: Record<EgresosColKey, boolean>) => {
      setVisible(next);
      if (!proyectoId || typeof window === 'undefined') return;
      try {
        localStorage.setItem(storageKeyColumnas(proyectoId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [proyectoId],
  );

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const qs = new URLSearchParams({
        proyecto: proyectoId,
        clase: 'GASTO',
        limit: '5000',
      });
      const res = await fetch(`/api/contabilidad/cco/libro?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error al cargar egresos');
      const rows = (json.filas ?? []) as CcoLibroFila[];
      setFilas(rows.map((f) => ({ ...f, dirty: false, draft: toDraft(f) })));
      setTotalApi(Number(json.total) || rows.length);
      setPctGlobal(Number(json.honorarios_admin_pct) || 15);
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
    const base = agrupar ? agruparFilas(filas) : filas;
    const sorted = [...base].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const va = (() => {
        switch (sortKey) {
          case 'id':
            return Number(a.display_id) || String(a.display_id);
          case 'fecha':
            return a.draft?.fecha ?? a.fecha ?? '';
          case 'proveedor':
            return (a.draft?.proveedor ?? a.proveedor).toUpperCase();
          case 'descripcion':
            return (a.draft?.descripcion ?? a.descripcion).toUpperCase();
          case 'factura':
            return (a.invoice_number ?? '').toUpperCase();
          case 'moneda':
            return a.draft?.moneda ?? a.moneda;
          case 'tasa':
            return Number(a.draft?.tasa ?? a.tasa) || 0;
          case 'tasa_binance':
            return a.tasa_binance || 0;
          case 'tasa_usada':
            return a.tasa_usada ?? '';
          case 'monto_orig':
            return Number(a.draft?.monto_orig ?? a.monto_orig) || 0;
          case 'monto_base':
            return a.monto_base_usd;
          case 'monto_pagado':
            return a.monto_pagado_usd ?? -1;
          case 'pct_dist':
            return a.pct_distribucion;
          case 'admin_pct':
            return Number(a.draft?.admin_pct ?? a.admin_pct) || 0;
          case 'brecha':
            return a.porcentaje_brecha_real ?? -1;
          case 'honorarios':
            return a.honorarios_usd;
          case 'costo_total':
            return a.costo_total_usd;
          case 'tipo':
            return a.tipo;
          case 'capitulo':
            return a.capitulo;
          case 'subcapitulo':
            return a.subcapitulo;
          case 'contrato':
            return a.contrato_label ?? '';
          case 'estado':
            return a.estado;
          case 'forma_pago':
            return a.forma_pago ?? '';
          default:
            return 0;
        }
      })();
      const vb = (() => {
        switch (sortKey) {
          case 'id':
            return Number(b.display_id) || String(b.display_id);
          case 'fecha':
            return b.draft?.fecha ?? b.fecha ?? '';
          case 'proveedor':
            return (b.draft?.proveedor ?? b.proveedor).toUpperCase();
          case 'descripcion':
            return (b.draft?.descripcion ?? b.descripcion).toUpperCase();
          case 'factura':
            return (b.invoice_number ?? '').toUpperCase();
          case 'moneda':
            return b.draft?.moneda ?? b.moneda;
          case 'tasa':
            return Number(b.draft?.tasa ?? b.tasa) || 0;
          case 'tasa_binance':
            return b.tasa_binance || 0;
          case 'tasa_usada':
            return b.tasa_usada ?? '';
          case 'monto_orig':
            return Number(b.draft?.monto_orig ?? b.monto_orig) || 0;
          case 'monto_base':
            return b.monto_base_usd;
          case 'monto_pagado':
            return b.monto_pagado_usd ?? -1;
          case 'pct_dist':
            return b.pct_distribucion;
          case 'admin_pct':
            return Number(b.draft?.admin_pct ?? b.admin_pct) || 0;
          case 'brecha':
            return b.porcentaje_brecha_real ?? -1;
          case 'honorarios':
            return b.honorarios_usd;
          case 'costo_total':
            return b.costo_total_usd;
          case 'tipo':
            return b.tipo;
          case 'capitulo':
            return b.capitulo;
          case 'subcapitulo':
            return b.subcapitulo;
          case 'contrato':
            return b.contrato_label ?? '';
          case 'estado':
            return b.estado;
          case 'forma_pago':
            return b.forma_pago ?? '';
          default:
            return 0;
        }
      })();
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir;
    });
    return sorted;
  }, [filas, agrupar, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const rows = filasVista;
    return {
      montoOrig: rows.reduce((s, r) => {
        const d = r.draft;
        if (d && !r._agrupada) {
          const rec = recalcFromDraft(r, d, pctGlobal);
          return s + rec.monto_base_usd;
        }
        return s + r.monto_base_usd;
      }, 0),
      honorarios: rows.reduce((s, r) => {
        const d = r.draft;
        if (d && !r._agrupada) {
          const rec = recalcFromDraft(r, d, pctGlobal);
          return s + rec.honorarios_usd;
        }
        return s + r.honorarios_usd;
      }, 0),
      costo: rows.reduce((s, r) => {
        const d = r.draft;
        if (d && !r._agrupada) {
          const rec = recalcFromDraft(r, d, pctGlobal);
          return s + rec.costo_total_usd;
        }
        return s + r.costo_total_usd;
      }, 0),
    };
  }, [filasVista, pctGlobal]);

  const dirtyCount = filas.filter((f) => f.dirty).length;
  const colsActivas = EGRESOS_COLUMNAS.filter((c) => visible[c.key]);

  const patchDraft = (id: string, patch: Partial<Draft>) => {
    setFilas((prev) =>
      prev.map((f) => {
        if (f.id !== id || f._agrupada) return f;
        const draft = { ...(f.draft ?? toDraft(f)), ...patch };
        const rec = recalcFromDraft(f, draft, pctGlobal);
        return {
          ...f,
          ...rec,
          draft,
          dirty: true,
          fecha: draft.fecha || f.fecha,
          proveedor: draft.proveedor,
          descripcion: draft.descripcion,
        };
      }),
    );
  };

  const toggleSort = (key: EgresosColKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'proveedor' || key === 'descripcion' ? 'asc' : 'desc');
    }
  };

  const mostrarOcultasORestablecer = () => {
    const next = defaultVisibleCols();
    for (const c of EGRESOS_COLUMNAS) next[c.key] = true;
    persistCols(next);
    setCfgOpen(true);
  };

  const capitulosOpts = useMemo(() => {
    const set = new Set<string>();
    for (const f of filas) {
      if (f.capitulo && f.capitulo !== '—') set.add(f.capitulo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [filas]);

  const subcapitulosOpts = useMemo(() => {
    const set = new Set<string>();
    for (const f of filas) {
      if (f.subcapitulo && f.subcapitulo !== '—') set.add(f.subcapitulo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [filas]);

  const guardar = async () => {
    const cambios = filas
      .filter((f) => f.dirty && f.draft && !f._agrupada && f.fuente === 'compra')
      .map((f) => {
        const d = f.draft!;
        return {
          id: f.id,
          fecha: d.fecha || undefined,
          proveedor: d.proveedor,
          descripcion: d.descripcion,
          moneda: d.moneda,
          tasa: Number(d.tasa) || 0,
          monto_orig: Number(d.monto_orig) || 0,
          admin_pct: Number(d.admin_pct) || null,
          tipo: d.tipo,
          capitulo: d.capitulo,
          subcapitulo: d.subcapitulo,
          estado: d.estado,
          forma_pago: d.forma_pago || null,
        };
      });
    if (cambios.length === 0) {
      setOkMsg('No hay cambios pendientes.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/registros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, clase: 'GASTO', cambios }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? 'No se pudo guardar');
      }
      setOkMsg(`Guardados ${json.updated ?? cambios.length} cambio(s) de egresos.`);
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
        <p style={muted}>Selecciona una obra para ver el cuadro de egresos.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <KpiSuma
          title="Suma Monto Original"
          value={fmtNum(kpis.montoOrig)}
          accent="#EAB308"
          icon={<CircleDollarSign size={18} />}
        />
        <KpiSuma
          title="Suma Honorarios"
          value={fmtUsd(kpis.honorarios)}
          accent="#16A34A"
          icon={<Briefcase size={18} />}
        />
        <KpiSuma
          title="Suma Costo Total"
          value={fmtUsd(kpis.costo)}
          accent="#DC2626"
          icon={<CircleDollarSign size={18} />}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 12,
          padding: '10px 14px',
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: '#1E3A8A', flex: 1, minWidth: 200 }}>
          Mostrando <strong>{filasVista.length}</strong> egresos desde compras de obra
          {totalApi !== filasVista.length ? ` · ${totalApi} en libro` : ''}. En{' '}
          <strong>LINK FACTURA</strong> puede ver el documento o adjuntar PDF/imagen y
          enlazarlo al egreso.
        </p>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            color: '#1E40AF',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Combina filas de un mismo gasto dividido (split) en una sola línea."
        >
          <input
            type="checkbox"
            checked={agrupar}
            onChange={(e) => setAgrupar(e.target.checked)}
          />
          Agrupar Gastos Divididos
          <HelpCircle size={14} color="#64748B" />
        </label>
        <button type="button" onClick={() => void cargar()} style={btnGhost} disabled={loading}>
          Actualizar
        </button>
      </div>

      <div style={box}>
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
            marginBottom: cfgOpen ? 12 : 0,
          }}
        >
          {cfgOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Eye size={16} color="#64748B" />
          Configurar Columnas Visibles (Egresos)
        </button>
        {cfgOpen ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 8,
              marginBottom: 8,
            }}
          >
            {EGRESOS_COLUMNAS.map((c) => (
              <label
                key={c.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#334155',
                }}
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#64748B', padding: 16 }}>
            <Loader2 className="animate-spin" size={16} /> Cargando egresos…
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 'min(70vh, 640px)', borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 980 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {colsActivas.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      style={{
                        padding: '9px 8px',
                        position: 'sticky',
                        top: 0,
                        background: '#F1F5F9',
                        zIndex: 1,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        userSelect: 'none',
                        textAlign: c.align === 'right' ? 'right' : 'left',
                        color: '#334155',
                        fontWeight: 800,
                        borderBottom: '1px solid #E2E8F0',
                      }}
                    >
                      {c.label}
                      {sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasVista.map((f, idx) => {
                  const d = f.draft ?? toDraft(f);
                  const rec = f._agrupada ? f : { ...f, ...recalcFromDraft(f, d, pctGlobal) };
                  const readonly = !!f._agrupada || agrupar;
                  return (
                    <tr
                      key={f._agrupada ? `g-${f.split_group_key}` : f.id}
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        background: f.dirty ? '#FFF7ED' : idx % 2 ? '#F8FAFC' : '#fff',
                      }}
                    >
                      {colsActivas.map((c) => {
                        const align = c.align === 'right' ? 'right' : 'left';
                        const cell: React.CSSProperties = {
                          ...td,
                          textAlign: align,
                          background: f.dirty ? '#FFF7ED' : undefined,
                        };
                        if (c.key === 'id') {
                          return (
                            <td key={c.key} style={cell}>
                              {f.display_id}
                              {f._agrupada ? (
                                <span style={{ color: '#64748B', fontSize: 10, display: 'block' }}>
                                  {f._groupIds?.length} partes
                                </span>
                              ) : null}
                            </td>
                          );
                        }
                        if (c.key === 'fecha') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                d.fecha || '—'
                              ) : (
                                <input
                                  type="date"
                                  value={d.fecha}
                                  onChange={(e) => patchDraft(f.id, { fecha: e.target.value })}
                                  style={inputCell}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'proveedor') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                d.proveedor
                              ) : (
                                <input
                                  value={d.proveedor}
                                  onChange={(e) => patchDraft(f.id, { proveedor: e.target.value })}
                                  style={{ ...inputCell, minWidth: 110 }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'descripcion') {
                          return (
                            <td key={c.key} style={{ ...cell, maxWidth: 260 }}>
                              {readonly ? (
                                <span title={d.descripcion}>{d.descripcion}</span>
                              ) : (
                                <input
                                  value={d.descripcion}
                                  onChange={(e) => patchDraft(f.id, { descripcion: e.target.value })}
                                  style={{ ...inputCell, minWidth: 160 }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'factura') {
                          return (
                            <td key={c.key} style={cell}>
                              {noneLabel(f.invoice_number)}
                            </td>
                          );
                        }
                        if (c.key === 'moneda') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                d.moneda
                              ) : (
                                <select
                                  value={d.moneda.toUpperCase().startsWith('VE') ? 'VES' : 'USD'}
                                  onChange={(e) => patchDraft(f.id, { moneda: e.target.value })}
                                  style={inputCell}
                                >
                                  <option value="USD">USD</option>
                                  <option value="VES">VES</option>
                                </select>
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'tasa') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                f.tasa > 0 ? fmtNum(f.tasa, 4) : '—'
                              ) : (
                                <input
                                  value={d.tasa}
                                  onChange={(e) => patchDraft(f.id, { tasa: e.target.value })}
                                  style={{ ...inputCell, width: 88, textAlign: 'right' }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'tasa_binance') {
                          return (
                            <td key={c.key} style={cell}>
                              {f.tasa_binance > 0 ? fmtNum(f.tasa_binance, 4) : '—'}
                            </td>
                          );
                        }
                        if (c.key === 'tasa_usada') {
                          return (
                            <td key={c.key} style={cell}>
                              {noneLabel(f.tasa_usada)}
                            </td>
                          );
                        }
                        if (c.key === 'monto_orig') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                fmtNum(rec.monto_orig)
                              ) : (
                                <input
                                  value={d.monto_orig}
                                  onChange={(e) => patchDraft(f.id, { monto_orig: e.target.value })}
                                  style={{ ...inputCell, width: 96, textAlign: 'right' }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'monto_base') {
                          return (
                            <td
                              key={c.key}
                              style={{ ...cell, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                            >
                              {fmtUsd(rec.monto_base_usd)}
                            </td>
                          );
                        }
                        if (c.key === 'monto_pagado') {
                          return (
                            <td key={c.key} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                              {f.monto_pagado_usd != null ? fmtUsd(f.monto_pagado_usd) : '—'}
                            </td>
                          );
                        }
                        if (c.key === 'pct_dist') {
                          return (
                            <td key={c.key} style={cell}>
                              {fmtNum(f.pct_distribucion)}%
                            </td>
                          );
                        }
                        if (c.key === 'admin_pct') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                fmtNum(rec.admin_pct)
                              ) : (
                                <input
                                  value={d.admin_pct}
                                  onChange={(e) => patchDraft(f.id, { admin_pct: e.target.value })}
                                  style={{ ...inputCell, width: 64, textAlign: 'right' }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'brecha') {
                          return (
                            <td key={c.key} style={cell}>
                              {f.porcentaje_brecha_real != null
                                ? `${fmtNum(f.porcentaje_brecha_real)}%`
                                : '—'}
                            </td>
                          );
                        }
                        if (c.key === 'honorarios') {
                          return (
                            <td key={c.key} style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtUsd(rec.honorarios_usd)}
                            </td>
                          );
                        }
                        if (c.key === 'costo_total') {
                          return (
                            <td
                              key={c.key}
                              style={{ ...cell, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                            >
                              {fmtUsd(rec.costo_total_usd)}
                            </td>
                          );
                        }
                        if (c.key === 'estado') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                <EstadoBadge estado={d.estado} />
                              ) : (
                                <select
                                  value={d.estado}
                                  onChange={(e) => patchDraft(f.id, { estado: e.target.value })}
                                  style={inputCell}
                                >
                                  {EGRESOS_ESTADOS.map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'forma_pago') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                noneLabel(d.forma_pago)
                              ) : (
                                <select
                                  value={d.forma_pago}
                                  onChange={(e) => patchDraft(f.id, { forma_pago: e.target.value })}
                                  style={inputCell}
                                >
                                  <option value="">None</option>
                                  {FORMAS_PAGO_CCO.map((fp) => (
                                    <option key={fp} value={fp}>
                                      {fp}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'tipo') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                d.tipo || '—'
                              ) : (
                                <select
                                  value={d.tipo}
                                  onChange={(e) => patchDraft(f.id, { tipo: e.target.value })}
                                  style={{ ...inputCell, minWidth: 120 }}
                                >
                                  <option value="">—</option>
                                  {[...CCO_TIPOS_GASTO]
                                    .sort((a, b) => a.localeCompare(b, 'es'))
                                    .map((t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    ))}
                                </select>
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'capitulo') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                d.capitulo || '—'
                              ) : (
                                <input
                                  list={`cap-${proyectoId}`}
                                  value={d.capitulo}
                                  onChange={(e) => patchDraft(f.id, { capitulo: e.target.value })}
                                  style={{ ...inputCell, minWidth: 100 }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'subcapitulo') {
                          return (
                            <td key={c.key} style={cell}>
                              {readonly ? (
                                d.subcapitulo || '—'
                              ) : (
                                <input
                                  list={`sub-${proyectoId}`}
                                  value={d.subcapitulo}
                                  onChange={(e) => patchDraft(f.id, { subcapitulo: e.target.value })}
                                  style={{ ...inputCell, minWidth: 110 }}
                                />
                              )}
                            </td>
                          );
                        }
                        if (c.key === 'contrato') {
                          return (
                            <td key={c.key} style={{ ...cell, maxWidth: 160, whiteSpace: 'normal' }}>
                              {noneLabel(f.contrato_label)}
                            </td>
                          );
                        }
                        if (c.key === 'link_factura') {
                          const puedeAdjuntar =
                            !readonly && f.fuente === 'compra' && !f._agrupada;
                          return (
                            <td key={c.key} style={{ ...cell, whiteSpace: 'normal' }}>
                              {f.fuente === 'compra' ? (
                                <EgresoFacturaCell
                                  compraId={f.id}
                                  tieneDocumento={!!f.tiene_documento}
                                  fileName={f.document_file_name}
                                  puedeAdjuntar={puedeAdjuntar}
                                  onAdjuntado={(compraId, name) => {
                                    setFilas((prev) =>
                                      prev.map((row) =>
                                        row.id === compraId
                                          ? {
                                              ...row,
                                              tiene_documento: true,
                                              document_file_name: name,
                                              link_factura: `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`,
                                            }
                                          : row,
                                      ),
                                    );
                                    setOkMsg('Factura enlazada al egreso.');
                                  }}
                                />
                              ) : (
                                noneLabel(null)
                              )}
                            </td>
                          );
                        }
                        return <td key={c.key} style={cell}>—</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <datalist id={`cap-${proyectoId}`}>
              {capitulosOpts.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id={`sub-${proyectoId}`}>
              {subcapitulosOpts.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {filasVista.length === 0 ? (
              <p style={{ ...muted, padding: 16 }}>Sin egresos para el filtro actual.</p>
            ) : null}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 14,
          }}
        >
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={saving || dirtyCount === 0 || agrupar}
            style={{
              ...btnSave,
              opacity: saving || dirtyCount === 0 || agrupar ? 0.55 : 1,
            }}
            title={agrupar ? 'Desactiva «Agrupar» para editar y guardar filas.' : undefined}
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar Cambios de Egresos
            {dirtyCount > 0 ? ` (${dirtyCount})` : ''}
          </button>
          <button type="button" onClick={mostrarOcultasORestablecer} style={btnLink}>
            <Eye size={14} /> Mostrar Columnas Ocultas / Restablecer Vista
          </button>
        </div>
      </div>

      <EgresoCargaSoportesPanel
        filas={filas}
        onAdjuntado={(compraId, name) => {
          setFilas((prev) =>
            prev.map((row) =>
              row.id === compraId
                ? {
                    ...row,
                    tiene_documento: true,
                    document_file_name: name,
                    link_factura: `/api/contabilidad/compras/${encodeURIComponent(compraId)}/document`,
                  }
                : row,
            ),
          );
          setOkMsg('Factura enlazada al egreso.');
        }}
      />
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 16,
};

const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: 0 };
const td: React.CSSProperties = {
  padding: '6px 8px',
  verticalAlign: 'middle',
  color: '#334155',
  whiteSpace: 'nowrap',
};
const inputCell: React.CSSProperties = {
  width: '100%',
  border: '1px solid #CBD5E1',
  borderRadius: 6,
  padding: '4px 6px',
  fontSize: 12,
  color: '#0F172A',
  background: '#fff',
};
const btnGhost: React.CSSProperties = {
  border: '1px solid #93C5FD',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 12,
  color: '#1D4ED8',
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
