'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import {
  calcularEficienciaAdOficina,
  calcularHonorariosAdUsd,
  costoMensualCargoVes,
  type FilaHonorarioAd,
} from '@/lib/nomina/calcularEficienciaAdOficina';
import { createClient } from '@/lib/supabase/client';

type NominaRow = {
  salario_base_mensual: number;
  factor_prestacional: number;
  cestaticket_mensual: number;
};

type Props = {
  filasOficina: NominaRow[];
};

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtVes(n: number) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function KpiEficienciaAdOficina({ filasOficina }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { tasa, loading: cargandoTasa } = useTasaBcvHoy();
  const [honorariosFilas, setHonorariosFilas] = useState<FilaHonorarioAd[]>([]);
  const [cargandoFondos, setCargandoFondos] = useState(true);

  const cargarHonorarios = useCallback(async () => {
    setCargandoFondos(true);
    try {
      const { data: contratos, error: errC } = await supabase
        .from('ci_contratos_express')
        .select('proyecto_id, honorarios_admin_pct')
        .eq('tipo_contrato', 'administracion_delegada')
        .eq('estado', 'exitoso');

      if (errC) throw errC;

      const ids = Array.from(
        new Set((contratos ?? []).map((c) => String((c as { proyecto_id: string }).proyecto_id))),
      );
      if (!ids.length) {
        setHonorariosFilas([]);
        return;
      }

      const { data: fondos, error: errF } = await supabase
        .from('ci_proyecto_fondos')
        .select('proyecto_id, total_abonado_usd')
        .in('proyecto_id', ids);

      if (errF) throw errF;

      const pctPorProyecto = new Map<string, number>();
      for (const c of contratos ?? []) {
        const pid = String((c as { proyecto_id: string }).proyecto_id);
        const pct = Number((c as { honorarios_admin_pct?: unknown }).honorarios_admin_pct) || 0;
        pctPorProyecto.set(pid, pct);
      }

      const merged: FilaHonorarioAd[] = (fondos ?? []).map((f) => ({
        proyecto_id: String((f as { proyecto_id: string }).proyecto_id),
        total_abonado_usd: Number((f as { total_abonado_usd?: unknown }).total_abonado_usd) || 0,
        honorarios_admin_pct: pctPorProyecto.get(String((f as { proyecto_id: string }).proyecto_id)) ?? 0,
      }));

      setHonorariosFilas(merged);
    } catch {
      setHonorariosFilas([]);
    } finally {
      setCargandoFondos(false);
    }
  }, [supabase]);

  useEffect(() => {
    void cargarHonorarios();
  }, [cargarHonorarios]);

  const nominaOficinaVes = useMemo(
    () =>
      filasOficina.reduce(
        (acc, r) =>
          acc + costoMensualCargoVes(r.salario_base_mensual, r.factor_prestacional, r.cestaticket_mensual),
        0,
      ),
    [filasOficina],
  );

  const honorariosAdUsd = useMemo(() => calcularHonorariosAdUsd(honorariosFilas), [honorariosFilas]);

  const resultado = useMemo(() => {
    const base = calcularEficienciaAdOficina(honorariosAdUsd, nominaOficinaVes, tasa);
    return { ...base, proyectosConAd: honorariosFilas.length };
  }, [honorariosAdUsd, nominaOficinaVes, tasa, honorariosFilas.length]);

  const cargando = cargandoTasa || cargandoFondos;
  const labelClass = resultado.eficiente ? 'text-emerald-400' : 'text-rose-500';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            resultado.eficiente ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'
          }`}
        >
          {resultado.eficiente ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-500" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Rendimiento corporativo — Honorarios AD vs nómina oficina
          </p>
          <p className={`mt-2 text-lg font-bold ${labelClass}`}>
            {cargando
              ? 'Calculando eficiencia…'
              : resultado.eficiente
                ? 'Operación eficiente: los honorarios AD cubren la nómina administrativa'
                : 'Deficiencia: la estructura fija consume margen de utilidad'}
          </p>
          {!cargando && !resultado.eficiente ? (
            <p className="mt-1 text-sm text-rose-400/90">
              Faltan {fmtUsd(resultado.deficienciaUsd)} en honorarios AD para cubrir el costo mensual de
              oficina. Revise contratos AD exitosos y abonos del cliente.
            </p>
          ) : null}
        </div>
        <TrendingUp className="hidden h-5 w-5 shrink-0 text-zinc-600 sm:block" aria-hidden />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Honorarios AD acumulados</p>
          <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${labelClass}`}>
            {cargando ? '—' : fmtUsd(resultado.honorariosAdUsd)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {resultado.proyectosConAd} proyecto(s) con AD · ci_proyecto_fondos
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Nómina oficina / mes</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-zinc-100">
            {cargando ? '—' : fmtUsd(resultado.nominaOficinaUsd)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            Bs {fmtVes(resultado.nominaOficinaVes)} · tasa BCV {tasa ? fmtVes(tasa) : 'N/D'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Balance AD − Oficina</p>
          <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${labelClass}`}>
            {cargando ? '—' : fmtUsd(resultado.honorariosAdUsd - resultado.nominaOficinaUsd)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">Vista bimonetaria consolidada en USD</p>
        </div>
      </div>
    </section>
  );
}
