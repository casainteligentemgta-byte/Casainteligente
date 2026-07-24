'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CcoProveedorContratos, CcoPagoVinculado, CcoContratoConSaldo } from '@/lib/contabilidad/cco/types';
import {
  conciliarContratosPorProveedor,
  sugeridoPagarPorAvance,
  type CcoConciliacionFila,
} from '@/lib/contabilidad/cco/conciliacionContratos';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUsdTick(n: number): string {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

function trunc(s: string, max: number): string {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type Props = {
  proyectoId: string;
  onNeedProyecto?: () => void;
};

export default function CcoTabContratos({ proyectoId, onNeedProyecto }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [porProveedor, setPorProveedor] = useState<CcoProveedorContratos[]>([]);
  const [huerfanos, setHuerfanos] = useState<CcoPagoVinculado[]>([]);
  const [openProv, setOpenProv] = useState<Set<string>>(new Set());
  const [mostrarConciliacion, setMostrarConciliacion] = useState(true);
  const [filtroEgresos, setFiltroEgresos] = useState<string | null>(null);
  const [form, setForm] = useState({
    proveedor: '',
    descripcion: '',
    monto_base_usd: '',
    admin_pct: '0',
  });
  const [saving, setSaving] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [selectedHuerfanos, setSelectedHuerfanos] = useState<Set<string>>(new Set());
  const [targetContrato, setTargetContrato] = useState('');
  const [repartoCompraId, setRepartoCompraId] = useState('');
  const [montosReparto, setMontosReparto] = useState<Record<string, string>>({});
  const [avanceDraft, setAvanceDraft] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    if (!proyectoId) {
      onNeedProyecto?.();
      return;
    }
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/contratos?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setHint(json.hint ?? null);
        throw new Error(json.error ?? 'Error al cargar contratos');
      }
      setPorProveedor(json.porProveedor ?? []);
      setHuerfanos(json.huerfanos ?? []);
      const drafts: Record<string, string> = {};
      for (const p of (json.porProveedor ?? []) as CcoProveedorContratos[]) {
        for (const c of p.contratos) {
          drafts[c.id] = String(c.pct_avance ?? 0);
        }
      }
      setAvanceDraft(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setPorProveedor([]);
      setHuerfanos([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, onNeedProyecto]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const { filas, total } = useMemo(
    () => conciliarContratosPorProveedor(porProveedor),
    [porProveedor],
  );

  const chartData = useMemo(
    () =>
      [...filas]
        .map((f) => ({
          proveedor: trunc(f.proveedor, 18),
          proveedorFull: f.proveedor,
          ejecutado: Math.min(f.montoEjecutado, f.montoAcordado),
          pendiente: Math.max(0, f.montoAcordado - f.montoEjecutado),
        }))
        .sort((a, b) => b.ejecutado + b.pendiente - (a.ejecutado + a.pendiente)),
    [filas],
  );

  const allContratosSaldo = useMemo(
    () => porProveedor.flatMap((p) => p.contratos),
    [porProveedor],
  );

  const huerfanoReparto = useMemo(
    () => huerfanos.find((h) => h.id === repartoCompraId) ?? null,
    [huerfanos, repartoCompraId],
  );

  const contratosReparto = useMemo(() => {
    if (!huerfanoReparto) return [] as CcoContratoConSaldo[];
    const prov = huerfanoReparto.proveedor.toUpperCase();
    const mismos = allContratosSaldo.filter((c) => c.proveedor.toUpperCase() === prov);
    return mismos.length ? mismos : allContratosSaldo;
  }, [huerfanoReparto, allContratosSaldo]);

  const sumaReparto = useMemo(
    () => Object.values(montosReparto).reduce((a, v) => a + (Number(v) || 0), 0),
    [montosReparto],
  );

  const egresosFiltrados = useMemo(() => {
    if (!filtroEgresos) return [];
    const p = porProveedor.find((x) => x.proveedor === filtroEgresos);
    if (!p) return [];
    return p.contratos.flatMap((c) =>
      c.pagos.map((pago) => ({
        ...pago,
        contrato: c.descripcion,
      })),
    );
  }, [filtroEgresos, porProveedor]);

  async function crearContrato(e: React.FormEvent) {
    e.preventDefault();
    if (!proyectoId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          proyecto_id: proyectoId,
          proveedor: form.proveedor,
          descripcion: form.descripcion,
          monto_base_usd: Number(form.monto_base_usd),
          admin_pct: Number(form.admin_pct) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      setForm({ proveedor: '', descripcion: '', monto_base_usd: '', admin_pct: '0' });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function vincularSeleccionados() {
    if (!targetContrato || !selectedHuerfanos.size) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vincular',
          contrato_id: targetContrato,
          compra_ids: Array.from(selectedHuerfanos),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo vincular');
      setSelectedHuerfanos(new Set());
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vincular');
    } finally {
      setSaving(false);
    }
  }

  async function autoVincular() {
    if (!proyectoId) return;
    setSaving(true);
    setError(null);
    setBackfillMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backfill',
          proyecto_id: proyectoId,
          umbral: 40,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo auto-vincular');
      setBackfillMsg(
        `Auto-vínculo: ${json.vinculados ?? 0} de ${json.revisados ?? 0} huérfanos · sin match ${json.sinMatch ?? 0}`,
      );
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en backfill');
    } finally {
      setSaving(false);
    }
  }

  async function guardarAvance(contratoId: string, pctRaw: string) {
    const pct = Number(pctRaw);
    if (!Number.isFinite(pct)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'patch_avance',
          contrato_id: contratoId,
          pct_avance: pct,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setHint(json.hint ?? null);
        throw new Error(json.error ?? 'No se pudo guardar el avance');
      }
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar avance');
    } finally {
      setSaving(false);
    }
  }

  function iniciarReparto(compraId: string) {
    setRepartoCompraId(compraId);
    const h = huerfanos.find((x) => x.id === compraId);
    const prov = (h?.proveedor ?? '').toUpperCase();
    const contratos =
      allContratosSaldo.filter((c) => c.proveedor.toUpperCase() === prov).length > 0
        ? allContratosSaldo.filter((c) => c.proveedor.toUpperCase() === prov)
        : allContratosSaldo;
    const next: Record<string, string> = {};
    for (const c of contratos) {
      const sug = sugeridoPagarPorAvance(c.costo_total_usd, c.pct_avance, c.monto_pagado_usd);
      next[c.id] = sug > 0 ? String(sug) : '';
    }
    setMontosReparto(next);
  }

  async function confirmarReparto() {
    if (!repartoCompraId || !huerfanoReparto) return;
    const asignaciones = Object.entries(montosReparto)
      .map(([contrato_id, monto]) => ({
        contrato_id,
        monto_usd: Number(monto) || 0,
      }))
      .filter((a) => a.monto_usd > 0);
    if (!asignaciones.length) {
      setError('Indica al menos un monto a repartir.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contabilidad/cco/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'repartir',
          compra_id: repartoCompraId,
          asignaciones,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setHint(json.hint ?? null);
        throw new Error(json.error ?? 'No se pudo repartir el saco');
      }
      setBackfillMsg(
        `Reparto: ${json.vinculados ?? 0} vínculo(s) · resto en saco $${Number(json.resto_usd ?? 0).toFixed(2)}`,
      );
      setRepartoCompraId('');
      setMontosReparto({});
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al repartir');
    } finally {
      setSaving(false);
    }
  }

  function expandirTodo() {
    setOpenProv(new Set(filas.map((f) => f.proveedor)));
  }
  function resumirTodo() {
    setOpenProv(new Set());
  }
  function toggleProv(p: string) {
    setOpenProv((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Contratos</h3>
        <p style={muted}>
          Selecciona una obra en el filtro superior para ver y crear contratos de subcontratista.
        </p>
      </div>
    );
  }

  const allContratos = porProveedor.flatMap((p) =>
    p.contratos.map((c) => ({ id: c.id, label: `${c.proveedor} · ${c.descripcion}` })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs V4 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { t: 'MONTO ACORDADO', v: fmtUsd(total.montoAcordado), accent: '#1D4ED8' },
          { t: 'MONTO EJECUTADO', v: fmtUsd(total.montoEjecutado), accent: '#0F766E' },
          { t: 'MONTO PAGADO', v: fmtUsd(total.montoPagado), accent: '#15803D' },
        ].map((k) => (
          <div
            key={k.t}
            style={{
              ...box,
              padding: '16px 18px',
              borderTop: `4px solid ${k.accent}`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#64748B',
              }}
            >
              {k.t}
            </p>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 24,
                fontWeight: 800,
                color: '#0F172A',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {k.v}
            </p>
          </div>
        ))}
      </div>

      <div style={box}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3 style={{ ...h3, margin: 0 }}>Contratos por Subcontratista</h3>
          <button type="button" onClick={() => void cargar()} style={btnGhost} disabled={loading}>
            Actualizar
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMostrarConciliacion((v) => !v)}
          style={btnBanner}
        >
          CUADRO DE CONCILIACIÓN DE CONTRATOS
        </button>

        {mostrarConciliacion ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              <button type="button" onClick={expandirTodo} style={btnGhost}>
                Expandir Todo
              </button>
              <button type="button" onClick={resumirTodo} style={btnGhost}>
                Resumir Todo
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
                <Loader2 className="animate-spin" size={16} /> Cargando…
              </div>
            ) : filas.length === 0 ? (
              <p style={muted}>Sin contratos. Impórtalos desde V4 o créalos abajo.</p>
            ) : (
              <div style={{ overflow: 'auto', maxHeight: 520 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 1100 }}>
                  <thead>
                    <tr style={{ background: '#1E293B', color: '#fff', textAlign: 'left' }}>
                      {[
                        'SUBCONTRATISTA / CONTRATO',
                        'MONTO ACORDADO',
                        'MONTO EJECUTADO',
                        'MONTO PAGADO',
                        'MONTO POR EJECUTAR',
                        'MONTO NO EJECUTADO PAGADO',
                        'MONTO PAGADO DE MAS',
                        'TOTAL ANTICIPADO',
                        'EJECUTADO SIN PAGAR',
                        'MONTO NO EJECUTADO POR PAGAR',
                        'AVANCE',
                        'ESTADO',
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '8px 6px',
                            whiteSpace: 'nowrap',
                            position: 'sticky',
                            top: 0,
                            background: '#1E293B',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <FilaProveedor
                        key={f.proveedor}
                        fila={f}
                        open={openProv.has(f.proveedor)}
                        onToggle={() => toggleProv(f.proveedor)}
                        avanceDraft={avanceDraft}
                        onAvanceChange={(id, v) =>
                          setAvanceDraft((prev) => ({ ...prev, [id]: v }))
                        }
                        onAvanceSave={(id) => void guardarAvance(id, avanceDraft[id] ?? '0')}
                        saving={saving}
                      />
                    ))}
                    <tr style={{ background: '#F1F5F9', fontWeight: 800, borderTop: '2px solid #CBD5E1' }}>
                      <td style={td}>TOTAL GENERAL</td>
                      <td style={numTd}>{fmtUsd(total.montoAcordado)}</td>
                      <td style={numTd}>{fmtUsd(total.montoEjecutado)}</td>
                      <td style={numTd}>{fmtUsd(total.montoPagado)}</td>
                      <td style={{ ...numTd, color: '#B91C1C' }}>{fmtUsd(total.montoPorEjecutar)}</td>
                      <td style={{ ...numTd, color: '#B91C1C' }}>
                        {fmtUsd(total.montoNoEjecutadoPagado)}
                      </td>
                      <td style={{ ...numTd, color: '#B91C1C' }}>{fmtUsd(total.montoPagadoDeMas)}</td>
                      <td style={{ ...numTd, color: '#B91C1C' }}>{fmtUsd(total.totalAnticipado)}</td>
                      <td style={{ ...numTd, color: '#15803D' }}>{fmtUsd(total.ejecutadoSinPagar)}</td>
                      <td style={{ ...numTd, color: '#1D4ED8' }}>
                        {fmtUsd(total.montoNoEjecutadoPorPagar)}
                      </td>
                      <td style={numTd}>{total.avancePct.toFixed(1)}%</td>
                      <td style={td}>
                        <EstadoBadge estado={total.estado} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Gráfico comparativo */}
      {chartData.length > 0 ? (
        <div style={box}>
          <h3 style={{ ...h3, margin: '0 0 4px' }}>Gráfico Comparativo de Subcontratistas</h3>
          <p style={{ ...muted, margin: '0 0 14px' }}>
            Comparativa de Contratos: Monto Ejecutado vs. Pendiente por Subcontratista
          </p>
          <div style={{ width: '100%', height: Math.max(280, chartData.length * 36 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtUsdTick} tick={{ fill: '#64748B', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="proveedor"
                  width={120}
                  tick={{ fill: '#475569', fontSize: 10 }}
                  interval={0}
                />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { proveedorFull?: string } | undefined;
                    return p?.proveedorFull ?? '';
                  }}
                  formatter={(v, name) => [
                    fmtUsd(Number(v)),
                    name === 'ejecutado' ? 'Ejecutado (avance)' : 'Pendiente por ejecutar',
                  ]}
                />
                <Bar dataKey="ejecutado" stackId="a" fill="#22C55E" name="ejecutado" />
                <Bar dataKey="pendiente" stackId="a" fill="#EF4444" name="pendiente" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, fontWeight: 700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: '#22C55E', borderRadius: 2 }} />
              Ejecutado (avance operador)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, background: '#EF4444', borderRadius: 2 }} />
              Pendiente
            </span>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (filtroEgresos) setFiltroEgresos(null);
          else if (filas[0]) setFiltroEgresos(filas[0].proveedor);
        }}
        style={btnBannerDark}
      >
        DETALLE Y FILTRO DE EGRESOS POR SUBCONTRATISTA
      </button>

      {filtroEgresos ? (
        <div style={box}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Subcontratista{' '}
              <select
                value={filtroEgresos}
                onChange={(e) => setFiltroEgresos(e.target.value)}
                style={input}
              >
                {filas.map((f) => (
                  <option key={f.proveedor} value={f.proveedor}>
                    {f.proveedor}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setFiltroEgresos(null)} style={btnGhost}>
              Cerrar
            </button>
          </div>
          {egresosFiltrados.length === 0 ? (
            <p style={muted}>Sin egresos vinculados a este subcontratista.</p>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: 360 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    {['Fecha', 'Contrato', 'Descripción', 'Estado', 'Monto USD'].map((h) => (
                      <th key={h} style={{ padding: '8px 6px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {egresosFiltrados.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={td}>{p.fecha ?? '—'}</td>
                      <td style={td}>{p.contrato}</td>
                      <td style={{ ...td, whiteSpace: 'normal' }}>{p.descripcion}</td>
                      <td style={td}>{p.estado ?? 'PAGADO'}</td>
                      <td style={numTd}>{fmtUsd(p.monto_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <div style={{ ...box, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>
          {error}
          {hint ? <p style={{ margin: '8px 0 0', fontSize: 12 }}>{hint}</p> : null}
        </div>
      ) : null}
      {backfillMsg ? (
        <div style={{ ...box, borderColor: '#BBF7D0', background: '#F0FDF4', color: '#14532D' }}>
          {backfillMsg}
        </div>
      ) : null}

      {/* Alta + huérfanos (operación) */}
      <form
        onSubmit={crearContrato}
        style={{
          ...box,
          display: 'grid',
          gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ ...h3, marginBottom: 4 }}>Nuevo contrato</h3>
          <p style={{ ...muted, margin: 0 }}>Equivalente a CLASE=CONTRATO en V4 (subcontratista).</p>
        </div>
        <label style={label}>
          Proveedor
          <input
            required
            value={form.proveedor}
            onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
            style={input}
          />
        </label>
        <label style={label}>
          Descripción
          <input
            required
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            style={input}
          />
        </label>
        <label style={label}>
          Monto base USD
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={form.monto_base_usd}
            onChange={(e) => setForm((f) => ({ ...f, monto_base_usd: e.target.value }))}
            style={input}
          />
        </label>
        <label style={label}>
          % Admin
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={form.admin_pct}
            onChange={(e) => setForm((f) => ({ ...f, admin_pct: e.target.value }))}
            style={input}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? 'Guardando…' : 'Registrar contrato'}
          </button>
        </div>
      </form>

      <div style={box}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ ...h3, margin: 0 }}>Saco / pagos huérfanos (CONTRATISTA sin vínculo)</h3>
          <button
            type="button"
            disabled={saving || !huerfanos.length}
            onClick={() => void autoVincular()}
            style={{ ...btnPrimary, background: '#0F766E' }}
          >
            Auto-vincular por descripción
          </button>
        </div>
        <p style={muted}>
          Pagas al contratista en un saco (sin contrato). Luego repartes montos a cada contrato según
          el % de avance que fija el operador. Los vínculos previos no se sobrescriben.
        </p>
        {huerfanos.length === 0 ? (
          <p style={muted}>No hay pagos huérfanos tipados como CONTRATISTA.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <select
                value={targetContrato}
                onChange={(e) => setTargetContrato(e.target.value)}
                style={input}
              >
                <option value="">Vínculo 1:1 — contrato destino…</option>
                {allContratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!targetContrato || !selectedHuerfanos.size || saving}
                onClick={() => void vincularSeleccionados()}
                style={btnPrimary}
              >
                Vincular seleccionados ({selectedHuerfanos.size})
              </button>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 280 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    {['', 'Fecha', 'Proveedor', 'Descripción', 'Monto', ''].map((h, i) => (
                      <th key={h || `col-${i}`} style={{ padding: '6px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {huerfanos.map((h) => (
                    <tr key={h.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={selectedHuerfanos.has(h.id)}
                          onChange={(e) => {
                            setSelectedHuerfanos((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(h.id);
                              else next.delete(h.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td style={td}>{h.fecha ?? '—'}</td>
                      <td style={td}>{h.proveedor}</td>
                      <td style={{ ...td, whiteSpace: 'normal' }}>{h.descripcion}</td>
                      <td style={numTd}>{fmtUsd(h.monto_usd)}</td>
                      <td style={td}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => iniciarReparto(h.id)}
                          style={{ ...btnGhost, padding: '6px 10px', fontSize: 11 }}
                        >
                          Repartir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {huerfanoReparto ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #BFDBFE',
                  background: '#EFF6FF',
                }}
              >
                <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#1E3A8A' }}>
                  Repartir saco · {fmtUsd(huerfanoReparto.monto_usd)}
                </h4>
                <p style={{ ...muted, margin: '0 0 10px' }}>
                  {huerfanoReparto.proveedor} · {huerfanoReparto.descripcion}. Sugerido = avance% ×
                  costo − ya pagado. Suma asignada: {fmtUsd(sumaReparto)}
                  {sumaReparto - huerfanoReparto.monto_usd > 0.009 ? (
                    <span style={{ color: '#B91C1C', fontWeight: 800 }}>
                      {' '}
                      (excede el saco)
                    </span>
                  ) : null}
                </p>
                {contratosReparto.length === 0 ? (
                  <p style={muted}>No hay contratos para este proveedor. Crea uno arriba.</p>
                ) : (
                  <div style={{ overflow: 'auto', maxHeight: 360 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#DBEAFE', textAlign: 'left' }}>
                          {[
                            'Contrato',
                            'Costo',
                            '% Avance',
                            'Ya pagado',
                            'Sugerido',
                            'Asignar USD',
                          ].map((h) => (
                            <th key={h} style={{ padding: '8px 6px' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {contratosReparto.map((c) => {
                          const sug = sugeridoPagarPorAvance(
                            c.costo_total_usd,
                            Number(avanceDraft[c.id] ?? c.pct_avance) || 0,
                            c.monto_pagado_usd,
                          );
                          return (
                            <tr key={c.id} style={{ borderTop: '1px solid #BFDBFE' }}>
                              <td style={{ ...td, whiteSpace: 'normal', fontWeight: 700 }}>
                                {c.descripcion}
                              </td>
                              <td style={numTd}>{fmtUsd(c.costo_total_usd)}</td>
                              <td style={td}>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.1"
                                  value={avanceDraft[c.id] ?? String(c.pct_avance)}
                                  onChange={(e) =>
                                    setAvanceDraft((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => void guardarAvance(c.id, avanceDraft[c.id] ?? '0')}
                                  style={{ ...input, width: 72, padding: '4px 6px' }}
                                  disabled={saving}
                                />
                              </td>
                              <td style={numTd}>{fmtUsd(c.monto_pagado_usd)}</td>
                              <td style={numTd}>{fmtUsd(sug)}</td>
                              <td style={td}>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={montosReparto[c.id] ?? ''}
                                  onChange={(e) =>
                                    setMontosReparto((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="0"
                                  style={{ ...input, width: 100, padding: '4px 6px' }}
                                  disabled={saving}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    disabled={
                      saving ||
                      sumaReparto <= 0 ||
                      sumaReparto - huerfanoReparto.monto_usd > 0.009
                    }
                    onClick={() => void confirmarReparto()}
                    style={btnPrimary}
                  >
                    Confirmar reparto
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setRepartoCompraId('');
                      setMontosReparto({});
                    }}
                    style={btnGhost}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: 'Terminado' | 'En Ejecución' }) {
  const ok = estado === 'Terminado';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: ok ? '#DCFCE7' : '#FEF3C7',
        color: ok ? '#166534' : '#92400E',
        fontWeight: 800,
        fontSize: 11,
        whiteSpace: 'nowrap',
      }}
    >
      {ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
      {estado}
    </span>
  );
}

function FilaProveedor({
  fila,
  open,
  onToggle,
  avanceDraft,
  onAvanceChange,
  onAvanceSave,
  saving,
}: {
  fila: CcoConciliacionFila;
  open: boolean;
  onToggle: () => void;
  avanceDraft: Record<string, string>;
  onAvanceChange: (id: string, v: string) => void;
  onAvanceSave: (id: string) => void;
  saving: boolean;
}) {
  return (
    <>
      <tr style={{ borderTop: '1px solid #E2E8F0', background: '#fff' }}>
        <td style={td}>
          <button
            type="button"
            onClick={onToggle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 0,
              cursor: 'pointer',
              fontWeight: 800,
              color: '#0F172A',
              padding: 0,
              fontSize: 12,
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {fila.proveedor}
          </button>
        </td>
        <CeldasMetricas f={fila} />
      </tr>
      {open
        ? fila.contratos.map((c) => {
            const m = {
              montoAcordado: c.acordado,
              montoEjecutado: c.ejecutado,
              montoPagado: c.pagado,
              montoPorEjecutar: Math.max(0, c.acordado - c.ejecutado),
              montoNoEjecutadoPagado: Math.max(
                0,
                Math.min(Math.max(0, c.pagado - c.ejecutado), Math.max(0, c.acordado - c.ejecutado)),
              ),
              montoPagadoDeMas: Math.max(0, c.pagado - c.acordado),
              totalAnticipado: 0,
              ejecutadoSinPagar: Math.max(0, c.ejecutado - c.pagado),
              montoNoEjecutadoPorPagar: 0,
              avancePct: c.pctAvance,
              estado:
                c.pctAvance >= 99.5 && Math.max(0, c.ejecutado - c.pagado) < 0.01
                  ? ('Terminado' as const)
                  : ('En Ejecución' as const),
            };
            m.totalAnticipado = m.montoNoEjecutadoPagado + m.montoPagadoDeMas;
            m.montoNoEjecutadoPorPagar = Math.max(
              0,
              m.montoPorEjecutar - m.montoNoEjecutadoPagado,
            );
            return (
              <tr key={c.id} style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                <td style={{ ...td, paddingLeft: 28, fontWeight: 600, color: '#475569' }}>
                  {c.descripcion}
                </td>
                <td style={numTd}>{fmtUsd(m.montoAcordado)}</td>
                <td style={numTd}>{fmtUsd(m.montoEjecutado)}</td>
                <td style={numTd}>{fmtUsd(m.montoPagado)}</td>
                <td style={{ ...numTd, color: m.montoPorEjecutar > 0 ? '#B91C1C' : undefined }}>
                  {fmtUsd(m.montoPorEjecutar)}
                </td>
                <td style={{ ...numTd, color: m.montoNoEjecutadoPagado > 0 ? '#B91C1C' : undefined }}>
                  {fmtUsd(m.montoNoEjecutadoPagado)}
                </td>
                <td style={{ ...numTd, color: m.montoPagadoDeMas > 0 ? '#B91C1C' : undefined }}>
                  {fmtUsd(m.montoPagadoDeMas)}
                </td>
                <td style={{ ...numTd, color: m.totalAnticipado > 0 ? '#B91C1C' : undefined }}>
                  {fmtUsd(m.totalAnticipado)}
                </td>
                <td style={{ ...numTd, color: m.ejecutadoSinPagar > 0 ? '#15803D' : undefined }}>
                  {fmtUsd(m.ejecutadoSinPagar)}
                </td>
                <td
                  style={{
                    ...numTd,
                    color: m.montoNoEjecutadoPorPagar > 0 ? '#1D4ED8' : undefined,
                  }}
                >
                  {fmtUsd(m.montoNoEjecutadoPorPagar)}
                </td>
                <td style={td}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={avanceDraft[c.id] ?? String(c.pctAvance)}
                    onChange={(e) => onAvanceChange(c.id, e.target.value)}
                    onBlur={() => onAvanceSave(c.id)}
                    disabled={saving}
                    title="Avance del operador (0–100). Enter o salir del campo guarda."
                    style={{
                      width: 64,
                      padding: '4px 6px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontWeight: 700,
                      fontSize: 12,
                      textAlign: 'right',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <span style={{ marginLeft: 2, fontWeight: 700, color: '#64748B' }}>%</span>
                </td>
                <td style={td}>
                  <EstadoBadge estado={m.estado} />
                </td>
              </tr>
            );
          })
        : null}
    </>
  );
}

function CeldasMetricas({
  f,
}: {
  f: {
    montoAcordado: number;
    montoEjecutado: number;
    montoPagado: number;
    montoPorEjecutar: number;
    montoNoEjecutadoPagado: number;
    montoPagadoDeMas: number;
    totalAnticipado: number;
    ejecutadoSinPagar: number;
    montoNoEjecutadoPorPagar: number;
    avancePct: number;
    estado: 'Terminado' | 'En Ejecución';
  };
}) {
  return (
    <>
      <td style={numTd}>{fmtUsd(f.montoAcordado)}</td>
      <td style={numTd}>{fmtUsd(f.montoEjecutado)}</td>
      <td style={numTd}>{fmtUsd(f.montoPagado)}</td>
      <td style={{ ...numTd, color: f.montoPorEjecutar > 0 ? '#B91C1C' : undefined }}>
        {fmtUsd(f.montoPorEjecutar)}
      </td>
      <td style={{ ...numTd, color: f.montoNoEjecutadoPagado > 0 ? '#B91C1C' : undefined }}>
        {fmtUsd(f.montoNoEjecutadoPagado)}
      </td>
      <td style={{ ...numTd, color: f.montoPagadoDeMas > 0 ? '#B91C1C' : undefined }}>
        {fmtUsd(f.montoPagadoDeMas)}
      </td>
      <td style={{ ...numTd, color: f.totalAnticipado > 0 ? '#B91C1C' : undefined }}>
        {fmtUsd(f.totalAnticipado)}
      </td>
      <td style={{ ...numTd, color: f.ejecutadoSinPagar > 0 ? '#15803D' : undefined }}>
        {fmtUsd(f.ejecutadoSinPagar)}
      </td>
      <td style={{ ...numTd, color: f.montoNoEjecutadoPorPagar > 0 ? '#1D4ED8' : undefined }}>
        {fmtUsd(f.montoNoEjecutadoPorPagar)}
      </td>
      <td style={numTd}>{f.avancePct.toFixed(1)}%</td>
      <td style={td}>
        <EstadoBadge estado={f.estado} />
      </td>
    </>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
};
const h3: React.CSSProperties = { fontSize: 18, fontWeight: 800, color: '#0F172A' };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '8px 0 12px' };
const td: React.CSSProperties = {
  padding: '8px 6px',
  verticalAlign: 'middle',
  color: '#334155',
  whiteSpace: 'nowrap',
};
const numTd: React.CSSProperties = {
  ...td,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
};
const label: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
};
const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  background: '#F8FAFC',
  fontSize: 13,
  fontWeight: 600,
  color: '#0F172A',
};
const btnPrimary: React.CSSProperties = {
  background: '#1D4ED8',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 800,
  fontSize: 13,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  color: '#0F172A',
};
const btnBanner: React.CSSProperties = {
  width: '100%',
  background: '#2563EB',
  color: '#fff',
  border: 0,
  borderRadius: 10,
  padding: '12px 16px',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  letterSpacing: '0.02em',
};
const btnBannerDark: React.CSSProperties = {
  ...btnBanner,
  background: '#0F172A',
};
