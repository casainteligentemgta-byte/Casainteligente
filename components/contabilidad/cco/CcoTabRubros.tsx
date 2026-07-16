'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CcoProveedorContratos } from '@/lib/contabilidad/cco/types';
import CcoExportBar from '@/components/contabilidad/cco/CcoExportBar';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CcoTabRubros({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [porProveedor, setPorProveedor] = useState<CcoProveedorContratos[]>([]);
  const [resumen, setResumen] = useState({ contratos: 0, contratado: 0, pagado: 0, saldo: 0 });

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/contratos?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setPorProveedor(json.porProveedor ?? []);
      setResumen(json.resumen ?? { contratos: 0, contratado: 0, pagado: 0, saldo: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setPorProveedor([]);
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
        <h3 style={h3}>Lista de rubros</h3>
        <p style={muted}>Selecciona una obra para ver rubros (contratos) por subcontratista.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ ...h3, margin: 0 }}>Lista de rubros</h3>
          <p style={{ ...muted, margin: '6px 0 0' }}>
            {resumen.contratos} contratos · Contratado {fmtUsd(resumen.contratado)} · Pagado{' '}
            {fmtUsd(resumen.pagado)} · Saldo {fmtUsd(resumen.saldo)}
          </p>
        </div>
        <CcoExportBar proyectoId={proyectoId} />
        <button type="button" onClick={() => void cargar()} style={btn}>
          Actualizar
        </button>
      </div>

      {error ? (
        <div style={{ ...box, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando…
        </div>
      ) : porProveedor.length === 0 ? (
        <div style={box}>
          <p style={muted}>Sin contratos. Impórtalos o créalos en la pestaña Contratos.</p>
        </div>
      ) : (
        porProveedor.map((p) => (
          <div key={p.proveedor} style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>{p.proveedor}</strong>
              <span style={{ fontSize: 13, color: '#64748B' }}>
                {fmtUsd(p.total_contratado)} · saldo {fmtUsd(p.total_saldo)}
              </span>
            </div>
            <div style={{ overflow: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    {['RUBRO', 'COSTO', 'PAGADO', 'SALDO', '%'].map((h) => (
                      <th key={h} style={{ padding: '6px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.contratos.map((c) => (
                    <tr key={c.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={td}>{c.descripcion}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(c.costo_total_usd)}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(c.monto_pagado_usd)}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 700,
                          color: c.saldo_usd > 0 ? '#B91C1C' : '#15803D',
                        }}
                      >
                        {fmtUsd(c.saldo_usd)}
                      </td>
                      <td style={td}>{c.pct_avance}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
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
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13 };
const td: React.CSSProperties = { padding: '7px 6px', verticalAlign: 'top', color: '#334155' };
const btn: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '6px 12px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
