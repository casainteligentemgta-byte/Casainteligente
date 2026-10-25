'use client';

import { useCallback, useEffect, useState } from 'react';
import { InformesKpi, InformesShell, InformesTabla } from '@/components/informes/InformesShell';
import { descargarCsv, filasACsv } from '@/lib/informes/csv';
import type { FilaStockValorizado } from '@/lib/informes/cargarInformeStock';

type Obra = { id: string; nombre: string };

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export default function InformeStockPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaStockValorizado[]>([]);
  const [alcance, setAlcance] = useState('global_top');
  const [resumen, setResumen] = useState({ lineas: 0, cantidadTotal: 0, valorTotalUsd: 0 });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/almacen/proyectos', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json.proyectos) {
          setObras(
            json.proyectos.map((p: { id: string; nombre: string }) => ({
              id: String(p.id),
              nombre: String(p.nombre ?? 'Obra'),
            })),
          );
        }
      } catch {
        /* opcional */
      }
    })();
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = proyectoId ? `?proyecto_id=${encodeURIComponent(proyectoId)}` : '';
      const res = await fetch(`/api/informes/stock${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
      setFilas(json.filas ?? []);
      setResumen(json.resumen ?? resumen);
      setAlcance(json.alcance ?? 'global_top');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const exportar = () => {
    const csv = filasACsv(
      ['Código', 'Material', 'Unidad', 'Ubicación', 'Cantidad', 'Costo USD', 'Valor USD'],
      filas.map((f) => [f.codigo, f.material, f.unidad, f.ubicacion, f.cantidad, f.costoPromedioUsd, f.valorUsd]),
    );
    descargarCsv('informe-stock-valorizado.csv', csv);
  };

  return (
    <InformesShell
      titulo="Stock valorizado"
      subtitulo={
        alcance === 'obra'
          ? 'Almacenes físicos de la obra × costo promedio ponderado.'
          : 'Vista global (top 400 por cantidad). Elija una obra para el cuadro completo de esa obra.'
      }
      actions={
        <>
          <select
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            aria-label="Filtrar por obra"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '8px 12px',
              color: 'var(--label-primary)',
              fontSize: '12px',
              fontWeight: 600,
              maxWidth: '220px',
            }}
          >
            <option value="">Global (top)</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
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
        <InformesKpi label="Líneas" value={String(resumen.lineas)} />
        <InformesKpi label="Cantidad" value={String(Math.round(resumen.cantidadTotal))} color="#5AC8FA" />
        <InformesKpi label="Valor total" value={fmtUsd(resumen.valorTotalUsd)} color="#34C759" />
      </div>

      {error ? <p style={{ color: '#FF3B30', fontSize: '13px' }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>Cargando…</p>
      ) : (
        <InformesTabla
          headers={['Material', 'Ubicación', 'Cant.', 'Costo', 'Valor']}
          empty="Sin stock para el filtro."
          rows={filas.map((f) => [
            <>
              {f.material}
              {f.codigo ? (
                <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{f.codigo}</span>
              ) : null}
            </>,
            f.ubicacion,
            `${f.cantidad} ${f.unidad}`,
            fmtUsd(f.costoPromedioUsd),
            fmtUsd(f.valorUsd),
          ])}
        />
      )}
    </InformesShell>
  );
}
