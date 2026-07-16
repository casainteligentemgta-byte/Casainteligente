'use client';

import { useMemo, useState } from 'react';
import { Calculator, Loader2, UserRound } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  LaborCalculator,
  type ResultadoLaborCalculator,
} from '@/lib/legal/calcularPrestacionAntiguedad';
import type { WorkerPasivoResult } from '@/lib/legal/calculateWorkerPasivo';

function money(n: number) {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function labelCriterio(
  c: WorkerPasivoResult['criterio_provision'] | ResultadoLaborCalculator['criterio_provision'],
) {
  if (c === 'retroactivo') return 'Retroactivo (lit. f)';
  if (c === 'empatados') return 'Empate garantia / retroactivo';
  return 'Garantia trimestral (lit. a)';
}

export default function CalculosLaboralesClient() {
  const [salario, setSalario] = useState('500');
  const [utilidades, setUtilidades] = useState('30');
  const [bono, setBono] = useState('15');
  const [inicio, setInicio] = useState('2020-01-15');
  const [fin, setFin] = useState('2026-07-16');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoto, setRemoto] = useState<ResultadoLaborCalculator | null>(null);

  const [workerId, setWorkerId] = useState('');
  const [pasivoFechaFin, setPasivoFechaFin] = useState('');
  const [pasivoLoading, setPasivoLoading] = useState(false);
  const [pasivoError, setPasivoError] = useState<string | null>(null);
  const [pasivoHint, setPasivoHint] = useState<string | null>(null);
  const [pasivo, setPasivo] = useState<WorkerPasivoResult | null>(null);

  const local = useMemo(() => {
    const s = Number(salario);
    if (!Number.isFinite(s) || s < 0) return null;
    try {
      const calc = new LaborCalculator(
        s,
        Number(utilidades) || 30,
        Number(bono) || 15,
      );
      return calc.calcularTodo(inicio || null, fin || null);
    } catch {
      return null;
    }
  }, [salario, utilidades, bono, inicio, fin]);

  async function calcularApi(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRemoto(null);
    try {
      const res = await fetch(apiUrl('/api/legal/calculos/prestacion-antiguedad'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salario_mensual: Number(salario),
          dias_utilidades: Number(utilidades) || 30,
          dias_bono_vacacional: Number(bono) || 15,
          fecha_inicio: inicio || null,
          fecha_fin: fin || null,
        }),
      });
      const data = (await res.json()) as ResultadoLaborCalculator & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Error');
        return;
      }
      setRemoto(data);
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }

  async function calcularPasivo(e: React.FormEvent) {
    e.preventDefault();
    const id = workerId.trim();
    if (!id) {
      setPasivoError('Indique el UUID del trabajador (ci_empleados / workers).');
      return;
    }
    setPasivoLoading(true);
    setPasivoError(null);
    setPasivoHint(null);
    setPasivo(null);
    try {
      const q = pasivoFechaFin.trim()
        ? `?fecha_fin=${encodeURIComponent(pasivoFechaFin.trim())}`
        : '';
      const res = await fetch(apiUrl(`/api/legal/calculos/pasivo/${id}${q}`), {
        credentials: 'include',
      });
      const data = (await res.json()) as WorkerPasivoResult & {
        error?: string;
        hint?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setPasivoError(data.error || 'Error');
        setPasivoHint(data.hint || null);
        return;
      }
      setPasivo(data);
    } catch {
      setPasivoError('Error de red');
    } finally {
      setPasivoLoading(false);
    }
  }

  const r = remoto ?? local;
  const retro = r?.retroactivo;

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Calculator className="h-4 w-4" />
          LaborCalculator - Art. 142 LOTTT
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">Prestaciones sociales</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Salario integral, garantia trimestral (literal a) y retroactivo de 60 dias por ano o
          fraccion &gt; 6 meses (literal f). Se provisiona el monto mayor.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Simulacion manual
        </h3>
        <form
          onSubmit={calcularApi}
          className="grid gap-3 rounded-2xl border border-amber-500/20 bg-[#0c1018] p-4 sm:grid-cols-3"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Salario base mensual
            <input
              type="number"
              min={0}
              step="0.01"
              value={salario}
              onChange={(e) => setSalario(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Dias utilidades
            <input
              type="number"
              min={0}
              value={utilidades}
              onChange={(e) => setUtilidades(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Dias bono vacacional
            <input
              type="number"
              min={0}
              value={bono}
              onChange={(e) => setBono(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Fecha inicio (retroactivo)
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Fecha fin
            <input
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Calcular
            </button>
          </div>
        </form>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {r && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Salario integral diario
              </p>
              <p className="mt-1 text-xl font-bold text-white">
                {money(r.salario_integral_diario)}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Base {money(r.salario_diario_base)} + util. {money(r.alicuota_utilidades)} + bono{' '}
                {money(r.alicuota_bono_vacacional)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
                Garantia trimestral - lit. a)
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-100">
                {money(r.garantia_trimestral)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                4 trimestres ? {money(r.estimacion_anual_garantias)}
              </p>
            </div>
            {retro && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Retroactivo - {retro.referencia_retroactivo}
                </p>
                <p className="mt-1 text-3xl font-bold text-white">{money(retro.retroactivo)}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {retro.fecha_inicio} ? {retro.fecha_fin}: {retro.anios_completos} anos +{' '}
                  {retro.meses_fraccion} meses ?{' '}
                  <strong className="text-zinc-300">{retro.anios_servicio}</strong> ano(s)
                  computables - {retro.dias_retroactivo_por_anio} dias
                </p>
              </div>
            )}
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                Monto a provisionar - Art. 142 (mayor)
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-100">
                {money(r.monto_a_provisionar)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Criterio: {labelCriterio(r.criterio_provision)}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          <UserRound className="h-4 w-4" />
          Pasivo por trabajador (workers - benefit_configs - salary_history)
        </h3>
        <form
          onSubmit={calcularPasivo}
          className="grid gap-3 rounded-2xl border border-white/10 bg-[#0c1018] p-4 sm:grid-cols-3"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
            Worker ID (UUID)
            <input
              type="text"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              placeholder="id de ci_empleados / vista workers"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Fecha fin (opcional)
            <input
              type="date"
              value={pasivoFechaFin}
              onChange={(e) => setPasivoFechaFin(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={pasivoLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 disabled:opacity-50"
            >
              {pasivoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Leer datos y provisionar monto mayor
            </button>
          </div>
        </form>

        {pasivoError && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            <p>{pasivoError}</p>
            {pasivoHint && <p className="mt-1 text-xs text-red-300/80">{pasivoHint}</p>}
          </div>
        )}

        {pasivo && (
          <div className="grid gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-lg font-bold text-white">{pasivo.worker ?? pasivo.worker_id}</p>
              <p className="text-xs text-zinc-500">
                {pasivo.fecha_inicio} ? {pasivo.fecha_fin} - salario {money(pasivo.salario_base_mensual)}{' '}
                (desde {pasivo.salario_effective_date ?? '?'}) - util. {pasivo.dias_utilidades}d -
                bono {pasivo.dias_bono_vacacional}d
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase text-zinc-500">Garantia trimestral</p>
              <p className="mt-1 text-xl font-bold text-white">
                {money(pasivo.garantia_trimestral)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase text-zinc-500">Retroactivo acumulado</p>
              <p className="mt-1 text-xl font-bold text-white">
                {money(pasivo.retroactivo_acumulado)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                Monto a provisionar - {pasivo.referencias.garantia_y_retroactivo}
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-100">
                {money(pasivo.monto_a_provisionar)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Criterio: {labelCriterio(pasivo.criterio_provision)} - integral diario{' '}
                {money(pasivo.salario_integral_diario)}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
