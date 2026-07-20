'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';
import CargarFacturaCuadroModal from '@/components/contabilidad/CargarFacturaCuadroModal';
import type { ProyectoCatalogo } from '@/lib/proyectos/proyectosUnificados';

type Props = {
  proyectos: ProyectoCatalogo[];
  proyectoIdInicial?: string | null;
  onImportado?: (proyectoId: string) => void;
};

export default function CcoImportarCsvPanel({
  proyectos,
  proyectoIdInicial,
  onImportado,
}: Props) {
  const [open, setOpen] = useState(false);

  const obraHint = useMemo(() => {
    if (!proyectoIdInicial) return 'Seleccione la obra en el diálogo de importación.';
    const p = proyectos.find((x) => x.id === proyectoIdInicial);
    return p ? `Obra sugerida: ${p.nombre}` : 'Seleccione la obra en el diálogo.';
  }, [proyectoIdInicial, proyectos]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '24px 26px',
        maxWidth: 720,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
        Importar CSV de compras
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
        Carga histórica al libro contable <strong>sin afectar stock</strong>. El sistema usa anti-duplicados
        (llave natural + hash) para que <strong>no se vuelva a cargar data vieja</strong>: filas iguales en el
        CSV se omiten y las ya existentes en BD se actualizan en lugar de duplicarse.
      </p>

      <ul
        style={{
          margin: '18px 0',
          paddingLeft: 18,
          color: '#334155',
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <li>
          <strong>Nivel 1:</strong> dedupe dentro del propio CSV (fecha + factura + proveedor + monto + obra).
        </li>
        <li>
          <strong>Nivel 2:</strong> índice único <code>dedup_hash</code> en Supabase (migración 268).
        </li>
        <li>
          <strong>Maestro V4:</strong> si el CSV trae columna <code>CLASE</code>, solo se importan filas{' '}
          <code>GASTO</code> (ingresos/contratos/presupuestos no entran como compras). Se conservan
          honorarios, capítulo, estado y brecha para que el dashboard cuadre con el programa madre.
        </li>
      </ul>

      <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>{obraHint}</p>

      <button
        type="button"
        disabled={proyectos.length === 0}
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          background: proyectos.length === 0 ? '#94A3B8' : '#2563EB',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '12px 18px',
          fontWeight: 800,
          fontSize: 14,
          cursor: proyectos.length === 0 ? 'wait' : 'pointer',
        }}
      >
        <FileSpreadsheet size={18} />
        {proyectos.length === 0 ? 'Cargando obras…' : 'Abrir importador CSV / tabla'}
      </button>

      <div
        style={{
          marginTop: 20,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          padding: '12px 14px',
          borderRadius: 10,
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          fontSize: 12,
          color: '#065F46',
        }}
      >
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Si ya importaste el mismo CSV, no se crearán facturas nuevas duplicadas. Verás el resumen de
          nuevas vs actualizadas al terminar.
        </span>
      </div>

      <CargarFacturaCuadroModal
        open={open}
        onClose={() => setOpen(false)}
        proyectos={proyectos}
        proyectoIdInicial={proyectoIdInicial}
        onGuardado={(pid) => {
          setOpen(false);
          onImportado?.(pid);
        }}
      />
    </div>
  );
}
