'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatoVES } from '@/lib/nomina/compensacionDiaria';
import { etiquetaCliente } from '@/lib/clientes/etiquetaCliente';
import {
  moduloProyectosGlass,
  moduloProyectosInput,
  moduloProyectosPageShell,
  moduloProyectosStickyHeader,
} from '@/lib/ui/moduloProyectosTheme';
import { etiquetaFuenteProyecto } from '@/lib/proyectos/proyectosUnificados';
import { withTimeout } from '@/lib/http/withTimeout';

/** `modulo` = tabla ci_proyectos; `obra_talento` = ci_obras (flujo /proyectos/nuevo). */
type ProyectoOrigen = 'modulo' | 'obra_talento';

type ProyectoRow = {
  id: string;
  nombre: string;
  estado: string;
  ubicacion_texto: string;
  moneda: string;
  monto_aproximado: number;
  customer_id: string;
  created_at: string;
  customer_name?: string | null;
  origen: ProyectoOrigen;
  /** Filas en `ci_obra_empleados` por obra (Talento). `null` en Integral (sin tabla de cuadrilla en ese id). */
  obrerosContratados: number | null;
};

function customerName(r: ProyectoRow): string {
  return r.customer_name?.trim() || 'Cliente no disponible';
}

function etiquetaObrerosContratados(n: number): string {
  return n === 1 ? '1 obrero' : `${n} obreros`;
}

async function contarObrerosPorObra(
  supabase: ReturnType<typeof createClient>,
  obraIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (obraIds.length === 0) return out;
  const chunk = 200;
  for (let i = 0; i < obraIds.length; i += chunk) {
    const slice = obraIds.slice(i, i + chunk);
    const { data, error } = await supabase.from('ci_obra_empleados').select('obra_id').in('obra_id', slice);
    if (error) break;
    for (const row of (data ?? []) as { obra_id: string }[]) {
      const id = row.obra_id;
      out[id] = (out[id] ?? 0) + 1;
    }
  }
  return out;
}

const estadoChip: Record<string, { bg: string; text: string }> = {
  nuevo: { bg: 'rgba(148,163,184,0.2)', text: '#94A3B8' },
  levantamiento: { bg: 'rgba(90,200,250,0.15)', text: '#5AC8FA' },
  presupuestado: { bg: 'rgba(0,122,255,0.18)', text: '#64B5FF' },
  ejecucion: { bg: 'rgba(245,158,11,0.18)', text: '#FBBF24' },
  entregado: { bg: 'rgba(52,199,89,0.18)', text: '#4ADE80' },
  cerrado: { bg: 'rgba(142,142,147,0.2)', text: '#A1A1AA' },
  cancelado: { bg: 'rgba(239,68,68,0.18)', text: '#FCA5A5' },
  activa: { bg: 'rgba(52,199,89,0.15)', text: '#4ADE80' },
  cerrada: { bg: 'rgba(142,142,147,0.25)', text: '#A1A1AA' },
};

const LISTA_TIMEOUT_MS = 38_000;

export default function ModuloProyectosPage() {
  const supabase = useMemo(() => createClient(), []);
  const cargaIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ProyectoRow[]>([]);
  const [q, setQ] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [avisoObras, setAvisoObras] = useState<string | null>(null);
  const [avisoIntegral, setAvisoIntegral] = useState<string | null>(null);

  const load = useCallback(async () => {
    const cargaId = ++cargaIdRef.current;
    setLoading(true);
    setError(null);
    setAvisoObras(null);
    setAvisoIntegral(null);

    const stale = () => cargaId !== cargaIdRef.current;

    try {
      if (
        typeof process !== 'undefined' &&
        (!String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim() ||
          !String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim())
      ) {
        throw new Error(
          'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local; sin ellas el listado no puede cargar.',
        );
      }

      let avisoIntegralMsg: string | null = null;
      let avisoObrasMsg: string | null = null;

      const [pRes, oRes] = await withTimeout(
        Promise.all([
          Promise.resolve(
            supabase
              .from('ci_proyectos')
              .select('id,nombre,estado,ubicacion_texto,moneda,monto_aproximado,customer_id,created_at')
              .order('created_at', { ascending: false }),
          ),
          Promise.resolve(
            supabase
              .from('ci_obras')
              .select('id,nombre,ubicacion,cliente,estado,created_at,precio_venta_usd')
              .order('created_at', { ascending: false }),
          ),
        ]),
        LISTA_TIMEOUT_MS,
        'Carga inicial (proyectos y obras)',
      );

      if (stale()) return;

      let modRows: Omit<ProyectoRow, 'customer_name' | 'origen' | 'obrerosContratados'>[] = [];

      if (!pRes.error) {
        modRows = (pRes.data ?? []) as Omit<ProyectoRow, 'customer_name' | 'origen' | 'obrerosContratados'>[];
      } else {
        const msg = pRes.error?.message ?? 'Error al leer ci_proyectos.';
        const pMin = await withTimeout(
          Promise.resolve(
            supabase
              .from('ci_proyectos')
              .select('id,nombre,estado,created_at')
              .order('created_at', { ascending: false }),
          ),
          22_000,
          'Reintento ci_proyectos (mínimo)',
        );
        if (stale()) return;
        if (!pMin.error && pMin.data?.length) {
          modRows = (pMin.data as Array<{ id: string; nombre: string; estado: string; created_at: string }>).map(
            (r) => ({
              id: r.id,
              nombre: r.nombre ?? 'Sin nombre',
              estado: r.estado ?? 'nuevo',
              ubicacion_texto: '—',
              moneda: 'USD',
              monto_aproximado: 0,
              customer_id: '',
              created_at: r.created_at,
            }),
          );
          avisoIntegralMsg = `Módulo integral: ${msg} (listado mínimo: id, nombre, estado).`;
        } else {
          avisoIntegralMsg = `Módulo integral: no se pudieron cargar filas (${msg}).`;
        }
      }

      type ObraRow = {
        id: string;
        nombre: string;
        ubicacion: string | null;
        cliente: string | null;
        estado: string;
        created_at: string;
        precio_venta_usd?: number | null;
        presupuesto_ves?: number | null;
      };

      let obrasRaw: ObraRow[] = [];

      if (!oRes.error) {
        obrasRaw = (oRes.data ?? []) as ObraRow[];
      } else {
        const msg = oRes.error?.message ?? 'Error al leer ci_obras.';
        const oMid = await withTimeout(
          Promise.resolve(
            supabase
              .from('ci_obras')
              .select('id,nombre,ubicacion,cliente,estado,created_at,precio_venta_usd,presupuesto_ves')
              .order('created_at', { ascending: false }),
          ),
          22_000,
          'Reintento ci_obras (con montos)',
        );
        if (stale()) return;
        if (!oMid.error && oMid.data?.length) {
          obrasRaw = oMid.data as ObraRow[];
          avisoObrasMsg = `Obras (Talento): ${msg} (se usan columnas disponibles para el monto).`;
        } else {
          const oBare = await withTimeout(
            supabase
              .from('ci_obras')
              .select('id,nombre,ubicacion,cliente,estado,created_at')
              .order('created_at', { ascending: false }),
            22_000,
            'Reintento ci_obras (básico)',
          );
          if (stale()) return;
          if (!oBare.error && oBare.data?.length) {
            obrasRaw = (oBare.data as ObraRow[]).map((o) => ({
              ...o,
              precio_venta_usd: null,
              presupuesto_ves: null,
            }));
            avisoObrasMsg = `Obras (Talento): ${msg} (sin columna de monto en esta base).`;
          } else {
            avisoObrasMsg = `Obras (Talento): no se pudieron cargar (${msg}).`;
          }
        }
      }
      const ids = Array.from(new Set(modRows.map((r) => r.customer_id).filter(Boolean)));
      let byId: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: customersData } = await withTimeout(
          Promise.resolve(supabase.from('customers').select('*').in('id', ids)),
          22_000,
          'Carga de clientes',
        );
        if (stale()) return;
        byId = Object.fromEntries(
          ((customersData ?? []) as Array<Record<string, unknown> & { id: string }>).map((c) => {
            const row = c;
            return [row.id, etiquetaCliente(row)];
          }),
        );
      }

      const desdeModulo: ProyectoRow[] = modRows.map((r) => ({
        ...r,
        origen: 'modulo' as const,
        customer_name: byId[r.customer_id] || null,
        obrerosContratados: null,
      }));

      const obraIds = obrasRaw.map((o) => o.id);
      const porObra = await withTimeout(
        contarObrerosPorObra(supabase, obraIds),
        25_000,
        'Conteo de obreros por obra',
      );
      if (stale()) return;

      const desdeObra: ProyectoRow[] = obrasRaw.map((o) => ({
        id: o.id,
        nombre: o.nombre ?? 'Sin nombre',
        estado: o.estado ?? '—',
        ubicacion_texto: (o.ubicacion ?? '').trim() || '—',
        moneda: 'USD',
        monto_aproximado: Number(o.precio_venta_usd ?? o.presupuesto_ves ?? 0),
        customer_id: '',
        created_at: o.created_at ?? new Date(0).toISOString(),
        customer_name: (o.cliente ?? '').trim() || null,
        origen: 'obra_talento' as const,
        obrerosContratados: porObra[o.id] ?? 0,
      }));

      const merged = [...desdeModulo, ...desdeObra].sort((a, b) => {
        const ta = new Date(a.created_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? 0).getTime();
        return tb - ta;
      });
      if (stale()) return;
      setItems(merged);

      if (merged.length === 0) {
        const partes = [avisoIntegralMsg, avisoObrasMsg].filter(Boolean);
        if (partes.length) {
          setError(partes.join(' · '));
        } else {
          setError(null);
        }
        setAvisoIntegral(null);
        setAvisoObras(null);
      } else {
        setError(null);
        setAvisoIntegral(avisoIntegralMsg);
        setAvisoObras(avisoObrasMsg);
      }
    } catch (e) {
      if (cargaId !== cargaIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Error al cargar proyectos.');
      setItems([]);
    } finally {
      if (cargaId === cargaIdRef.current) {
        setLoading(false);
      }
    }
  }, [supabase]);

  useEffect(() => {
    void load();
    return () => {
      cargaIdRef.current += 1;
    };
  }, [load]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items;
    return items.filter((r) => {
      const nom = (r.nombre ?? '').toLowerCase();
      const ubi = (r.ubicacion_texto ?? '').toLowerCase();
      return nom.includes(n) || ubi.includes(n) || customerName(r).toLowerCase().includes(n);
    });
  }, [items, q]);

  const borrarProyecto = useCallback(
    async (row: ProyectoRow) => {
      const fuente = row.origen === 'obra_talento' ? etiquetaFuenteProyecto('talento') : etiquetaFuenteProyecto('integral');
      const ok = window.confirm(
        `¿Eliminar permanentemente el proyecto «${row.nombre}» (${fuente})?\n\nSe borrarán datos vinculados en la base correspondiente.`,
      );
      if (!ok) return;
      setDeletingId(row.id);
      setError(null);
      const { error: delErr } = await supabase
        .from(row.origen === 'obra_talento' ? 'ci_obras' : 'ci_proyectos')
        .delete()
        .eq('id', row.id);
      setDeletingId(null);
      if (delErr) {
        setError(delErr.message);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== row.id));
    },
    [supabase],
  );

  return (
    <div style={moduloProyectosPageShell}>
      <div style={moduloProyectosStickyHeader}>
        <div>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: 0 }}>Proyectos</h1>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <Link
            href="/entidades"
            style={{
              borderRadius: '12px',
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: '14px',
              border: '1px solid rgba(167,139,250,0.5)',
              color: '#E9D5FF',
              textDecoration: 'none',
              background: 'rgba(167,139,250,0.12)',
            }}
          >
            Entidades
          </Link>
          <Link href="/proyectos/modulo/nuevo">
            <button
              type="button"
              style={{
                background: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Nuevo Proyecto
            </button>
          </Link>
        </div>
      </div>

      <div style={{ padding: '16px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ ...moduloProyectosGlass, padding: '14px', marginBottom: '16px' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por proyecto, cliente o ubicación…"
            style={moduloProyectosInput}
          />
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', marginTop: '28px' }}>Cargando proyectos…</p>
        ) : null}
        {error ? <p style={{ color: '#f87171', fontSize: '14px', marginTop: '12px' }}>{error}</p> : null}
        {avisoIntegral && !error ? (
          <p style={{ color: 'rgba(251,191,36,0.95)', fontSize: '12px', marginTop: '10px' }}>{avisoIntegral}</p>
        ) : null}
        {avisoObras && !error ? (
          <p style={{ color: 'rgba(251,191,36,0.95)', fontSize: '12px', marginTop: '10px' }}>{avisoObras}</p>
        ) : null}

        {!loading && !error ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {filtered.length === 0 ? (
              <div style={{ ...moduloProyectosGlass, padding: '24px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                Sin proyectos ni obras en la base. Usa{' '}
                <Link href="/proyectos/modulo/nuevo" style={{ color: '#93C5FD', fontWeight: 700, textDecoration: 'underline' }}>
                  Nuevo Proyecto
                </Link>{' '}
                (integral) o{' '}
                <Link href="/proyectos/nuevo" style={{ color: '#93C5FD', fontWeight: 700, textDecoration: 'underline' }}>
                  Solicitar personal
                </Link>{' '}
                según el flujo que necesites.
              </div>
            ) : (
              filtered.map((r) => {
                const chip = estadoChip[r.estado] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.7)' };
                return (
                  <div key={r.id} style={{ ...moduloProyectosGlass, padding: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: r.origen === 'modulo' ? 'rgba(96,165,250,0.95)' : 'rgba(167,139,250,0.95)',
                            margin: '0 0 6px 0',
                          }}
                        >
                          {r.origen === 'modulo' ? etiquetaFuenteProyecto('integral') : etiquetaFuenteProyecto('talento')}
                        </p>
                        <h2 style={{ color: 'white', fontSize: '17px', fontWeight: 700, margin: 0 }}>{r.nombre}</h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '6px', marginBottom: 0 }}>
                          {customerName(r)}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                          {r.ubicacion_texto}
                        </p>
                      </div>
                      <span
                        style={{
                          background: chip.bg,
                          color: chip.text,
                          borderRadius: '999px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          height: 'fit-content',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.estado}
                      </span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', marginTop: '12px', marginBottom: 0 }}>
                      Monto aprox.:{' '}
                      <span style={{ fontWeight: 700, color: 'white' }}>
                        {formatoVES(Number(r.monto_aproximado || 0))} {r.moneda || 'USD'}
                      </span>
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', marginTop: '8px', marginBottom: 0 }}>
                      Obreros contratados:{' '}
                      <span style={{ fontWeight: 700, color: 'white' }}>
                        {r.obrerosContratados == null ? '—' : etiquetaObrerosContratados(r.obrerosContratados)}
                      </span>
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                      {r.origen === 'modulo' ? (
                        <Link
                          href={`/proyectos/nuevo?desde=proyecto&proyecto_modulo_id=${encodeURIComponent(r.id)}`}
                        >
                          <button
                            type="button"
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.9)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '10px',
                              padding: '8px 14px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Solicitar personal
                          </button>
                        </Link>
                      ) : null}
                      <Link
                        href={
                          r.origen === 'modulo'
                            ? `/proyectos/modulo/${r.id}?editar=1`
                            : `/proyectos/${r.id}/editar`
                        }
                      >
                        <button
                          type="button"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(226,232,240,0.95)',
                            border: '1px solid rgba(148,163,184,0.35)',
                            borderRadius: '10px',
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Modificar
                        </button>
                      </Link>
                      <Link href={r.origen === 'modulo' ? `/proyectos/modulo/${r.id}` : `/proyectos/${r.id}/finanzas`}>
                        <button
                          type="button"
                          style={{
                            background: '#007AFF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {r.origen === 'modulo' ? 'Abrir gestión' : 'Abrir finanzas / obra'}
                        </button>
                      </Link>
                      {r.origen === 'modulo' ? (
                        <Link href={`/proyectos/modulo/${r.id}?tab=rrhh`}>
                          <button
                            type="button"
                            style={{
                              background: 'rgba(192, 38, 211, 0.22)',
                              color: '#f5d0fe',
                              border: '1px solid rgba(217, 70, 239, 0.55)',
                              borderRadius: '10px',
                              padding: '8px 14px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            RRHH
                          </button>
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void borrarProyecto(r)}
                        disabled={deletingId === r.id}
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239,68,68,0.45)',
                          borderRadius: '10px',
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: deletingId === r.id ? 'wait' : 'pointer',
                          opacity: deletingId === r.id ? 0.6 : 1,
                        }}
                      >
                        {deletingId === r.id ? 'Borrando…' : 'Borrar proyecto'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
