'use client';

import { useCallback, useEffect, useState } from 'react';
import { InformesKpi, InformesShell, InformesTabla } from '@/components/informes/InformesShell';
import { descargarCsv, filasACsv } from '@/lib/informes/csv';
import type { LineaMaterialCompraTelegram } from '@/lib/contabilidad/cargarComprasPeriodoTelegram';

type Periodo = 'dia' | 'semana' | 'mes';

export default function InformeComprasPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaMaterialCompraTelegram[]>([]);
  const [rango, setRango] = useState<{ desde: string; hasta: string } | null>(null);
  const [resumen, setResumen] = useState({
    materiales: 0,
    facturas: 0,
    telegram: 0,
    app: 0,
    cantidadTotal: 0,
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/informes/compras?periodo=${periodo}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
      setLineas(json.lineas ?? []);
      setRango(json.rango ?? null);
      setResumen(json.resumen ?? resumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setLineas([]);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const exportar = () => {
    const csv = filasACsv(
      ['Fecha', 'Factura', 'Proveedor', 'Origen', 'Artículo', 'Código', 'Cantidad', 'Estado'],
      lineas.map((l) => [l.fecha, l.factura, l.proveedor, l.origen, l.articulo, l.codigo, l.cantidad, l.estado ?? '']),
    );
    descargarCsv(`informe-compras-${periodo}.csv`, csv);
  };

  return (
    <InformesShell
      titulo="Compras del período"
      subtitulo={
        rango
          ? `${rango.desde} → ${rango.hasta} · misma lógica que /comprasdia /comprassemana /comprasmes`
          : 'Facturas de contabilidad + canal Telegram'
      }
      actions={
        <>
          {(['dia', 'semana', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              style={{
                border: periodo === p ? '1px solid #34C759' : '1px solid rgba(255,255,255,0.12)',
                background: periodo === p ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.06)',
                color: periodo === p ? '#34C759' : 'var(--label-secondary)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {p === 'dia' ? 'Día' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
          <button
            type="button"
            onClick={exportar}
            disabled={!lineas.length}
            style={{
              border: 'none',
              background: '#007AFF',
              color: 'white',
              borderRadius: '10px',
              padding: '8px 12px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: lineas.length ? 'pointer' : 'not-allowed',
              opacity: lineas.length ? 1 : 0.5,
              fontFamily: 'inherit',
            }}
          >
            CSV
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <InformesKpi label="Materiales" value={String(resumen.materiales)} />
        <InformesKpi label="Facturas" value={String(resumen.facturas)} color="#5AC8FA" />
        <InformesKpi label="Telegram" value={String(resumen.telegram)} color="#AF52DE" />
        <InformesKpi label="App / otros" value={String(resumen.app)} color="#FF9500" />
      </div>

      {error ? (
        <p style={{ color: '#FF3B30', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>Cargando…</p>
      ) : (
        <InformesTabla
          headers={['Fecha', 'Factura', 'Proveedor', 'Origen', 'Artículo', 'Cant.']}
          empty="Sin compras en este período."
          rows={lineas.map((l) => [
            l.fecha,
            l.factura,
            l.proveedor,
            l.origen,
            <>
              {l.articulo}
              {l.codigo ? (
                <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{l.codigo}</span>
              ) : null}
            </>,
            l.cantidad || '—',
          ])}
        />
      )}
    </InformesShell>
  );
}
