'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  filtrarEquiposPorCategoria,
  isMaquinariaColumnMissing,
  normalizarCategoriaEquipo,
  parseCostoArriendo,
  type CategoriaEquipoProyecto,
  type ProyectoEquipoRow,
} from '@/lib/proyectos/proyectoEquipos';

const inputCls =
  'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40';
const inputSmCls =
  'rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40';

type Props = {
  proyectoId: string;
  equipos: ProyectoEquipoRow[];
  onRefresh: () => void;
  onError?: (msg: string) => void;
};

type EditState = {
  id: string;
  categoria: CategoriaEquipoProyecto;
  nombre: string;
  marca: string;
  modelo: string;
  serial: string;
  cantidad: string;
  notas: string;
  fechaAsignacion: string;
  fechaInicio: string;
  fechaFin: string;
  arrendatario: string;
  arrendatarioRif: string;
  costo: string;
  moneda: string;
};

function fechaInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function filaToEdit(e: ProyectoEquipoRow): EditState {
  const cat = normalizarCategoriaEquipo(e.categoria);
  return {
    id: e.id,
    categoria: cat,
    nombre: e.nombre_equipo,
    marca: e.marca ?? '',
    modelo: e.modelo ?? '',
    serial: e.serial ?? '',
    cantidad: String(e.cantidad),
    notas: e.notas ?? '',
    fechaAsignacion: fechaInput(e.fecha_asignacion),
    fechaInicio: fechaInput(e.fecha_arriendo_inicio),
    fechaFin: fechaInput(e.fecha_arriendo_fin),
    arrendatario: e.arrendatario ?? '',
    arrendatarioRif: e.arrendatario_rif ?? '',
    costo: e.costo_arriendo != null ? String(e.costo_arriendo) : '',
    moneda: (e.moneda_arriendo ?? 'USD').trim() || 'USD',
  };
}

function buildPayload(
  categoria: CategoriaEquipoProyecto,
  f: Omit<EditState, 'id' | 'categoria'>,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    categoria,
    nombre_equipo: f.nombre.trim(),
    marca: f.marca.trim() || null,
    modelo: f.modelo.trim() || null,
    serial: f.serial.trim() || null,
    cantidad: Math.max(0.001, Number(f.cantidad) || 1),
    notas: f.notas.trim() || null,
    fecha_asignacion: null,
    fecha_arriendo_inicio: null,
    fecha_arriendo_fin: null,
    arrendatario: null,
    arrendatario_rif: null,
    costo_arriendo: null,
    moneda_arriendo: 'USD',
  };
  if (categoria === 'maquinaria_propia') {
    base.fecha_asignacion = f.fechaAsignacion || null;
  }
  if (categoria === 'maquinaria_alquilada') {
    base.fecha_arriendo_inicio = f.fechaInicio || null;
    base.fecha_arriendo_fin = f.fechaFin || null;
    base.arrendatario = f.arrendatario.trim() || null;
    base.arrendatario_rif = f.arrendatarioRif.trim() || null;
    base.costo_arriendo = parseCostoArriendo(f.costo);
    base.moneda_arriendo = f.moneda.trim() || 'USD';
  }
  return base;
}

function FormEquipoGenerico({
  categoria,
  titulo,
  descripcion,
  onSubmit,
  saving,
}: {
  categoria: CategoriaEquipoProyecto;
  titulo: string;
  descripcion: string;
  onSubmit: (f: Omit<EditState, 'id' | 'categoria'>) => Promise<void>;
  saving: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [serial, setSerial] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [notas, setNotas] = useState('');
  const [fechaAsignacion, setFechaAsignacion] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [arrendatario, setArrendatario] = useState('');
  const [arrendatarioRif, setArrendatarioRif] = useState('');
  const [costo, setCosto] = useState('');
  const [moneda, setMoneda] = useState('USD');

  const reset = () => {
    setNombre('');
    setMarca('');
    setModelo('');
    setSerial('');
    setCantidad('1');
    setNotas('');
    setFechaAsignacion('');
    setFechaInicio('');
    setFechaFin('');
    setArrendatario('');
    setArrendatarioRif('');
    setCosto('');
    setMoneda('USD');
  };

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        void onSubmit({
          nombre,
          marca,
          modelo,
          serial,
          cantidad,
          notas,
          fechaAsignacion,
          fechaInicio,
          fechaFin,
          arrendatario,
          arrendatarioRif,
          costo,
          moneda,
        }).then(reset);
      }}
    >
      <p className="text-xs text-zinc-500">{descripcion}</p>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder={categoria === 'equipo' ? 'Equipo *' : 'Maquinaria *'}
        className={inputCls}
        required
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" className={inputCls} />
        <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Modelo" className={inputCls} />
        <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial / placa" className={inputCls} />
      </div>
      <input
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        placeholder="Cantidad"
        className={`${inputCls} max-w-[180px]`}
      />
      {categoria === 'maquinaria_propia' ? (
        <label className="block text-xs text-zinc-400">
          Fecha asignación a la obra
          <input
            type="date"
            value={fechaAsignacion}
            onChange={(e) => setFechaAsignacion(e.target.value)}
            className={`${inputCls} mt-1`}
          />
        </label>
      ) : null}
      {categoria === 'maquinaria_alquilada' ? (
        <div className="grid gap-2 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-400">
            Fecha inicio arriendo
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs text-zinc-400">
            Fecha fin arriendo
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <input
            value={arrendatario}
            onChange={(e) => setArrendatario(e.target.value)}
            placeholder="Arrendatario *"
            className={inputCls}
          />
          <input
            value={arrendatarioRif}
            onChange={(e) => setArrendatarioRif(e.target.value)}
            placeholder="RIF arrendatario"
            className={inputCls}
          />
          <input
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            placeholder="Costo arriendo"
            inputMode="decimal"
            className={inputCls}
          />
          <select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            className={inputCls}
            aria-label="Moneda del arriendo"
          >
            <option value="USD">USD</option>
            <option value="VES">VES</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      ) : null}
      <input
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder="Notas (opcional)"
        className={inputCls}
      />
      <button
        type="submit"
        disabled={saving}
        className="w-fit rounded-xl bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0062CC] disabled:opacity-50"
      >
        {saving ? 'Guardando…' : `Agregar ${titulo.toLowerCase()}`}
      </button>
    </form>
  );
}

export default function InventarioEquiposProyecto({ proyectoId, equipos, onRefresh, onError }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [savingCat, setSavingCat] = useState<CategoriaEquipoProyecto | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const equiposGen = useMemo(() => filtrarEquiposPorCategoria(equipos, 'equipo'), [equipos]);
  const maqPropias = useMemo(() => filtrarEquiposPorCategoria(equipos, 'maquinaria_propia'), [equipos]);
  const maqAlquiladas = useMemo(() => filtrarEquiposPorCategoria(equipos, 'maquinaria_alquilada'), [equipos]);

  const reportError = (msg: string) => {
    if (isMaquinariaColumnMissing(msg)) {
      const hint = 'Aplica la migración 155 en Supabase (maquinarias y arriendos en ci_proyecto_equipos).';
      onError?.(hint);
      toast.error(hint);
    } else {
      onError?.(msg);
      toast.error(msg);
    }
  };

  async function insertar(categoria: CategoriaEquipoProyecto, f: Omit<EditState, 'id' | 'categoria'>) {
    setSavingCat(categoria);
    const payload = { proyecto_id: proyectoId, ...buildPayload(categoria, f) };
    let { error } = await supabase.from('ci_proyecto_equipos').insert(payload);
    if (error && isMaquinariaColumnMissing(error.message)) {
      const legacy = {
        proyecto_id: proyectoId,
        nombre_equipo: f.nombre.trim(),
        marca: f.marca.trim() || null,
        modelo: f.modelo.trim() || null,
        serial: f.serial.trim() || null,
        cantidad: Math.max(0.001, Number(f.cantidad) || 1),
        notas: f.notas.trim() || null,
      };
      ({ error } = await supabase.from('ci_proyecto_equipos').insert(legacy));
    }
    setSavingCat(null);
    if (error) {
      reportError(error.message);
      return;
    }
    onRefresh();
  }

  async function guardarEdicion() {
    if (!edit) return;
    setBusyId(edit.id);
    const payload = buildPayload(edit.categoria, edit);
    let { error } = await supabase.from('ci_proyecto_equipos').update(payload).eq('id', edit.id);
    if (error && isMaquinariaColumnMissing(error.message)) {
      ({ error } = await supabase
        .from('ci_proyecto_equipos')
        .update({
          nombre_equipo: edit.nombre.trim(),
          marca: edit.marca.trim() || null,
          modelo: edit.modelo.trim() || null,
          serial: edit.serial.trim() || null,
          cantidad: Math.max(0.001, Number(edit.cantidad) || 1),
          notas: edit.notas.trim() || null,
        })
        .eq('id', edit.id));
    }
    setBusyId(null);
    if (error) {
      reportError(error.message);
      return;
    }
    setEdit(null);
    onRefresh();
  }

  async function borrar(rowId: string) {
    setBusyId(rowId);
    const { error } = await supabase.from('ci_proyecto_equipos').delete().eq('id', rowId);
    setBusyId(null);
    if (error) {
      reportError(error.message);
      return;
    }
    if (edit?.id === rowId) setEdit(null);
    onRefresh();
  }

  function renderListaSimple(rows: ProyectoEquipoRow[], categoria: CategoriaEquipoProyecto) {
    if (rows.length === 0) {
      return <p className="mt-2 text-xs text-zinc-600">Sin registros.</p>;
    }
    return (
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((e) => {
          const enEdicion = edit?.id === e.id;
          return (
            <li key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
              {enEdicion && edit ? (
                <EditorInline edit={edit} setEdit={setEdit} onSave={() => void guardarEdicion()} onCancel={() => setEdit(null)} />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-white">{e.nombre_equipo}</span>
                    <span className="text-zinc-500">
                      {' '}
                      · {e.marca ?? '—'} {e.modelo ?? ''} · Serial: {e.serial ?? '—'} · Cant: {e.cantidad}
                    </span>
                    {categoria === 'maquinaria_propia' && e.fecha_asignacion ? (
                      <p className="mt-0.5 text-xs text-emerald-400/90">
                        Asignada: {new Date(e.fecha_asignacion).toLocaleDateString('es-VE')}
                      </p>
                    ) : null}
                    {e.notas ? <p className="mt-0.5 text-xs text-zinc-500">{e.notas}</p> : null}
                  </div>
                  <Acciones
                    busy={busyId === e.id}
                    onEdit={() => setEdit(filaToEdit(e))}
                    onDelete={() => void borrar(e.id)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl">
        <h2 className="text-sm font-bold uppercase text-zinc-500">Inventario de equipos</h2>
        <FormEquipoGenerico
          categoria="equipo"
          titulo="Equipo"
          descripcion="Herramientas y equipos menores del proyecto."
          saving={savingCat === 'equipo'}
          onSubmit={(f) => insertar('equipo', f)}
        />
        {renderListaSimple(equiposGen, 'equipo')}
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-5 shadow-lg backdrop-blur-xl">
        <h2 className="text-sm font-bold uppercase text-emerald-400/90">Maquinarias propias</h2>
        <p className="mt-1 text-xs text-zinc-500">Maquinaria de la empresa asignada a esta obra.</p>
        <FormEquipoGenerico
          categoria="maquinaria_propia"
          titulo="Maquinaria propia"
          descripcion="Registra equipo propio con fecha de asignación al proyecto."
          saving={savingCat === 'maquinaria_propia'}
          onSubmit={(f) => insertar('maquinaria_propia', f)}
        />
        {renderListaSimple(maqPropias, 'maquinaria_propia')}
      </section>

      <section className="rounded-2xl border border-amber-500/25 bg-amber-950/15 p-5 shadow-lg backdrop-blur-xl">
        <h2 className="text-sm font-bold uppercase text-amber-300/90">Maquinarias alquiladas</h2>
        <p className="mt-1 text-xs text-zinc-500">Listado de arriendos: fechas, arrendatario, RIF y costo.</p>
        <FormEquipoGenerico
          categoria="maquinaria_alquilada"
          titulo="Maquinaria alquilada"
          descripcion="Cada fila es un arriendo o máquina rentada para la obra."
          saving={savingCat === 'maquinaria_alquilada'}
          onSubmit={(f) => insertar('maquinaria_alquilada', f)}
        />
        {maqAlquiladas.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-600">Sin maquinarias alquiladas registradas.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2">Maquinaria</th>
                  <th className="px-3 py-2">Fecha inicio</th>
                  <th className="px-3 py-2">Fecha fin</th>
                  <th className="px-3 py-2">Arrendatario</th>
                  <th className="px-3 py-2">RIF</th>
                  <th className="px-3 py-2 text-right">Costo</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {maqAlquiladas.map((e) =>
                  edit?.id === e.id && edit ? (
                    <tr key={e.id} className="border-b border-white/5 bg-amber-950/30">
                      <td colSpan={7} className="px-3 py-3">
                        <EditorInline edit={edit} setEdit={setEdit} onSave={() => void guardarEdicion()} onCancel={() => setEdit(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-medium text-white">
                        {e.nombre_equipo}
                        <span className="block text-[10px] font-normal text-zinc-500">
                          {[e.marca, e.modelo, e.serial].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-300">
                        {e.fecha_arriendo_inicio
                          ? new Date(e.fecha_arriendo_inicio).toLocaleDateString('es-VE')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">
                        {e.fecha_arriendo_fin
                          ? new Date(e.fecha_arriendo_fin).toLocaleDateString('es-VE')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-zinc-200">{e.arrendatario ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-zinc-400">{e.arrendatario_rif ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-200">
                        {e.costo_arriendo != null
                          ? `${e.moneda_arriendo ?? 'USD'} ${e.costo_arriendo.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Acciones
                          busy={busyId === e.id}
                          onEdit={() => setEdit(filaToEdit(e))}
                          onDelete={() => void borrar(e.id)}
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Acciones({
  busy,
  onEdit,
  onDelete,
}: {
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
      >
        {busy ? '…' : 'Borrar'}
      </button>
    </span>
  );
}

function EditorInline({
  edit,
  setEdit,
  onSave,
  onCancel,
}: {
  edit: EditState;
  setEdit: (e: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const cat = edit.categoria;
  return (
    <div className="space-y-2">
      <input
        value={edit.nombre}
        onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
        className={`${inputSmCls} w-full`}
        placeholder="Nombre *"
      />
      <div className="grid gap-2 sm:grid-cols-4">
        <input value={edit.marca} onChange={(e) => setEdit({ ...edit, marca: e.target.value })} className={inputSmCls} placeholder="Marca" />
        <input value={edit.modelo} onChange={(e) => setEdit({ ...edit, modelo: e.target.value })} className={inputSmCls} placeholder="Modelo" />
        <input value={edit.serial} onChange={(e) => setEdit({ ...edit, serial: e.target.value })} className={inputSmCls} placeholder="Serial" />
        <input value={edit.cantidad} onChange={(e) => setEdit({ ...edit, cantidad: e.target.value })} className={inputSmCls} placeholder="Cant." />
      </div>
      {cat === 'maquinaria_propia' ? (
        <label className="block text-xs text-zinc-400">
          Fecha asignación
          <input
            type="date"
            value={edit.fechaAsignacion}
            onChange={(e) => setEdit({ ...edit, fechaAsignacion: e.target.value })}
            className={`${inputSmCls} mt-1 w-full`}
          />
        </label>
      ) : null}
      {cat === 'maquinaria_alquilada' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Inicio
            <input type="date" value={edit.fechaInicio} onChange={(e) => setEdit({ ...edit, fechaInicio: e.target.value })} className={`${inputSmCls} mt-1 w-full`} />
          </label>
          <label className="text-xs text-zinc-400">
            Fin
            <input type="date" value={edit.fechaFin} onChange={(e) => setEdit({ ...edit, fechaFin: e.target.value })} className={`${inputSmCls} mt-1 w-full`} />
          </label>
          <input value={edit.arrendatario} onChange={(e) => setEdit({ ...edit, arrendatario: e.target.value })} className={inputSmCls} placeholder="Arrendatario" />
          <input value={edit.arrendatarioRif} onChange={(e) => setEdit({ ...edit, arrendatarioRif: e.target.value })} className={inputSmCls} placeholder="RIF" />
          <input value={edit.costo} onChange={(e) => setEdit({ ...edit, costo: e.target.value })} className={inputSmCls} placeholder="Costo" inputMode="decimal" />
          <select value={edit.moneda} onChange={(e) => setEdit({ ...edit, moneda: e.target.value })} className={inputSmCls}>
            <option value="USD">USD</option>
            <option value="VES">VES</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      ) : null}
      <input value={edit.notas} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} className={`${inputSmCls} w-full`} placeholder="Notas" />
      <div className="flex gap-2">
        <button type="button" onClick={onSave} className="rounded-lg bg-[#007AFF] px-2 py-1 text-xs font-semibold text-white hover:bg-[#0062CC]">
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10">
          Cancelar
        </button>
      </div>
    </div>
  );
}
