'use client';

import React, { useMemo } from 'react';
import type {
  CcoCapituloJerarquia,
  CcoGastoMensual,
  CcoProveedorFila,
  CcoTipoPie,
  CcoTreemapNodo,
} from '@/lib/contabilidad/cargarCcoDashboard';

type Props = {
  gastosMensual: CcoGastoMensual[];
  jerarquiaCapitulos: CcoCapituloJerarquia[];
  topProveedores: CcoProveedorFila[];
  tiposPie: CcoTipoPie[];
  treemapNodos: CcoTreemapNodo[];
};

type TablaFila = { label: string; costo: number };

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function descargarCsv(nombreArchivo: string, headers: string[], rows: string[][]) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

function DataTableCard({
  title,
  colLabel,
  rows,
  showTotal = true,
  csvName,
}: {
  title: string;
  colLabel: string;
  rows: TablaFila[];
  showTotal?: boolean;
  csvName: string;
}) {
  const total = rows.reduce((s, r) => s + r.costo, 0);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '16px 18px 12px',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{title}</h3>
        <button
          type="button"
          onClick={() =>
            descargarCsv(
              csvName,
              [colLabel, 'COSTO TOTAL'],
              [
                ...rows.map((r) => [r.label, r.costo.toFixed(2)]),
                ...(showTotal ? [['TOTAL', total.toFixed(2)]] : []),
              ],
            )
          }
          style={{
            border: '1px solid #CBD5E1',
            background: '#F8FAFC',
            color: '#334155',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          CSV
        </button>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 360 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  borderBottom: '1px solid #E2E8F0',
                }}
              >
                {colLabel}
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '8px 10px',
                  color: '#64748B',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  borderBottom: '1px solid #E2E8F0',
                }}
              >
                COSTO TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  style={{ padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}
                >
                  Sin datos en el filtro actual
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.label}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                  <td
                    style={{
                      padding: '8px 10px',
                      color: '#0F172A',
                      fontWeight: 600,
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    {r.label}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      textAlign: 'right',
                      color: '#0F172A',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    {fmtUsd(r.costo)}
                  </td>
                </tr>
              ))
            )}
            {showTotal && rows.length > 0 ? (
              <tr style={{ background: '#EEF2FF' }}>
                <td
                  style={{
                    padding: '10px',
                    fontWeight: 800,
                    color: '#1E3A8A',
                    borderTop: '1px solid #CBD5E1',
                  }}
                >
                  TOTAL
                </td>
                <td
                  style={{
                    padding: '10px',
                    textAlign: 'right',
                    fontWeight: 800,
                    color: '#1E3A8A',
                    fontVariantNumeric: 'tabular-nums',
                    borderTop: '1px solid #CBD5E1',
                  }}
                >
                  {fmtUsd(total)}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalleCompletoTable({ nodos }: { nodos: CcoTreemapNodo[] }) {
  const filas = useMemo(
    () =>
      [...nodos]
        .filter((n) => n.costo > 0)
        .sort((a, b) => b.costo - a.costo),
    [nodos],
  );
  const total = filas.reduce((s, r) => s + r.costo, 0);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '16px 18px 12px',
        marginTop: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
            Detalle Completo: Capítulo, Sub-Capítulo y Tipo de Gasto
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
            Misma jerarquía que los gráficos (capítulo/obra → tipo de gasto inferido desde proveedor)
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            descargarCsv(
              'cco-detalle-capitulo-tipo.csv',
              ['CAPITULO', 'SUBCAPITULO', 'TIPO', 'COSTO TOTAL'],
              [
                ...filas.map((r) => [r.cap, r.sub, r.sub, r.costo.toFixed(2)]),
                ['TOTAL', '', '', total.toFixed(2)],
              ],
            )
          }
          style={{
            border: '1px solid #CBD5E1',
            background: '#F8FAFC',
            color: '#334155',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          CSV
        </button>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 480 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              {['CAPITULO', 'SUBCAPITULO', 'TIPO', 'COSTO TOTAL'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === 'COSTO TOTAL' ? 'right' : 'left',
                    padding: '8px 10px',
                    color: '#64748B',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    position: 'sticky',
                    top: 0,
                    background: '#F1F5F9',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}
                >
                  Sin datos en el filtro actual
                </td>
              </tr>
            ) : (
              filas.map((r, i) => (
                <tr key={`${r.cap}-${r.sub}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0F172A', borderBottom: '1px solid #F1F5F9' }}>
                    {r.cap}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#334155', borderBottom: '1px solid #F1F5F9' }}>
                    {r.sub}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#334155', borderBottom: '1px solid #F1F5F9' }}>
                    {r.sub}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      textAlign: 'right',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: '#0F172A',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                  >
                    {fmtUsd(r.costo)}
                  </td>
                </tr>
              ))
            )}
            {filas.length > 0 ? (
              <tr style={{ background: '#EEF2FF' }}>
                <td colSpan={3} style={{ padding: '10px', fontWeight: 800, color: '#1E3A8A' }}>
                  TOTAL
                </td>
                <td
                  style={{
                    padding: '10px',
                    textAlign: 'right',
                    fontWeight: 800,
                    color: '#1E3A8A',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtUsd(total)}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CcoDatosGraficos({
  gastosMensual,
  jerarquiaCapitulos,
  topProveedores,
  tiposPie,
  treemapNodos,
}: Props) {
  const evolucion = useMemo(
    () => gastosMensual.map((g) => ({ label: g.periodo, costo: g.costo })),
    [gastosMensual],
  );

  const porCapitulo = useMemo(
    () =>
      [...jerarquiaCapitulos]
        .map((c) => ({ label: c.nombre, costo: c.total }))
        .sort((a, b) => b.costo - a.costo),
    [jerarquiaCapitulos],
  );

  const proveedores = useMemo(
    () =>
      [...topProveedores]
        .map((p) => ({ label: p.proveedor, costo: p.costo }))
        .sort((a, b) => b.costo - a.costo),
    [topProveedores],
  );

  const porTipo = useMemo(
    () =>
      [...tiposPie]
        .map((t) => ({ label: t.name, costo: t.value }))
        .sort((a, b) => b.costo - a.costo),
    [tiposPie],
  );

  return (
    <div>
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          padding: '20px 22px 8px',
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
          Datos Numéricos de los Gráficos
        </h2>
        <p style={{ margin: '6px 0 18px', fontSize: 14, color: '#64748B', maxWidth: 820 }}>
          Aquí puedes ver el detalle numérico exacto de cada gráfico mostrado en la pestaña anterior
          para un análisis profundo o para exportar los datos a CSV.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
            marginBottom: 10,
          }}
        >
          <DataTableCard
            title="Evolución Mensual"
            colLabel="PERIODO"
            rows={evolucion}
            csvName="cco-evolucion-mensual.csv"
          />
          <DataTableCard
            title="Distribución por Capítulo"
            colLabel="CAPITULO"
            rows={porCapitulo}
            csvName="cco-distribucion-capitulo.csv"
          />
          <DataTableCard
            title="Top 10 Proveedores"
            colLabel="PROVEEDOR"
            rows={proveedores}
            csvName="cco-top-proveedores.csv"
          />
          <DataTableCard
            title="Distribución por Tipo de Gasto"
            colLabel="TIPO"
            rows={porTipo}
            csvName="cco-distribucion-tipo.csv"
          />
        </div>
      </div>

      <DetalleCompletoTable nodos={treemapNodos} />
    </div>
  );
}
