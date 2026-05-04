'use client';

import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { etiquetaCliente, idCliente, rifCliente } from '@/lib/clientes/etiquetaCliente';
import { apiUrl } from '@/lib/http/apiUrl';
import { withTimeout } from '@/lib/http/withTimeout';
import { parseClientesApiResponse } from '@/lib/proyectos/parseClientesApiResponse';
import { moduloProyectosPageShell, moduloProyectosStickyHeader } from '@/lib/ui/moduloProyectosTheme';

type Customer = Record<string, unknown> & { id: string };
type Budget = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  subtotal: number | null;
  numero_correlativo?: number | string | null;
  created_at?: string;
};

/** Sin `numero_correlativo`: en algunas BD no existe la migración 020; el número se deriva del `id` en `numeroPresupuesto`. */
const BUDGET_SELECT = 'id,customer_id,customer_name,status,subtotal,created_at' as const;

const CLIENTES_API_TIMEOUT_MS = 12_000;
const CLIENTES_BROWSER_TIMEOUT_MS = 22_000;

/** Une filas del navegador y de la API por `id`; si está en ambas, gana la del navegador (más columnas). */
function mergeCustomersUnionPreferBrowser(browserRows: Customer[], apiRows: Customer[]): Customer[] {
  const byId = new Map<string, Customer>();
  for (const c of apiRows) {
    const id = String(c.id ?? '').trim();
    if (id) byId.set(id, c);
  }
  for (const c of browserRows) {
    const id = String(c.id ?? '').trim();
    if (id) byId.set(id, c);
  }
  return Array.from(byId.values()).sort((a, b) =>
    etiquetaCliente(a).localeCompare(etiquetaCliente(b), 'es', { sensitivity: 'base' }),
  );
}

function mergeBudgetsById(primary: Budget[], extra: Budget[]): Budget[] {
  const seen = new Set<string>();
  const out: Budget[] = [];
  for (const b of primary) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  for (const b of extra) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  out.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  return out;
}

function numeroPresupuesto(b: Budget) {
  const raw = b.numero_correlativo;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null;
  if (n != null && !Number.isNaN(n)) return `P-${n}`;
  return `P-${b.id.slice(0, 8).toUpperCase()}`;
}

function subtotalPresupuestoUSD(b: Budget | undefined): number | null {
  if (!b || b.subtotal == null) return null;
  const n = Number(b.subtotal);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function formatoUSD(n: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

const ProjectLocationPicker = dynamic(
  () => import('@/components/proyectos/ProjectLocationPicker'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2">
        <div className="h-10 w-full max-w-md animate-pulse rounded-xl bg-white/10" />
        <div className="h-72 w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
        <p className="text-xs text-zinc-500">Cargando mapa…</p>
      </div>
    ),
  },
);

export default function NuevoProyectoModuloPage() {
  /** Cliente solo en el navegador (evita instanciar @supabase/ssr durante el SSR del componente). */
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }, []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  /** Presupuestos del cliente elegido (consulta por FK + legado sin `customer_id`). */
  const [budgetsCliente, setBudgetsCliente] = useState<Budget[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loadingBudgetsCliente, setLoadingBudgetsCliente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [budgetId, setBudgetId] = useState('');
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('nuevo');
  const [ubicacion, setUbicacion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [monto, setMonto] = useState('');
  const [obs, setObs] = useState('');
  const [clienteMenuOpen, setClienteMenuOpen] = useState(false);
  const [presupuestoMenuOpen, setPresupuestoMenuOpen] = useState(false);
  const clienteMenuRef = useRef<HTMLDivElement | null>(null);
  const presupuestoMenuRef = useRef<HTMLDivElement | null>(null);
  /** Evita carrera con React Strict Mode: el `finally` solo apaga loading si esta sigue siendo la carga vigente. */
  const clientesCargaIdRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);

  type EntidadOpt = { id: string; nombre: string; rif: string | null };
  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [entidadesHint, setEntidadesHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error: entErr } = await supabase.from('ci_entidades').select('id,nombre,rif').order('nombre');
        if (cancelled) return;
        if (entErr) {
          setEntidades([]);
          setEntidadesHint('No se cargaron entidades (¿migración 063?). Puedes guardar el proyecto sin entidad.');
          return;
        }
        setEntidadesHint(null);
        setEntidades((data ?? []) as EntidadOpt[]);
      } catch {
        if (!cancelled) {
          setEntidades([]);
          setEntidadesHint('No se pudieron cargar entidades.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSupabase]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!clienteMenuOpen && !presupuestoMenuOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (clienteMenuRef.current?.contains(t)) return;
      if (presupuestoMenuRef.current?.contains(t)) return;
      setClienteMenuOpen(false);
      setPresupuestoMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [clienteMenuOpen, presupuestoMenuOpen]);

  useEffect(() => {
    const cargaId = ++clientesCargaIdRef.current;
    const stale = () => cargaId !== clientesCargaIdRef.current;

    (async () => {
      setLoadingRefs(true);
      setError(null);

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
        if (!supabaseUrl || !supabaseAnon) {
          if (!stale()) {
            setCustomers([]);
            setError('Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.');
          }
          return;
        }

        let supabase: ReturnType<typeof createClient>;
        try {
          supabase = getSupabase();
        } catch (e: unknown) {
          if (!stale()) {
            setCustomers([]);
            setError(e instanceof Error ? e.message : 'No se pudo iniciar el cliente de Supabase.');
          }
          return;
        }

        const normalizeRows = (rows: unknown[] | null): Customer[] =>
          (rows ?? [])
            .map((raw) => {
              const r = raw as Record<string, unknown>;
              const id = idCliente(r);
              return id ? ({ ...r, id } as Customer) : null;
            })
            .filter((x): x is Customer => Boolean(x));

        let browserErr: string | null = null;
        let fetchErr: string | null = null;
        let apiHint: string | null = null;

        const loadFromBrowser = async (): Promise<Customer[]> => {
          const query = async (): Promise<Customer[]> => {
            const tryCustomers = await supabase.from('customers').select('*').limit(2000);
            if (tryCustomers.error) {
              const fallback = await supabase.from('customers').select('id,nombre,rif,email').limit(2000);
              if (fallback.error) {
                const minimal = await supabase
                  .from('customers')
                  .select('id,nombre,rif,email,movil,tipo,status,direccion,imagen,created_at,updated_at')
                  .limit(2000);
                if (minimal.error) {
                  browserErr =
                    browserErr ??
                    minimal.error.message ??
                    fallback.error.message ??
                    tryCustomers.error.message ??
                    'Error leyendo customers.';
                  return [];
                }
                return normalizeRows(minimal.data as unknown[]);
              }
              return normalizeRows(fallback.data as unknown[]);
            }
            return normalizeRows(tryCustomers.data as unknown[]);
          };

          try {
            return await withTimeout(query(), CLIENTES_BROWSER_TIMEOUT_MS, 'Supabase (customers)');
          } catch (e: unknown) {
            browserErr = browserErr ?? (e instanceof Error ? e.message : 'Error leyendo customers.');
            return [];
          }
        };

        const mapApiItems = (body: { items?: Array<{ id: string; label: string; rif?: string }> }): Customer[] =>
          (body.items ?? [])
            .filter((x) => x != null && String(x.id ?? '').trim().length > 0)
            .map((x) => ({
              id: String(x.id).trim(),
              nombre: (x.label ?? '').trim() || 'Sin nombre',
              rif: typeof x.rif === 'string' ? x.rif : '',
            }));

        const loadFromApi = async (): Promise<Customer[]> => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), CLIENTES_API_TIMEOUT_MS);
          try {
            const apiRes = await fetch(`${apiUrl('/api/proyectos/clientes')}?t=${Date.now()}`, {
              cache: 'no-store',
              credentials: 'same-origin',
              signal: controller.signal,
            });
            const rawText = await apiRes.text();
            const { items, hint } = parseClientesApiResponse(apiRes, rawText);
            if (hint) apiHint = apiHint ?? hint;
            return mapApiItems({ items });
          } catch (e: unknown) {
            if (e instanceof Error && e.name === 'AbortError') {
              fetchErr =
                fetchErr ??
                `La API de clientes tardó más de ${CLIENTES_API_TIMEOUT_MS / 1000}s; se intentó combinar con lo obtenido en el navegador.`;
            } else {
              fetchErr =
                fetchErr ?? (e instanceof Error ? e.message : 'No se pudo contactar /api/proyectos/clientes.');
            }
            return [];
          } finally {
            clearTimeout(timer);
          }
        };

        const [browserRows, apiRows] = await Promise.all([loadFromBrowser(), loadFromApi()]);
        if (stale()) return;

        const custRows = mergeCustomersUnionPreferBrowser(browserRows, apiRows);

        if (stale()) return;

        if (custRows.length === 0) {
          setCustomers([]);
          const customerMsg = browserErr ?? fetchErr ?? apiHint;
          if (customerMsg) {
            setError((prev) => prev ?? customerMsg);
          } else {
            setError((prev) => prev ?? 'No hay filas en `customers` o no tienes permiso de lectura con la clave anónima.');
          }
        } else {
          setCustomers(custRows);
        }
      } catch (e: unknown) {
        if (!stale()) {
          setError((prev) => prev ?? (e instanceof Error ? e.message : 'Error cargando datos.'));
        }
      } finally {
        if (cargaId === clientesCargaIdRef.current) {
          setLoadingRefs(false);
        }
      }
    })();

    return () => {
      clientesCargaIdRef.current += 1;
    };
  }, [getSupabase]);

  const clienteSeleccionado = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const presupuestoSeleccionado = useMemo(
    () => budgetsCliente.find((x) => x.id === budgetId) ?? null,
    [budgetsCliente, budgetId],
  );

  useEffect(() => {
    if (!customerId) {
      setBudgetsCliente([]);
      setBudgetId('');
      setLoadingBudgetsCliente(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingBudgetsCliente(true);
      let supabase: ReturnType<typeof createClient>;
      try {
        supabase = getSupabase();
      } catch {
        if (!cancelled) {
          setError((prev) => prev ?? 'No se pudo conectar a Supabase para cargar presupuestos.');
          setLoadingBudgetsCliente(false);
        }
        return;
      }
      const c = customers.find((x) => x.id === customerId) ?? null;

      const byCustomerId = await supabase
        .from('budgets')
        .select(BUDGET_SELECT)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(500);

      let orphanRows: Budget[] = [];
      if (c) {
        const label = etiquetaCliente(c).trim();
        const nombreRaw = typeof c.nombre === 'string' ? c.nombre.trim() : '';
        const tokens = [label, nombreRaw].filter((t) => t.length >= 2);
        const needle = tokens.reduce((a, b) => (a.length >= b.length ? a : b), '');
        if (needle.length >= 2) {
          const safe = needle.replace(/%/g, '').replace(/_/g, ' ').slice(0, 80);
          const pattern = `%${safe}%`;
          const orphanRes = await supabase
            .from('budgets')
            .select(BUDGET_SELECT)
            .is('customer_id', null)
            .ilike('customer_name', pattern)
            .order('created_at', { ascending: false })
            .limit(200);
          if (!orphanRes.error && orphanRes.data) {
            orphanRows = orphanRes.data as Budget[];
          }
        }
      }

      if (cancelled) return;

      if (byCustomerId.error) {
        setError((prev) => prev ?? byCustomerId.error.message ?? 'Error cargando presupuestos del cliente.');
        setBudgetsCliente([]);
      } else {
        const primary = (byCustomerId.data ?? []) as Budget[];
        setBudgetsCliente(mergeBudgetsById(primary, orphanRows));
      }
      setLoadingBudgetsCliente(false);
    })().catch((e: unknown) => {
      if (!cancelled) {
        setError((prev) => prev ?? (e instanceof Error ? e.message : 'Error cargando presupuestos.'));
        setBudgetsCliente([]);
        setLoadingBudgetsCliente(false);
      }
    });

    return () => {
      cancelled = true;
      setLoadingBudgetsCliente(false);
    };
  }, [customerId, customers, getSupabase]);

  useEffect(() => {
    if (!customerId) {
      setBudgetId('');
      return;
    }
    if (budgetId && !budgetsCliente.some((b) => b.id === budgetId)) {
      setBudgetId('');
    }
  }, [customerId, budgetId, budgetsCliente]);

  useEffect(() => {
    if (!budgetId) return;
    const row = budgetsCliente.find((x) => x.id === budgetId);
    const st = subtotalPresupuestoUSD(row);
    if (st == null) {
      setMonto('');
      return;
    }
    setMonto(String(st));
  }, [budgetId, budgetsCliente]);

  const cerrarPresupuestoMenu = useCallback(() => setPresupuestoMenuOpen(false), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId || !nombre.trim() || !ubicacion.trim()) {
      setError('Cliente, nombre y ubicación son obligatorios.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkId(null);
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = getSupabase();
    } catch (e: unknown) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'No se pudo conectar a Supabase.');
      return;
    }
    const montoParsed = monto.trim().replace(',', '.');
    const manual =
      montoParsed !== '' && Number.isFinite(Number(montoParsed)) ? Number(montoParsed) : null;
    const porPresupuesto = budgetId ? subtotalPresupuestoUSD(budgetsCliente.find((b) => b.id === budgetId)) : null;
    const montoFinal = manual ?? porPresupuesto ?? 0;

    const payload: Record<string, unknown> = {
      customer_id: customerId,
      budget_id: budgetId || null,
      entidad_id: entidadId.trim() || null,
      nombre: nombre.trim(),
      estado,
      ubicacion_texto: ubicacion.trim(),
      lat: lat.trim() ? Number(lat) : null,
      lng: lng.trim() ? Number(lng) : null,
      monto_aproximado: montoFinal,
      moneda: 'USD',
      observaciones: obs.trim() || null,
    };
    const { data, error: insErr } = await supabase.from('ci_proyectos').insert(payload).select('id').single();
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setOkId((data as { id: string }).id);
  }

  const fieldClass =
    'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40 disabled:opacity-50 disabled:bg-white/[0.03]';
  const labelClass = 'block text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
  const menuButtonClass =
    'mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-white shadow-sm hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60';

  const presupuestoBotonResumen = useMemo(() => {
    if (!customerId) {
      return { titulo: 'Selecciona un cliente primero', subtitulo: null as string | null, disabled: true };
    }
    if (!budgetId || !presupuestoSeleccionado) {
      return {
        titulo: loadingBudgetsCliente ? 'Cargando presupuestos…' : 'Presupuesto',
        subtitulo: loadingBudgetsCliente ? null : 'Toca para elegir · opcional',
        disabled: loadingRefs || loadingBudgetsCliente,
      };
    }
    const st = subtotalPresupuestoUSD(presupuestoSeleccionado);
    return {
      titulo: numeroPresupuesto(presupuestoSeleccionado),
      subtitulo: st != null ? formatoUSD(st) : 'Sin subtotal en USD',
      disabled: loadingRefs || loadingBudgetsCliente,
    };
  }, [customerId, budgetId, presupuestoSeleccionado, loadingRefs, loadingBudgetsCliente]);

  return (
    <div style={moduloProyectosPageShell}>
      <div style={moduloProyectosStickyHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href="/proyectos/modulo"
            style={{ color: 'rgba(90,200,250,0.95)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            ← Proyectos
          </Link>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '8px 0 0' }}>Nuevo proyecto</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-8 pt-2">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-lg backdrop-blur-xl"
        >
          <div ref={clienteMenuRef} className="relative">
            <label className={labelClass}>Cliente *</label>
            <button
              type="button"
              disabled={loadingRefs}
              onClick={() => setClienteMenuOpen((o) => !o)}
              className={menuButtonClass}
            >
              <span className="min-w-0 truncate">
                {loadingRefs
                  ? 'Cargando clientes...'
                  : clienteSeleccionado
                    ? `${etiquetaCliente(clienteSeleccionado)}${rifCliente(clienteSeleccionado) ? ` · ${rifCliente(clienteSeleccionado)}` : ''}`
                    : 'Selecciona un cliente del registro…'}
              </span>
              <span className="shrink-0 text-zinc-500" aria-hidden>
                {clienteMenuOpen ? '▲' : '▼'}
              </span>
            </button>
            {!loadingRefs && customers.length === 0 ? (
              <div className="mt-2 space-y-2 rounded-xl border border-amber-500/35 bg-amber-950/25 p-3 text-xs leading-relaxed">
                {error ? (
                  <p className="font-semibold text-amber-100">{error}</p>
                ) : (
                  <p className="text-amber-100/95">No se listaron clientes.</p>
                )}
                <p className="text-zinc-400">
                  Este formulario usa la tabla CRM <code className="rounded bg-white/10 px-1 text-zinc-200">customers</code>{' '}
                  (pantalla{' '}
                  <Link href="/clientes" className="font-semibold text-sky-400 underline hover:text-sky-300">
                    Clientes
                  </Link>
                  ). Si tus fichas están solo en{' '}
                  <Link href="/personas" className="font-semibold text-sky-400 underline hover:text-sky-300">
                    Personas
                  </Link>
                  , hay que dar de alta un cliente en Clientes para poder elegirlo aquí.
                </p>
                <p className="text-zinc-500">
                  Revisa <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_SUPABASE_*</code> en{' '}
                  <code className="rounded bg-white/10 px-1">.env.local</code> y, en el servidor,{' '}
                  <code className="rounded bg-white/10 px-1">SUPABASE_SERVICE_ROLE_KEY</code> si la API no puede leer
                  <code className="mx-0.5 rounded bg-white/10 px-1">customers</code>.
                </p>
              </div>
            ) : null}
            {clienteMenuOpen ? (
              <ul
                className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
                role="listbox"
              >
                <li>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-zinc-500 hover:bg-white/5"
                    onClick={() => {
                      setCustomerId('');
                      setClienteMenuOpen(false);
                      setPresupuestoMenuOpen(false);
                    }}
                  >
                    — Sin seleccionar —
                  </button>
                </li>
                {customers.map((c) => {
                  const label = `${etiquetaCliente(c)}${rifCliente(c) ? ` · ${rifCliente(c)}` : ''}`;
                  const active = c.id === customerId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${active ? 'bg-sky-500/15 font-medium text-white' : 'text-zinc-200'}`}
                        onClick={() => {
                          setCustomerId(c.id);
                          setClienteMenuOpen(false);
                          setPresupuestoMenuOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Entidad de trabajo (patrono)</label>
            <p className="mb-1 text-[11px] text-zinc-500">
              Razón social y RIF para planillas.{' '}
              <Link href="/configuracion/entidades" className="font-semibold text-sky-400 underline hover:text-sky-300">
                Gestionar entidades
              </Link>
            </p>
            <select
              className={fieldClass}
              value={entidadId}
              onChange={(e) => setEntidadId(e.target.value)}
              style={{ colorScheme: 'dark' }}
            >
              <option value="">— Sin entidad —</option>
              {entidades.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.nombre}
                  {en.rif ? ` · ${en.rif}` : ''}
                </option>
              ))}
            </select>
            {entidadesHint ? <p className="mt-1 text-[11px] text-amber-400/90">{entidadesHint}</p> : null}
          </div>

          <div ref={presupuestoMenuRef} className="relative">
            <label className={labelClass}>Presupuesto del cliente</label>
            <button
              type="button"
              disabled={presupuestoBotonResumen.disabled}
              onClick={() => {
                if (!customerId) return;
                setPresupuestoMenuOpen((o) => !o);
              }}
              className={menuButtonClass}
            >
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                <span className="w-full truncate font-semibold text-white">{presupuestoBotonResumen.titulo}</span>
                {presupuestoBotonResumen.subtitulo ? (
                  <span className="w-full truncate text-xs font-medium text-sky-300/95">
                    {presupuestoBotonResumen.subtitulo}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-zinc-500" aria-hidden>
                {presupuestoMenuOpen ? '▲' : '▼'}
              </span>
            </button>
            {presupuestoMenuOpen && customerId ? (
              <ul
                className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
                role="listbox"
              >
                <li>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm text-zinc-500 hover:bg-white/5"
                    onClick={() => {
                      setBudgetId('');
                      cerrarPresupuestoMenu();
                    }}
                  >
                    Sin presupuesto asociado
                  </button>
                </li>
                {budgetsCliente.map((b) => {
                  const active = b.id === budgetId;
                  const st = subtotalPresupuestoUSD(b);
                  const precioTxt = st != null ? formatoUSD(st) : '—';
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-white/5 ${active ? 'bg-sky-500/15' : ''}`}
                        onClick={() => {
                          setBudgetId(b.id);
                          cerrarPresupuestoMenu();
                        }}
                      >
                        <span className={`text-sm font-bold ${active ? 'text-white' : 'text-zinc-100'}`}>
                          {numeroPresupuesto(b)}
                        </span>
                        <span className="text-xs font-semibold text-sky-300/95">{precioTxt}</span>
                        <span className="text-[11px] text-zinc-500">
                          {(b.customer_name || 'Sin cliente').trim()} · {b.status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {customerId && !loadingRefs && !loadingBudgetsCliente && budgetsCliente.length === 0 ? (
              <p className="mt-1 text-xs text-zinc-500">
                No hay presupuestos vinculados a este cliente por ID ni por nombre en presupuestos sin cliente
                asignado.
              </p>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Nombre del proyecto *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className={fieldClass}
            >
              {['nuevo', 'levantamiento', 'presupuestado', 'ejecucion', 'entregado', 'cerrado', 'cancelado'].map((s) => (
                <option key={s} value={s} className="bg-zinc-900 text-white">
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Ubicación escrita *</label>
            <textarea value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={fieldClass} rows={2} />
          </div>
          {mapReady ? (
            <ProjectLocationPicker
              lat={lat.trim() ? Number(lat) : null}
              lng={lng.trim() ? Number(lng) : null}
              onChange={(v) => {
                setLat(String(v.lat));
                setLng(String(v.lng));
                if (v.label && !ubicacion.trim()) setUbicacion(v.label);
              }}
            />
          ) : (
            <div className="space-y-2">
              <div className="h-10 w-full max-w-md animate-pulse rounded-xl bg-white/10" />
              <div className="h-72 w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
              <p className="text-xs text-zinc-500">Preparando selector de mapa…</p>
            </div>
          )}
          <p className="text-xs text-zinc-500">
            Coordenadas GPS seleccionadas: {lat.trim() || '—'}, {lng.trim() || '—'}
          </p>
          <div>
            <label className={labelClass}>Monto aproximado (USD)</label>
            <input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={fieldClass}
              placeholder="Se rellena al elegir presupuesto"
            />
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Si eliges presupuesto, el subtotal en USD se copia aquí; puedes ajustarlo.
            </p>
          </div>
          <div>
            <label className={labelClass}>Observaciones</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} className={fieldClass} rows={2} />
          </div>

          {loadingRefs ? <p className="text-xs text-zinc-500">Cargando clientes…</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {okId ? (
            <div className="space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4">
              <p className="text-sm text-emerald-300">
                Proyecto creado.{' '}
                <Link className="font-semibold text-sky-400 underline hover:text-sky-300" href={`/proyectos/modulo/${okId}`}>
                  Abrir gestión del proyecto
                </Link>
              </p>
              <p className="text-xs text-zinc-400">
                Desde la gestión del proyecto puedes continuar con equipos, visitas y demás módulos.
              </p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving || loadingRefs || loadingBudgetsCliente}
            className="rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0062CC] disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear proyecto'}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 shadow-sm">
          <p className="text-sm font-bold text-amber-100">Requisición de personal (obrero y/o empleado)</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Si necesitas vacantes u oficios, usa el panel de reclutamiento y elige el proyecto en la lista cuando ya
            esté guardado.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/reclutamiento/dashboard"
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Panel reclutamiento
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
