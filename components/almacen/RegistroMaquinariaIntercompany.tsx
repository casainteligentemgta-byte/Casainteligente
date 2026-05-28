'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { labelPartida, type PartidaRow } from '@/lib/almacen/inventoryClasificacion';
import { calcularTechoRemanentePartida } from '@/lib/proyectos/techoPartidaLulo';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

const SELECT_MAQUINARIA = `
  id,
  codigo_interno,
  costo_hora_alquiler_interno,
  costo_hora_cliente_final,
  activo,
  inventory:global_inventory ( id, name, sap_code ),
  entidad:ci_entidades ( id, nombre, nombre_abreviado )
`;

type MaquinariaRow = {
  id: string;
  codigo_interno: string | null;
  costo_hora_alquiler_interno: number;
  costo_hora_cliente_final: number;
  inventory:
    | { id: string; name: string; sap_code: string | null }
    | Array<{ id: string; name: string; sap_code: string | null }>
    | null;
  entidad:
    | { id: string; nombre: string; nombre_abreviado: string | null }
    | Array<{ id: string; nombre: string; nombre_abreviado: string | null }>
    | null;
};

function joinOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function abreviarEntidad(nombre: string, abreviado?: string | null): string {
  const ab = abreviado?.trim();
  if (ab) return ab;
  const t = nombre.trim();
  if (!t) return '—';
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join('')
      .slice(0, 8)
      .toUpperCase();
  }
  return t.length > 10 ? `${t.slice(0, 9)}…` : t;
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

type Props = {
  proyectoId: string;
};

export default function RegistroMaquinariaIntercompany({ proyectoId }: Props) {
  const [maquinarias, setMaquinarias] = useState<MaquinariaRow[]>([]);
  const [partidas, setPartidas] = useState<PartidaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [migracionPendiente, setMigracionPendiente] = useState(false);

  const [maquinariaId, setMaquinariaId] = useState('');
  const [partidaId, setPartidaId] = useState('');
  const [fechaTrabajo, setFechaTrabajo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [horas, setHoras] = useState('');
  const [justificacionUso, setJustificacionUso] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [techoRemanente, setTechoRemanente] = useState<number | null>(null);
  const [cargandoTecho, setCargandoTecho] = useState(false);

  const { isSubmitting: guardando, runLocked } = useSyncSubmitLock();
  const toastExcesoRef = useRef(false);

  const supabase = useMemo(() => createClient(), []);

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setLoadError(null);
    setMigracionPendiente(false);
    try {
      const [maqRes, parRes] = await Promise.all([
        supabase
          .from('ci_maquinaria_maestro')
          .select(SELECT_MAQUINARIA)
          .eq('activo', true)
          .order('codigo_interno'),
        supabase
          .from('ci_presupuesto_partidas')
          .select('id,codigo_partida,descripcion,proyecto_id,monto_total_estimado')
          .eq('proyecto_id', proyectoId)
          .order('codigo_partida'),
      ]);

      if (maqRes.error) {
        if (
          maqRes.error.code === '42P01' ||
          /ci_maquinaria_maestro|does not exist/i.test(maqRes.error.message ?? '')
        ) {
          setMigracionPendiente(true);
          setMaquinarias([]);
        } else {
          throw new Error(maqRes.error.message);
        }
      } else {
        setMaquinarias((maqRes.data ?? []) as MaquinariaRow[]);
      }

      if (parRes.error) throw new Error(parRes.error.message);
      setPartidas((parRes.data ?? []) as PartidaRow[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar datos');
      setMaquinarias([]);
      setPartidas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const maquinaSel = useMemo(
    () => maquinarias.find((m) => m.id === maquinariaId),
    [maquinarias, maquinariaId],
  );

  const horasNum = useMemo(() => {
    const n = Number(horas.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [horas]);

  const tarifaInterna = Number(maquinaSel?.costo_hora_alquiler_interno ?? 0);
  const tarifaCliente = Number(maquinaSel?.costo_hora_cliente_final ?? 0);

  const costoTransferencia = horasNum * tarifaInterna;
  const costoVentaCliente = horasNum * tarifaCliente;

  useEffect(() => {
    if (!partidaId) {
      setTechoRemanente(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setCargandoTecho(true);
      try {
        const { remanente } = await calcularTechoRemanentePartida(supabase, partidaId);
        if (!cancelled) setTechoRemanente(remanente);
      } catch {
        if (!cancelled) setTechoRemanente(null);
      } finally {
        if (!cancelled) setCargandoTecho(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partidaId, supabase]);

  const excedeTecho =
    partidaId &&
    techoRemanente != null &&
    horasNum > 0 &&
    costoVentaCliente > techoRemanente + 0.0001;

  const justificacionOk = justificacionUso.trim().length >= 8;

  useEffect(() => {
    if (excedeTecho && !justificacionOk && !toastExcesoRef.current) {
      toastExcesoRef.current = true;
      toast.warning(
        `El costo al cliente (${fmtUsd(costoVentaCliente)}) supera el techo remanente de la partida (${fmtUsd(techoRemanente ?? 0)}). Justifique el uso (mín. 8 caracteres).`,
      );
    }
    if (!excedeTecho || justificacionOk) {
      toastExcesoRef.current = false;
    }
  }, [excedeTecho, justificacionOk, costoVentaCliente, techoRemanente]);

  const puedeConfirmar =
    Boolean(maquinariaId) &&
    Boolean(partidaId) &&
    horasNum > 0 &&
    !guardando &&
    (!excedeTecho || justificacionOk);

  const registrar = async () => {
    if (!puedeConfirmar) return;
    await runLocked(async () => {
      const { error } = await supabase.from('ci_maquinaria_control_horas').insert({
        ci_proyecto_id: proyectoId,
        maquinaria_id: maquinariaId,
        ci_presupuesto_partida_id: partidaId,
        fecha_trabajo: fechaTrabajo,
        horas_trabajadas: horasNum,
        costo_transferencia_interna: costoTransferencia,
        costo_venta_cliente: costoVentaCliente,
        justificacion_uso: excedeTecho ? justificacionUso.trim() : null,
        observaciones: observaciones.trim() || null,
      });

      if (error) {
        if (error.code === '42P01') {
          toast.error('Tablas de maquinaria no existen. Aplique migración 186 en Supabase.');
          return;
        }
        toast.error(error.message);
        return;
      }

      toast.success('Parte diario de maquinaria registrado.');
      setHoras('');
      setJustificacionUso('');
      setObservaciones('');
      if (partidaId) {
        const { remanente } = await calcularTechoRemanentePartida(supabase, partidaId);
        setTechoRemanente(remanente);
      }
    });
  };

  const inputClass = (warn: boolean) =>
    `w-full rounded-2xl border bg-black/50 px-4 py-4 text-base font-bold text-white outline-none transition-colors focus:border-white/25 ${
      warn ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-white/10'
    }`;

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0A0A0F] p-5 md:p-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <Truck className="h-7 w-7 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-100">
            Registro de horas — Maquinaria intercompany
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Parte diario en obra · transferencia interna y venta a cliente en tiempo real
          </p>
        </div>
      </header>

      {migracionPendiente ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Ejecute{' '}
          <code className="text-amber-100">186_ci_maquinaria_intercompany.sql</code> en Supabase
          SQL Editor y recargue el esquema.
        </p>
      ) : null}

      {loadError ? (
        <p className="text-sm text-red-400" role="alert">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando maquinaria y partidas…
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Máquina
              </span>
              <select
                value={maquinariaId}
                onChange={(e) => setMaquinariaId(e.target.value)}
                className={inputClass(false)}
              >
                <option value="" className="bg-[#0A0A0F]">
                  Seleccione equipo…
                </option>
                {maquinarias.map((m) => {
                  const inv = joinOne(m.inventory);
                  const ent = joinOne(m.entidad);
                  const entLabel = ent
                    ? abreviarEntidad(ent.nombre, ent.nombre_abreviado)
                    : '—';
                  const nombre = inv?.name ?? m.codigo_interno ?? 'Equipo';
                  const sap = inv?.sap_code ? ` · ${inv.sap_code}` : '';
                  return (
                    <option key={m.id} value={m.id} className="bg-[#0A0A0F]">
                      [{entLabel}] {nombre}
                      {sap}
                    </option>
                  );
                })}
              </select>
            </label>

            {maquinaSel ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <p className="text-zinc-400">
                  Entidad dueña:{' '}
                  <span className="font-bold text-amber-200">
                    {abreviarEntidad(
                      joinOne(maquinaSel.entidad)?.nombre ?? '',
                      joinOne(maquinaSel.entidad)?.nombre_abreviado,
                    )}
                  </span>
                </p>
                <p className="mt-1 text-zinc-500">
                  Tarifas: {fmtUsd(tarifaInterna)}/h interno · {fmtUsd(tarifaCliente)}/h cliente
                </p>
              </div>
            ) : null}

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                Partida Lulo (destino de costo)
              </span>
              <select
                value={partidaId}
                onChange={(e) => setPartidaId(e.target.value)}
                className={inputClass(false)}
              >
                <option value="" className="bg-[#0A0A0F]">
                  Partida del presupuesto…
                </option>
                {partidas.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#0A0A0F]">
                    {labelPartida(p)}
                  </option>
                ))}
              </select>
              {partidaId ? (
                <p className="text-[11px] text-zinc-500">
                  {cargandoTecho ? (
                    'Calculando techo remanente…'
                  ) : techoRemanente != null ? (
                    <>
                      Techo remanente partida:{' '}
                      <span className="font-bold text-emerald-400">{fmtUsd(techoRemanente)}</span>
                    </>
                  ) : (
                    'Sin techo cargado para esta partida.'
                  )}
                </p>
              ) : null}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Fecha
                </span>
                <input
                  type="date"
                  value={fechaTrabajo}
                  onChange={(e) => setFechaTrabajo(e.target.value)}
                  className={inputClass(false)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Horas trabajadas
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  inputMode="decimal"
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  placeholder="0"
                  className={inputClass(Boolean(excedeTecho))}
                />
              </label>
            </div>

            {excedeTecho ? (
              <label className="block space-y-2">
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Justificación de uso (obligatoria)
                </span>
                <textarea
                  value={justificacionUso}
                  onChange={(e) => setJustificacionUso(e.target.value)}
                  rows={3}
                  placeholder="Mínimo 8 caracteres…"
                  className={`${inputClass(true)} min-h-[88px] resize-y`}
                />
                <p className="text-[11px] text-amber-400/90">
                  {justificacionOk
                    ? 'Justificación válida.'
                    : `Faltan ${Math.max(0, 8 - justificacionUso.trim().length)} caracteres.`}
                </p>
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                Observaciones (opcional)
              </span>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                className={`${inputClass(false)} min-h-[72px] resize-y text-sm font-medium`}
              />
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-black/60 p-5">
              <div className="mb-4 flex items-center gap-2 text-zinc-400">
                <Clock className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest">
                  Cálculo en caliente
                </span>
              </div>
              <dl className="space-y-4">
                <div>
                  <dt className="text-[10px] font-bold uppercase text-zinc-600">
                    Costo transferencia interna
                  </dt>
                  <dd className="text-2xl font-black text-sky-300">
                    {horasNum > 0 && maquinariaId ? fmtUsd(costoTransferencia) : '—'}
                  </dd>
                  <dd className="text-[11px] text-zinc-600">
                    {horasNum} h × {fmtUsd(tarifaInterna)}/h
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase text-zinc-600">
                    Costo venta cliente final
                  </dt>
                  <dd
                    className={`text-2xl font-black ${
                      excedeTecho ? 'text-amber-400' : 'text-emerald-300'
                    }`}
                  >
                    {horasNum > 0 && maquinariaId ? fmtUsd(costoVentaCliente) : '—'}
                  </dd>
                  <dd className="text-[11px] text-zinc-600">
                    {horasNum} h × {fmtUsd(tarifaCliente)}/h
                  </dd>
                </div>
              </dl>
            </div>

            <button
              type="button"
              disabled={!puedeConfirmar}
              onClick={() => {
                if (guardando) return;
                void registrar();
              }}
              className="mt-auto flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-base font-black text-black shadow-lg shadow-amber-900/30 disabled:opacity-40 active:scale-[0.99]"
            >
              {guardando ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Registrando…
                </>
              ) : (
                'Registrar parte diario'
              )}
            </button>
          </div>
        </div>
      )}

      {!loading && !migracionPendiente && maquinarias.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay equipos en <code className="text-zinc-400">ci_maquinaria_maestro</code>. Vincule
          ítems de <code className="text-zinc-400">global_inventory</code> con tarifas intercompany.
        </p>
      ) : null}
    </section>
  );
}
