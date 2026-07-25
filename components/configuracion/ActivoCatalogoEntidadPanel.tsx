'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Loader2, MapPin } from 'lucide-react';
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
    return `${msg} — Ejecuta la migración 289 (fotos y ubicación de activos).`;
  }
  if (m.includes('entidad_id')) {
    return `${msg} — Ejecuta la migración 287 (activos por entidad).`;
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
          toast.success('Registrado (aplica migración 289 para fotos y ubicación)');
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
            const thumbs = COSTADOS_ACTIVO.map((lado) => e.fotos_costados?.[lado]?.url).filter(
              Boolean,
            ) as string[];
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
                    className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
                  >
                    Eliminar
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

                {thumbs.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {thumbs.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-12 w-12 rounded-lg border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
