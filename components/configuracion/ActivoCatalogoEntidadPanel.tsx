'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { ChevronLeft, ChevronRight, Loader2, MapPin, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import FotosCostadosActivo, {
  type FotoCostadoLocal,
} from '@/components/configuracion/FotosCostadosActivo';
import {
  labelUbicacionOpcion,
  listarUbicacionesPorEntidad,
} from '@/lib/almacen/ubicacionesInventario';
import {
  COSTADOS_ACTIVO,
  ETIQUETA_COSTADO,
  type CostadoActivo,
  subirFotosCostadosPendientes,
} from '@/lib/proyectos/activoFotosCostados';
import {
  PROYECTO_EQUIPO_SELECT_ENTIDAD,
  isMaquinariaColumnMissing,
  mapProyectoEquipoRow,
  type CategoriaEquipoProyecto,
  type ProyectoEquipoRow,
} from '@/lib/proyectos/proyectoEquipos';
import { createClient } from '@/lib/supabase/client';
import type { UbicacionInventario } from '@/types/inventario-obra';

const inputCls =
  'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/40';

type Props = {
  entidadId: string;
  entidadNombre?: string;
  categoria: Extract<CategoriaEquipoProyecto, 'maquinaria_propia' | 'equipo' | 'herramienta'>;
  titulo: string;
  subtitulo: string;
  labelNombre: string;
  botonAgregar: string;
  confirmBorrar: string;
  icon: ComponentType<{ className?: string }>;
  accentClass?: string;
};

function migrationHint(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('ubicacion_id') || m.includes('fotos_costados') || m.includes('herramienta')) {
    return `${msg} — Ejecuta la migración 318 (fotos y ubicación de activos).`;
  }
  if (m.includes('entidad_id')) {
    return `${msg} — Ejecuta la migración 317 (activos por entidad).`;
  }
  return msg;
}

export default function ActivoCatalogoEntidadPanel({
  entidadId,
  entidadNombre,
  categoria,
  titulo,
  subtitulo,
  labelNombre,
  botonAgregar,
  confirmBorrar,
  icon: Icon,
  accentClass = 'border-emerald-500/25 bg-emerald-950/15',
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [filas, setFilas] = useState<ProyectoEquipoRow[]>([]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [serial, setSerial] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [notas, setNotas] = useState('');
  const [fechaAsignacion, setFechaAsignacion] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [fotosLocales, setFotosLocales] = useState<
    Partial<Record<CostadoActivo, FotoCostadoLocal | null>>
  >({});
  const [visor, setVisor] = useState<{
    titulo: string;
    items: { url: string; label: string }[];
    index: number;
  } | null>(null);
  const lastTapRef = useRef<{ key: string; at: number } | null>(null);

  const abrirVisor = useCallback(
    (titulo: string, items: { url: string; label: string }[], index: number) => {
      if (!items.length) return;
      setVisor({ titulo, items, index: Math.max(0, Math.min(index, items.length - 1)) });
    },
    [],
  );

  /** Doble clic (escritorio) o doble toque (móvil) sobre la miniatura. */
  const onFotoActivate = useCallback(
    (
      key: string,
      titulo: string,
      items: { url: string; label: string }[],
      index: number,
      kind: 'dblclick' | 'touch',
    ) => {
      if (kind === 'dblclick') {
        abrirVisor(titulo, items, index);
        return;
      }
      const now = Date.now();
      const prev = lastTapRef.current;
      if (prev && prev.key === key && now - prev.at < 320) {
        lastTapRef.current = null;
        abrirVisor(titulo, items, index);
        return;
      }
      lastTapRef.current = { key, at: now };
    },
    [abrirVisor],
  );

  useEffect(() => {
    if (!visor) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setVisor(null);
      if (ev.key === 'ArrowLeft') {
        setVisor((v) =>
          v ? { ...v, index: (v.index - 1 + v.items.length) % v.items.length } : v,
        );
      }
      if (ev.key === 'ArrowRight') {
        setVisor((v) => (v ? { ...v, index: (v.index + 1) % v.items.length } : v));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visor]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const [eqRes, ubRes] = await Promise.all([
      supabase
        .from('ci_proyecto_equipos')
        .select(PROYECTO_EQUIPO_SELECT_ENTIDAD)
        .eq('entidad_id', entidadId)
        .eq('categoria', categoria)
        .order('created_at', { ascending: false }),
      listarUbicacionesPorEntidad(supabase, entidadId).catch(() => [] as UbicacionInventario[]),
    ]);

    setUbicaciones(ubRes);

    if (eqRes.error) {
      const msg = eqRes.error.message ?? 'No se pudo cargar el catálogo';
      // Select con join nuevo: reintentar sin embed/fotos si falta migración.
      if (isMaquinariaColumnMissing(msg) || /fotos_costados|ubicacion/i.test(msg)) {
        const fallback = await supabase
          .from('ci_proyecto_equipos')
          .select(
            'id,proyecto_id,entidad_id,categoria,nombre_equipo,marca,modelo,serial,cantidad,notas,fecha_asignacion,created_at',
          )
          .eq('entidad_id', entidadId)
          .eq('categoria', categoria)
          .order('created_at', { ascending: false });
        if (fallback.error) {
          setError(migrationHint(fallback.error.message));
          setFilas([]);
        } else {
          setFilas((fallback.data ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
          setError(null);
        }
      } else {
        setError(migrationHint(msg));
        setFilas([]);
      }
    } else {
      setFilas((eqRes.data ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
    }
    setCargando(false);
  }, [supabase, entidadId, categoria]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function limpiarForm() {
    setNombre('');
    setMarca('');
    setModelo('');
    setSerial('');
    setCantidad('1');
    setNotas('');
    setFechaAsignacion('');
    setUbicacionId('');
    for (const lado of COSTADOS_ACTIVO) {
      const prev = fotosLocales[lado];
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
    }
    setFotosLocales({});
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const nom = nombre.trim();
    if (!nom) {
      toast.error(`Indica el nombre (${labelNombre.toLowerCase()})`);
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        entidad_id: entidadId,
        proyecto_id: null,
        categoria,
        nombre_equipo: nom,
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        serial: serial.trim() || null,
        cantidad: Math.max(0.001, Number(cantidad) || 1),
        notas: notas.trim() || null,
        fecha_asignacion: fechaAsignacion || null,
        ubicacion_id: ubicacionId || null,
        fotos_costados: {},
      };

      const { data: inserted, error: insErr } = await supabase
        .from('ci_proyecto_equipos')
        .insert(payload)
        .select('id')
        .single();

      if (insErr) {
        // Sin columnas nuevas: insert mínimo.
        if (isMaquinariaColumnMissing(insErr.message)) {
          const { ubicacion_id: _u, fotos_costados: _f, ...legacy } = payload;
          const { error: legacyErr } = await supabase.from('ci_proyecto_equipos').insert(legacy);
          if (legacyErr) {
            toast.error(migrationHint(legacyErr.message));
            return;
          }
          toast.success('Registrado (aplica migración 318 para fotos y ubicación)');
          limpiarForm();
          void cargar();
          return;
        }
        toast.error(migrationHint(insErr.message));
        return;
      }

      const activoId = String(inserted?.id ?? '');
      const locales: Partial<Record<CostadoActivo, File>> = {};
      for (const lado of COSTADOS_ACTIVO) {
        const f = fotosLocales[lado]?.file;
        if (f) locales[lado] = f;
      }

      if (activoId && Object.keys(locales).length) {
        try {
          const fotos = await subirFotosCostadosPendientes(supabase, {
            entidadId,
            activoId,
            categoria,
            locales,
          });
          const { error: upErr } = await supabase
            .from('ci_proyecto_equipos')
            .update({ fotos_costados: fotos })
            .eq('id', activoId);
          if (upErr) {
            toast.error(`Guardado, pero fotos fallaron: ${upErr.message}`);
          } else {
            toast.success('Registrado con fotos');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error al subir fotos';
          toast.error(`Guardado, pero fotos fallaron: ${msg}`);
        }
      } else {
        toast.success('Registrado');
      }

      limpiarForm();
      void cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    if (!window.confirm(confirmBorrar)) return;
    const { error: delErr } = await supabase.from('ci_proyecto_equipos').delete().eq('id', id);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    toast.success('Eliminado');
    void cargar();
  }

  async function cambiarUbicacion(id: string, nextUbicacionId: string) {
    const { error: upErr } = await supabase
      .from('ci_proyecto_equipos')
      .update({ ubicacion_id: nextUbicacionId || null })
      .eq('id', id);
    if (upErr) {
      toast.error(migrationHint(upErr.message));
      return;
    }
    toast.success('Ubicación actualizada');
    void cargar();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Icon className="h-4 w-4 text-emerald-400" />
          {titulo}
          {entidadNombre ? ` · ${entidadNombre}` : ''}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{subtitulo}</p>
      </div>

      <form onSubmit={(ev) => void agregar(ev)} className={`space-y-3 rounded-xl border p-4 ${accentClass}`}>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            {labelNombre} *
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputCls}
            placeholder={`Nombre del ${labelNombre.toLowerCase()}`}
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Marca</label>
            <input value={marca} onChange={(e) => setMarca(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Modelo</label>
            <input value={modelo} onChange={(e) => setModelo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Serial / placa
            </label>
            <input value={serial} onChange={(e) => setSerial(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Cantidad</label>
            <input
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={inputCls}
              inputMode="decimal"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              <MapPin className="h-3 w-3" />
              Ubicación (almacén / obra)
            </label>
            <select
              value={ubicacionId}
              onChange={(e) => setUbicacionId(e.target.value)}
              className={inputCls}
              style={{ colorScheme: 'dark' }}
            >
              <option value="">Sin ubicación</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {labelUbicacionOpcion(u)}
                </option>
              ))}
            </select>
            {ubicaciones.length === 0 ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                No hay almacenes/obras vinculados. Créalos en Almacén → Maestros.
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Fecha asignación
            </label>
            <input
              type="date"
              value={fechaAsignacion}
              onChange={(e) => setFechaAsignacion(e.target.value)}
              className={inputCls}
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Notas (opcional)
            </label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} />
          </div>
        </div>

        <FotosCostadosActivo value={fotosLocales} onChange={setFotosLocales} disabled={guardando} />

        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : botonAgregar}
        </button>
      </form>

      {cargando ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </p>
      ) : error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-zinc-500">Sin registros.</p>
      ) : (
        <ul className="space-y-2">
          {filas.map((e) => {
            const fotoItems = COSTADOS_ACTIVO.map((lado) => {
              const url = e.fotos_costados?.[lado]?.url?.trim();
              if (!url) return null;
              return { url, label: ETIQUETA_COSTADO[lado] };
            }).filter(Boolean) as { url: string; label: string }[];
            return (
              <li
                key={e.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{e.nombre_equipo}</p>
                    <p className="text-xs text-zinc-500">
                      {[e.marca, e.modelo, e.serial ? `Serial: ${e.serial}` : null, `Cant: ${e.cantidad}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {e.fecha_asignacion ? (
                      <p className="mt-0.5 text-xs text-emerald-400/90">
                        Asignada: {new Date(e.fecha_asignacion).toLocaleDateString('es-VE')}
                      </p>
                    ) : null}
                    {e.notas ? <p className="mt-0.5 text-xs text-zinc-500">{e.notas}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void borrar(e.id)}
                    title="Eliminar"
                    aria-label={`Eliminar ${e.nombre_equipo}`}
                    className="shrink-0 p-1 text-zinc-500 transition hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                <div className="mt-2">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Ubicación
                  </label>
                  <select
                    value={e.ubicacion_id ?? ''}
                    onChange={(ev) => void cambiarUbicacion(e.id, ev.target.value)}
                    className={`${inputCls} mt-0.5`}
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">Sin ubicación</option>
                    {e.ubicacion && !ubicaciones.some((u) => u.id === e.ubicacion?.id) ? (
                      <option value={e.ubicacion.id}>{e.ubicacion.nombre}</option>
                    ) : null}
                    {ubicaciones.map((u) => (
                      <option key={u.id} value={u.id}>
                        {labelUbicacionOpcion(u)}
                      </option>
                    ))}
                  </select>
                </div>

                {fotoItems.length > 0 ? (
                  <div className="mt-2">
                    <p className="mb-1 text-[10px] text-zinc-600">
                      Doble toque / doble clic para ampliar
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {fotoItems.map((item, idx) => (
                        <button
                          key={`${e.id}-${item.label}-${idx}`}
                          type="button"
                          title={`${item.label} · doble toque para ampliar`}
                          aria-label={`Foto ${item.label}. Doble toque para ampliar`}
                          onDoubleClick={() =>
                            onFotoActivate(
                              `${e.id}-${idx}`,
                              e.nombre_equipo,
                              fotoItems,
                              idx,
                              'dblclick',
                            )
                          }
                          onTouchEnd={() =>
                            onFotoActivate(
                              `${e.id}-${idx}`,
                              e.nombre_equipo,
                              fotoItems,
                              idx,
                              'touch',
                            )
                          }
                          className="overflow-hidden rounded-lg border border-white/10 bg-black/30 p-0 transition hover:border-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.label}
                            className="h-12 w-12 object-cover"
                            draggable={false}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {visor ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3"
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos de ${visor.titulo}`}
          onClick={() => setVisor(null)}
        >
          <div
            className="relative flex w-full max-w-lg flex-col gap-3"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{visor.titulo}</p>
                <p className="text-xs text-zinc-400">
                  {visor.items[visor.index]?.label} · {visor.index + 1}/{visor.items.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisor(null)}
                className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={visor.items[visor.index]?.url}
                alt={visor.items[visor.index]?.label ?? 'Foto'}
                className="max-h-[70vh] w-full object-contain"
              />
              {visor.items.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    onClick={() =>
                      setVisor((v) =>
                        v
                          ? {
                              ...v,
                              index: (v.index - 1 + v.items.length) % v.items.length,
                            }
                          : v,
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Foto siguiente"
                    onClick={() =>
                      setVisor((v) =>
                        v ? { ...v, index: (v.index + 1) % v.items.length } : v,
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white hover:bg-black/75"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
