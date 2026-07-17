'use client';

import React, { useCallback, useEffect, useState } from 'react';
import CcoFormRegistroModal from '@/components/contabilidad/cco/CcoFormRegistroModal';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

function fmtMonto(n: number, moneda?: string): string {
  const m = (moneda ?? 'USD').toUpperCase().startsWith('VE') ? 'VES' : 'USD';
  return `${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${m}`;
}

function MiniTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div style={{ marginTop: 14, minWidth: 196 }}>
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#94A3B8',
        }}
      >
        {title}
      </p>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>Sin datos</p>
      ) : (
        <div
          style={{
            background: '#1E293B',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid #334155',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '6px 6px',
                      color: '#94A3B8',
                      fontWeight: 800,
                      borderBottom: '1px solid #334155',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: i ? '1px solid #334155' : undefined }}>
                  {r.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '6px 6px',
                        color: '#E2E8F0',
                        maxWidth: j === 0 ? 88 : undefined,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: j > 0 ? 'tabular-nums' : undefined,
                      }}
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CcoSidebarResumen({
  proyectoId,
  onChanged,
}: {
  proyectoId: string;
  onChanged?: () => void;
}) {
  const [egresos, setEgresos] = useState<CcoLibroFila[]>([]);
  const [ingresos, setIngresos] = useState<CcoLibroFila[]>([]);
  const [egresosLabel, setEgresosLabel] = useState('Próximos 3 Egresos');

  const cargar = useCallback(async () => {
    if (!proyectoId) {
      setEgresos([]);
      setIngresos([]);
      return;
    }
    try {
      const [gRes, iRes] = await Promise.all([
        fetch(
          `/api/contabilidad/cco/libro?proyecto=${encodeURIComponent(proyectoId)}&clase=GASTO&limit=80`,
          { cache: 'no-store' },
        ),
        fetch(
          `/api/contabilidad/cco/libro?proyecto=${encodeURIComponent(proyectoId)}&clase=INGRESO&limit=40`,
          { cache: 'no-store' },
        ),
      ]);
      const gJson = await gRes.json();
      const iJson = await iRes.json();
      const gastos = (gJson.filas ?? []) as CcoLibroFila[];
      const ings = (iJson.filas ?? []) as CcoLibroFila[];

      const pendientes = gastos
        .filter((f) => String(f.estado).toUpperCase() === 'PENDIENTE')
        .sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')));
      if (pendientes.length > 0) {
        setEgresosLabel('Próximos 3 Egresos');
        setEgresos(pendientes.slice(0, 3));
      } else {
        setEgresosLabel('Últimos 3 Egresos');
        setEgresos(
          [...gastos]
            .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')))
            .slice(0, 3),
        );
      }
      setIngresos(
        [...ings]
          .sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')))
          .slice(0, 3),
      );
    } catch {
      setEgresos([]);
      setIngresos([]);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1E293B' }}>
      {proyectoId ? (
        <CcoFormRegistroModal
          proyectoId={proyectoId}
          defaultClase="INGRESO"
          triggerLabel="+ Ingreso"
          triggerVariant="ingreso"
          onSaved={() => {
            void cargar();
            onChanged?.();
          }}
        />
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>
          Selecciona una obra para registrar ingresos.
        </p>
      )}

      <MiniTable
        title={`${egresosLabel} (Gastos)`}
        headers={['PROVEEDOR', 'Monto Orig.', 'MO.']}
        rows={egresos.map((f) => [
          f.proveedor,
          fmtMonto(f.monto_orig || f.monto_base_usd, f.moneda),
          (f.moneda || 'USD').slice(0, 3),
        ])}
      />

      <MiniTable
        title="Últimos 3 Ingresos"
        headers={['FECHA', 'PROVEEDOR', 'Monto', 'Tasa']}
        rows={ingresos.map((f) => [
          f.fecha ?? '—',
          f.proveedor,
          fmtMonto(f.monto_orig || f.monto_base_usd, f.moneda),
          f.tasa > 0 ? f.tasa.toFixed(1) : '—',
        ])}
      />
    </div>
  );
}
