'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { INFORMES_PACK1 } from '@/lib/informes/catalogo';

export default function InformesHubPage() {
  const glass: CSSProperties = {
    background: 'rgba(28, 28, 30, 0.72)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '20px', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
          Contabilidad · Almacén · Obra
        </p>
        <h1 style={{ margin: '6px 0 0', fontSize: '26px', fontWeight: 800, color: 'var(--label-primary)' }}>
          Centro de informes
        </h1>
        <p style={{ margin: '8px 0 20px', fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.45, maxWidth: '540px' }}>
          Pack 1: compras del período, cadena de procura, stock valorizado y rentabilidad simple de obra.
          Filtros por fecha u obra; export CSV en cada informe.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
          {INFORMES_PACK1.map((inf) => (
            <Link
              key={inf.id}
              href={inf.href}
              style={{ ...glass, padding: '18px 16px', textDecoration: 'none', display: 'block' }}
            >
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>
                {inf.titulo}
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>
                {inf.descripcion}
              </p>
              <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                {inf.fuentes.join(' · ')}
              </p>
            </Link>
          ))}
        </div>

        <div style={{ ...glass, padding: '14px 16px', marginTop: '16px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--label-secondary)', lineHeight: 1.45 }}>
            También disponible: cuadro de compras, CCO/rendición, inventario/movimientos/trazabilidad y auditoría de descalce de procuras.
            Próximos packs: proveedores, recepción FRM, despacho y nómina vs presupuesto.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
            <Link href="/contabilidad/compras" style={{ fontSize: '12px', fontWeight: 600, color: '#5AC8FA', textDecoration: 'none' }}>
              Cuadro compras →
            </Link>
            <Link href="/almacen" style={{ fontSize: '12px', fontWeight: 600, color: '#5AC8FA', textDecoration: 'none' }}>
              Almacén →
            </Link>
            <Link href="/contabilidad/cco" style={{ fontSize: '12px', fontWeight: 600, color: '#5AC8FA', textDecoration: 'none' }}>
              CCO →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
