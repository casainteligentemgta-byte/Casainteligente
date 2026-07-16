'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HardHat, Plus, Send, Trash2, UserSquare2, Users } from 'lucide-react';
import { CATALOGO_OBREROS } from '@/lib/reclutamiento/catalogoObreros';
import { CATALOGO_EMPLEADOS } from '@/lib/reclutamiento/catalogoEmpleados';
import { metaDesdeCargoCatalogo } from '@/lib/reclutamiento/cargoMetaCatalogo';
import { cargoPorCodigo } from '@/lib/constants/cargosObreros';
import {
  etiquetaFuenteProyecto,
  loadOpcionesProyectoReclutamiento,
} from '@/lib/proyectos/proyectosUnificados';
import { createClient } from '@/lib/supabase/client';
import { apiUrl, assertHttpOrigin } from '@/lib/http/apiUrl';

type TipoPersonal = 'obrero' | 'empleado';

type ProyectoOption = {
  key: string;
  etiqueta: string;
  proyectoModuloId: string | null;
  proyectoObraId: string | null;
};

type LineaObrero = {
  kind: 'obrero';
  departamento: string;
  cargo: string;
  cantidad: number;
  cargoCodigo: string;
  cargoNombre: string;
  cargoNivel: number;
  tipoVacante: 'obrero_basico' | 'obrero_especializado';
};

type LineaEmpleado = {
  kind: 'empleado';
  cargoCodigo: string;
  cargoNombre: string;
  cantidad: number;
};

type LineaLista = LineaObrero | LineaEmpleado;

const CI_SOLICITUD_PERSONAL_PREFILL_KEY = 'ci_solicitud_personal_prefill';

function parseCargoObrero(value: string): { departamento: string; cargo: string } | null {
  const [departamento, cargo] = value.split('|||');
  if (!departamento || !cargo) return null;
  return { departamento, cargo };
}

/** Acorta mensajes de error muy largos (el detalle viene ya de la API). */
function mensajeErrorGuardadoPlaza(raw: string | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return 'No se pudo guardar esta plaza.';
  return s.length > 500 ? `${s.slice(0, 500)}…` : s;
}

export type ConstructorRequisicionProps = {
  /** UUID de `ci_proyectos` (p. ej. desde ?proyecto_modulo_id= al crear proyecto). */
  initialProyectoModuloId?: string | null;
  /** UUID de fila Talento en `ci_proyectos` (antes ci_obras), p. ej. ?proyecto_id=. */
  initialProyectoObraId?: string | null;
};

export function ConstructorRequisicion({
  initialProyectoModuloId = null,
  initialProyectoObraId = null,
}: ConstructorRequisicionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [tipoPersonal, setTipoPersonal] = useState<TipoPersonal>('obrero');
  const [proyectos, setProyectos] = useState<ProyectoOption[]>([]);
  const [cargandoProyectos, setCargandoProyectos] = useState(true);
  const [errorProyectos, setErrorProyectos] = useState<string | null>(null);
  const [proyectoKey, setProyectoKey] = useState('');

  const [lista, setLista] = useState<LineaLista[]>([]);
  const prefillDesdeNuevoPersonalHecho = useRef(false);

  const [cargoObreroValue, setCargoObreroValue] = useState('');
  const [empleadoSelect, setEmpleadoSelect] = useState('');
  const [empleadoOtroCodigo, setEmpleadoOtroCodigo] = useState('');
  const [empleadoOtroNombre, setEmpleadoOtroNombre] = useState('');

  const [cantidad, setCantidad] = useState(1);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [exitoEnvio, setExitoEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setCargandoProyectos(true);
      setErrorProyectos(null);
      try {
        const { opciones, errors } = await loadOpcionesProyectoReclutamiento(supabase);
        if (!alive) return;
        let opts: ProyectoOption[] = opciones.map((o) => ({
          key: o.key,
          etiqueta: o.etiqueta,
          proyectoModuloId: o.proyectoModuloId,
          proyectoObraId: o.proyectoObraId,
        }));

        const wantM = initialProyectoModuloId?.trim() ?? '';
        const wantO = initialProyectoObraId?.trim() ?? '';

        /** Si el proyecto de la URL no entra en el límite del listado, las vacantes se guardaban en otro ítem del select. */
        if (wantM && !opts.some((o) => o.proyectoModuloId === wantM)) {
          const { data: row } = await supabase.from('ci_proyectos').select('id,nombre').eq('id', wantM).maybeSingle();
          if (!alive) return;
          if (row && typeof (row as { id?: unknown }).id === 'string') {
            const r = row as { id: string; nombre?: string | null };
            const nombre = String(r.nombre ?? '').trim() || 'Sin nombre';
            opts = [
              {
                key: `i:${r.id}`,
                etiqueta: `${nombre} · ${etiquetaFuenteProyecto('integral')}`,
                proyectoModuloId: r.id,
                proyectoObraId: null,
              },
              ...opts,
            ];
          }
        }
        if (wantO && !opts.some((o) => o.proyectoObraId === wantO)) {
          const q0 = await supabase
            .from('ci_proyectos')
            .select('id,nombre')
            .eq('id', wantO)
            .maybeSingle();
          const row =
            q0.error && (q0.error.message ?? '').toLowerCase().includes('tipo_proyecto')
              ? (await supabase.from('ci_proyectos').select('id,nombre').eq('id', wantO).maybeSingle()).data
              : q0.data;
          if (!alive) return;
          if (row && typeof (row as { id?: unknown }).id === 'string') {
            const r = row as { id: string; nombre?: string | null };
            const nombre = String(r.nombre ?? '').trim() || 'Sin nombre';
            opts = [
              {
                key: `t:${r.id}`,
                etiqueta: `${nombre} · ${etiquetaFuenteProyecto('talento')}`,
                proyectoModuloId: null,
                proyectoObraId: r.id,
              },
              ...opts,
            ];
          }
        }

        for (const msg of errors) {
          setErrorProyectos((e) => e ?? msg);
        }
        setProyectos(opts);
        let nextKey = opts[0]?.key ?? '';
        if (wantM) {
          const hit = opts.find((o) => o.proyectoModuloId === wantM);
          if (hit) nextKey = hit.key;
        } else if (wantO) {
          const hit = opts.find((o) => o.proyectoObraId === wantO);
          if (hit) nextKey = hit.key;
        }
        setProyectoKey(nextKey);
      } catch (e) {
        if (alive) {
          setErrorProyectos(e instanceof Error ? e.message : 'Error cargando proyectos.');
          setProyectos([]);
        }
      } finally {
        if (alive) setCargandoProyectos(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase, initialProyectoModuloId, initialProyectoObraId]);

  useEffect(() => {
    if (cargandoProyectos || prefillDesdeNuevoPersonalHecho.current) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(CI_SOLICITUD_PERSONAL_PREFILL_KEY);
    } catch {
      return;
    }
    if (!raw?.trim()) return;

    let parsed: { items?: Array<{ codigo?: string; cantidad?: unknown }> };
    try {
      parsed = JSON.parse(raw) as { items?: Array<{ codigo?: string; cantidad?: unknown }> };
    } catch {
      return;
    }
    const items = parsed.items;
    if (!Array.isArray(items) || items.length === 0) {
      prefillDesdeNuevoPersonalHecho.current = true;
      try {
        sessionStorage.removeItem(CI_SOLICITUD_PERSONAL_PREFILL_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const nuevas: LineaObrero[] = [];
    for (const it of items) {
      const cod = String(it.codigo ?? '').trim();
      if (!cod) continue;
      const cant = Math.max(1, Math.floor(Number(it.cantidad) || 1));
      const c = cargoPorCodigo(cod);
      if (!c) continue;
      const departamento = `Grupo ${c.nivel}`;
      const cargo = `${c.codigo} ${c.nombre}`;
      const meta = metaDesdeCargoCatalogo(departamento, cargo);
      if (!meta) continue;
      nuevas.push({
        kind: 'obrero',
        departamento,
        cargo,
        cantidad: cant,
        cargoCodigo: meta.cargoCodigo,
        cargoNombre: meta.cargoNombre,
        cargoNivel: meta.cargoNivel,
        tipoVacante: meta.tipoVacante,
      });
    }

    prefillDesdeNuevoPersonalHecho.current = true;
    try {
      sessionStorage.removeItem(CI_SOLICITUD_PERSONAL_PREFILL_KEY);
    } catch {
      /* ignore */
    }
    if (nuevas.length === 0) return;
    setLista((prev) => [...prev, ...nuevas]);
  }, [cargandoProyectos]);

  const proyectoSel = useMemo(() => proyectos.find((p) => p.key === proyectoKey) ?? null, [proyectos, proyectoKey]);

  const departamentosOrdenados = useMemo(() => {
    const set = new Set<string>();
    for (const row of CATALOGO_OBREROS) set.add(row.departamento);
    return Array.from(set).sort((a, b) => {
      const na = /^Grupo\s+(\d+)/i.exec(a)?.[1];
      const nb = /^Grupo\s+(\d+)/i.exec(b)?.[1];
      if (na && nb) return parseInt(na, 10) - parseInt(nb, 10);
      return a.localeCompare(b, 'es');
    });
  }, []);

  const totalVacantes = useMemo(() => lista.reduce((acc, row) => acc + row.cantidad, 0), [lista]);

  const agregarLinea = useCallback(() => {
    setErrorForm(null);
    setExitoEnvio(null);
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n < 1) {
      setErrorForm('La cantidad debe ser al menos 1.');
      return;
    }

    if (tipoPersonal === 'obrero') {
      const parsed = cargoObreroValue ? parseCargoObrero(cargoObreroValue) : null;
      if (!parsed) {
        setErrorForm('Selecciona un cargo de obra de la lista.');
        return;
      }
      const meta = metaDesdeCargoCatalogo(parsed.departamento, parsed.cargo);
      if (!meta) {
        setErrorForm('No se pudo derivar el código de oficio del cargo (debe coincidir con el tabulador, ej. 5.1 …).');
        return;
      }
      setLista((prev) => [
        ...prev,
        {
          kind: 'obrero',
          departamento: parsed.departamento,
          cargo: parsed.cargo,
          cantidad: n,
          cargoCodigo: meta.cargoCodigo,
          cargoNombre: meta.cargoNombre,
          cargoNivel: meta.cargoNivel,
          tipoVacante: meta.tipoVacante,
        },
      ]);
      setCantidad(1);
      return;
    }

    if (empleadoSelect === 'OTRO') {
      const cod = empleadoOtroCodigo.trim().toUpperCase().replace(/\s+/g, '-');
      const nom = empleadoOtroNombre.trim();
      if (!nom || cod.length < 3) {
        setErrorForm('Para «Otro cargo»: indica nombre del puesto y un código interno (mín. 3 caracteres, ej. ADM-AUX-1).');
        return;
      }
      setLista((prev) => [...prev, { kind: 'empleado', cargoCodigo: cod.slice(0, 40), cargoNombre: nom, cantidad: n }]);
    } else {
      const row = CATALOGO_EMPLEADOS.find((x) => `${x.codigo}|||${x.nombre}` === empleadoSelect);
      if (!row) {
        setErrorForm('Selecciona un cargo de empleado / administrativo.');
        return;
      }
      setLista((prev) => [
        ...prev,
        { kind: 'empleado', cargoCodigo: row.codigo, cargoNombre: row.nombre, cantidad: n },
      ]);
    }
    setCantidad(1);
  }, [tipoPersonal, cargoObreroValue, cantidad, empleadoSelect, empleadoOtroCodigo, empleadoOtroNombre]);

  const quitarLinea = useCallback((index: number) => {
    setLista((prev) => prev.filter((_, i) => i !== index));
    setExitoEnvio(null);
  }, []);

  const enviarARRHH = useCallback(async () => {
    setErrorEnvio(null);
    setExitoEnvio(null);
    const originErr = assertHttpOrigin();
    if (originErr) {
      setErrorEnvio(originErr);
      return;
    }
    if (lista.length === 0) {
      setErrorEnvio('Agrega al menos una línea (obrero o empleado) antes de enviar.');
      return;
    }
    if (!proyectoSel) {
      setErrorEnvio('Selecciona un proyecto u obra donde aplica la requisición (o crea uno en Proyectos).');
      return;
    }

    setEnviando(true);
    let creadas = 0;
    const fallos: string[] = [];

    try {
      for (const item of lista) {
        for (let i = 0; i < item.cantidad; i++) {
          const suf = item.cantidad > 1 ? ` (${i + 1}/${item.cantidad})` : '';
          let title: string;
          let notes: string;
          let body: Record<string, unknown>;

          if (item.kind === 'obrero') {
            title = `${item.cargoNombre}${suf} — ${proyectoSel.etiqueta}`;
            notes = `Requisición (obrero). ${item.departamento}. Bloque constructor RRHH.`;
            body = {
              title,
              notes,
              cargo_codigo: item.cargoCodigo,
              cargo_nombre: item.cargoNombre,
              cargo_nivel: item.cargoNivel,
              tipo_vacante: item.tipoVacante,
              ...(proyectoSel.proyectoObraId
                ? { proyecto_id: proyectoSel.proyectoObraId }
                : { proyecto_modulo_id: proyectoSel.proyectoModuloId }),
            };
          } else {
            title = `${item.cargoNombre}${suf} — ${proyectoSel.etiqueta}`;
            notes = `Requisición (empleado / administrativo). Código: ${item.cargoCodigo}. Bloque constructor RRHH.`;
            body = {
              title,
              notes,
              cargo_codigo: item.cargoCodigo,
              cargo_nombre: item.cargoNombre,
              cargo_nivel: 1,
              tipo_vacante: 'empleado',
              ...(proyectoSel.proyectoObraId
                ? { proyecto_id: proyectoSel.proyectoObraId }
                : { proyecto_modulo_id: proyectoSel.proyectoModuloId }),
            };
          }

          let res: Response;
          try {
            res = await fetch(apiUrl('/api/recruitment/needs'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
          } catch {
            fallos.push('Sin conexión con el servidor (¿`npm run dev` activo?).');
            continue;
          }
          const raw = await res.text();
          let data: { id?: string; error?: string; hint?: string } = {};
          try {
            data = raw ? (JSON.parse(raw) as typeof data) : {};
          } catch {
            fallos.push(`HTTP ${res.status}: respuesta no JSON.`);
            continue;
          }
          if (!res.ok) {
            fallos.push(mensajeErrorGuardadoPlaza(data.error ?? data.hint ?? `Error HTTP ${res.status}`));
            continue;
          }
          if (data.id) creadas += 1;
        }
      }

      if (creadas === 0) {
        setErrorEnvio(
          fallos[0]
            ? mensajeErrorGuardadoPlaza(fallos[0])
            : 'No se pudo registrar ninguna plaza. Revisa la conexión e inténtalo de nuevo.',
        );
        return;
      }
      const sol =
        creadas === 1
          ? 'Se registró 1 solicitud de personal'
          : `Se registraron ${creadas} solicitudes de personal`;
      const plz =
        totalVacantes === 1 ? '1 plaza en total' : `${totalVacantes} plazas en total`;
      setExitoEnvio(
        `${sol} (${plz}).` +
          (fallos.length
            ? ` Avisos: ${fallos.slice(0, 3).map((f) => mensajeErrorGuardadoPlaza(f)).join(' · ')}`
            : ''),
      );
      setLista([]);
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'Error al enviar la requisición.');
    } finally {
      setEnviando(false);
    }
  }, [lista, proyectoSel, totalVacantes]);

  return (
    <div
      className="animate-in fade-in fill-mode-forwards duration-300 mx-auto w-full max-w-6xl px-4 py-6 text-white"
      style={{ backgroundColor: '#0A0A0F' }}
    >
      <header className="mb-8 flex flex-wrap items-center gap-3 border-b border-white/10 pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <Users className="h-6 w-6 text-[#FFD60A]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">Primer requerimiento de personal</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Elige proyecto u obra, <strong className="text-zinc-200">obreros</strong> o{' '}
            <strong className="text-zinc-200">empleado administrativo</strong>, y registra cuando la lista esté lista.
          </p>
        </div>
      </header>

      {errorProyectos ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
          {errorProyectos}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5 shadow-lg backdrop-blur-xl transition-shadow hover:shadow-[0_0_24px_rgba(255,214,10,0.08)] md:p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#FF9500]">Datos de la solicitud</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTipoPersonal('obrero');
                setErrorForm(null);
              }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                tipoPersonal === 'obrero'
                  ? 'border-[#FF9500]/60 bg-[#FF9500]/15 text-[#FFD60A]'
                  : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
              }`}
            >
              <HardHat className="h-4 w-4" aria-hidden />
              Obrero (oficio / obra)
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoPersonal('empleado');
                setErrorForm(null);
              }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                tipoPersonal === 'empleado'
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                  : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
              }`}
            >
              <UserSquare2 className="h-4 w-4" aria-hidden />
              Empleado (administrativo)
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">Proyecto u obra *</span>
              <select
                value={proyectoKey}
                onChange={(e) => setProyectoKey(e.target.value)}
                disabled={cargandoProyectos || proyectos.length === 0}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-[#FF9500]/30 transition focus:ring-2 disabled:opacity-50"
              >
                {proyectos.length === 0 ? (
                  <option value="">No hay proyectos — crea uno en /proyectos/modulo o /proyectos/nuevo</option>
                ) : (
                  proyectos.map((p) => (
                    <option key={p.key} value={p.key} className="bg-zinc-900">
                      {p.etiqueta}
                    </option>
                  ))
                )}
              </select>
            </label>

            {tipoPersonal === 'obrero' ? (
              <label className="grid gap-1.5 text-sm">
                <span className="text-zinc-400">Cargo de obra (tabulador)</span>
                <select
                  value={cargoObreroValue}
                  onChange={(e) => setCargoObreroValue(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-[#FF9500]/30 transition focus:ring-2"
                >
                  <option value="" className="bg-zinc-900">
                    — Selecciona cargo —
                  </option>
                  {departamentosOrdenados.map((dept) => (
                    <optgroup key={dept} label={dept}>
                      {CATALOGO_OBREROS.filter((c) => c.departamento === dept).map((c) => {
                        const v = `${c.departamento}|||${c.cargo}`;
                        return (
                          <option key={v} value={v} className="bg-zinc-900">
                            {c.cargo}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-zinc-400">Cargo empleado / administrativo</span>
                  <select
                    value={empleadoSelect}
                    onChange={(e) => setEmpleadoSelect(e.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-sky-500/30 transition focus:ring-2"
                  >
                    <option value="" className="bg-zinc-900">
                      — Selecciona —
                    </option>
                    {CATALOGO_EMPLEADOS.map((c) => (
                      <option key={c.codigo} value={`${c.codigo}|||${c.nombre}`} className="bg-zinc-900">
                        {c.nombre}
                      </option>
                    ))}
                    <option value="OTRO" className="bg-zinc-900">
                      Otro (definir nombre y código)
                    </option>
                  </select>
                </label>
                {empleadoSelect === 'OTRO' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-zinc-400">Nombre del puesto *</span>
                      <input
                        value={empleadoOtroNombre}
                        onChange={(e) => setEmpleadoOtroNombre(e.target.value)}
                        placeholder="Ej. Auxiliar de gerencia general"
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-sky-500/30 focus:ring-2"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-zinc-400">Código interno *</span>
                      <input
                        value={empleadoOtroCodigo}
                        onChange={(e) => setEmpleadoOtroCodigo(e.target.value)}
                        placeholder="Ej. ADM-AUX-GG"
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-sky-500/30 focus:ring-2"
                      />
                    </label>
                  </div>
                ) : null}
              </>
            )}

            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">Cantidad de plazas (esta línea)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-[#FF9500]/30 transition focus:ring-2"
              />
            </label>

            {errorForm ? <p className="text-sm text-red-400">{errorForm}</p> : null}

            <button
              type="button"
              onClick={agregarLinea}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF9500]/50 bg-white/5 px-4 py-3 text-sm font-semibold text-[#FFD60A] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition hover:border-[#FFD60A]/70 hover:bg-[#FF9500]/10 hover:text-white active:scale-[0.99]"
            >
              <Plus className="h-4 w-4 transition group-hover:rotate-90" aria-hidden />
              Añadir a la lista
            </button>
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-white/10 bg-zinc-950/60 shadow-lg backdrop-blur-xl md:min-h-[420px]">
          <div className="border-b border-white/10 p-5 md:p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#FF9500]">Resumen</h2>
          </div>

          <ul className="flex-1 space-y-2 overflow-y-auto p-4 md:p-5" aria-live="polite">
            {lista.length === 0 ? (
              <li className="animate-in fade-in duration-300 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center text-sm text-zinc-500">
                Aún no hay líneas. Elige obrero o empleado, completa el cargo y pulsa «Añadir a la lista».
              </li>
            ) : (
              lista.map((item, index) => (
                <li
                  key={`${item.kind}-${index}-${item.cargoNombre}`}
                  className="animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards duration-300 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3"
                  style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      {item.kind === 'obrero' ? 'Obrero' : 'Empleado'}
                    </p>
                    <p className="truncate font-medium text-white">
                      <span className="text-[#FFD60A]">{item.cantidad}×</span>{' '}
                      {item.kind === 'obrero' ? item.cargo : item.cargoNombre}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {item.kind === 'obrero' ? item.departamento : `${item.cargoCodigo} · administrativo`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarLinea(index)}
                    className="shrink-0 rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300"
                    aria-label="Quitar línea"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>

          <footer className="mt-auto space-y-3 border-t border-white/10 p-5 md:p-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Total plazas (suma de cantidades)</span>
              <span className="text-lg font-bold tabular-nums text-[#FFD60A]">{totalVacantes}</span>
            </div>
            {errorEnvio ? <p className="text-sm text-red-400">{errorEnvio}</p> : null}
            {exitoEnvio ? <p className="text-sm text-emerald-400">{exitoEnvio}</p> : null}
            <button
              type="button"
              disabled={enviando || lista.length === 0 || !proyectoSel || cargandoProyectos}
              onClick={() => void enviarARRHH()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFD60A] via-[#FFB020] to-[#FF9500] px-4 py-4 text-base font-bold text-[#0A0A0F] shadow-[0_0_15px_rgba(249,115,22,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              {enviando ? (
                <>Registrando…</>
              ) : (
                <>
                  <Send className="h-5 w-5" aria-hidden />
                  Registrar requisición en sistema
                </>
              )}
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}

export default ConstructorRequisicion;
