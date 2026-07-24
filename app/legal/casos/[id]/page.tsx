'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  etiquetaDe,
  LEGAL_ESTADOS,
  LEGAL_PRIORIDADES,
  LEGAL_TIPOS_ACTUACION,
  LEGAL_TIPOS_LAPSO,
  LEGAL_AMBITOS,
  LEGAL_TIPOS_CASO,
} from '@/lib/legal/casosCatalogo';

type Caso = {
  id: string;
  titulo: string;
  tipo: string;
  ambito: string;
  estado: string;
  prioridad: string;
  resumen: string | null;
  contraparte: string | null;
  cliente_nombre: string | null;
  fecha_limite: string | null;
  numero_expediente: string | null;
  organo_tribunal: string | null;
  fase_actual: string | null;
  google_drive_folder_id: string | null;
};

type Actuacion = {
  id: string;
  tipo: string;
  titulo: string | null;
  detalle: string | null;
  ocurrio_at: string;
};

type Tarea = {
  id: string;
  descripcion: string;
  tipo_actuacion: string | null;
  fecha_limite_lapso: string;
  completada: boolean;
  responsable_abogado: string | null;
};

const campo =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

function diasHasta(fechaIso: string): number {
  const lim = new Date(fechaIso).getTime();
  const hoy = Date.now();
  return Math.ceil((lim - hoy) / (1000 * 60 * 60 * 24));
}

function alertaLapso(t: Tarea): 'ok' | 'proximo' | 'vencido' {
  if (t.completada) return 'ok';
  const d = diasHasta(t.fecha_limite_lapso);
  if (d < 0) return 'vencido';
  if (d <= 3) return 'proximo';
  return 'ok';
}

export default function LegalCasoDetallePage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [caso, setCaso] = useState<Caso | null>(null);
  const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [actTipo, setActTipo] = useState('nota');
  const [actTitulo, setActTitulo] = useState('');
  const [actDetalle, setActDetalle] = useState('');
  const [enviandoAct, setEnviandoAct] = useState(false);

  const [numExp, setNumExp] = useState('');
  const [organo, setOrgano] = useState('');
  const [fase, setFase] = useState('');
  const [driveId, setDriveId] = useState('');
  const [guardandoJud, setGuardandoJud] = useState(false);

  const [tareaDesc, setTareaDesc] = useState('');
  const [tareaTipo, setTareaTipo] = useState('Contestación');
  const [tareaFecha, setTareaFecha] = useState('');
  const [tareaResp, setTareaResp] = useState('');
  const [enviandoTarea, setEnviandoTarea] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${id}`), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        caso?: Caso;
        actuaciones?: Actuacion[];
        tareas?: Tarea[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'No se pudo cargar');
        return;
      }
      const c = data.caso ?? null;
      setCaso(c);
      setEstado(c?.estado ?? '');
      setNumExp(c?.numero_expediente ?? '');
      setOrgano(c?.organo_tribunal ?? '');
      setFase(c?.fase_actual ?? '');
      setDriveId(c?.google_drive_folder_id ?? '');
      setActuaciones(data.actuaciones ?? []);
      setTareas(data.tareas ?? []);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardarEstado() {
    if (!caso) return;
    setGuardando(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const data = (await res.json()) as { error?: string; caso?: Caso };
      if (!res.ok) {
        toast.error(data.error || 'No se guardó');
        return;
      }
      setCaso(data.caso ?? caso);
      toast.success('Estado actualizado');
    } catch {
      toast.error('Error de red');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarJudicial() {
    if (!caso) return;
    setGuardandoJud(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_expediente: numExp.trim() || null,
          organo_tribunal: organo.trim() || null,
          fase_actual: fase.trim() || null,
          google_drive_folder_id: driveId.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string; caso?: Caso };
      if (!res.ok) {
        toast.error(data.error || 'No se guardó');
        return;
      }
      setCaso(data.caso ?? caso);
      toast.success('Datos judiciales actualizados');
    } catch {
      toast.error('Error de red');
    } finally {
      setGuardandoJud(false);
    }
  }

  async function agregarActuacion(e: React.FormEvent) {
    e.preventDefault();
    if (!caso) return;
    setEnviandoAct(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}/actuaciones`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: actTipo,
          titulo: actTitulo.trim() || null,
          detalle: actDetalle.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'No se registró');
        return;
      }
      toast.success('Actuación registrada');
      setActTitulo('');
      setActDetalle('');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setEnviandoAct(false);
    }
  }

  async function agregarTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!caso) return;
    if (!tareaDesc.trim() || !tareaFecha) {
      toast.error('Descripción y fecha límite son obligatorias');
      return;
    }
    setEnviandoTarea(true);
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}/tareas`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: tareaDesc.trim(),
          tipo_actuacion: tareaTipo,
          fecha_limite_lapso: tareaFecha,
          responsable_abogado: tareaResp.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'No se creó el lapso');
        return;
      }
      toast.success('Lapso registrado');
      setTareaDesc('');
      setTareaFecha('');
      setTareaResp('');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setEnviandoTarea(false);
    }
  }

  async function toggleTarea(t: Tarea) {
    if (!caso) return;
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}/tareas/${t.id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completada: !t.completada }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'No se actualizó');
        return;
      }
      void cargar();
    } catch {
      toast.error('Error de red');
    }
  }

  async function eliminarTarea(t: Tarea) {
    if (!caso) return;
    try {
      const res = await fetch(apiUrl(`/api/legal/casos/${caso.id}/tareas/${t.id}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'No se eliminó');
        return;
      }
      toast.success('Lapso eliminado');
      void cargar();
    } catch {
      toast.error('Error de red');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !caso) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error || 'Caso no encontrado'}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-amber-500/80">
          {etiquetaDe(LEGAL_AMBITOS, caso.ambito)} · {etiquetaDe(LEGAL_TIPOS_CASO, caso.tipo)}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">{caso.titulo}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {caso.cliente_nombre ? `Cliente: ${caso.cliente_nombre}` : null}
          {caso.contraparte ? ` · Contraparte: ${caso.contraparte}` : null}
          {caso.fecha_limite ? ` · Límite: ${caso.fecha_limite}` : null}
        </p>
        {caso.numero_expediente ? (
          <p className="mt-1 text-sm text-amber-200/80">{caso.numero_expediente}</p>
        ) : null}
        {caso.resumen ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{caso.resumen}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div>
          <label className="text-[10px] font-semibold uppercase text-zinc-500">Estado</label>
          <select className={campo} value={estado} onChange={(e) => setEstado(e.target.value)}>
            {LEGAL_ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="pb-1 text-xs text-zinc-500">
          Prioridad: {etiquetaDe(LEGAL_PRIORIDADES, caso.prioridad)}
        </div>
        <button
          type="button"
          onClick={() => void guardarEstado()}
          disabled={guardando}
          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar estado'}
        </button>
      </div>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-bold text-white">Datos judiciales</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              N° expediente
            </label>
            <input
              className={campo}
              value={numExp}
              onChange={(e) => setNumExp(e.target.value)}
              placeholder="Exp. N° AA40-A-2026-XXXX"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Órgano / tribunal
            </label>
            <input
              className={campo}
              value={organo}
              onChange={(e) => setOrgano(e.target.value)}
              placeholder="Tribunal Municipal, Fiscalía…"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">Fase actual</label>
            <input
              className={campo}
              value={fase}
              onChange={(e) => setFase(e.target.value)}
              placeholder="Preparatoria"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">
              Carpeta Drive (ID)
            </label>
            <input
              className={campo}
              value={driveId}
              onChange={(e) => setDriveId(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void guardarJudicial()}
          disabled={guardandoJud}
          className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {guardandoJud ? 'Guardando…' : 'Guardar datos judiciales'}
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">Lapsos / tareas críticas</h3>
        <form
          onSubmit={(ev) => void agregarTarea(ev)}
          className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase text-zinc-500">Tipo</label>
              <select
                className={campo}
                value={tareaTipo}
                onChange={(e) => setTareaTipo(e.target.value)}
              >
                {LEGAL_TIPOS_LAPSO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-zinc-500">
                Fecha límite del lapso
              </label>
              <input
                type="date"
                className={campo}
                value={tareaFecha}
                onChange={(e) => setTareaFecha(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-semibold uppercase text-zinc-500">
                Descripción
              </label>
              <input
                className={campo}
                value={tareaDesc}
                onChange={(e) => setTareaDesc(e.target.value)}
                placeholder="Ej. Contestar demanda"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-semibold uppercase text-zinc-500">
                Responsable
              </label>
              <input
                className={campo}
                value={tareaResp}
                onChange={(e) => setTareaResp(e.target.value)}
                placeholder="Abogado a cargo"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={enviandoTarea}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {enviandoTarea ? 'Guardando…' : 'Registrar lapso'}
          </button>
        </form>

        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {tareas.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">Sin lapsos registrados.</li>
          ) : (
            tareas.map((t) => {
              const alerta = alertaLapso(t);
              return (
                <li
                  key={t.id}
                  className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${
                    alerta === 'vencido'
                      ? 'bg-red-500/10'
                      : alerta === 'proximo'
                        ? 'bg-amber-500/10'
                        : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase text-amber-500/80">
                      {t.tipo_actuacion || 'Lapso'} ·{' '}
                      {new Date(t.fecha_limite_lapso).toLocaleDateString('es-VE')}
                      {alerta === 'vencido' ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-red-300">
                          <AlertTriangle className="h-3 w-3" /> Vencido
                        </span>
                      ) : null}
                      {alerta === 'proximo' ? (
                        <span className="ml-2 text-amber-200">≤ 3 días</span>
                      ) : null}
                      {t.completada ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Completada
                        </span>
                      ) : null}
                    </p>
                    <p
                      className={`mt-0.5 font-medium ${t.completada ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}
                    >
                      {t.descripcion}
                    </p>
                    {t.responsable_abogado ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{t.responsable_abogado}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleTarea(t)}
                      className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      {t.completada ? 'Reabrir' : 'Completar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void eliminarTarea(t)}
                      className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-200 hover:bg-red-500/10"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-white">Bitácora de resolución</h3>
        <form
          onSubmit={(ev) => void agregarActuacion(ev)}
          className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase text-zinc-500">Tipo</label>
              <select className={campo} value={actTipo} onChange={(e) => setActTipo(e.target.value)}>
                {LEGAL_TIPOS_ACTUACION.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-zinc-500">Título</label>
              <input className={campo} value={actTitulo} onChange={(e) => setActTitulo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-zinc-500">Detalle</label>
            <textarea
              className={campo + ' min-h-[80px]'}
              value={actDetalle}
              onChange={(e) => setActDetalle(e.target.value)}
              placeholder="Qué se hizo / qué falta / acuerdos…"
            />
          </div>
          <button
            type="submit"
            disabled={enviandoAct}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {enviandoAct ? 'Guardando…' : 'Registrar actuación'}
          </button>
        </form>

        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {actuaciones.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">Sin actuaciones aún.</li>
          ) : (
            actuaciones.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase text-amber-500/80">
                  {etiquetaDe(LEGAL_TIPOS_ACTUACION, a.tipo)} ·{' '}
                  {new Date(a.ocurrio_at).toLocaleString('es-VE')}
                </p>
                {a.titulo ? <p className="mt-0.5 font-medium text-zinc-100">{a.titulo}</p> : null}
                {a.detalle ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">{a.detalle}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
