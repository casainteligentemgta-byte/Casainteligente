'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CcoPresupuestoFila } from '@/lib/contabilidad/cco/cargarPresupuestos';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CcoTabPresupuestos({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<CcoPresupuestoFila[]>([]);
  const [totales, setTotales] = useState({ estimado: 0, ejecutado: 0, saldo: 0 });

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/presupuestos?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setFilas(json.filas ?? []);
      setTotales({
        estimado: Number(json.totalEstimado) || 0,
        ejecutado: Number(json.totalEjecutado) || 0,
        saldo: Number(json.totalSaldo) || 0,
      });
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

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Presupuestos</h3>
        <p style={muted}>Selecciona una obra para ver estimado vs ejecutado por capítulo.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {[
          { t: 'Estimado', v: fmtUsd(totales.estimado) },
          { t: 'Ejecutado', v: fmtUsd(totales.ejecutado) },
          { t: 'Saldo presup.', v: fmtUsd(totales.saldo) },
        ].map((k) => (
          <div key={k.t} style={{ ...box, padding: '12px 14px' }}>
            <p style={{ ...muted, margin: 0, fontSize: 11, fontWeight: 800 }}>{k.t}</p>
            <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800 }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h3 style={{ ...h3, margin: 0 }}>Por capítulo</h3>
          <button type="button" onClick={() => void cargar()} style={btn}>
            Actualizar
          </button>
        </div>
        <p style={muted}>Comparación presupuesto V4 vs gastos con el mismo capítulo CCO.</p>
        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {loading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </div>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 480 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {['CAPÍTULO', 'SUB', 'ESTIMADO', 'EJECUTADO', '%', 'SALDO'].map((h) => (
                    <th key={h} style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={td}>
                      <strong>{f.capitulo}</strong>
                      {f.descripcion ? (
                        <div style={{ color: '#94A3B8', fontSize: 11 }}>{f.descripcion.slice(0, 50)}</div>
                      ) : null}
                    </td>
                    <td style={td}>{f.subcapitulo ?? '—'}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(f.estimado_usd)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(f.ejecutado_usd)}</td>
                    <td style={td}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: f.pct_ejecutado > 100 ? '#B91C1C' : f.pct_ejecutado > 80 ? '#B45309' : '#15803D',
                        }}
                      >
                        {f.pct_ejecutado.toFixed(1)}%
                      </span>
                    </td>
                    <td
                      style={{
                        ...td,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 700,
                        color: f.saldo_usd < 0 ? '#B91C1C' : '#0F172A',
                      }}
                    >
                      {fmtUsd(f.saldo_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filas.length === 0 ? <p style={muted}>Sin presupuestos para esta obra.</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
};
const h3: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '8px 0 12px' };
const td: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'top', color: '#334155' };
const btn: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
