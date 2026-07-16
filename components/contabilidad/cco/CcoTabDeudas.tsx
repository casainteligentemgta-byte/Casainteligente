'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CcoDeudaFila } from '@/lib/contabilidad/cco/cargarDeudas';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CcoTabDeudas({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deudas, setDeudas] = useState<CcoDeudaFila[]>([]);
  const [resumen, setResumen] = useState({
    totalDeuda: 0,
    contratosConDeuda: 0,
    huerfanosMonto: 0,
    huerfanosCount: 0,
  });

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/deudas?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setDeudas(json.deudas ?? []);
      setResumen({
        totalDeuda: Number(json.totalDeuda) || 0,
        contratosConDeuda: Number(json.contratosConDeuda) || 0,
        huerfanosMonto: Number(json.huerfanosMonto) || 0,
        huerfanosCount: Number(json.huerfanosCount) || 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setDeudas([]);
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
        <h3 style={h3}>Deudas</h3>
        <p style={muted}>Selecciona una obra para ver saldos pendientes de contratos.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          { t: 'Deuda contratos', v: fmtUsd(resumen.totalDeuda) },
          { t: 'Contratos con saldo', v: String(resumen.contratosConDeuda) },
          { t: 'Pagos sin vínculo', v: `${resumen.huerfanosCount} · ${fmtUsd(resumen.huerfanosMonto)}` },
        ].map((k) => (
          <div key={k.t} style={{ ...box, padding: '12px 14px' }}>
            <p style={{ ...muted, margin: 0, fontSize: 11, fontWeight: 800 }}>{k.t}</p>
            <p style={{ margin: '6px 0 0', fontSize: 16, fontWeight: 800 }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <h3 style={{ ...h3, margin: 0 }}>Saldo por contrato</h3>
          <button type="button" onClick={() => void cargar()} style={btn}>
            Actualizar
          </button>
        </div>
        <p style={muted}>
          Deuda = costo total del contrato − pagos vinculados. Si hay muchos huérfanos, usa «Auto-vincular» en
          Contratos.
        </p>
        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}
        {loading ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </div>
        ) : deudas.length === 0 ? (
          <p style={muted}>No hay contratos con saldo pendiente (o aún no hay vínculos de pago).</p>
        ) : (
          <div style={{ overflow: 'auto', maxHeight: 480 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {['PROVEEDOR', 'CONTRATO', 'COSTO', 'PAGADO', 'SALDO', 'AVANCE'].map((h) => (
                    <th key={h} style={{ padding: '8px 6px', position: 'sticky', top: 0, background: '#F1F5F9' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deudas.map((d) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                    <td style={td}>{d.proveedor}</td>
                    <td style={td}>{d.descripcion}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(d.costo_total_usd)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(d.monto_pagado_usd)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#B91C1C' }}>
                      {fmtUsd(d.saldo_usd)}
                    </td>
                    <td style={td}>
                      <div style={{ height: 6, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                        <div style={{ width: `${d.pct_avance}%`, height: '100%', background: '#2563EB' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#64748B' }}>{d.pct_avance}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
