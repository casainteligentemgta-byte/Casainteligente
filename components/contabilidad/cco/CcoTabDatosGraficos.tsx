'use client';

import React from 'react';
import type { CcoDashboard } from '@/lib/contabilidad/cargarCcoDashboard';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = {
  data: CcoDashboard;
  modo: 'acumulado' | 'periodo';
};

/**
 * Tablas numéricas detrás de los gráficos del panel CCO (flujo, gastos, proveedores, capítulos).
 */
export default function CcoTabDatosGraficos({ data, modo }: Props) {
  const flujo = modo === 'acumulado' ? data.flujoAcumulado : data.flujoPeriodo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={box}>
        <h3 style={h3}>Datos gráficos</h3>
        <p style={muted}>
          Series usadas en GRÁFICOS · modo{' '}
          <strong>{modo === 'acumulado' ? 'acumulado' : 'por período'}</strong>
          {data.proyectoNombre ? ` · ${data.proyectoNombre}` : ''} · {data.totalRegistros} registros
        </p>
      </div>

      <Tabla
        title={`Flujo de caja (${modo === 'acumulado' ? 'acumulado' : 'período'})`}
        empty={flujo.length === 0}
        headers={['PERÍODO', 'INGRESOS', 'EGRESOS', 'SALDO']}
        rows={flujo.map((r) => [
          r.periodo,
          fmtUsd(r.ingresos),
          fmtUsd(r.egresos),
          fmtUsd(r.saldo),
        ])}
      />

      <Tabla
        title="Gastos por mes (costo compras USD)"
        empty={data.gastosMensual.length === 0}
        headers={['PERÍODO', 'COSTO USD']}
        rows={data.gastosMensual.map((r) => [r.periodo, fmtUsd(r.costo)])}
      />

      <Tabla
        title="Top proveedores"
        empty={data.topProveedores.length === 0}
        headers={['PROVEEDOR', 'COSTO USD']}
        rows={[...data.topProveedores]
          .slice()
          .reverse()
          .map((r) => [r.proveedor, fmtUsd(r.costo)])}
      />

      <Tabla
        title="Capítulos × tipo de gasto (USD)"
        empty={data.capitulos.length === 0}
        headers={[
          'CAPÍTULO',
          'ADMIN',
          'MAT.',
          'CONTR.',
          'EQUIP.',
          'INSUM.',
          'M.O.',
          'TRANSP.',
          'PERM.',
          'PROY.',
        ]}
        rows={data.capitulos.map((c) => [
          c.cap,
          fmtUsd(c.admin),
          fmtUsd(c.materiales),
          fmtUsd(c.contratista),
          fmtUsd(c.equipos),
          fmtUsd(c.insumos),
          fmtUsd(c.mano),
          fmtUsd(c.transporte),
          fmtUsd(c.permiso),
          fmtUsd(c.proyecto),
        ])}
      />

      {data.tiposPie.length > 0 ? (
        <Tabla
          title="Distribución por tipo (pie)"
          empty={false}
          headers={['TIPO', 'USD']}
          rows={data.tiposPie.map((t) => [t.name, fmtUsd(t.value)])}
        />
      ) : null}
    </div>
  );
}

function Tabla({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  empty: boolean;
}) {
  return (
    <div style={box}>
      <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>{title}</h4>
      {empty ? (
        <p style={muted}>Sin datos en el filtro actual.</p>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 360 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                {headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '7px 6px',
                      position: 'sticky',
                      top: 0,
                      background: '#F1F5F9',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${title}-${i}`} style={{ borderTop: '1px solid #E2E8F0' }}>
                  {row.map((cell, j) => (
                    <td
                      key={`${i}-${j}`}
                      style={{
                        padding: '7px 6px',
                        color: '#334155',
                        fontVariantNumeric: j > 0 ? 'tabular-nums' : undefined,
                        whiteSpace: j === 0 ? 'normal' : 'nowrap',
                      }}
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

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
};
const h3: React.CSSProperties = { margin: '0 0 6px', fontSize: 18, fontWeight: 800 };
const muted: React.CSSProperties = { margin: 0, color: '#64748B', fontSize: 13 };
