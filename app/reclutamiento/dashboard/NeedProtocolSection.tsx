'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CARGOS_OBREROS,
  cargoPorCodigo,
  cargosAgrupadosPorNivel,
  tipoVacantePorNivel,
  type TipoVacante,
} from '@/lib/constants/cargosObreros';
import {
  calcularCompensacionDiaria,
  DIAS_LABORABLES_MES_PRORRATEO_BONO_ASISTENCIA,
  formatoVES,
} from '@/lib/nomina/compensacionDiaria';

type NeedRow = {
  id: string;
  title: string;
  notes: string | null;
  protocolActive: boolean;
  cargoCodigo: string | null;
  cargoNombre: string | null;
  cargoNivel: number | null;
  tipoVacante: string | null;
  proyectoId: string | null;
  proyectoNombre: string | null;
  createdAt: string;
};

type ObraOption = { id: string; nombre: string };

/** Estado alineado a `recruitment_needs` y a columnas homónimas en `ci_empleados`. */
export type NecesidadServicioPayload = {
  cargo_codigo: string;
  cargo_nombre: string;
  cargo_nivel: number;
  tipo_vacante: TipoVacante;
};

function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function NeedProtocolSection() {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [cargoCodigo, setCargoCodigo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [proyectos, setProyectos] = useState<ObraOption[]>([]);
  const [loadingProyectos, setLoadingProyectos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<NeedRow | null>(null);
  const [needs, setNeeds] = useState<NeedRow[]>([]);

  const cargosFiltrados = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return [...CARGOS_OBREROS];
    const n = norm(q);
    return CARGOS_OBREROS.filter(
      (c) => norm(c.nombre).includes(n) || c.codigo.replace('.', ',').includes(q) || c.codigo.includes(q),
    );
  }, [busqueda]);

  const grupos = useMemo(() => cargosAgrupadosPorNivel(cargosFiltrados), [cargosFiltrados]);

  const cargoSel = cargoCodigo ? cargoPorCodigo(cargoCodigo) : undefined;
  const tipoVacante: TipoVacante | '' = cargoSel ? tipoVacantePorNivel(cargoSel.nivel) : '';

  const payloadSupabase: NecesidadServicioPayload | null = useMemo(() => {
    if (!cargoSel || !tipoVacante) return null;
    return {
      cargo_codigo: cargoSel.codigo,
      cargo_nombre: cargoSel.nombre,
      cargo_nivel: cargoSel.nivel,
      tipo_vacante: tipoVacante,
    };
  }, [cargoSel, tipoVacante]);

  const nomina = useMemo(
    () => (cargoSel ? calcularCompensacionDiaria(cargoSel.nivel) : null),
    [cargoSel],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/recruitment/needs');
      const data = (await res.json()) as { needs?: NeedRow[]; error?: string };
      if (res.ok && data.needs) setNeeds(data.needs);
    } catch {
      /* ignore */
    }
  }, []);

  const loadProyectos = useCallback(async () => {
    setLoadingProyectos(true);
    try {
      const { data, error: err } = await supabase
        .from('ci_obras')
        .select('id,nombre')
        .eq('estado', 'activa')
        .order('nombre');
      if (!err && data) setProyectos(data as ObraOption[]);
      else setProyectos([]);
    } catch {
      setProyectos([]);
    } finally {
      setLoadingProyectos(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadProyectos();
  }, [loadProyectos]);

  function onCargoChange(next: string) {
    setCargoCodigo(next);
    const c = next ? cargoPorCodigo(next) : undefined;
    if (c) {
      setTitle((t) => (t.trim() === '' ? c.nombre : t));
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !payloadSupabase || !proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recruitment/needs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: t,
          notes: notes.trim() || undefined,
          proyecto_id: proyectoId,
          ...payloadSupabase,
        }),
      });
      const data = (await res.json()) as NeedRow & { error?: string; hint?: string };
      if (!res.ok) {
        setError([data.error, (data as { hint?: string }).hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      setLastCreated(data);
      setTitle('');
      setNotes('');
      setCargoCodigo('');
      setBusqueda('');
      void load();
    } catch {
      setError('No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const nivelesOrden = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 mb-8 space-y-4">
      <h2 className="text-sm font-semibold text-white">1. Necesidad de servicio (vacante)</h2>
      <p className="text-xs text-zinc-400">
        Registra la vacante según el tabulador de oficios de la convención (GOE 6.752). Se activa el enlace con{' '}
        <code className="text-zinc-300">?need=</code> para asociar la entrevista al puesto.
      </p>

      <form onSubmit={(e) => void crear(e)} className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
            Proyecto (obra) *
          </label>
          {loadingProyectos ? (
            <p className="text-xs text-zinc-500 py-2">Cargando proyectos desde Supabase…</p>
          ) : proyectos.length === 0 ? (
            <p className="text-xs text-amber-400/95 leading-relaxed rounded-xl border border-amber-700/40 bg-amber-950/20 px-3 py-2">
              No hay obras activas en <code className="text-amber-200">ci_obras</code>.{' '}
              <Link href="/proyectos/nuevo" className="text-sky-400 font-medium hover:underline">
                Crear proyecto
              </Link>{' '}
              antes de registrar vacantes.
            </p>
          ) : (
            <select
              required
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2.5 text-sm text-white min-h-[2.75rem]"
            >
              <option value="">Selecciona el proyecto…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-[11px] text-zinc-600">
            Cada vacante queda vinculada a un <code className="text-zinc-400">proyecto_id</code> en la base de datos.
          </p>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
            Cargo (tabulador) *
          </label>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre…"
            autoComplete="off"
            className="mb-2 w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
          <select
            required
            value={cargoCodigo}
            onChange={(e) => onCargoChange(e.target.value)}
            className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2.5 text-sm text-white min-h-[2.75rem]"
          >
            <option value="">Selecciona un oficio…</option>
            {nivelesOrden.map((nv) => {
              const lista = grupos.get(nv);
              if (!lista?.length) return null;
              return (
                <optgroup key={nv} label={`Nivel ${nv}`}>
                  {lista.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.codigo} — {c.nombre}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          {cargoSel ? (
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Nivel {cargoSel.nivel} ·{' '}
              <span className="text-zinc-300">
                {tipoVacante === 'obrero_basico' ? 'Obrero básico' : 'Obrero especializado'}
              </span>
              <span className="text-zinc-600"> ({tipoVacante})</span>
            </p>
          ) : null}
          {nomina ? (
            <div className="mt-3 rounded-xl border border-zinc-700/80 bg-zinc-950/60 px-3 py-2.5 space-y-1.5 text-xs">
              <p className="text-zinc-200 font-medium">
                Este cargo tiene un costo base diario de:{' '}
                <span className="text-emerald-300">{formatoVES(nomina.totalDiarioVES)} VES</span>
              </p>
              <p className="text-zinc-500 leading-relaxed">
                Incluye salario básico diario ({formatoVES(nomina.salarioBasicoDiarioVES)} VES) más bono de
                asistencia prorrateado ({formatoVES(nomina.bonoAsistenciaDiarioVES)} VES; Conv. Cl. 41 — 6 días de SB
                entre {DIAS_LABORABLES_MES_PRORRATEO_BONO_ASISTENCIA} días laborables de referencia).
                {nomina.nivel === 9 ? (
                  <>
                    {' '}
                    Nivel 9: banda máxima del tabulador (p. ej. Maestro de obra 1.ª). Prima adicional por
                    responsabilidad en obra, si aplica en su política:{' '}
                    {formatoVES(nomina.beneficioResponsabilidadNivel9VES)} VES/día (variable{' '}
                    <code className="text-zinc-400">NEXT_PUBLIC_NOMINA_PRIMA_RESPONSABILIDAD_NIVEL9_DIARIO_VES</code>
                    ).
                  </>
                ) : null}
              </p>
              <p className="text-zinc-400 border-t border-zinc-800 pt-1.5">
                Proyección 30 días (remuneración + cesta ticket diario estimado{' '}
                {formatoVES(nomina.cestaTicketDiarioVES)} VES):{' '}
                <span className="text-zinc-200 font-medium">
                  {formatoVES(nomina.proyeccion30DiasConCestaTicketVES)} VES
                </span>
                . Cesta ticket: ley vigente; ajusta{' '}
                <code className="text-zinc-500">NEXT_PUBLIC_NOMINA_CESTA_TICKET_MENSUAL_VES</code>.
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Título del puesto *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Se rellena al elegir cargo; puedes ajustarlo"
            className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Requisitos, ubicación, urgencia…"
            className="w-full rounded-xl bg-zinc-950 border border-zinc-600 px-3 py-2 text-sm text-white resize-y min-h-[3rem]"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !title.trim() || !payloadSupabase || !proyectoId || loadingProyectos}
          className="w-full sm:w-auto rounded-xl px-4 py-2 text-sm font-medium bg-emerald-700 text-white disabled:opacity-40"
        >
          {loading ? 'Guardando…' : 'Registrar y activar protocolo'}
        </button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {lastCreated?.id ? (
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/20 p-3 text-xs space-y-2">
          <p className="text-emerald-200 font-medium">Protocolo listo para esta vacante</p>
          {lastCreated.cargoNombre ? (
            <p className="text-zinc-400">
              Cargo: <span className="text-zinc-200">{lastCreated.cargoNombre}</span> (nivel {lastCreated.cargoNivel}
              {lastCreated.tipoVacante ? ` · ${lastCreated.tipoVacante}` : ''})
            </p>
          ) : null}
          {lastCreated.proyectoId ? (
            <p className="text-zinc-400">
              Proyecto:{' '}
              <span className="text-zinc-200">
                {proyectos.find((p) => p.id === lastCreated.proyectoId)?.nombre ?? lastCreated.proyectoId}
              </span>
            </p>
          ) : null}
          <p className="text-zinc-400">Comparte con el candidato (entrevista guiada):</p>
          <code className="block break-all text-[11px] text-sky-300 bg-black/40 p-2 rounded-lg">
            {origin}/reclutamiento?need={lastCreated.id}
          </code>
        </div>
      ) : null}

      {needs.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase text-zinc-500 mb-2">Vacantes recientes</p>
          <ul className="space-y-2 text-xs">
            {needs.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 border border-zinc-800 rounded-lg p-2">
                <span className="text-zinc-200">{n.title}</span>
                {n.proyectoNombre ? (
                  <span className="text-zinc-500">
                    Proyecto: <span className="text-zinc-300">{n.proyectoNombre}</span>
                  </span>
                ) : n.proyectoId ? (
                  <span className="text-zinc-600 text-[10px]">Proyecto: {n.proyectoId}</span>
                ) : null}
                {n.cargoNombre ? (
                  <span className="text-zinc-500">
                    {n.cargoCodigo} · Nivel {n.cargoNivel}
                    {n.tipoVacante ? ` · ${n.tipoVacante}` : ''}
                  </span>
                ) : null}
                <code className="text-[10px] text-sky-400/90 break-all">
                  {origin}/reclutamiento?need={n.id}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
