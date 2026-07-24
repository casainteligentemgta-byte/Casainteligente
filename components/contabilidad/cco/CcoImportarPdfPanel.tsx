'use client';

import { useMemo, useState } from 'react';
import { FileUp, ShieldCheck } from 'lucide-react';
import CargarFacturaCuadroModal from '@/components/contabilidad/CargarFacturaCuadroModal';
import type { ProyectoCatalogo } from '@/lib/proyectos/proyectosUnificados';

type Props = {
  proyectos: ProyectoCatalogo[];
  proyectoIdInicial?: string | null;
  onImportado?: (proyectoId: string) => void;
};

/**
 * Import PDF/imagen de tabla de compras → contabilidad (sin stock).
 * Reutiliza extract-tabla (Gemini) + anti-duplicados del cuadro CI.
 */
export default function CcoImportarPdfPanel({
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
        Importar PDF / imagen
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748B', lineHeight: 1.5 }}>
        Extrae la tabla de un PDF o captura (OCR/IA) y la carga al libro contable de la obra{' '}
        <strong>sin afectar stock</strong>. Usa el mismo anti-duplicados que el import CSV
        (<code>dedup_hash</code>).
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
          <strong>PDF / imagen:</strong> máx. ~4 MB. Tablas grandes → mejor exportar a CSV.
        </li>
        <li>
          En el diálogo pulse <strong>«PDF / imagen»</strong> (no el botón CSV).
        </li>
        <li>
          Revise filas, marque las facturas y guarde. Se imputan a la obra elegida.
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
          background: proyectos.length === 0 ? '#94A3B8' : '#7C3AED',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '12px 18px',
          fontWeight: 800,
          fontSize: 14,
          cursor: proyectos.length === 0 ? 'wait' : 'pointer',
        }}
      >
        <FileUp size={18} />
        {proyectos.length === 0 ? 'Cargando obras…' : 'Abrir importador PDF'}
      </button>

      <div
        style={{
          marginTop: 20,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          padding: '12px 14px',
          borderRadius: 10,
          background: '#F5F3FF',
          border: '1px solid #DDD6FE',
          fontSize: 12,
          color: '#5B21B6',
        }}
      >
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Equivalente a «Importar PDF» de CCO V4, pero persistiendo en Supabase (compras obra) en lugar
          de SQLite local. Si el OCR falla, use menú <strong>Importar CSV</strong>.
        </span>
      </div>

      <CargarFacturaCuadroModal
        open={open}
        onClose={() => setOpen(false)}
        proyectos={proyectos}
        proyectoIdInicial={proyectoIdInicial}
        onGuardado={(pid) => {
          setOpen(false);
          if (pid) {
            void fetch('/api/contabilidad/cco/auditoria-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                proyecto_id: pid,
                accion: 'IMPORTACION PDF',
                detalle: 'Carga desde CCO · extract-tabla / cuadro compras',
              }),
            }).catch(() => undefined);
          }
          onImportado?.(pid);
        }}
      />
    </div>
  );
}
