'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  CLASIFICACIONES_GASTO_ENTIDAD,
  etiquetaClasificacionGastoEntidad,
} from '@/lib/contabilidad/clasificacionGastoEntidad';
import type {
  FilaGastoEntidad,
  ResumenGastosEntidad,
  TotalesClasificacionGastoEntidad,
} from '@/lib/contabilidad/resumenGastosEntidad';
import { todayIso } from '@/lib/contabilidad/comprasFiltros';

type EntidadRow = { id: string; nombre: string };

type ApiResponse = ResumenGastosEntidad & {
  ok?: boolean;
  error?: string;
  hint?: string;
  fechaDesde: string;
  fechaHasta: string;
  entidadId?: string | null;
  entidadesMap?: Record<string, string>;
};

function inicioMes(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-');
  return `${y}-${m}-01`;
}

function finMes(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const y = d.getFullYear();
  const m = d.getMonth();
  const ult = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(ult).padStart(2, '0')}`;
}

function fmtBs(n: number): string {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(28, 28, 30, 0.7)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px',
  padding: '16px',
};

const colorClasificacion: Record<string, string> = {
  operacional: '#34C759',
  administrativo: '#5856D6',
  servicio: '#FF9500',
  sin_clasificar: '#8E8E93',
};

export default function GastosEntidadPage() {
  const hoy = todayIso();
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [fechaDesde, setFechaDesde] = useState(inicioMes(hoy));
  const [fechaHasta, setFechaHasta] = useState(finMes(hoy));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/almacen/entidades', { cache: 'no-store' });
        const json = (await res.json()) as { entidades?: EntidadRow[] };
        setEntidades(json.entidades ?? []);
      } catch {
        /* opcional */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ desde: fechaDesde, hasta: fechaHasta });
      if (entidadId.trim()) q.set('entidad_id', entidadId.trim());
      const res = await fetch(`/api/contabilidad/gastos-entidad?${q}`, { cache: 'no-store' });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error([json.error, json.hint].filter(Boolean).join(' — '));
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entidadId, fechaDesde, fechaHasta]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalesMap = useMemo(() => {
    const m = new Map<string, TotalesClasificacionGastoEntidad>();
    for (const t of data?.totalesPorClasificacion ?? []) m.set(t.clave, t);
    return m;
  }, [data?.totalesPorClasificacion]);

  const tiles = useMemo(() => {
    return [
      ...CLASIFICACIONES_GASTO_ENTIDAD.map((c) => {
        const t = totalesMap.get(c);
        return {
          clave: c,
          etiqueta: etiquetaClasificacionGastoEntidad(c),
          count: t?.count ?? 0,
          totalBs: t?.totalBs ?? 0,
          totalUsd: t?.totalUsd ?? 0,
        };
      }),
      {
        clave: 'sin_clasificar' as const,
        etiqueta: 'Sin clasificar',
        count: totalesMap.get('sin_clasificar')?.count ?? 0,
        totalBs: totalesMap.get('sin_clasificar')?.totalBs ?? 0,
        totalUsd: totalesMap.get('sin_clasificar')?.totalUsd ?? 0,
      },
    ];
  }, [totalesMap]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: 120 }}>
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
        <Link
          href="/contabilidad"
          style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, textDecoration: 'none' }}
        >
          ← Contabilidad
        </Link>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800, marginTop: 8 }}>
          Gastos de entidad (OpEx)
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 4 }}>
          Fuera de la valuación de administración delegada · operacional, administrativo y servicio
        </p>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            }}
          >
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                ENTIDAD
              </label>
              <select
                value={entidadId}
                onChange={(e) => setEntidadId(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 4,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#0A0A0F',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: 12,
                }}
              >
                <option value="">Todas las entidades</option>
                {entidades.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                DESDE
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 4,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#0A0A0F',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
                HASTA
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: 4,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#0A0A0F',
                  color: '#fff',
                  padding: '8px 10px',
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 16 }}>{error}</p>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {tiles.map((t) => (
            <div
              key={t.clave}
              style={{
                ...cardStyle,
                borderColor: `${colorClasificacion[t.clave] ?? '#888'}44`,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: colorClasificacion[t.clave] ?? '#aaa',
                  textTransform: 'uppercase',
                }}
              >
                {t.etiqueta}
              </p>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                Bs {fmtBs(t.totalBs)}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                USD {fmtUsd(t.totalUsd)} · {t.count} fact.
              </p>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700 }}>
              TOTAL PERIODO · {data?.count ?? 0} facturas
            </p>
            <p style={{ color: '#FF3B30', fontSize: 16, fontWeight: 800 }}>
              Bs {fmtBs(data?.totalBs ?? 0)}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 8 }}>
                USD {fmtUsd(data?.totalUsd ?? 0)}
              </span>
            </p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 className="animate-spin text-zinc-400" size={28} />
            </div>
          ) : (data?.filas.length ?? 0) === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              No hay gastos de entidad en este periodo.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 6px' }}>Fecha</th>
                    <th style={{ padding: '8px 6px' }}>Factura</th>
                    <th style={{ padding: '8px 6px' }}>Proveedor</th>
                    <th style={{ padding: '8px 6px' }}>Entidad</th>
                    <th style={{ padding: '8px 6px' }}>Tipo</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>Bs</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>USD</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.filas ?? []).map((f: FilaGastoEntidad) => {
                    const cl = f.clasificacion_gasto_entidad ?? 'sin_clasificar';
                    return (
                      <tr
                        key={f.id}
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.7)' }}>
                          {f.fecha?.slice(0, 10)}
                        </td>
                        <td style={{ padding: '10px 6px', color: '#fff', fontWeight: 600 }}>
                          {f.invoice_number || '—'}
                        </td>
                        <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.75)' }}>
                          {f.supplier_name}
                        </td>
                        <td style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.55)' }}>
                          {f.entidad_id
                            ? (data?.entidadesMap?.[f.entidad_id] ?? '—')
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 6px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 8,
                              color: colorClasificacion[cl],
                              background: `${colorClasificacion[cl]}18`,
                            }}
                          >
                            {etiquetaClasificacionGastoEntidad(f.clasificacion_gasto_entidad)}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px 6px',
                            textAlign: 'right',
                            color: '#fff',
                            fontWeight: 700,
                          }}
                        >
                          {fmtBs(Number(f.monto_ves ?? f.total_amount) || 0)}
                        </td>
                        <td
                          style={{
                            padding: '10px 6px',
                            textAlign: 'right',
                            color: 'rgba(255,255,255,0.55)',
                          }}
                        >
                          {fmtUsd(Number(f.monto_usd) || 0)}
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
