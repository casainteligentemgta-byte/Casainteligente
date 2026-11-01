'use client';

import { useEffect, useState } from 'react';
import { InformesKpi, InformesShell, InformesTabla } from '@/components/informes/InformesShell';
import { descargarCsv, filasACsv } from '@/lib/informes/csv';
import type { FilaConciliacion, CuadreStock } from '@/lib/informes/cargarInformeConciliacionCompras';

type Respuesta = {
  filas: FilaConciliacion[];
  cuadreStock: CuadreStock[];
  resumen: {
    documentos: number;
    filas: number;
    filasConAlerta: number;
    facturasBorradas: number;
    transitoHuerfano: number;
    stockDescuadrado: number;
  };
  materiales: Record<string, { nombre: string; unidad: string }>;
};

const ESTADO_TXT: Record<FilaConciliacion['estado'], string> = {
  recibido: 'Recibido',
  en_cuarentena: 'En cuarentena',
  en_transito: 'En tránsito',
  factura_borrada: 'Factura borrada',
};

const n = (v: number) => (Math.round(v * 10000) / 10000).toString();

export default function InformeConciliacionPage() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/informes/conciliacion', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'No se pudo cargar');
        setData(json as Respuesta);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nombreMat = (id: string) => data?.materiales[id]?.nombre ?? id.slice(0, 8);

  const exportar = () => {
    if (!data) return;
    const csv = filasACsv(
      ['Documento', 'Factura', 'Proveedor', 'Material', 'Facturado', 'Aprobado', 'Rechazado', 'En cuarentena', 'Tránsito (ledger)', 'Estado', 'Alertas'],
      data.filas.map((f) => [
        f.documentoId,
        f.numeroFactura ?? '',
        f.proveedor ?? '',
        nombreMat(f.materialId),
        f.facturado,
        f.aprobado,
        f.rechazado,
        f.pendiente,
        f.transitoLedger,
        ESTADO_TXT[f.estado],
        f.alertas.join(' · '),
      ]),
    );
    descargarCsv('informe-conciliacion-compras.csv', csv);
  };

  const r = data?.resumen;

  return (
    <InformesShell
      titulo="Conciliación factura · recepción · stock"
      subtitulo="Qué se facturó, qué llegó al almacén, qué sigue en tránsito y dónde no cuadra el ledger."
      actions={
        <button
          type="button"
          onClick={exportar}
          disabled={!data?.filas.length}
          style={{
            border: 'none',
            background: '#007AFF',
            color: 'white',
            borderRadius: '10px',
            padding: '8px 12px',
            fontWeight: 700,
            fontSize: '12px',
            cursor: data?.filas.length ? 'pointer' : 'not-allowed',
            opacity: data?.filas.length ? 1 : 0.5,
            fontFamily: 'inherit',
          }}
        >
          CSV
        </button>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <InformesKpi label="Documentos" value={String(r?.documentos ?? 0)} />
        <InformesKpi label="Con alerta" value={String(r?.filasConAlerta ?? 0)} color="#FF9500" />
        <InformesKpi
          label="Facturas borradas"
          value={String(r?.facturasBorradas ?? 0)}
          color="#FF3B30"
        />
        <InformesKpi
          label="Tránsito huérfano (u.)"
          value={n(r?.transitoHuerfano ?? 0)}
          color="#FF3B30"
        />
        <InformesKpi
          label="Stock sin cuadrar"
          value={String(r?.stockDescuadrado ?? 0)}
          color="#FF9500"
        />
      </div>

      {error ? <p style={{ color: '#FF3B30', fontSize: '13px' }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: 'var(--label-secondary)', fontSize: '13px' }}>Cargando…</p>
      ) : (
        <>
          <InformesTabla
            headers={['Factura', 'Proveedor', 'Material', 'Facturado', 'Aprobado', 'Cuarentena', 'Tránsito', 'Estado', 'Alertas']}
            empty="Sin movimientos de compras."
            rows={(data?.filas ?? []).map((f) => [
              f.numeroFactura ?? f.documentoId.slice(0, 8),
              f.proveedor ?? '—',
              nombreMat(f.materialId),
              n(f.facturado),
              n(f.aprobado),
              n(f.pendiente),
              n(f.transitoLedger),
              ESTADO_TXT[f.estado],
              f.alertas.length ? f.alertas.join(' · ') : '✓',
            ])}
          />

          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '22px 0 8px' }}>
            Ledger vs stock por ubicación
          </h2>
          <InformesTabla
            headers={['Ubicación', 'Material', 'Stock disp.', 'Ledger disp.', 'Stock tránsito', 'Ledger tránsito']}
            empty="El ledger cuadra con el stock en todas las ubicaciones."
            rows={(data?.cuadreStock ?? []).map((c) => [
              c.ubicacionId.slice(0, 8),
              nombreMat(c.materialId),
              n(c.stockDisponible),
              n(c.ledgerDisponible),
              n(c.stockTransito),
              n(c.ledgerTransito),
            ])}
          />
        </>
      )}
    </InformesShell>
  );
}
