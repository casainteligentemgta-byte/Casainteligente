'use client';

import { useCallback, useEffect, useState } from 'react';
import { HardHat, Loader2, Save } from 'lucide-react';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { IngenieroResidente } from '@/types/campo';

type Props = {
  proyectoId: string;
  className?: string;
};

export default function IngenieroResidenteObraCard({ proyectoId, className = '' }: Props) {
  const [empleados, setEmpleados] = useState<IngenieroResidente[]>([]);
  const [asignado, setAsignado] = useState<IngenieroResidente | null>(null);
  const [empleadoId, setEmpleadoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/campo/equipo`,
        { cache: 'no-store' },
      );
      const json = await parseFetchJson<{
        ingenieroAsignado?: IngenieroResidente | null;
        empleadosDisponibles?: IngenieroResidente[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setAsignado(json.ingenieroAsignado ?? null);
      setEmpleados(json.empleadosDisponibles ?? []);
      setEmpleadoId(json.ingenieroAsignado?.id ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const guardar = async () => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/campo/equipo`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empleadoId: empleadoId || null }),
        },
      );
      const json = await parseFetchJson<{ error?: string; ingenieroAsignado?: IngenieroResidente }>(
        res,
      );
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      setAsignado(json.ingenieroAsignado ?? null);
      setOk('Ingeniero residente actualizado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="ingeniero-residente"
      className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-zinc-900/80 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
          <HardHat className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-emerald-100">Ingeniero residente de obra</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Se elige desde el personal de RRHH asignado a este proyecto. Recibirá el recordatorio
            diario de avance por Telegram (5:00 PM).
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-200">
              {ok}
            </p>
          ) : null}

          <label className="mt-4 block text-xs font-semibold text-zinc-500">
            Personal del proyecto (RRHH)
          </label>
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
          >
            <option value="">— Sin ingeniero residente —</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
                {e.cargo ? ` · ${e.cargo}` : ''}
                {e.telegram_chat_id ? ' · Telegram ✓' : ''}
              </option>
            ))}
          </select>

          {empleados.length === 0 ? (
            <p className="mt-2 text-xs text-amber-200/90">
              No hay empleados vinculados a esta obra. Asigne personal en{' '}
              <strong>Gestión laboral</strong> o contrate desde RRHH.
            </p>
          ) : null}

          {asignado ? (
            <p className="mt-2 text-xs text-zinc-400">
              Actual: <span className="font-medium text-zinc-200">{asignado.nombre}</span>
              {asignado.cargo ? ` (${asignado.cargo})` : ''}
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void guardar()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar ingeniero residente
          </button>
        </>
      )}
    </section>
  );
}
