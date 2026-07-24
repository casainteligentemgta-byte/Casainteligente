import type React from 'react';

export function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtFecha(iso: string): string {
  const s = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export const panelCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 20,
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
};

export const kpiGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
  marginBottom: 18,
};

export const tableWrap: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
};

export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#64748B',
  background: '#F8FAFC',
  borderBottom: '1px solid #E2E8F0',
  whiteSpace: 'nowrap',
};

export const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#334155',
  borderBottom: '1px solid #F1F5F9',
  verticalAlign: 'top',
};
