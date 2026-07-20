'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Cloud, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import CargarFacturaCuadroModal from '@/components/contabilidad/CargarFacturaCuadroModal';
import {
  esCsvMaestroCco,
  parseCsvMaestroV4,
} from '@/lib/contabilidad/cco/parseCsvMaestroV4';
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
  const [proyectoId, setProyectoId] = useState(proyectoIdInicial ?? '');

  useEffect(() => {
    if (proyectoIdInicial) setProyectoId(proyectoIdInicial);
  }, [proyectoIdInicial]);

  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openCompras, setOpenCompras] = useState(false);

  const obraNombre = useMemo(() => {
    const p = proyectos.find((x) => x.id === proyectoId);
    return p?.nombre ?? null;
  }, [proyectoId, proyectos]);

  async function onFile(file: File | null) {
    if (!file) return;
    if (!proyectoId) {
      setError('Seleccione la obra destino (la misma del programa del suegro).');
      return;
    }
    setBusy(true);
    setError(null);
    setLog(null);
    setPreview(null);
    try {
      const text = await file.text();
      if (!esCsvMaestroCco(text)) {
        throw new Error(
          'Este archivo no parece el CSV maestro (falta columna CLASE). ' +
            'Use el export de OneDrive del programa CCO, o el botón «Solo compras» más abajo.',
        );
      }
      const parsed = parseCsvMaestroV4(text, {
        proyecto_id: proyectoId,
        obra_alias: obraNombre ? `${obraNombre} / CSV OneDrive` : 'CSV OneDrive / CCO V4',
      });
      const clasesTxt = Object.entries(parsed.resumen.porClase)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
      setPreview(
        `${parsed.resumen.total} filas (${clasesTxt}) · estructura ${parsed.resumen.estructura}` +
          (parsed.devaluacion_pct
            ? ` · devaluación media ${Number(parsed.devaluacion_pct).toFixed(2)}%`
            : ''),
      );

      const { resumen: _r, ...payload } = parsed;
      const res = await fetch('/api/contabilidad/cco/import-v4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          proyecto_id: proyectoId,
          auto_vincular: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(
          [json.error, json.hint].filter(Boolean).join(' · ') || 'Error de importación',
        );
      }
      setLog(
        [
          `Listo: misma ruta que el programa CCO (gastos, ingresos, contratos, presupuestos).`,
          `Gastos: +${json.gastos?.created ?? 0} creados / ${json.gastos?.updated ?? 0} actualizados`,
          `Contratos: ${json.contratos}`,
          `Ingresos: ${json.ingresos}`,
          `Presupuestos: ${json.presupuestos}`,
          `Estructura: ${json.estructura}`,
          `Vinculados auto: ${json.vinculados}`,
          json.pre_snapshot_id
            ? `Snapshot previo: ${String(json.pre_snapshot_id).slice(0, 8)}…`
            : null,
          json.errores?.length ? `Avisos: ${json.errores.length}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
      onImportado?.(proyectoId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar CSV');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        padding: '24px 26px',
        maxWidth: 760,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
        Importar CSV (OneDrive / programa CCO)
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748B', lineHeight: 1.55 }}>
        El programa de contabilidad genera el CSV y lo sube a OneDrive. Descárguelo aquí y se
        cargará el <strong>maestro completo</strong> (GASTO, INGRESO, CONTRATO, PRESUPUESTO) para
        que el dashboard quede alineado con la otra aplicación. No toca stock.
      </p>

      <ol
        style={{
          margin: '16px 0 18px',
          paddingLeft: 20,
          color: '#334155',
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <li>En el programa CCO: exportar / publicar CSV a OneDrive.</li>
        <li>Descargar el archivo (p. ej. <code style={code}>MAESTRO_…csv</code>).</li>
        <li>Elegir la obra destino abajo y subir el CSV.</li>
      </ol>

      <label style={{ display: 'block', marginBottom: 14, maxWidth: 420 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
          Obra destino
        </span>
        <select
          value={proyectoId}
          onChange={(e) => setProyectoId(e.target.value)}
          disabled={busy}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #CBD5E1',
            fontSize: 14,
            fontWeight: 600,
            color: '#0F172A',
            background: '#F8FAFC',
          }}
        >
          <option value="">Seleccionar obra…</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 18px',
          borderRadius: 12,
          border: 'none',
          background: busy || !proyectoId || proyectos.length === 0 ? '#94A3B8' : '#2563EB',
          color: '#fff',
          cursor: busy || !proyectoId || proyectos.length === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 800,
          fontSize: 14,
          opacity: busy || !proyectoId ? 0.85 : 1,
        }}
      >
        <Cloud size={18} />
        {busy
          ? 'Importando maestro…'
          : proyectos.length === 0
            ? 'Cargando obras…'
            : 'Elegir CSV de OneDrive'}
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          disabled={busy || !proyectoId || proyectos.length === 0}
          style={{ display: 'none' }}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {preview ? (
        <p style={{ marginTop: 14, fontSize: 13, color: '#334155', fontWeight: 600 }}>{preview}</p>
      ) : null}

      {error ? (
        <pre
          style={{
            marginTop: 14,
            color: '#B91C1C',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            padding: 12,
          }}
        >
          {error}
        </pre>
      ) : null}

      {log ? (
        <pre
          style={{
            marginTop: 14,
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 10,
            padding: 12,
            fontSize: 12,
            color: '#14532D',
            whiteSpace: 'pre-wrap',
          }}
        >
          {log}
        </pre>
      ) : null}

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
          Antes de importar se crea un snapshot (si la migración 275 está aplicada). Las filas se
          upsertan por ID del programa CCO: reimportar el mismo CSV actualiza en lugar de duplicar.
        </span>
      </div>

      <div
        style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: '1px solid #E2E8F0',
        }}
      >
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
          ¿Solo una tabla de compras históricas (sin CLASE / contratos / ingresos)? Use el
          importador simple:
        </p>
        <button
          type="button"
          disabled={proyectos.length === 0}
          onClick={() => setOpenCompras(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            color: '#334155',
            border: '1px solid #CBD5E1',
            borderRadius: 10,
            padding: '10px 14px',
            fontWeight: 700,
            fontSize: 13,
            cursor: proyectos.length === 0 ? 'wait' : 'pointer',
          }}
        >
          <FileSpreadsheet size={16} />
          Solo compras (cuadro contable)
        </button>
      </div>

      <CargarFacturaCuadroModal
        open={openCompras}
        onClose={() => setOpenCompras(false)}
        proyectos={proyectos}
        proyectoIdInicial={proyectoId || proyectoIdInicial}
        onGuardado={(pid) => {
          setOpenCompras(false);
          onImportado?.(pid);
        }}
      />
    </div>
  );
}

const code: CSSProperties = {
  background: '#F1F5F9',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 12,
};
