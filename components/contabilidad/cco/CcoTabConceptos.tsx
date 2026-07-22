'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type {
  CcoConceptoFila,
  CcoConceptosMaterialesResult,
} from '@/lib/contabilidad/cco/cargarConceptosMateriales';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQty(n: number): string {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

type ModoQty = 'unica' | 'bruta';

export default function CcoTabConceptos({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CcoConceptosMaterialesResult | null>(null);
  const [modo, setModo] = useState<ModoQty>('unica');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [soloConocidos, setSoloConocidos] = useState(true);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/conceptos?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      setData({
        proyectoId: json.proyectoId,
        totalLineasAnalizadas: Number(json.totalLineasAnalizadas) || 0,
        totalConceptos: Number(json.totalConceptos) || 0,
        stubsPendientes: Number(json.stubsPendientes) || 0,
        conceptos: (json.conceptos ?? []) as CcoConceptoFila[],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const conceptos = useMemo(() => {
    const list = data?.conceptos ?? [];
    if (!soloConocidos) return list;
    const ids = new Set(['concreto_premezclado', 'cemento', 'acero_cabillas']);
    return list.filter((c) => ids.has(String(c.conceptoId)));
  }, [data, soloConocidos]);

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Conceptos / materiales</h3>
        <p style={muted}>Selecciona una obra en Obra activa (CCO) arriba.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ ...h3, margin: 0 }}>Resumen consolidado de conceptos</h3>
          <p style={{ ...muted, margin: '6px 0 0' }}>
            Cantidades físicas inferidas desde la descripción (cuando el import V4 dejó 1 UND).
            {data
              ? ` · ${data.totalLineasAnalizadas} líneas · ${data.totalConceptos} conceptos`
              : null}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div style={seg}>
            <button
              type="button"
              onClick={() => setModo('unica')}
              style={segBtn(modo === 'unica')}
              title="Una sola vez por descripción (sin contar splits %)"
            >
              Única
            </button>
            <button
              type="button"
              onClick={() => setModo('bruta')}
              style={segBtn(modo === 'bruta')}
              title="Suma todas las filas (puede duplicar 6%/20%/48%)"
            >
              Bruta
            </button>
          </div>
          <label style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={soloConocidos}
              onChange={(e) => setSoloConocidos(e.target.checked)}
            />
            Solo concreto / cemento / acero
          </label>
          <button type="button" onClick={() => void cargar()} style={btn}>
            Actualizar
          </button>
        </div>
      </div>

      {data && data.stubsPendientes > 0 ? (
        <div style={{ ...box, borderColor: '#FDE68A', background: '#FFFBEB', color: '#92400E' }}>
          {data.stubsPendientes} líneas V4 siguen en 1 UND sin cantidad parseable en el texto.
          Puedes correr el script de backfill o completar la descripción.
        </div>
      ) : null}

      {error ? (
        <div style={{ ...box, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando conceptos…
        </div>
      ) : conceptos.length === 0 ? (
        <div style={box}>
          <p style={muted}>Sin conceptos de materiales detectados en esta obra.</p>
        </div>
      ) : (
        <div style={box}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                  {[
                    '',
                    'CONCEPTO',
                    'UNIDAD',
                    modo === 'unica' ? 'CANT. ÚNICA' : 'CANT. BRUTA',
                    'REF. MATRIZ',
                    'Δ',
                    'FILAS',
                    'USD',
                    'STUBS',
                  ].map((h) => (
                    <th
                      key={h || 'exp'}
                      style={{
                        padding: '8px 6px',
                        position: 'sticky',
                        top: 0,
                        background: '#F1F5F9',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conceptos.map((c) => {
                  const key = `${c.conceptoId}::${c.unidad}`;
                  const open = abierto === key;
                  const qty = modo === 'unica' ? c.cantidadUnica : c.cantidadBruta;
                  const delta =
                    c.matrizRef != null ? Math.round((qty - c.matrizRef) * 1000) / 1000 : null;
                  return (
                    <React.Fragment key={key}>
                      <tr
                        style={{ borderTop: '1px solid #E2E8F0', cursor: 'pointer' }}
                        onClick={() => setAbierto(open ? null : key)}
                      >
                        <td style={{ padding: '8px 4px', width: 28 }}>
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ padding: '8px 6px', fontWeight: 700 }}>{c.etiqueta}</td>
                        <td style={{ padding: '8px 6px' }}>{c.unidad}</td>
                        <td style={{ padding: '8px 6px', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtQty(qty)}
                          {modo === 'unica' ? (
                            <span style={{ color: '#94A3B8', marginLeft: 6 }}>
                              ({c.descripcionesUnicas} desc.)
                            </span>
                          ) : null}
                        </td>
                        <td style={{ padding: '8px 6px', color: '#64748B' }}>
                          {c.matrizRef != null ? fmtQty(c.matrizRef) : '—'}
                        </td>
                        <td
                          style={{
                            padding: '8px 6px',
                            color:
                              delta == null
                                ? '#94A3B8'
                                : Math.abs(delta) < 1
                                  ? '#16A34A'
                                  : '#B45309',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {delta == null ? '—' : (delta > 0 ? '+' : '') + fmtQty(delta)}
                        </td>
                        <td style={{ padding: '8px 6px' }}>{c.filas}</td>
                        <td style={{ padding: '8px 6px', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtUsd(c.usd)}
                        </td>
                        <td style={{ padding: '8px 6px', color: c.stubsSinParse ? '#B45309' : '#64748B' }}>
                          {c.stubsSinParse}/{c.stubsV4}
                        </td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={9} style={{ padding: '0 8px 14px', background: '#F8FAFC' }}>
                            <DetalleConcepto concepto={c} />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ ...muted, margin: '12px 0 0', fontSize: 11 }}>
            Modo <strong>única</strong>: deduplica descripciones que el V4 partió por % de capítulo.
            Modo <strong>bruta</strong>: suma todas las filas. STUBS = sin parse / total stub V4.
          </p>
        </div>
      )}
    </div>
  );
}

function DetalleConcepto({ concepto }: { concepto: CcoConceptoFila }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
      {concepto.porCapitulo.length > 0 ? (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#64748B' }}>
            POR CAPÍTULO
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {concepto.porCapitulo.slice(0, 12).map((p) => (
              <span
                key={p.capitulo}
                style={{
                  fontSize: 11,
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '4px 8px',
                }}
              >
                {p.capitulo}: {fmtQty(p.cantidadBruta)} {concepto.unidad} · {fmtUsd(p.usd)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ overflow: 'auto', maxHeight: 280 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748B' }}>
              {['FECHA', 'PROVEEDOR', 'DESCRIPCIÓN', 'QTY', 'FUENTE', 'USD'].map((h) => (
                <th key={h} style={{ padding: '4px 6px', fontWeight: 700 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concepto.lineas.map((l) => (
              <tr key={l.lineaId} style={{ borderTop: '1px solid #E2E8F0' }}>
                <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{l.fecha ?? '—'}</td>
                <td style={{ padding: '5px 6px', maxWidth: 120 }}>{l.proveedor}</td>
                <td style={{ padding: '5px 6px', maxWidth: 320 }} title={l.descripcion}>
                  {l.descripcion.slice(0, 90)}
                  {l.descripcion.length > 90 ? '…' : ''}
                </td>
                <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                  {fmtQty(l.cantidadUsada)} {l.unidadUsada}
                  {l.stubV4 && l.fuenteCantidad === 'inferida' ? (
                    <span style={{ color: '#94A3B8' }}> ← {l.cantidadDb} {l.unidadDb}</span>
                  ) : null}
                </td>
                <td style={{ padding: '5px 6px' }}>{l.fuenteCantidad}</td>
                <td style={{ padding: '5px 6px' }}>{fmtUsd(l.usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  padding: 16,
};

const h3: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: '#0F172A',
};

const muted: React.CSSProperties = {
  fontSize: 13,
  color: '#64748B',
};

const btn: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  color: '#334155',
};

const seg: React.CSSProperties = {
  display: 'inline-flex',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  overflow: 'hidden',
};

function segBtn(active: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: active ? '#FEF2F2' : '#fff',
    color: active ? '#DC2626' : '#475569',
    fontSize: 12,
    fontWeight: 700,
    padding: '8px 12px',
    cursor: 'pointer',
  };
}
