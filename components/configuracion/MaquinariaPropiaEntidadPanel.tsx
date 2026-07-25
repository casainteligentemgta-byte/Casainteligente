'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  PROYECTO_EQUIPO_SELECT_ENTIDAD,
  isMaquinariaColumnMissing,
  mapProyectoEquipoRow,
  type ProyectoEquipoRow,
} from '@/lib/proyectos/proyectoEquipos';

const inputCls =
  'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/40';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Catálogo de maquinarias propias del patrono (MENÚ de entidad). */
export default function MaquinariaPropiaEntidadPanel({ entidadId, entidadNombre }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [filas, setFilas] = useState<ProyectoEquipoRow[]>([]);
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

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('ci_proyecto_equipos')
      .select(PROYECTO_EQUIPO_SELECT_ENTIDAD)
      .eq('entidad_id', entidadId)
      .eq('categoria', 'maquinaria_propia')
      .order('created_at', { ascending: false });

    if (qErr) {
      const msg = qErr.message ?? 'No se pudo cargar maquinaria';
      setError(
        isMaquinariaColumnMissing(msg) || msg.toLowerCase().includes('entidad_id')
          ? `${msg} — Ejecuta la migración 287 (maquinaria propia por entidad).`
          : msg,
      );
      setFilas([]);
    } else {
      setFilas((data ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
    }
    setCargando(false);
  }, [supabase, entidadId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const nom = nombre.trim();
    if (!nom) {
      toast.error('Indica el nombre del equipo');
      return;
    }
    setGuardando(true);
    const payload = {
      entidad_id: entidadId,
      proyecto_id: null,
      categoria: 'maquinaria_propia',
      nombre_equipo: nom,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      serial: serial.trim() || null,
      cantidad: Math.max(0.001, Number(cantidad) || 1),
      notas: notas.trim() || null,
      fecha_asignacion: fechaAsignacion || null,
    };
    const { error: insErr } = await supabase.from('ci_proyecto_equipos').insert(payload);
    setGuardando(false);
    if (insErr) {
      toast.error(
        isMaquinariaColumnMissing(insErr.message) || insErr.message.toLowerCase().includes('entidad')
          ? `${insErr.message} — Migración 287 pendiente.`
          : insErr.message,
      );
      return;
    }
    toast.success('Maquinaria propia registrada');
    setNombre('');
    setMarca('');
    setModelo('');
    setSerial('');
    setCantidad('1');
    setNotas('');
    setFechaAsignacion('');
    void cargar();
  }

  async function borrar(id: string) {
    if (!window.confirm('¿Eliminar esta maquinaria propia?')) return;
    const { error: delErr } = await supabase.from('ci_proyecto_equipos').delete().eq('id', id);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    toast.success('Eliminada');
    void cargar();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Truck className="h-4 w-4 text-emerald-400" />
          Maquinarias propias{entidadNombre ? ` · ${entidadNombre}` : ''}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Catálogo del patrono. Las alquiladas se gestionan en Control de obras de cada proyecto.
        </p>
      </div>

      <form onSubmit={(ev) => void agregar(ev)} className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Equipo *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} placeholder="Nombre del equipo" required />
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
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Serial / placa</label>
            <input value={serial} onChange={(e) => setSerial(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Cantidad</label>
            <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls} inputMode="decimal" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Fecha asignación</label>
            <input
              type="date"
              value={fechaAsignacion}
              onChange={(e) => setFechaAsignacion(e.target.value)}
              className={inputCls}
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Notas (opcional)</label>
            <input value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Agregar maquinaria propia'}
        </button>
      </form>

      {cargando ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </p>
      ) : error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/25 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-zinc-500">Sin registros.</p>
      ) : (
        <ul className="space-y-2">
          {filas.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
            >
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
