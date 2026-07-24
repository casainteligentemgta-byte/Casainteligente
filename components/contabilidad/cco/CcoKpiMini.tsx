'use client';

import React from 'react';

export default function CcoKpiMini({
  title,
  value,
  footnote,
  accent,
}: {
  title: string;
  value: string;
  footnote: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        borderTop: `4px solid ${accent}`,
        padding: '12px 14px',
        minHeight: 96,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#64748B',
        }}
      >
        {title}
      </p>
      <p
        style={{
          margin: '8px 0 4px',
          fontSize: 20,
          fontWeight: 800,
          color: '#0F172A',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>{footnote}</p>
    </div>
  );
}
