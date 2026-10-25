'use client';

import { useCallback, useEffect, useState } from 'react';
import { InformesKpi, InformesShell, InformesTabla } from '@/components/informes/InformesShell';
import { descargarCsv, filasACsv } from '@/lib/informes/csv';
import type { FilaRentabilidadObra } from '@/lib/informes/cargarInformeRentabilidad';

type Obra = { id: string; nombre: string };

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function InformeRentabilidadPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaRentabilidadObra[]>([]);
  const [resumen, setResumen] = useState({
    obras: 0,
    ventasAceptadasUsd: 0,
    cobradoUsd: 0,
    comprasUsd: 0,
    margenBrutoUsd: 0,
  });

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
      const res = await fetch(`/api/informes/rentabilidad${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
      setFilas(json.filas ?? []);
      setResumen(json.resumen ?? resumen);
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
      [
        'Obra',
        'Ventas aceptadas USD',
        'Cobrado USD',
        'Por cobrar USD',
        'Compras USD',
        'Facturas compra',
        'Margen bruto USD',
        'Margen %',
      ],
      filas.map((f) => [
        f.proyectoNombre,
        f.ventasAceptadasUsd,
        f.cobradoUsd,
        f.porCobrarUsd,
        f.comprasUsd,
        f.facturasCompra,
        f.margenBrutoUsd,
        f.margenBrutoPct ?? '',
      ]),
    );
    descargarCsv('informe-rentabilidad-obra.csv', csv);
  };

  return (
    <InformesShell
      titulo="Rentabilidad de obra"
      subtitulo="Ventas aceptadas del cliente de la obra vs compras contables. No incluye nómina ni CCO (próximo pack)."
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
            <option value="">Hasta 40 obras</option>
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
        <InformesKpi label="Obras" value={String(resumen.obras)} />
        <InformesKpi label="Ventas aceptadas" value={fmtUsd(resumen.ventasAceptadasUsd)} color="#5AC8FA" />
        <InformesKpi label="Cobrado" value={fmtUsd(resumen.cobradoUsd)} color="#34C759" />
        <InformesKpi label="Compras" value={fmtUsd(resumen.comprasUsd)} color="#FF9500" />
        <InformesKpi
          label="Margen bruto"
          value={fmtUsd(resumen.margenBrutoUsd)}
          color={resumen.margenBrutoUsd >= 0 ? '#34C759' : '#FF3B30'}
        />
      </div>

      {error ? <p style={{ color: '#FF3B30', fontSize: '13px' }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>Cargando…</p>
      ) : (
        <InformesTabla
          headers={['Obra', 'Ventas', 'Cobrado', 'Por cobrar', 'Compras', 'Margen', '%']}
          empty="Sin obras para el filtro."
          rows={filas.map((f, i) => [
            f.proyectoNombre,
            fmtUsd(f.ventasAceptadasUsd),
            fmtUsd(f.cobradoUsd),
            fmtUsd(f.porCobrarUsd),
            fmtUsd(f.comprasUsd),
            <span key={`margen-${i}`} style={{ color: f.margenBrutoUsd >= 0 ? '#34C759' : '#FF3B30', fontWeight: 700 }}>
              {fmtUsd(f.margenBrutoUsd)}
            </span>,
            f.margenBrutoPct != null ? `${f.margenBrutoPct}%` : '—',
          ])}
        />
      )}
    </InformesShell>
  );
}
