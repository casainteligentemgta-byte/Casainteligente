'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  LaborCalculator,
  type ResultadoLaborCalculator,
} from '@/lib/legal/calcularPrestacionAntiguedad';
import type { WorkerPasivoResult } from '@/lib/legal/calculateWorkerPasivo';
import {
  REGIMEN_CCT_CONSTRUCCION,
  REGIMEN_LOTT,
  REGIMENES_PRESTACIONES,
  type RegimenPrestacionesId,
} from '@/lib/legal/regimenesPrestaciones';
import CargarColectivoLegalPanel from '@/components/legal/CargarColectivoLegalPanel';

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
  if (c === 'empatados') return 'Empate garantía / retroactivo';
  return 'Garantía trimestral (lit. a)';
}

function AuditoriaPanel({
  auditoria,
  advertencias,
  version,
}: {
  auditoria?: ResultadoLaborCalculator['auditoria'] | WorkerPasivoResult['auditoria'];
  advertencias?: ResultadoLaborCalculator['advertencias'] | WorkerPasivoResult['advertencias'];
  version?: string;
}) {
  if (!auditoria?.length && !advertencias?.length) return null;
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Desglose auditable (fórmulas LOTTT)
        </p>
        {version ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            fórmula v{version}
          </span>
        ) : null}
      </div>
      {advertencias && advertencias.length > 0 ? (
        <ul className="space-y-1.5">
          {advertencias.map((a) => (
            <li
              key={a.codigo}
              className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{a.mensaje}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {auditoria && auditoria.length > 0 ? (
        <ol className="space-y-2">
          {auditoria.map((p) => (
            <li
              key={`${p.paso}-${p.titulo}`}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-200">
                  <span className="mr-1.5 text-amber-300/90">{p.paso}.</span>
                  {p.titulo}
                </p>
                <p className="font-mono text-sm font-bold text-white">
                  {p.unidad === 'años' ? p.valor : money(p.valor)}
                  {p.unidad === 'años' ? ' año(s)' : ''}
                </p>
              </div>
              <p className="mt-1 font-mono text-[11px] text-zinc-500">{p.formula}</p>
              {p.detalle ? (
                <p className="mt-0.5 text-[11px] text-zinc-400">{p.detalle}</p>
              ) : null}
              {p.referencia ? (
                <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
                  {p.referencia}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      <p className="text-[11px] leading-relaxed text-zinc-600">
        Cálculo determinístico según Art. 142 LOTTT (no usa IA ni Excel). Verifique salario,
        fechas y días de utilidades/bono antes de provisionar.
      </p>
    </div>
  );
}

export default function CalculosLaboralesClient() {
  const [regimenId, setRegimenId] = useState<RegimenPrestacionesId>('lott');
  const [salario, setSalario] = useState('500');
  const [utilidades, setUtilidades] = useState(String(REGIMEN_LOTT.dias_utilidades));
  const [bono, setBono] = useState(String(REGIMEN_LOTT.dias_bono_vacacional));
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

  function aplicarRegimen(id: RegimenPrestacionesId) {
    setRegimenId(id);
    if (id === 'personalizado') return;
    const r = REGIMENES_PRESTACIONES.find((x) => x.id === id);
    if (!r) return;
    setUtilidades(String(r.dias_utilidades));
    setBono(String(r.dias_bono_vacacional));
    setRemoto(null);
  }

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
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Error de cálculo' } as const;
    }
  }, [salario, utilidades, bono, inicio, fin]);

  const localOk = local && !('error' in local) ? local : null;
  const localErr = local && 'error' in local ? local.error : null;

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

  const r = remoto ?? localOk;
  const retro = r?.retroactivo;
  const coherente =
    remoto && localOk
      ? Math.abs(remoto.monto_a_provisionar - localOk.monto_a_provisionar) < 0.015
      : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Calculator className="h-4 w-4" />
          LaborCalculator · Art. 142 LOTTT · fiable y auditable
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">Prestaciones sociales</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          No requiere Excel ni entrenamiento. Aplica fórmulas fijas: salario integral, garantía
          trimestral (literal a) y retroactivo de 60 días por año o fracción superior a 6 meses
          (literal f). Puede cargar la convención colectiva y la contratación colectiva obrera;
          elija el régimen de días (LOTTT o CCT) y se provisiona el monto mayor con desglose
          auditable.
        </p>
      </header>

      <CargarColectivoLegalPanel
        onRegimenCctSugerido={() => aplicarRegimen('cct_construccion')}
      />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Simulación manual
        </h3>

        <div className="flex flex-wrap gap-2">
          {REGIMENES_PRESTACIONES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => aplicarRegimen(r.id)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                regimenId === r.id
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                  : 'border-white/10 text-zinc-400 hover:bg-white/5'
              }`}
            >
              <span className="block font-semibold">{r.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-80">{r.descripcion}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => aplicarRegimen('personalizado')}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              regimenId === 'personalizado'
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
                : 'border-white/10 text-zinc-400 hover:bg-white/5'
            }`}
          >
            <span className="block font-semibold">Personalizado</span>
            <span className="mt-0.5 block text-[10px] opacity-80">
              Edite días a mano según su convenio
            </span>
          </button>
        </div>
        {regimenId === 'cct_construccion' ? (
          <p className="text-[11px] text-zinc-500">
            {REGIMEN_CCT_CONSTRUCCION.referencia}. Confirme que coincida con la CCT que cargó.
          </p>
        ) : null}

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
            Días utilidades {regimenId === 'lott' ? '(mín. 30)' : ''}
            <input
              type="number"
              min={0}
              value={utilidades}
              onChange={(e) => {
                setUtilidades(e.target.value);
                setRegimenId('personalizado');
              }}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Días bono vacacional {regimenId === 'lott' ? '(mín. 15)' : ''}
            <input
              type="number"
              min={0}
              value={bono}
              onChange={(e) => {
                setBono(e.target.value);
                setRegimenId('personalizado');
              }}
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
              Calcular y auditar
            </button>
          </div>
        </form>

        {(error || localErr) && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error || localErr}
          </p>
        )}

        {coherente === true ? (
          <p className="flex items-center gap-2 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resultado del servidor coincide con el cálculo local (mismo Art. 142).
          </p>
        ) : null}
        {coherente === false ? (
          <p className="flex items-center gap-2 text-xs text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Diferencia entre cálculo local y servidor — revise e intente de nuevo.
          </p>
        ) : null}

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
                  {retro.meses_fraccion} meses
                  {'dias_fraccion' in retro && retro.dias_fraccion != null
                    ? ` + ${retro.dias_fraccion} días`
                    : ''}{' '}
                  → <strong className="text-zinc-300">{retro.anios_servicio}</strong> año(s)
                  computables · {retro.dias_retroactivo_por_anio} días
                  {'fraccion_superior_seis_meses' in retro
                    ? retro.fraccion_superior_seis_meses
                      ? ' · fracción > 6 meses aplicada'
                      : ' · sin fracción > 6 meses'
                    : ''}
                </p>
              </div>
            )}
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                Monto a provisionar · Art. 142 (mayor)
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-100">
                {money(r.monto_a_provisionar)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Criterio: {labelCriterio(r.criterio_provision)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <AuditoriaPanel
                auditoria={r.auditoria}
                advertencias={r.advertencias}
                version={r.version_formula}
              />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          <UserRound className="h-4 w-4" />
          Pasivo por trabajador (workers · benefit_configs · salary_history)
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
                {pasivo.fecha_inicio} → {pasivo.fecha_fin} · salario{' '}
                {money(pasivo.salario_base_mensual)} (desde{' '}
                {pasivo.salario_effective_date ?? '?'}) · util. {pasivo.dias_utilidades}d · bono{' '}
                {pasivo.dias_bono_vacacional}d
                {pasivo.anios_servicio != null
                  ? ` · ${pasivo.anios_servicio} año(s) computables`
                  : ''}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase text-zinc-500">Garantía trimestral</p>
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
                Monto a provisionar · {pasivo.referencias.garantia_y_retroactivo}
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-100">
                {money(pasivo.monto_a_provisionar)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Criterio: {labelCriterio(pasivo.criterio_provision)} · integral diario{' '}
                {money(pasivo.salario_integral_diario)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <AuditoriaPanel
                auditoria={pasivo.auditoria}
                advertencias={pasivo.advertencias}
                version={pasivo.version_formula}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
