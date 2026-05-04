'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { etiquetaCliente, idCliente, rifCliente } from '@/lib/clientes/etiquetaCliente';
import { apiUrl } from '@/lib/http/apiUrl';
import { withTimeout } from '@/lib/http/withTimeout';
import {
  diasCalendarioInclusive,
  filasManoObraEstimada,
  type FilaManoObraEstimada,
} from '@/lib/proyectos/manoObraEstimada';
import {
  CARGOS_OBREROS,
  cargoPorCodigo,
  cargosAgrupadosPorNivel,
} from '@/lib/constants/cargosObreros';
import { calcularCompensacionDiaria, formatoVES } from '@/lib/nomina/compensacionDiaria';
import { parseClientesApiResponse } from '@/lib/proyectos/parseClientesApiResponse';
import { moduloProyectosPageShell, moduloProyectosStickyHeader } from '@/lib/ui/moduloProyectosTheme';

type InsertResult = {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_entrega_prometida: string;
  presupuesto_ves: number | null;
};

type Customer = Record<string, unknown> & { id: string };

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

type BudgetRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  subtotal: number;
  numero_correlativo?: number | string | null;
};

function formatUSD(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type LineaPersonalObra = { id: string; cargoCodigo: string; cantidad: string };

type ResumenTrasCrear = {
  dias: number;
  obreros: number;
  filas: FilaManoObraEstimada[];
  detalleOficios: Array<{
    codigo: string;
    nombre: string;
    cantidad: number;
    costoDiarioConCesta: number;
    subtotal: number;
  }>;
};

function nuevaLineaPersonal(): LineaPersonalObra {
  const id =
    typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, cargoCodigo: '', cantidad: '1' };
}

/** Une filas con el mismo código y suma cantidades (enteras ≥ 1). */
function mergeCantidadPorCodigo(lineas: LineaPersonalObra[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lineas) {
    const cod = l.cargoCodigo.trim();
    if (!cod) continue;
    const n = Math.max(1, Math.floor(Number(l.cantidad) || 1));
    m.set(cod, (m.get(cod) ?? 0) + n);
  }
  return m;
}

function numeroPresupuesto(b: BudgetRow) {
  const raw = b.numero_correlativo;
  const n =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null;
  if (n != null && !Number.isNaN(n)) return `P-${n}`;
  return `P-${b.id.slice(0, 8).toUpperCase()}`;
}

function textoClienteObra(c: Customer | null): string | null {
  if (!c) return null;
  const base = etiquetaCliente(c).trim();
  const rif = rifCliente(c);
  if (rif) return `${base} · ${rif}`;
  return base || null;
}

/** Volcado temporal hacia `/reclutamiento/requisicion` (lee `ConstructorRequisicion`). */
const CI_SOLICITUD_PERSONAL_PREFILL_KEY = 'ci_solicitud_personal_prefill';

function hrefRequisicionPersonal(proyectoModuloId: string, proyectoObraId: string): string {
  const q = new URLSearchParams();
  if (proyectoModuloId) q.set('proyecto_modulo_id', proyectoModuloId);
  if (proyectoObraId) q.set('proyecto_id', proyectoObraId);
  const s = q.toString();
  return s ? `/reclutamiento/requisicion?${s}` : '/reclutamiento/requisicion';
}

function ProyectoNuevoPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const omitirTabuladorPersonal = searchParams.get('desde') === 'proyecto';
  const proyectoModuloIdParam = searchParams.get('proyecto_modulo_id')?.trim() ?? '';
  const proyectoObraIdParam = searchParams.get('proyecto_id')?.trim() ?? '';

  const supabase = useMemo(() => createClient(), []);
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [budgetId, setBudgetId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [lineasPersonal, setLineasPersonal] = useState<LineaPersonalObra[]>(() => [nuevaLineaPersonal()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<InsertResult | null>(null);
  const [resumen, setResumen] = useState<ResumenTrasCrear | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  /** Clientes y presupuestos se cargan en paralelo: antes un solo flag bloqueaba la UI hasta que ambos terminaran. */
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [refsError, setRefsError] = useState<string | null>(null);
  const [clienteMenuOpen, setClienteMenuOpen] = useState(false);
  const clienteMenuRef = useRef<HTMLDivElement | null>(null);

  const diasPreview = useMemo(() => {
    if (!fechaInicio || !fechaFin) return 1;
    return diasCalendarioInclusive(fechaInicio, fechaFin);
  }, [fechaInicio, fechaFin]);

  const gruposTabulador = useMemo(() => cargosAgrupadosPorNivel(CARGOS_OBREROS), []);

  const mergePersonalPreview = useMemo(() => mergeCantidadPorCodigo(lineasPersonal), [lineasPersonal]);

  const totalObrerosPreview = useMemo(() => {
    if (mergePersonalPreview.size === 0) return 0;
    return Array.from(mergePersonalPreview.values()).reduce((a, v) => a + v, 0);
  }, [mergePersonalPreview]);

  const clienteSeleccionado = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );

  const budgetsFiltrados = useMemo(() => {
    if (!customerId) return budgets;
    return budgets.filter((b) => String(b.customer_id ?? '') === customerId);
  }, [budgets, customerId]);

  const presupuestoSeleccionado = useMemo(
    () => budgets.find((b) => b.id === budgetId) ?? null,
    [budgets, budgetId],
  );

  type EntidadOpt = { id: string; nombre: string; rif: string | null };
  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [entidadesHint, setEntidadesHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error: entErr } = await supabase.from('ci_entidades').select('id,nombre,rif').order('nombre');
        if (cancelled) return;
        if (entErr) {
          setEntidades([]);
          setEntidadesHint('No se cargaron entidades. Revisa migración 063 en Supabase.');
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
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    setRefsError(null);

    const normalizeRows = (rows: unknown[] | null): Customer[] =>
      (rows ?? [])
        .map((raw) => {
          const r = raw as Record<string, unknown>;
          const id = idCliente(r);
          return id ? ({ ...r, id } as Customer) : null;
        })
        .filter((x): x is Customer => Boolean(x));

    const mapApiItems = (body: { items?: Array<{ id: string; label: string; rif?: string }> }): Customer[] =>
      (body.items ?? [])
        .filter((x) => x != null && String(x.id ?? '').trim().length > 0)
        .map((x) => ({
          id: String(x.id).trim(),
          nombre: (x.label ?? '').trim() || 'Sin nombre',
          rif: typeof x.rif === 'string' ? x.rif : '',
        }));

    const API_TIMEOUT_MS = 12_000;
    const BROWSER_CUSTOMERS_TIMEOUT_MS = 22_000;

    async function loadCustomerRows(): Promise<void> {
      setLoadingCustomers(true);
      let browserErr: string | null = null;
      let fetchErr: string | null = null;
      let apiHint: string | null = null;

      const loadFromBrowser = async (): Promise<Customer[]> => {
        const inner = async (): Promise<Customer[]> => {
          const tryCustomers = await supabase.from('customers').select('*').limit(2000);
          if (tryCustomers.error) {
            const fallback = await supabase.from('customers').select('id,nombre,rif,email').limit(2000);
            if (fallback.error) {
              browserErr =
                browserErr ??
                fallback.error.message ??
                tryCustomers.error.message ??
                'Error leyendo customers.';
              return [];
            }
            return normalizeRows(fallback.data as unknown[]);
          }
          return normalizeRows(tryCustomers.data as unknown[]);
        };
        try {
          return await withTimeout(inner(), BROWSER_CUSTOMERS_TIMEOUT_MS, 'Supabase (customers)');
        } catch (e: unknown) {
          browserErr = browserErr ?? (e instanceof Error ? e.message : 'Error leyendo customers.');
          return [];
        }
      };

      const loadFromApi = async (): Promise<Customer[]> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
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
            fetchErr = `La API de clientes tardó más de ${API_TIMEOUT_MS / 1000}s; se usan solo los datos del navegador.`;
          } else {
            fetchErr = e instanceof Error ? e.message : 'No se pudo contactar /api/proyectos/clientes.';
          }
          return [];
        } finally {
          clearTimeout(timer);
        }
      };

      try {
        const browserRows = await loadFromBrowser();
        if (cancelled) return;

        const quick = browserRows;
        if (!cancelled) {
          setCustomers(quick);
          if (quick.length > 0) {
            setLoadingCustomers(false);
          }
        }

        if (cancelled) return;
        const apiRows = await loadFromApi();
        if (cancelled) return;

        const custRows = mergeCustomersUnionPreferBrowser(browserRows, apiRows);
        if (custRows.length === 0) {
          setCustomers([]);
          const customerMsg = browserErr ?? fetchErr ?? apiHint;
          if (customerMsg) setRefsError((prev) => prev ?? customerMsg);
        } else {
          setCustomers(custRows);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setCustomers([]);
          setRefsError((prev) => prev ?? (e instanceof Error ? e.message : 'Error cargando clientes.'));
        }
      } finally {
        setLoadingCustomers(false);
      }
    }

    async function loadBudgetRows(): Promise<void> {
      setLoadingBudgets(true);
      try {
        const { data: bData, error: be } = await supabase
          .from('budgets')
          .select('id,customer_id,customer_name,status,subtotal,created_at')
          .order('created_at', { ascending: false })
          .limit(400);
        if (cancelled) return;
        if (be) {
          setBudgets([]);
          setRefsError((prev) => prev ?? be.message ?? 'Error cargando presupuestos.');
        } else {
          setBudgets((bData ?? []) as BudgetRow[]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setBudgets([]);
          setRefsError((prev) => prev ?? (e instanceof Error ? e.message : 'Error cargando presupuestos.'));
        }
      } finally {
        setLoadingBudgets(false);
      }
    }

    void loadCustomerRows();
    void loadBudgetRows();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!budgetId) return;
    if (!budgetsFiltrados.some((b) => b.id === budgetId)) setBudgetId('');
  }, [budgetId, budgetsFiltrados]);

  useEffect(() => {
    if (!clienteMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (clienteMenuRef.current && !clienteMenuRef.current.contains(e.target as Node)) {
        setClienteMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [clienteMenuOpen]);

  const nivelesOrden = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  const fieldClass =
    'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40 disabled:opacity-50 disabled:bg-white/[0.03]';
  /** Select nativo de tabulador: más contraste en lista y valor cerrado (p. ej. Windows + tema oscuro). */
  const selectOficioClass =
    'ci-select-tabulador mt-1 w-full rounded-xl border border-zinc-500/70 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-zinc-50 placeholder:text-zinc-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/35 disabled:opacity-50';
  const sublabelOficioClass =
    'text-[10px] font-semibold uppercase tracking-wide text-zinc-300';
  const fieldReadonlyClass =
    'mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 outline-none cursor-default';
  const labelClass = 'block text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
  const labelTabuladorClass =
    'block text-[10px] font-semibold uppercase tracking-wide text-zinc-300';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = nombre.trim();
    if (!n || !fechaInicio || !fechaFin) {
      setError('Nombre del proyecto y ambas fechas son obligatorios.');
      return;
    }
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      setError('La fecha de fin debe ser igual o posterior a la de inicio.');
      return;
    }
    if (!entidadId.trim()) {
      setError('Selecciona el patrono / empresa ejecutora del proyecto.');
      return;
    }
    if (!budgetId) {
      setError('Selecciona un presupuesto ya creado (número P-…).');
      return;
    }
    const presRow = budgets.find((b) => b.id === budgetId);
    if (!presRow) {
      setError('El presupuesto seleccionado ya no está disponible. Vuelve a elegir uno.');
      return;
    }
    const presNum = Number(presRow.subtotal);
    if (!Number.isFinite(presNum) || presNum < 0) {
      setError('El presupuesto elegido no tiene un total válido.');
      return;
    }

    const diasRef = diasCalendarioInclusive(fechaInicio, fechaFin);

    let obrerosRef = 1;
    let detalleOficios: ResumenTrasCrear['detalleOficios'] = [];
    let notasPersonal: string | null = null;

    if (!omitirTabuladorPersonal) {
      const mergedPersonal = mergeCantidadPorCodigo(lineasPersonal);
      if (mergedPersonal.size === 0) {
        setError('Indica al menos un oficio del tabulador (GOE 6.752) y cuántos obreros de ese tipo necesitas.');
        return;
      }
      obrerosRef = Math.max(
        1,
        Array.from(mergedPersonal.values()).reduce((a, v) => a + v, 0),
      );
      notasPersonal = Array.from(mergedPersonal.entries())
        .map(([codigo, cant]) => {
          const c = cargoPorCodigo(codigo);
          return `${codigo} × ${cant}: ${c?.nombre ?? codigo}`;
        })
        .join('\n');

      detalleOficios = Array.from(mergedPersonal.entries())
        .map(([codigo, cantidad]) => {
          const c = cargoPorCodigo(codigo);
          if (!c) return null;
          const comp = calcularCompensacionDiaria(c.nivel);
          const costoDiarioConCesta =
            Math.round((comp.totalDiarioVES + comp.cestaTicketDiarioVES) * 100) / 100;
          const subtotal = Math.round(costoDiarioConCesta * diasRef * cantidad * 100) / 100;
          return { codigo, nombre: c.nombre, cantidad, costoDiarioConCesta, subtotal };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
    }

    setLoading(true);
    setError(null);
    setCreado(null);
    setResumen(null);

    const payload: Record<string, unknown> = {
      nombre: n,
      ubicacion: ubicacion.trim() || null,
      cliente: textoClienteObra(clienteSeleccionado),
      fecha_inicio: fechaInicio,
      fecha_entrega_prometida: fechaFin,
      estado: 'activa',
      avance_porcentaje: 0,
      penalizacion_diaria_usd: 0,
    };
    if (notasPersonal) {
      payload.notas = `Personal requerido (tabulador GOE 6.752):\n${notasPersonal}`;
    }
    payload.presupuesto_ves = presNum;
    payload.entidad_id = entidadId.trim();

    const { data, error: err } = await supabase
      .from('ci_obras')
      .insert(payload)
      .select('id,nombre,fecha_inicio,fecha_entrega_prometida,presupuesto_ves')
      .single();

    setLoading(false);
    if (err) {
      setError(
        err.message.includes('entidad_id')
          ? `${err.message} — Ejecuta la migración 071_ci_obras_entidad_patrono.sql en Supabase.`
          : err.message.includes('presupuesto_ves') || err.message.includes('column')
            ? `${err.message} — Ejecuta la migración 034 en Supabase (columna presupuesto_ves).`
            : err.message,
      );
      return;
    }
    if (data) {
      setCreado(data as InsertResult);
      setResumen({
        dias: diasRef,
        obreros: omitirTabuladorPersonal ? 0 : obrerosRef,
        filas: omitirTabuladorPersonal ? [] : filasManoObraEstimada(diasRef, obrerosRef),
        detalleOficios,
      });
    }
  }

  function irRequisicionConLineas() {
    setError(null);
    const merged = mergeCantidadPorCodigo(lineasPersonal);
    if (merged.size === 0) {
      setError('Selecciona al menos un oficio del tabulador y la cantidad.');
      return;
    }
    const items = Array.from(merged.entries()).map(([codigo, cantidad]) => ({ codigo, cantidad }));
    try {
      sessionStorage.setItem(CI_SOLICITUD_PERSONAL_PREFILL_KEY, JSON.stringify({ items }));
    } catch {
      // navegación privada / cuota: seguimos sin prefill
    }
    router.push(hrefRequisicionPersonal(proyectoModuloIdParam, proyectoObraIdParam));
  }

  if (omitirTabuladorPersonal) {
    const backHref = hrefRequisicionPersonal(proyectoModuloIdParam, proyectoObraIdParam);
    return (
      <div style={moduloProyectosPageShell}>
        <div style={moduloProyectosStickyHeader}>
          <div>
            <Link
              href={backHref}
              style={{ color: 'rgba(90,200,250,0.95)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
            >
              ← Solicitud de personal
            </Link>
            <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '8px 0 0' }}>Nuevo Personal</h1>
          </div>
          <Link
            href="/proyectos/modulo"
            className="shrink-0 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
          >
            Terminar
          </Link>
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-8 pt-2">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-lg backdrop-blur-xl">
            <label className={labelTabuladorClass}>Obreros (tabulador GOE 6.752)</label>
            <ul className="space-y-3">
              {lineasPersonal.map((linea) => (
                <li
                  key={linea.id}
                  className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                >
                  <div className="min-w-0 flex-1 sm:min-w-[220px]">
                    <span className={sublabelOficioClass}>Oficio</span>
                    <select
                      value={linea.cargoCodigo}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLineasPersonal((prev) =>
                          prev.map((l) => (l.id === linea.id ? { ...l, cargoCodigo: v } : l)),
                        );
                      }}
                      className={selectOficioClass}
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="" className="bg-zinc-950 text-zinc-100">
                        — Selecciona oficio —
                      </option>
                      {nivelesOrden.map((nv) => {
                        const lista = gruposTabulador.get(nv);
                        if (!lista?.length) return null;
                        return (
                          <optgroup key={nv} label={`Nivel ${nv}`}>
                            {lista.map((c) => (
                              <option
                                key={c.codigo}
                                value={c.codigo}
                                className="bg-zinc-950 text-zinc-100"
                              >
                                {c.codigo} — {c.nombre}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div className="w-full sm:w-28">
                    <span className={sublabelOficioClass}>Cantidad</span>
                    <input
                      type="number"
                      min={1}
                      value={linea.cantidad}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLineasPersonal((prev) =>
                          prev.map((l) => (l.id === linea.id ? { ...l, cantidad: v } : l)),
                        );
                      }}
                      className={`${fieldClass} mt-1 text-zinc-50`}
                    />
                  </div>
                  {lineasPersonal.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setLineasPersonal((prev) => prev.filter((l) => l.id !== linea.id))}
                      className="text-[11px] text-zinc-400 underline decoration-zinc-500 underline-offset-2 hover:text-zinc-200"
                    >
                      Quitar fila
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLineasPersonal((prev) => [...prev, nuevaLineaPersonal()])}
                className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => void irRequisicionConLineas()}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Solicitar otro obrero
              </button>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={moduloProyectosPageShell}>
      <div style={moduloProyectosStickyHeader}>
        <div>
          <Link
            href="/reclutamiento/dashboard"
            style={{ color: 'rgba(90,200,250,0.95)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}
          >
            ← Reclutamiento
          </Link>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 800, margin: '8px 0 0' }}>Nuevo proyecto</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: '4px 0 0' }}>
            Talento · obra para vacantes y finanzas
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-8 pt-2">
        <p className="mb-4 text-[13px] leading-relaxed text-zinc-400">
          Registra la obra aquí para vincular vacantes y abrir el análisis de costos. Es distinto del{' '}
          <Link href="/proyectos/modulo/nuevo" className="font-semibold text-sky-400 hover:text-sky-300">
            módulo integral
          </Link>{' '}
          (presupuestos y clientes).
        </p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-lg backdrop-blur-xl"
        >
          <div>
            <label className={labelClass}>Nombre del proyecto *</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={fieldClass}
              placeholder="Ej. Torre B — Domótica"
            />
          </div>
          <div>
            <label className={labelClass}>Ubicación</label>
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              className={fieldClass}
              placeholder="Dirección o ciudad"
            />
          </div>

          <div>
            <label className={labelClass}>Patrono / empresa ejecutora *</label>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              Quien contrata o ejecuta la obra (razón social).{' '}
              <Link href="/configuracion/entidades" className="font-semibold text-sky-400 hover:text-sky-300">
                Gestionar entidades
              </Link>
            </p>
            <select
              required
              value={entidadId}
              onChange={(e) => setEntidadId(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className={fieldClass}
            >
              <option value="">— Selecciona patrono —</option>
              {entidades.map((en) => (
                <option key={en.id} value={en.id} className="bg-zinc-900 text-white">
                  {en.nombre}
                  {en.rif ? ` · ${en.rif}` : ''}
                </option>
              ))}
            </select>
            {entidadesHint ? <p className="mt-1 text-[11px] text-amber-300/95">{entidadesHint}</p> : null}
          </div>

          <div ref={clienteMenuRef} className="relative">
            <label className={labelClass}>Cliente</label>
            <button
              type="button"
              disabled={loadingCustomers}
              onClick={() => setClienteMenuOpen((o) => !o)}
              className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-white shadow-sm hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0 truncate">
                {loadingCustomers
                  ? 'Cargando clientes…'
                  : clienteSeleccionado
                    ? `${etiquetaCliente(clienteSeleccionado)}${rifCliente(clienteSeleccionado) ? ` · ${rifCliente(clienteSeleccionado)}` : ''}`
                    : 'Selecciona un cliente (opcional)…'}
              </span>
              <span className="shrink-0 text-zinc-500" aria-hidden>
                {clienteMenuOpen ? '▲' : '▼'}
              </span>
            </button>
            {!loadingCustomers && customers.length === 0 ? (
              <p className="mt-1 text-xs text-amber-300/95">
                No se listaron clientes. Revisa{' '}
                <code className="rounded bg-amber-500/15 px-1 text-amber-200">.env.local</code> o crea uno en{' '}
                <Link href="/clientes" className="font-semibold text-sky-400 underline hover:text-sky-300">
                  Clientes
                </Link>
                .
                {refsError ? <span className="mt-1 block text-amber-200/80">{refsError}</span> : null}
              </p>
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
                    }}
                  >
                    — Sin cliente —
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
            <label className={labelClass}>Presupuesto ya existente *</label>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              Elige por <strong className="text-zinc-400">número</strong> (P-…). Los montos salen del presupuesto en{' '}
              <Link href="/presupuestos" className="font-semibold text-sky-400 hover:text-sky-300">
                Presupuestos
              </Link>
              ; en la obra se copia el subtotal (USD) al campo de referencia{' '}
              <code className="rounded bg-white/10 px-1 text-zinc-300">presupuesto_ves</code>.
            </p>
            <select
              required
              value={budgetId}
              onChange={(e) => {
                const id = e.target.value;
                setBudgetId(id);
                if (!id) return;
                const row = budgets.find((b) => b.id === id);
                const cid = row?.customer_id ? String(row.customer_id) : '';
                if (cid && !customerId) setCustomerId(cid);
              }}
              disabled={loadingBudgets}
              style={{ colorScheme: 'dark' }}
              className={`${fieldClass} disabled:cursor-not-allowed`}
            >
              <option value="">
                {loadingBudgets ? 'Cargando presupuestos…' : '— Selecciona número de presupuesto —'}
              </option>
              {budgetsFiltrados.map((b) => (
                <option key={b.id} value={b.id} className="bg-zinc-900 text-white">
                  {numeroPresupuesto(b)} · {(b.customer_name || 'Sin cliente').trim()} · {b.status}
                </option>
              ))}
            </select>
            {!loadingBudgets && customerId && budgetsFiltrados.length === 0 ? (
              <p className="mt-1 text-xs text-amber-300/95">
                No hay presupuestos para este cliente. Crea uno en{' '}
                <Link href="/presupuestos" className="font-semibold text-sky-400 underline hover:text-sky-300">
                  Presupuestos
                </Link>
                .
              </p>
            ) : null}
            {!loadingBudgets && !customerId && budgets.length === 0 ? (
              <p className="mt-1 text-xs text-amber-300/95">
                No se cargaron presupuestos. Revisa permisos o crea uno en{' '}
                <Link href="/presupuestos" className="font-semibold text-sky-400 underline hover:text-sky-300">
                  Presupuestos
                </Link>
                .
              </p>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Número (según selección)</label>
                <input
                  readOnly
                  tabIndex={-1}
                  aria-live="polite"
                  value={presupuestoSeleccionado ? numeroPresupuesto(presupuestoSeleccionado) : ''}
                  placeholder="—"
                  className={fieldReadonlyClass}
                />
              </div>
              <div>
                <label className={labelClass}>Monto del presupuesto (USD)</label>
                <input
                  readOnly
                  tabIndex={-1}
                  aria-live="polite"
                  value={
                    presupuestoSeleccionado
                      ? `$${formatUSD(Number(presupuestoSeleccionado.subtotal))}`
                      : ''
                  }
                  placeholder="—"
                  className={`${fieldReadonlyClass} font-mono`}
                />
              </div>
            </div>
            {presupuestoSeleccionado ? (
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Ese monto es el que se guardará en la obra al crear el proyecto.
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Fecha de inicio *</label>
              <input
                required
                type="date"
                autoComplete="off"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={fieldClass}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha de entrega *</label>
              <input
                required
                type="date"
                autoComplete="off"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className={fieldClass}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500 -mt-1">
            Indica inicio y entrega con el calendario: las eliges tú a mano;{' '}
            <strong className="font-medium text-zinc-400">no se toman del presupuesto ni del cliente</strong>.
          </p>
          {omitirTabuladorPersonal ? null : (
          <div className="space-y-3">
            <label className={labelTabuladorClass}>Personal obrero requerido (tabulador GOE 6.752) *</label>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Por cada fila elige el oficio según el tabulador de la convención y la cantidad de obreros de ese tipo.
              Puedes añadir varias filas si necesitas varios oficios.
            </p>
            <ul className="space-y-3">
              {lineasPersonal.map((linea) => (
                <li
                  key={linea.id}
                  className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                >
                  <div className="min-w-0 flex-1 sm:min-w-[220px]">
                    <span className={sublabelOficioClass}>Oficio</span>
                    <select
                      value={linea.cargoCodigo}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLineasPersonal((prev) =>
                          prev.map((l) => (l.id === linea.id ? { ...l, cargoCodigo: v } : l)),
                        );
                      }}
                      className={selectOficioClass}
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="" className="bg-zinc-950 text-zinc-100">
                        — Selecciona oficio —
                      </option>
                      {nivelesOrden.map((nv) => {
                        const lista = gruposTabulador.get(nv);
                        if (!lista?.length) return null;
                        return (
                          <optgroup key={nv} label={`Nivel ${nv}`}>
                            {lista.map((c) => (
                              <option
                                key={c.codigo}
                                value={c.codigo}
                                className="bg-zinc-950 text-zinc-100"
                              >
                                {c.codigo} — {c.nombre}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div className="w-full sm:w-28">
                    <span className={sublabelOficioClass}>Cantidad</span>
                    <input
                      type="number"
                      min={1}
                      value={linea.cantidad}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLineasPersonal((prev) =>
                          prev.map((l) => (l.id === linea.id ? { ...l, cantidad: v } : l)),
                        );
                      }}
                      className={`${fieldClass} mt-1 text-zinc-50`}
                    />
                  </div>
                  {lineasPersonal.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setLineasPersonal((prev) => prev.filter((l) => l.id !== linea.id))}
                      className="text-[11px] text-zinc-400 underline decoration-zinc-500 underline-offset-2 hover:text-zinc-200"
                    >
                      Quitar fila
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setLineasPersonal((prev) => [...prev, nuevaLineaPersonal()])}
              className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
            >
              Añadir otro oficio
            </button>
            <p className="text-xs text-zinc-500">
              Resumen orientativo: {totalObrerosPreview} plaza(s) total · {diasPreview} día(s) calendario (inicio a
              entrega).
            </p>
          </div>
          )}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || loadingCustomers || loadingBudgets}
            className="rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0062CC] disabled:opacity-50"
          >
            {loading ? 'Guardando…' : 'Crear proyecto'}
          </button>
        </form>

        {creado && resumen ? (
          <section className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-6 shadow-lg backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white">Proyecto creado</h2>
            <p className="text-sm text-zinc-400">
              <span className="font-medium text-zinc-100">{creado.nombre}</span>
              {creado.presupuesto_ves != null ? (
                <>
                  {' '}
                  · Total desde presupuesto:{' '}
                  <span className="font-mono text-zinc-200">${formatUSD(Number(creado.presupuesto_ves))}</span>
                </>
              ) : null}
            </p>
            <p className="text-xs text-zinc-500">
              ID (vacantes / API):{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-200">{creado.id}</code>
            </p>

            {resumen.detalleOficios.length > 0 ? (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Costo de mano de obra estimado
                </h3>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  Total plazas solicitadas: {resumen.obreros} · {resumen.dias} día(s) calendario. La tabla siguiente
                  desglosa por oficio del tabulador; la de referencia por niveles 1 / 5 / 9 es orientativa (misma
                  dotación total). Incluye remuneración diaria (SB + bono Cl. 41) + cesta ticket por defecto.
                </p>
                <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="p-3">Código</th>
                        <th className="p-3">Oficio</th>
                        <th className="p-3 text-right">Cant.</th>
                        <th className="p-3 text-right">VES / obrero / día</th>
                        <th className="p-3 text-right">Subtotal (VES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.detalleOficios.map((d) => (
                        <tr key={d.codigo} className="border-t border-white/10">
                          <td className="p-3 font-mono text-zinc-200">{d.codigo}</td>
                          <td className="p-3 text-zinc-100">{d.nombre}</td>
                          <td className="p-3 text-right font-mono text-zinc-300">{d.cantidad}</td>
                          <td className="p-3 text-right font-mono text-zinc-300">
                            {formatoVES(d.costoDiarioConCesta)}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-white">
                            {formatoVES(d.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h4 className="mt-5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Banda de referencia (niveles 1 · 5 · 9)
                </h4>
                <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="p-3">Referencia nivel</th>
                        <th className="p-3 text-right">VES / obrero / día</th>
                        <th className="p-3 text-right">Subtotal estimado (VES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.filas.map((f) => (
                        <tr key={f.nivel} className="border-t border-white/10">
                          <td className="p-3">
                            <span className="font-medium text-zinc-100">{f.etiqueta}</span>
                          </td>
                          <td className="p-3 text-right font-mono text-zinc-300">
                            {formatoVES(f.costoDiarioConCestaPorObrero)}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-white">
                            {formatoVES(f.subtotalEstimado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Link
                href="/reclutamiento/dashboard"
                className="inline-flex rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0062CC]"
              >
                Ir a vacantes
              </Link>
              <Link
                href={`/proyectos/${creado.id}/finanzas`}
                className="inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Análisis de costos
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function ProyectoNuevoPage() {
  return (
    <Suspense
      fallback={
        <div
          style={moduloProyectosPageShell}
          className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-400"
        >
          Cargando…
        </div>
      }
    >
      <ProyectoNuevoPageContent />
    </Suspense>
  );
}
