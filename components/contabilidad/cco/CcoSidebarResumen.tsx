'use client';

import React, { useCallback, useEffect, useState } from 'react';
import CcoFormRegistroModal from '@/components/contabilidad/cco/CcoFormRegistroModal';
import type { CcoLibroFila } from '@/lib/contabilidad/cco/types';

function fmtFecha(raw: string | null | undefined): string {
  if (!raw) return '—';
  const s = String(raw).trim();
  // ISO / YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // Ya DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  return s.slice(0, 10);
}

function monedaNorm(moneda?: string | null): string {
  const m = (moneda ?? 'USD').toUpperCase();
  if (m.startsWith('VE')) return 'VES';
  if (m.startsWith('US') || m === 'USD') return 'USD';
  return m.slice(0, 3) || 'USD';
}

/** Monto original sin código de moneda (la moneda va en columna aparte). */
function fmtMontoOrig(n: number, moneda?: string | null): string {
  const m = monedaNorm(moneda);
  const num = (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return m === 'USD' ? `$${num}` : num;
}

function fmtMontoUsd(n: number): string {
  const num = (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${num}`;
}

function fmtTasa(tasa: number): string {
  if (!(tasa > 0)) return '—';
  return tasa.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function textoProv(p: string | null | undefined): string {
  const t = String(p ?? '').trim();
  return t || 'None';
}

function MiniTable({
  title,
  subtitle,
  headers,
  rows,
  accent,
}: {
  title: string;
  subtitle?: string | null;
  headers: string[];
  rows: string[][];
  /** Color de acento del título (egresos / ingresos). */
  accent?: string;
}) {
  return (
    <div style={{ marginTop: 14, minWidth: 196 }}>
      <p
        style={{
          margin: '0 0 4px',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: accent ?? '#94A3B8',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {accent ? (
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              background: accent,
              transform: 'rotate(45deg)',
              flexShrink: 0,
            }}
          />
        ) : null}
        {title}
      </p>
      {subtitle ? (
        <p style={{ margin: '0 0 8px', fontSize: 10, color: '#64748B', fontWeight: 600 }}>
          {subtitle}
        </p>
      ) : (
        <div style={{ height: 4 }} />
      )}
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>Sin datos</p>
      ) : (
        <div
          style={{
            background: '#1E293B',
            borderRadius: 10,
            overflow: 'auto',
            border: '1px solid #334155',
            maxWidth: '100%',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 10,
              minWidth: headers.length > 4 ? 420 : 260,
            }}
          >
            <thead>
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '6px 6px',
                      color: '#94A3B8',
                      fontWeight: 800,
                      borderBottom: '1px solid #334155',
                      whiteSpace: 'nowrap',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      fontSize: 9,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: i ? '1px solid #334155' : undefined }}>
                  {r.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: '6px 6px',
                        color: '#E2E8F0',
                        maxWidth: j === headers.length - 1 ? 120 : j === 1 ? 88 : undefined,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CcoSidebarResumen({
  proyectoId,
  onChanged,
}: {
  proyectoId: string;
  onChanged?: () => void;
}) {
  const [egresos, setEgresos] = useState<CcoLibroFila[]>([]);
  const [ingresos, setIngresos] = useState<CcoLibroFila[]>([]);
  const [egresosLabel, setEgresosLabel] = useState('Últimos 3 Egresos');
  const [ultimoRegistroGlobal, setUltimoRegistroGlobal] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!proyectoId) {
      setEgresos([]);
      setIngresos([]);
      setUltimoRegistroGlobal(null);
      return;
    }
    try {
      const [gRes, iRes] = await Promise.all([
        fetch(
          `/api/contabilidad/cco/libro?proyecto=${encodeURIComponent(proyectoId)}&clase=GASTO&limit=80`,
          { cache: 'no-store' },
        ),
        fetch(
          `/api/contabilidad/cco/libro?proyecto=${encodeURIComponent(proyectoId)}&clase=INGRESO&limit=40`,
          { cache: 'no-store' },
        ),
      ]);
      const gJson = await gRes.json();
      const iJson = await iRes.json();
      const gastos = (gJson.filas ?? []) as CcoLibroFila[];
      const ings = (iJson.filas ?? []) as CcoLibroFila[];

      const porFechaDesc = (a: CcoLibroFila, b: CcoLibroFila) =>
        String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''));

      const gastosOrdenados = [...gastos].sort(porFechaDesc);
      const ultimo = gastosOrdenados[0]?.fecha ?? ings.map((x) => x.fecha).filter(Boolean).sort().at(-1) ?? null;
      setUltimoRegistroGlobal(ultimo ? fmtFecha(ultimo) : null);

      const pendientes = gastos
        .filter((f) => String(f.estado).toUpperCase() === 'PENDIENTE')
        .sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')));
      if (pendientes.length > 0) {
        setEgresosLabel('Próximos 3 Egresos');
        setEgresos(pendientes.slice(0, 3));
      } else {
        setEgresosLabel('Últimos 3 Egresos');
        setEgresos(gastosOrdenados.slice(0, 3));
      }
      setIngresos([...ings].sort(porFechaDesc).slice(0, 3));
    } catch {
      setEgresos([]);
      setIngresos([]);
      setUltimoRegistroGlobal(null);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1E293B' }}>
      {proyectoId ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CcoFormRegistroModal
            proyectoId={proyectoId}
            defaultClase="INGRESO"
            triggerLabel="+ Ingreso"
            triggerVariant="ingreso"
            onSaved={() => {
              void cargar();
              onChanged?.();
            }}
          />
          <CcoFormRegistroModal
            proyectoId={proyectoId}
            defaultClase="GASTO"
            triggerLabel="+ Gasto"
            triggerVariant="primary"
            onSaved={() => {
              void cargar();
              onChanged?.();
            }}
          />
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>
          Selecciona una obra para registrar ingresos.
        </p>
      )}

      <MiniTable
        title={`${egresosLabel} (Gastos)`}
        subtitle={
          ultimoRegistroGlobal ? `Último Registro Global: ${ultimoRegistroGlobal}` : null
        }
        headers={['FECHA', 'PROVEEDOR', 'Monto Orig.', 'MONEDA', 'DESCRIPCION']}
        rows={egresos.map((f) => [
          fmtFecha(f.fecha),
          textoProv(f.proveedor),
          fmtMontoOrig(f.monto_orig || f.monto_base_usd, f.moneda),
          monedaNorm(f.moneda),
          String(f.descripcion ?? '').trim() || '—',
        ])}
      />

      <MiniTable
        title="Últimos 3 Ingresos"
        accent="#38BDF8"
        headers={[
          'FECHA',
          'PROVEEDOR',
          'Monto Orig.',
          'MONEDA',
          'Tasa',
          'Monto USD',
          'DESCRIPCION',
        ]}
        rows={ingresos.map((f) => [
          fmtFecha(f.fecha),
          textoProv(f.proveedor),
          fmtMontoOrig(f.monto_orig || f.monto_base_usd, f.moneda),
          monedaNorm(f.moneda),
          fmtTasa(f.tasa),
          fmtMontoUsd(f.monto_base_usd),
          String(f.descripcion ?? '').trim() || '—',
        ])}
      />
    </div>
  );
}
