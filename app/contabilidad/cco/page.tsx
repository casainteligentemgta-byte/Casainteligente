'use client';

import { useEffect, useState } from 'react';
import CcoDashboardClient from '@/components/contabilidad/cco/CcoDashboardClient';

/**
 * Solo monta el dashboard en el cliente (tras hidratar el shell).
 * Evita mismatch SSR/cliente por Recharts, styled-jsx y formato numérico.
 */
export default function ContabilidadCcoPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        style={{
          minHeight: '100vh',
          background: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748B',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Cargando Control Contable de Obra…
      </div>
    );
  }

  return <CcoDashboardClient />;
}
