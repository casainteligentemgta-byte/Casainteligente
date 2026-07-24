'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, HardHat, Layers, Loader2, MapPin, Warehouse } from 'lucide-react';
import type { UbicacionInventario } from '@/types/inventario-obra';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';
import type { DestinoFisicoDespacho } from '@/components/almacen/DestinoObraDespachoSelect';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition-colors hover:bg-white/[0.04] focus:border-white/20 disabled:opacity-50';

export type TipoDestinoDespacho = 'obra' | 'almacen';

export type CapituloDespachoOption = {
  id: string;
  codigo: string;
  nombre: string;
  fuente: 'cascada' | 'presupuesto';
};

export type PartidaCapituloOption = {
  key: string;
  id: string;
  nombre: string;
  fuente: 'presupuesto' | 'cascada';
};

export type TareaCronogramaOption = {
  id: string;
  nombre_tarea: string;
  codigo_partida: string | null;
  partida_id: string | null;
};

export type DespachoDestinoDocumentoValue = {
  tipoDestino: TipoDestinoDespacho;
  destinoFisico: DestinoFisicoDespacho;
  destinoProyectoId: string;
  destinoId: string;
  destinoEtiqueta: string;
  capituloId: string;
  capituloLabel: string;
  imputacionObra: 'partida' | 'actividad';
  partidaKey: string;
  partidaLabel: string;
  actividadTexto: string;
  cronogramaTareaId: string;
  tareaEtiqueta: string;
};

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  origenUbicacionId?: string;
  /** IDs de almacenes donde hay stock en la obra (accesos rápidos). */
  almacenesSugeridosIds?: string[];
  value: DespachoDestinoDocumentoValue;
  onChange: (next: DespachoDestinoDocumentoValue) => void;
  disabled?: boolean;
};

const BTN_TIPO =
  'rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50';

function esAlmacenDeposito(u: UbicacionInventario): boolean {
  return u.tipo === 'almacen_central' || u.tipo === 'almacen_movil';
}

export default function DespachoDestinoDocumentoPanel({
  proyectoId,
  proyectoNombre,
  origenUbicacionId,
  almacenesSugeridosIds = [],
  value,
  onChange,
  disabled,
}: Props) {
  const [loadingCap, setLoadingCap] = useState(false);
  const [loadingPar, setLoadingPar] = useState(false);
  const [loadingUb, setLoadingUb] = useState(false);
  const [loadingTareas, setLoadingTareas] = useState(false);
  const [capitulos, setCapitulos] = useState<CapituloDespachoOption[]>([]);
  const [partidas, setPartidas] = useState<PartidaCapituloOption[]>([]);
  const [ubicacionesObra, setUbicacionesObra] = useState<UbicacionInventario[]>([]);
  const [ubicacionesAlmacen, setUbicacionesAlmacen] = useState<UbicacionInventario[]>([]);
  const [tareas, setTareas] = useState<TareaCronogramaOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const patch = (partial: Partial<DespachoDestinoDocumentoValue>) => {
    onChange({ ...value, ...partial });
  };

  const cargarCapitulos = useCallback(async () => {
    if (!proyectoId.trim()) {
      setCapitulos([]);
      return;
    }
    setLoadingCap(true);
    setError(null);
    try {
      const q = new URLSearchParams({ proyecto_id: proyectoId });
      const res = await fetch(`/api/almacen/capitulos?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { capitulos?: CapituloDespachoOption[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar capítulos');
      setCapitulos(data.capitulos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar capítulos');
      setCapitulos([]);
    } finally {
      setLoadingCap(false);
    }
  }, [proyectoId]);

  const cargarPartidas = useCallback(async () => {
    if (!proyectoId.trim() || !value.capituloId.trim()) {
      setPartidas([]);
      return;
    }
    setLoadingPar(true);
    try {
      const q = new URLSearchParams({
        proyecto_id: proyectoId,
        capitulo_id: value.capituloId,
      });
      const res = await fetch(`/api/almacen/partidas-capitulo?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { partidas?: PartidaCapituloOption[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar partidas');
      setPartidas(data.partidas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar partidas');
      setPartidas([]);
    } finally {
      setLoadingPar(false);
    }
  }, [proyectoId, value.capituloId]);

  const cargarUbicacionesObra = useCallback(async () => {
    if (!proyectoId.trim()) {
      setUbicacionesObra([]);
      return;
    }
    setLoadingUb(true);
    try {
      const q = new URLSearchParams({ flat: '1', proyecto_id: proyectoId });
      const res = await fetch(`/api/almacen/ubicaciones?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { ubicaciones?: UbicacionInventario[] };
      setUbicacionesObra(data.ubicaciones ?? []);
    } catch {
      setUbicacionesObra([]);
    } finally {
      setLoadingUb(false);
    }
  }, [proyectoId]);

  const cargarUbicacionesAlmacen = useCallback(async () => {
    setLoadingUb(true);
    try {
      const q = new URLSearchParams({ flat: '1', solo_almacenes: '1' });
      const res = await fetch(`/api/almacen/ubicaciones?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { ubicaciones?: UbicacionInventario[] };
      setUbicacionesAlmacen(data.ubicaciones ?? []);
    } catch {
      setUbicacionesAlmacen([]);
    } finally {
      setLoadingUb(false);
    }
  }, []);

  const cargarTareas = useCallback(async () => {
    if (!proyectoId.trim() || value.imputacionObra !== 'actividad') {
      setTareas([]);
      return;
    }
    setLoadingTareas(true);
    try {
      const q = new URLSearchParams({ proyecto_id: proyectoId });
      const partidaPresupuestoId = value.partidaKey.startsWith('pp:')
        ? value.partidaKey.slice(3)
        : '';
      if (partidaPresupuestoId) q.set('partida_id', partidaPresupuestoId);
      const res = await fetch(`/api/almacen/tareas-cronograma?${q}`, { cache: 'no-store' });
      const data = (await res.json()) as { tareas?: TareaCronogramaOption[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar actividades');
      setTareas(data.tareas ?? []);
    } catch {
      setTareas([]);
    } finally {
      setLoadingTareas(false);
    }
  }, [proyectoId, value.imputacionObra, value.partidaKey]);

  useEffect(() => {
    void cargarCapitulos();
  }, [cargarCapitulos]);

  useEffect(() => {
    void cargarPartidas();
  }, [cargarPartidas]);

  useEffect(() => {
    void cargarUbicacionesObra();
    void cargarUbicacionesAlmacen();
  }, [cargarUbicacionesObra, cargarUbicacionesAlmacen]);

  useEffect(() => {
    void cargarTareas();
  }, [cargarTareas]);

  const ubicacionesObraFiltradas = useMemo(
    () => ubicacionesObra.filter((u) => u.id !== origenUbicacionId),
    [ubicacionesObra, origenUbicacionId],
  );

  const almacenesFiltrados = useMemo(
    () => ubicacionesAlmacen.filter((u) => u.id !== origenUbicacionId && esAlmacenDeposito(u)),
    [ubicacionesAlmacen, origenUbicacionId],
  );

  const almacenesRapidos = useMemo(() => {
    const sugeridos = almacenesSugeridosIds
      .map((id) => almacenesFiltrados.find((u) => u.id === id))
      .filter(Boolean) as UbicacionInventario[];
    const resto = almacenesFiltrados.filter((u) => !sugeridos.some((s) => s.id === u.id));
    return [...sugeridos, ...resto].slice(0, 6);
  }, [almacenesFiltrados, almacenesSugeridosIds]);

  useEffect(() => {
    if (value.tipoDestino !== 'obra' || value.destinoId || !ubicacionesObraFiltradas.length) return;
    const preferida =
      ubicacionesObraFiltradas.find((u) => u.tipo === 'obra')?.id ??
      ubicacionesObraFiltradas[0]?.id ??
      '';
    if (preferida) {
      const ub = ubicacionesObraFiltradas.find((u) => u.id === preferida);
      patch({
        destinoId: preferida,
        destinoEtiqueta: ub ? `Obra: ${proyectoNombre} · ${labelUbicacionOpcion(ub)}` : '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preselección única al cargar ubicaciones
  }, [value.tipoDestino, value.destinoId, ubicacionesObraFiltradas, proyectoNombre]);

  const seleccionarTipo = (tipo: TipoDestinoDespacho) => {
    if (tipo === 'obra') {
      onChange({
        ...value,
        tipoDestino: 'obra',
        destinoFisico: 'obra_actual',
        destinoProyectoId: '',
        destinoId: '',
        destinoEtiqueta: '',
        capituloId: '',
        capituloLabel: '',
        imputacionObra: 'partida',
        partidaKey: '',
        partidaLabel: '',
        actividadTexto: '',
        cronogramaTareaId: '',
        tareaEtiqueta: '',
      });
    } else {
      onChange({
        ...value,
        tipoDestino: 'almacen',
        destinoFisico: 'otro_almacen',
        destinoProyectoId: '',
        destinoId: '',
        destinoEtiqueta: '',
        capituloId: '',
        capituloLabel: '',
        imputacionObra: 'partida',
        partidaKey: '',
        partidaLabel: '',
        actividadTexto: '',
        cronogramaTareaId: '',
        tareaEtiqueta: '',
      });
    }
  };

  const seleccionarUbicacionObra = (id: string) => {
    const ub = ubicacionesObraFiltradas.find((u) => u.id === id);
    patch({
      destinoId: id,
      destinoEtiqueta: ub ? `Obra: ${proyectoNombre} · ${labelUbicacionOpcion(ub)}` : '',
    });
  };

  const seleccionarAlmacen = (id: string) => {
    const ub = almacenesFiltrados.find((u) => u.id === id);
    patch({
      destinoId: id,
      destinoEtiqueta: ub ? `Almacén: ${labelUbicacionOpcion(ub)}` : '',
    });
  };

  const resumen = useMemo(() => {
    const partes: string[] = [];
    if (value.destinoEtiqueta) partes.push(value.destinoEtiqueta);
    if (value.tipoDestino === 'obra') {
      if (value.capituloLabel) partes.push(`Cap. ${value.capituloLabel}`);
      if (value.imputacionObra === 'partida' && value.partidaLabel) {
        partes.push(`Partida: ${value.partidaLabel}`);
      }
      if (value.imputacionObra === 'actividad') {
        const act = value.tareaEtiqueta || value.actividadTexto.trim();
        if (act) partes.push(`Actividad: ${act}`);
      }
    }
    return partes.join(' · ');
  }, [value]);

  if (!proyectoId.trim()) return null;

  return (
    <div className="space-y-4 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-sky-300">Destino</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => seleccionarTipo('obra')}
          className={`${BTN_TIPO} ${
            value.tipoDestino === 'obra'
              ? 'border-orange-500/50 bg-orange-500/15 text-orange-100'
              : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <HardHat className="h-4 w-4" />
            Obra
          </span>
          <span className="mt-1 block text-[10px] opacity-80">Bodega / frente de obra</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => seleccionarTipo('almacen')}
          className={`${BTN_TIPO} ${
            value.tipoDestino === 'almacen'
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
              : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/20'
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <Warehouse className="h-4 w-4" />
            Almacén
          </span>
          <span className="mt-1 block text-[10px] opacity-80">Depósito central o móvil</span>
        </button>
      </div>

      {value.tipoDestino === 'obra' ? (
        <div className="space-y-4 border-t border-white/10 pt-3">
          {ubicacionesObraFiltradas.length > 1 ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-500">
                Ubicación en la obra
              </label>
              <select
                value={value.destinoId}
                disabled={disabled || loadingUb}
                onChange={(e) => seleccionarUbicacionObra(e.target.value)}
                className={selectClass}
              >
                <option value="" className="bg-[#0A0A0F] text-zinc-100">
                  {loadingUb ? 'Cargando…' : 'Seleccione bodega…'}
                </option>
                {ubicacionesObraFiltradas.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                    {labelUbicacionOpcion(u)}
                  </option>
                ))}
              </select>
            </div>
          ) : value.destinoId ? (
            <p className="text-xs text-zinc-400">
              <MapPin className="mr-1 inline h-3.5 w-3.5 text-orange-400" />
              {proyectoNombre}
              {ubicacionesObraFiltradas[0]
                ? ` · ${labelUbicacionOpcion(ubicacionesObraFiltradas[0])}`
                : ''}
            </p>
          ) : null}

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500">
              <BookOpen className="h-3.5 w-3.5 text-emerald-400/90" />
              Capítulo
            </label>
            <select
              value={value.capituloId}
              disabled={disabled || loadingCap}
              onChange={(e) => {
                const id = e.target.value;
                const cap = capitulos.find((c) => c.id === id);
                patch({
                  capituloId: id,
                  capituloLabel: cap ? `${cap.codigo} · ${cap.nombre}` : '',
                  partidaKey: '',
                  partidaLabel: '',
                  cronogramaTareaId: '',
                  tareaEtiqueta: '',
                  actividadTexto: '',
                });
              }}
              className={selectClass}
            >
              <option value="" className="bg-[#0A0A0F] text-zinc-100">
                {loadingCap ? 'Cargando capítulos…' : 'Seleccione capítulo…'}
              </option>
              {capitulos.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0A0A0F] text-zinc-100">
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {value.capituloId ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    patch({
                      imputacionObra: 'partida',
                      actividadTexto: '',
                      cronogramaTareaId: '',
                      tareaEtiqueta: '',
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                    value.imputacionObra === 'partida'
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                      : 'border-white/10 bg-black/30 text-zinc-400'
                  }`}
                >
                  <Layers className="mr-1 inline h-3.5 w-3.5" />
                  Partida
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    patch({
                      imputacionObra: 'actividad',
                      partidaKey: '',
                      partidaLabel: '',
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                    value.imputacionObra === 'actividad'
                      ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                      : 'border-white/10 bg-black/30 text-zinc-400'
                  }`}
                >
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                  Actividad
                </button>
              </div>

              {value.imputacionObra === 'partida' ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">
                    Partida destino (opcional)
                  </label>
                  <select
                    value={value.partidaKey}
                    disabled={disabled || loadingPar}
                    onChange={(e) => {
                      const key = e.target.value;
                      const p = partidas.find((x) => x.key === key);
                      patch({ partidaKey: key, partidaLabel: p?.nombre ?? '' });
                    }}
                    className={selectClass}
                  >
                    <option value="" className="bg-[#0A0A0F] text-zinc-100">
                      {loadingPar ? 'Cargando…' : 'Sin partida específica…'}
                    </option>
                    {partidas.map((p) => (
                      <option key={p.key} value={p.key} className="bg-[#0A0A0F] text-zinc-100">
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">
                    Actividad destino
                  </label>
                  <input
                    type="text"
                    value={value.actividadTexto}
                    disabled={disabled}
                    onChange={(e) =>
                      patch({
                        actividadTexto: e.target.value,
                        cronogramaTareaId: '',
                        tareaEtiqueta: '',
                      })
                    }
                    placeholder="Ej. Instalación eléctrica planta baja…"
                    className={selectClass}
                  />
                  {tareas.length > 0 ? (
                    <>
                      <p className="text-[10px] text-zinc-500">O elija del cronograma:</p>
                      <select
                        value={value.cronogramaTareaId}
                        disabled={disabled || loadingTareas}
                        onChange={(e) => {
                          const id = e.target.value;
                          const t = tareas.find((x) => x.id === id);
                          patch({
                            cronogramaTareaId: id,
                            tareaEtiqueta: t?.nombre_tarea ?? '',
                            actividadTexto: t?.nombre_tarea ?? value.actividadTexto,
                          });
                        }}
                        className={selectClass}
                      >
                        <option value="" className="bg-[#0A0A0F] text-zinc-100">
                          {loadingTareas ? 'Cargando…' : 'Actividad del Gantt (opcional)…'}
                        </option>
                        {tareas.map((t) => (
                          <option key={t.id} value={t.id} className="bg-[#0A0A0F] text-zinc-100">
                            {t.nombre_tarea}
                            {t.codigo_partida ? ` · ${t.codigo_partida}` : ''}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 border-t border-white/10 pt-3">
          {almacenesRapidos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Almacenes frecuentes</p>
              <div className="flex flex-wrap gap-2">
                {almacenesRapidos.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => seleccionarAlmacen(u.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      value.destinoId === u.id
                        ? 'border-sky-500/50 bg-sky-500/20 text-sky-100'
                        : 'border-white/10 bg-black/30 text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    {labelUbicacionOpcion(u)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-500">
              Todos los almacenes
            </label>
            <select
              value={value.destinoId}
              disabled={disabled || loadingUb}
              onChange={(e) => seleccionarAlmacen(e.target.value)}
              className={selectClass}
            >
              <option value="" className="bg-[#0A0A0F] text-zinc-100">
                {loadingUb ? 'Cargando almacenes…' : 'Seleccione depósito…'}
              </option>
              {almacenesFiltrados.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#0A0A0F] text-zinc-100">
                  {labelUbicacionOpcion(u)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {resumen ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
          <p className="mt-1 text-sm font-medium leading-snug text-emerald-100">{resumen}</p>
        </div>
      ) : null}

      {error ? <p className="text-[10px] font-bold text-amber-400">{error}</p> : null}
      {loadingCap || loadingPar || loadingUb ? (
        <p className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Cargando…
        </p>
      ) : null}
    </div>
  );
}
