'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  compilarHorarioSemanalExpress,
  estadoHorarioExpressPorDefecto,
  type DiaLaboralKey,
  type HorarioSemanalExpressState,
} from '@/lib/talento/horarioSemanalExpressTexto';

const DIAS: { key: DiaLaboralKey; label: string }[] = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mié' },
  { key: 'thu', label: 'Jue' },
  { key: 'fri', label: 'Vie' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

type Props = {
  onChange: (textoDetalleCuarta: string) => void;
  /** Texto del proyecto (solo referencia; no se aplica solo). */
  hintProyecto?: string | null;
};

const inputTimeClass =
  'rounded-md border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white text-sm [color-scheme:dark]';

export function HorarioSemanalExpressForm({ onChange, hintProyecto }: Props) {
  const [st, setSt] = useState<HorarioSemanalExpressState>(() => estadoHorarioExpressPorDefecto());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const texto = useMemo(() => compilarHorarioSemanalExpress(st), [st]);

  useEffect(() => {
    onChangeRef.current(texto);
  }, [texto]);

  function setDia(k: DiaLaboralKey, v: boolean) {
    setSt((prev) => ({ ...prev, dias: { ...prev.dias, [k]: v } }));
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Horario semanal (cláusula CUARTA)</p>
      <p className="text-[11px] text-zinc-500">
        Marca los días laborables. El horario de <span className="text-zinc-300">lunes a jueves</span> (y demás días
        excepto viernes si aplica) usa la primera franja; el <span className="text-zinc-300">viernes</span> puede ser
        distinto (p. ej. media jornada).
      </p>

      {hintProyecto?.trim() ? (
        <p className="text-[11px] text-amber-200/80 border border-amber-500/20 rounded-md px-2 py-1.5 bg-amber-500/5">
          <span className="text-zinc-500">Horario registrado en la obra: </span>
          {hintProyecto.trim()}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {DIAS.map(({ key, label }) => (
          <label
            key={key}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-600 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-500/10"
          >
            <input
              type="checkbox"
              checked={st.dias[key]}
              onChange={(e) => setDia(key, e.target.checked)}
              className="rounded border-zinc-500"
            />
            {label}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={st.viernesDistinto}
          onChange={(e) => setSt((p) => ({ ...p, viernesDistinto: e.target.checked }))}
          className="rounded border-zinc-500"
        />
        Viernes con horario distinto (si el viernes está marcado arriba)
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 text-[11px] font-semibold text-zinc-500 uppercase">
          Horario {st.viernesDistinto ? '(lunes a jueves y demás, excepto viernes)' : '(todos los días marcados)'}
        </div>
        <div>
          <span className="block text-[10px] uppercase text-zinc-500">Entrada</span>
          <input
            type="time"
            value={st.horaEntrada}
            onChange={(e) => setSt((p) => ({ ...p, horaEntrada: e.target.value }))}
            className={`mt-0.5 w-full ${inputTimeClass}`}
          />
        </div>
        <div>
          <span className="block text-[10px] uppercase text-zinc-500">Salida</span>
          <input
            type="time"
            value={st.horaSalida}
            onChange={(e) => setSt((p) => ({ ...p, horaSalida: e.target.value }))}
            className={`mt-0.5 w-full ${inputTimeClass}`}
          />
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={st.usaDescanso}
            onChange={(e) => setSt((p) => ({ ...p, usaDescanso: e.target.checked }))}
            className="rounded border-zinc-500"
          />
          Incluir descanso de medio día (no imputable)
        </label>
        {st.usaDescanso ? (
          <>
            <div>
              <span className="block text-[10px] uppercase text-zinc-500">Inicio descanso</span>
              <input
                type="time"
                value={st.descansoInicio}
                onChange={(e) => setSt((p) => ({ ...p, descansoInicio: e.target.value }))}
                className={`mt-0.5 w-full ${inputTimeClass}`}
              />
            </div>
            <div>
              <span className="block text-[10px] uppercase text-zinc-500">Fin descanso</span>
              <input
                type="time"
                value={st.descansoFin}
                onChange={(e) => setSt((p) => ({ ...p, descansoFin: e.target.value }))}
                className={`mt-0.5 w-full ${inputTimeClass}`}
              />
            </div>
          </>
        ) : null}

        {st.viernesDistinto && st.dias.fri ? (
          <>
            <div className="sm:col-span-2 mt-1 text-[11px] font-semibold text-zinc-500 uppercase">Solo viernes</div>
            <div>
              <span className="block text-[10px] uppercase text-zinc-500">Entrada viernes</span>
              <input
                type="time"
                value={st.viernesEntrada}
                onChange={(e) => setSt((p) => ({ ...p, viernesEntrada: e.target.value }))}
                className={`mt-0.5 w-full ${inputTimeClass}`}
              />
            </div>
            <div>
              <span className="block text-[10px] uppercase text-zinc-500">Salida viernes</span>
              <input
                type="time"
                value={st.viernesSalida}
                onChange={(e) => setSt((p) => ({ ...p, viernesSalida: e.target.value }))}
                className={`mt-0.5 w-full ${inputTimeClass}`}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="rounded-md border border-zinc-700/80 bg-black/20 px-3 py-2">
        <p className="text-[10px] font-bold uppercase text-zinc-500">Vista previa en contrato</p>
        <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{texto || '— Marque al menos un día —'}</p>
      </div>
    </div>
  );
}
