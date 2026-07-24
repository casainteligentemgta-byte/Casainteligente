'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { CcoDeudaFila, CcoDeudaGasto } from '@/lib/contabilidad/cco/cargarDeudas';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtFecha(iso: string | null): string {
  const s = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  return s;
}

export default function CcoTabDeudas({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<CcoDeudaGasto[]>([]);
  const [deudasContrato, setDeudasContrato] = useState<CcoDeudaFila[]>([]);
  const [resumen, setResumen] = useState({
    totalPendiente: 0,
    countPendiente: 0,
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
      setPendientes(json.pendientes ?? []);
      setDeudasContrato(json.deudas ?? []);
      setResumen({
        totalPendiente: Number(json.totalPendiente) || 0,
        countPendiente: Number(json.countPendiente) || 0,
        totalDeuda: Number(json.totalDeuda) || 0,
        contratosConDeuda: Number(json.contratosConDeuda) || 0,
        huerfanosMonto: Number(json.huerfanosMonto) || 0,
        huerfanosCount: Number(json.huerfanosCount) || 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setPendientes([]);
      setDeudasContrato([]);
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
        <h3 style={h3}>Cuentas por Pagar (Gastos Pendientes)</h3>
        <p style={muted}>Selecciona una obra para ver las deudas pendientes.</p>
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
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h3 style={{ ...h3, margin: 0 }}>Cuentas por Pagar (Gastos Pendientes)</h3>
            <p style={{ ...muted, margin: '6px 0 0' }}>
              Gastos con estado <strong>PENDIENTE</strong> o <strong>PARCIAL</strong> en el libro
              CCO.
            </p>
          </div>
          <button type="button" onClick={() => void cargar()} style={btn} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>

        {error ? <p style={{ color: '#B91C1C', fontSize: 13 }}>{error}</p> : null}

        {loading && pendientes.length === 0 ? (
          <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center', marginTop: 12 }}>
            <Loader2 className="animate-spin" size={16} /> Cargando deudas…
          </div>
        ) : pendientes.length === 0 ? (
          <div
            style={{
              marginTop: 16,
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#92400E',
            }}
          >
            <AlertTriangle size={22} color="#D97706" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
              ¡No hay deudas pendientes registradas!
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
                marginTop: 14,
                marginBottom: 14,
              }}
            >
              <div style={kpiCard}>
                <p style={kpiLabel}>TOTAL POR PAGAR</p>
                <p style={{ ...kpiValue, color: '#B91C1C' }}>{fmtUsd(resumen.totalPendiente)}</p>
              </div>
              <div style={kpiCard}>
                <p style={kpiLabel}>GASTOS PENDIENTES</p>
                <p style={kpiValue}>{resumen.countPendiente}</p>
              </div>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 520 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#334155', color: '#fff', textAlign: 'left' }}>
                    {['ID', 'Fecha', 'Proveedor', 'Descripción', 'Tipo', 'Estado', 'Base USD', 'Pagado', 'Saldo'].map(
                      (h) => (
                        <th key={h} style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((d, i) => (
                    <tr
                      key={d.id}
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        background: i % 2 ? '#F8FAFC' : '#fff',
                      }}
                    >
                      <td style={td}>{d.display_id}</td>
                      <td style={td}>{fmtFecha(d.fecha)}</td>
                      <td style={td}>{d.proveedor}</td>
                      <td style={{ ...td, maxWidth: 260, whiteSpace: 'normal' }}>{d.descripcion}</td>
                      <td style={td}>{d.tipo}</td>
                      <td style={td}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: d.estado === 'PARCIAL' ? '#FEF3C7' : '#FEE2E2',
                            color: d.estado === 'PARCIAL' ? '#92400E' : '#991B1B',
                            fontWeight: 800,
                            fontSize: 11,
                          }}
                        >
                          {d.estado}
                        </span>
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(d.monto_base_usd)}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(d.monto_pagado_usd)}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 800,
                          color: '#B91C1C',
                        }}
                      >
                        {fmtUsd(d.saldo_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Complemento: saldos de contratos (si existen) */}
      {(deudasContrato.length > 0 || resumen.huerfanosCount > 0) && (
        <div style={box}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>
            Saldos de contratos (complemento)
          </h4>
          <p style={{ ...muted, margin: '0 0 12px' }}>
            {resumen.contratosConDeuda} contrato(s) con saldo · {fmtUsd(resumen.totalDeuda)}
            {resumen.huerfanosCount > 0
              ? ` · ${resumen.huerfanosCount} pago(s) sin vínculo (${fmtUsd(resumen.huerfanosMonto)})`
              : ''}
          </p>
          {deudasContrato.length > 0 ? (
            <div style={{ overflow: 'auto', maxHeight: 320 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                    {['PROVEEDOR', 'CONTRATO', 'COSTO', 'PAGADO', 'SALDO'].map((h) => (
                      <th key={h} style={{ padding: '8px 6px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deudasContrato.map((d) => (
                    <tr key={d.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={td}>{d.proveedor}</td>
                      <td style={td}>{d.descripcion}</td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(d.costo_total_usd)}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUsd(d.monto_pagado_usd)}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 800,
                          color: '#B91C1C',
                        }}
                      >
                        {fmtUsd(d.saldo_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
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
const h3: React.CSSProperties = { fontSize: 18, fontWeight: 800, color: '#0F172A' };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13 };
const td: React.CSSProperties = {
  padding: '8px 6px',
  verticalAlign: 'top',
  color: '#334155',
  whiteSpace: 'nowrap',
};
const btn: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  background: '#fff',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  color: '#0F172A',
};
const kpiCard: React.CSSProperties = {
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  padding: '12px 14px',
};
const kpiLabel: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 800,
  color: '#64748B',
  letterSpacing: '0.04em',
};
const kpiValue: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 18,
  fontWeight: 800,
  color: '#0F172A',
  fontVariantNumeric: 'tabular-nums',
};
