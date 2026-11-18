'use client';

import { useCallback, useEffect, useState } from 'react';
import { InformesKpi, InformesShell, InformesTabla } from '@/components/informes/InformesShell';
import { descargarCsv, filasACsv } from '@/lib/informes/csv';
import type { FilaMovimientoAlmacen } from '@/lib/informes/resumirMovimientosAlmacen';

const PERIODOS = [
  { dias: 7, label: 'Última semana' },
  { dias: 14, label: 'Últimas 2 semanas' },
  { dias: 30, label: 'Último mes' },
];

function fmt(n: number) {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 4 });
}

export default function InformeMovimientosAlmacenPage() {
  const [dias, setDias] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaMovimientoAlmacen[]>([]);
  const [resumen, setResumen] = useState({ lineas: 0, almacenes: 0, lineasEnTransito: 0 });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/informes/movimientos-almacen?dias=${dias}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
      setFilas(json.filas ?? []);
      setResumen(json.resumen ?? { lineas: 0, almacenes: 0, lineasEnTransito: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const exportar = () => {
    const csv = filasACsv(
      ['Almacén', 'Material', 'Unidad', 'Existencia inicial', 'Entradas', 'Salidas', 'Existencia actual', 'En tránsito'],
      filas.map((f) => [f.ubicacion, f.material, f.unidad, f.existenciaInicial, f.entradas, f.salidas, f.existenciaActual, f.enTransito]),
    );
    descargarCsv(`movimientos-almacen-${dias}d.csv`, csv);
  };

  return (
    <InformesShell
      titulo="Movimientos de almacén"
      subtitulo="Lo que entró, lo que salió y lo que hay en cada almacén. Las cantidades son de unidades distintas, así que no se suman entre materiales."
      actions={
        <>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            aria-label="Periodo"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '8px 12px',
              color: 'var(--label-primary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {PERIODOS.map((p) => (
              <option key={p.dias} value={p.dias}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportar}
            disabled={!filas.length}
            style={{
              border: 'none',
              background: '#007AFF',
              color: 'white',
              borderRadius: '10px',
              padding: '8px 12px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: filas.length ? 'pointer' : 'not-allowed',
              opacity: filas.length ? 1 : 0.5,
              fontFamily: 'inherit',
            }}
          >
            CSV
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <InformesKpi label="Líneas con movimiento" value={String(resumen.lineas)} />
        <InformesKpi label="Almacenes" value={String(resumen.almacenes)} color="#5AC8FA" />
        <InformesKpi label="En tránsito" value={String(resumen.lineasEnTransito)} color="#FF9F0A" />
      </div>

      {error ? <p style={{ color: '#FF3B30', fontSize: '13px' }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>Cargando…</p>
      ) : (
        <InformesTabla
          headers={['Almacén', 'Material', 'Inicial', 'Entradas', 'Salidas', 'Actual', 'En tránsito']}
          empty="Sin movimientos ni existencias en el periodo."
          rows={filas.map((f) => [
            f.ubicacion,
            `${f.material} (${f.unidad})`,
            fmt(f.existenciaInicial),
            fmt(f.entradas),
            fmt(f.salidas),
            fmt(f.existenciaActual),
            fmt(f.enTransito),
          ])}
        />
      )}
    </InformesShell>
  );
}
