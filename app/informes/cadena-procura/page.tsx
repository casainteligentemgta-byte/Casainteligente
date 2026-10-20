'use client';

import { useCallback, useEffect, useState } from 'react';
import { InformesKpi, InformesShell, InformesTabla } from '@/components/informes/InformesShell';
import { descargarCsv, filasACsv } from '@/lib/informes/csv';
import type { FilaCadenaProcura } from '@/lib/informes/cargarInformeCadenaProcura';

type Obra = { id: string; nombre: string };

export default function InformeCadenaProcuraPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaCadenaProcura[]>([]);
  const [resumen, setResumen] = useState({
    total: 0,
    conFactura: 0,
    sinFactura: 0,
    cumplimientoPromedioPct: null as number | null,
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
      const res = await fetch(`/api/informes/cadena-procura${qs}`, { cache: 'no-store' });
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
      ['Ticket', 'Obra', 'Material', 'Unidad', 'Pedida', 'Compra', 'Cumplimiento %', 'Estado', 'Con factura'],
      filas.map((f) => [
        f.ticket,
        f.proyectoNombre,
        f.material,
        f.unidad,
        f.cantidadPedida,
        f.cantidadCompra ?? '',
        f.cumplimientoPct ?? '',
        f.estado,
        f.tieneFactura ? 'Sí' : 'No',
      ]),
    );
    descargarCsv('informe-cadena-procura.csv', csv);
  };

  return (
    <InformesShell
      titulo="Cadena procura → compra"
      subtitulo="Pedido vs cantidad de compra y si ya hay factura vinculada."
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
            <option value="">Todas las obras</option>
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
        <InformesKpi label="Procuras" value={String(resumen.total)} />
        <InformesKpi label="Con factura" value={String(resumen.conFactura)} color="#34C759" />
        <InformesKpi label="Sin factura" value={String(resumen.sinFactura)} color="#FF9500" />
        <InformesKpi
          label="Cumplimiento prom."
          value={resumen.cumplimientoPromedioPct != null ? `${resumen.cumplimientoPromedioPct}%` : '—'}
          color="#5AC8FA"
        />
      </div>

      {error ? <p style={{ color: '#FF3B30', fontSize: '13px' }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>Cargando…</p>
      ) : (
        <InformesTabla
          headers={['Ticket', 'Obra', 'Material', 'Pedida', 'Compra', '%', 'Estado', 'Factura']}
          empty="Sin procuras para el filtro."
          rows={filas.map((f) => [
            f.ticket,
            f.proyectoNombre,
            f.material,
            `${f.cantidadPedida} ${f.unidad}`,
            f.cantidadCompra != null ? String(f.cantidadCompra) : '—',
            f.cumplimientoPct != null ? `${f.cumplimientoPct}%` : '—',
            f.estado,
            f.tieneFactura ? 'Sí' : 'No',
          ])}
        />
      )}
    </InformesShell>
  );
}
