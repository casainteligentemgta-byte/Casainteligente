'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HardHat, Plus, Trash2 } from 'lucide-react';
import {
  CARGOS_OBREROS,
  cargoPorCodigo,
  cargosAgrupadosPorNivel,
} from '@/lib/constants/cargosObreros';
import { loadOpcionesProyectoReclutamiento } from '@/lib/proyectos/proyectosUnificados';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export type SolicitudPersonalObreroFormProps = {
  initialProyectoModuloId?: string | null;
  initialProyectoObraId?: string | null;
  onCreada?: () => void;
};

type LineaPersonal = {
  id: string;
  cargoCodigo: string;
  cantidad: string;
};

const NIVELES_ORDEN = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const selectOficioClass =
  'ci-select-tabulador mt-1 w-full min-h-[44px] cursor-pointer rounded-xl border-2 border-zinc-500/80 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-zinc-50 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/35 disabled:cursor-not-allowed disabled:opacity-50';
const selectProyectoClass =
  'ci-select-tabulador mt-1 w-full min-h-[44px] cursor-pointer rounded-xl border-2 border-violet-500/50 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-zinc-50 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/35 disabled:cursor-not-allowed disabled:opacity-50';
const inputCantidadClass =
  'mt-1 w-full min-h-[44px] rounded-xl border-2 border-zinc-500/80 bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-zinc-50 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/35';
const sublabelClass = 'text-[10px] font-bold uppercase tracking-wide text-zinc-300';

let lineaSeq = 0;
function nuevaLinea(): LineaPersonal {
  lineaSeq += 1;
  return { id: `linea-${lineaSeq}-${Date.now()}`, cargoCodigo: '', cantidad: '1' };
}

function proyectoKeyDesdeIds(moduloId: string | null, obraId: string | null): string {
  if (obraId) return `t:${obraId}`;
  if (moduloId) return `i:${moduloId}`;
  return '';
}

export default function SolicitudPersonalObreroForm({
  initialProyectoModuloId = null,
  initialProyectoObraId = null,
  onCreada,
}: SolicitudPersonalObreroFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const gruposTabulador = useMemo(() => cargosAgrupadosPorNivel(CARGOS_OBREROS), []);

  const [proyectoKey, setProyectoKey] = useState('');
  const [lineas, setLineas] = useState<LineaPersonal[]>(() => [nuevaLinea()]);
  const [opciones, setOpciones] = useState<
    Awaited<ReturnType<typeof loadOpcionesProyectoReclutamiento>>['opciones']
  >([]);
  const [cargandoProyectos, setCargandoProyectos] = useState(true);
  const [errorProyectos, setErrorProyectos] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const aplicarProyectoInicial = useCallback(
    (opts: Awaited<ReturnType<typeof loadOpcionesProyectoReclutamiento>>['opciones']) => {
      const wantKey = proyectoKeyDesdeIds(
        initialProyectoModuloId?.trim() || null,
        initialProyectoObraId?.trim() || null,
      );
      if (wantKey && opts.some((o) => o.key === wantKey)) {
        setProyectoKey(wantKey);
      } else if (opts.length > 0) {
        setProyectoKey((prev) => (prev && opts.some((o) => o.key === prev) ? prev : opts[0]!.key));
      } else {
        setProyectoKey('');
      }
    },
    [initialProyectoModuloId, initialProyectoObraId],
  );

  const cargar = useCallback(async () => {
    setCargandoProyectos(true);
    setErrorProyectos(null);
    try {
      const rapido = await supabase
        .from('ci_proyectos')
        .select('id,nombre')
        .order('created_at', { ascending: false })
        .limit(80);
      if (!rapido.error && rapido.data?.length) {
        const optsRapidas = rapido.data.map((r) => {
          const id = String((r as { id: unknown }).id);
          const nombre = String((r as { nombre?: unknown }).nombre ?? 'Sin nombre');
          return {
            key: `i:${id}`,
            etiqueta: nombre,
            fuente: 'integral' as const,
            proyectoModuloId: id,
            proyectoObraId: null,
          };
        });
        setOpciones(optsRapidas);
        aplicarProyectoInicial(optsRapidas);
        setCargandoProyectos(false);
      }

      const { opciones: opts, errors } = await loadOpcionesProyectoReclutamiento(supabase);
      setOpciones(opts);
      if (errors.length) setErrorProyectos(errors.join(' · '));
      aplicarProyectoInicial(opts);
    } catch {
      setErrorProyectos('No se pudieron cargar los proyectos.');
    } finally {
      setCargandoProyectos(false);
    }
  }, [supabase, aplicarProyectoInicial]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (opciones.length === 0) return;
    aplicarProyectoInicial(opciones);
  }, [aplicarProyectoInicial, opciones, initialProyectoModuloId, initialProyectoObraId]);

  const proyectoSel = opciones.find((o) => o.key === proyectoKey);
  const projectId = (proyectoSel?.proyectoObraId ?? proyectoSel?.proyectoModuloId ?? '').trim();

  const totalPlazas = lineas.reduce((a, l) => a + Math.max(0, Math.floor(Number(l.cantidad) || 0)), 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (!projectId) {
      setError('Selecciona el proyecto u obra destino (paso 2, más abajo).');
      return;
    }

    const filasValidas: { cod: string; nombre: string; q: number }[] = [];
    for (const linea of lineas) {
      const cod = linea.cargoCodigo.trim();
      const cargo = cod ? cargoPorCodigo(cod) : undefined;
      const q = Math.max(1, Math.min(500, Math.floor(Number(linea.cantidad) || 0)));
      if (!cod || !cargo) continue;
      filasValidas.push({ cod, nombre: cargo.nombre, q });
    }

    if (filasValidas.length === 0) {
      setError('Selecciona al menos un oficio del tabulador GOE 6.752 y la cantidad.');
      return;
    }

    setSaving(true);
    let creadas = 0;
    const fallos: string[] = [];

    for (const f of filasValidas) {
      const { error: insErr } = await supabase.from('labor_requests').insert({
        project_id: projectId,
        specialty_codigo: f.cod,
        specialty_nombre: f.nombre,
        quantity_requested: f.q,
        status: 'pending',
        notes: null,
      });
      if (insErr) {
        fallos.push(insErr.message ?? 'Error al guardar');
      } else {
        creadas += 1;
      }
    }
    setSaving(false);

    if (creadas === 0) {
      setError(fallos[0] ?? 'No se pudo registrar la solicitud.');
      return;
    }

    setOkMsg(
      creadas === 1
        ? `Solicitud registrada (${filasValidas[0]!.q} plaza(s)).`
        : `Se registraron ${creadas} solicitudes (${totalPlazas} plaza(s) en total).`,
    );
    setLineas([nuevaLinea()]);
    onCreada?.();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <div
        id="oficio-cantidad"
        className="scroll-mt-24 space-y-3 rounded-2xl border-2 border-sky-500/40 bg-sky-950/25 p-4 sm:p-5"
      >
        <p className="flex items-center gap-2 text-sm font-bold text-sky-100">
          <HardHat className="h-5 w-5 shrink-0 text-[#FFD60A]" aria-hidden />
          Paso 1 — Oficio y cantidad (tabulador GOE 6.752) *
        </p>
        <ul className="space-y-4">
          {lineas.map((linea) => (
            <li
              key={linea.id}
              className="flex flex-row flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-black/30 p-3"
            >
              <div className="w-[4.5rem] shrink-0 sm:w-20">
                <span className={sublabelClass}>Cant.</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={linea.cantidad}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLineas((prev) =>
                      prev.map((l) => (l.id === linea.id ? { ...l, cantidad: v } : l)),
                    );
                  }}
                  className={inputCantidadClass}
                  aria-label="Cantidad de obreros"
                />
              </div>
              <div className="min-w-0 flex-1 basis-[12rem]">
                <span className={sublabelClass}>Oficio</span>
                <select
                  value={linea.cargoCodigo}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLineas((prev) =>
                      prev.map((l) => (l.id === linea.id ? { ...l, cargoCodigo: v } : l)),
                    );
                  }}
                  style={{ colorScheme: 'dark' }}
                  className={selectOficioClass}
                  aria-label="Seleccionar oficio del tabulador"
                >
                  <option value="" className="bg-zinc-950 text-zinc-100">
                    — Selecciona oficio —
                  </option>
                  {NIVELES_ORDEN.map((nv) => {
                    const lista = gruposTabulador.get(nv);
                    if (!lista?.length) return null;
                    return (
                      <optgroup key={nv} label={`Nivel ${nv}`}>
                        {lista.map((c) => (
                          <option key={c.codigo} value={c.codigo} className="bg-zinc-950 text-zinc-100">
                            {c.codigo} — {c.nombre}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              {lineas.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setLineas((prev) => prev.filter((l) => l.id !== linea.id))}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40"
                  title="Quitar fila"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setLineas((prev) => [...prev, nuevaLinea()])}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-sky-400/50 bg-sky-500/20 px-4 py-2.5 text-sm font-bold text-sky-100 hover:bg-sky-500/30"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Añadir otro oficio
        </button>

        {totalPlazas > 0 ? (
          <p className="text-xs text-zinc-500">Resumen: {totalPlazas} plaza(s) en las filas con cantidad válida.</p>
        ) : null}
      </div>

      <label className="block scroll-mt-24">
        <span className={`${sublabelClass} text-violet-200`}>Paso 2 — Proyecto u obra destino *</span>
        <select
          value={proyectoKey}
          onChange={(e) => setProyectoKey(e.target.value)}
          disabled={cargandoProyectos}
          style={{ colorScheme: 'dark' }}
          className={selectProyectoClass}
        >
          {cargandoProyectos ? (
            <option value="">Cargando proyectos…</option>
          ) : opciones.length === 0 ? (
            <option value="">— Crea un proyecto en Proyectos —</option>
          ) : (
            opciones.map((p) => (
              <option key={p.key} value={p.key} className="bg-zinc-950 text-zinc-100">
                {p.etiqueta}
              </option>
            ))
          )}
        </select>
      </label>

      {errorProyectos ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-100">
          Aviso: {errorProyectos.includes('obra_estado_legacy') ? 'sin filtro de estado de obra.' : errorProyectos}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {okMsg ? <p className="text-sm text-emerald-300">{okMsg}</p> : null}

      <Button
        type="submit"
        variant="elitePrimary"
        disabled={saving || cargandoProyectos || opciones.length === 0}
        className="w-full min-h-[48px] text-base font-bold sm:w-auto"
      >
        {saving ? 'Guardando…' : 'Registrar solicitud de personal'}
      </Button>
    </form>
  );
}
