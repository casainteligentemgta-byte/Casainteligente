'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

const glass: React.CSSProperties = {
  background: 'rgba(28, 28, 30, 0.72)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '20px',
};

export function InformesShell({
  titulo,
  subtitulo,
  children,
  actions,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '20px', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div style={{ minWidth: 0 }}>
            <Link
              href="/informes"
              style={{ fontSize: '12px', fontWeight: 600, color: '#5AC8FA', textDecoration: 'none' }}
            >
              ← Informes
            </Link>
            <h1 style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 800, color: 'var(--label-primary)' }}>
              {titulo}
            </h1>
            {subtitulo ? (
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>
                {subtitulo}
              </p>
            ) : null}
          </div>
          {actions ? <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function InformesKpi({
  label,
  value,
  color = '#34C759',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ ...glass, padding: '14px 16px', minWidth: '120px', flex: '1 1 120px' }}>
      <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

export function InformesTabla({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
}) {
  return (
    <div style={{ ...glass, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ padding: '24px 14px', color: 'rgba(255,255,255,0.4)' }}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: '10px 14px',
                      color: 'var(--label-primary)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      verticalAlign: 'top',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { glass as informesGlass };
