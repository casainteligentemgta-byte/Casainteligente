'use client';

import { useMemo, useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  LaborCalculator,
  type ResultadoLaborCalculator,
} from '@/lib/legal/calcularPrestacionAntiguedad';

function money(n: number) {
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

  const r = remoto ?? local;
  const retro = r?.retroactivo;

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Calculator className="h-4 w-4" />
          LaborCalculator · Art. 142 LOTTT
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Prestaciones sociales
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Salario integral, garantía trimestral (literal a) y retroactivo de 60
          días por año o fracción &gt; 6 meses (literal f).
        </p>
      </header>

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
          Días utilidades
          <input
            type="number"
            min={0}
            value={utilidades}
            onChange={(e) => setUtilidades(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Días bono vacacional
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
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
            <p className="mt-1 text-xl font-bold text-white">{money(r.salario_integral_diario)}</p>
            <p className="mt-1 text-xs text-zinc-600">
              Base {money(r.salario_diario_base)} + util. {money(r.alicuota_utilidades)} +
              bono {money(r.alicuota_bono_vacacional)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
              Garantía trimestral · lit. a)
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-100">
              {money(r.garantia_trimestral)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              4 trimestres ≈ {money(r.estimacion_anual_garantias)}
            </p>
          </div>
          {retro && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Retroactivo · {retro.referencia_retroactivo}
              </p>
              <p className="mt-1 text-3xl font-bold text-white">{money(retro.retroactivo)}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {retro.fecha_inicio} → {retro.fecha_fin}: {retro.anios_completos} años +{' '}
                {retro.meses_fraccion} meses → <strong className="text-zinc-300">{retro.anios_servicio}</strong>{' '}
                año(s) computables × {retro.dias_retroactivo_por_anio} días
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
