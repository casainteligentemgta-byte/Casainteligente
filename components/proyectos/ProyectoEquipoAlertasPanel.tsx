'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  HardHat,
  Link2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { EquipoAlertasPayload } from '@/types/campo';

type Props = {
  proyectoId: string;
};

export default function ProyectoEquipoAlertasPanel({ proyectoId }: Props) {
  const [data, setData] = useState<EquipoAlertasPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [generandoLink, setGenerandoLink] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/campo/equipo`,
        { cache: 'no-store' },
      );
      const json = await parseFetchJson<EquipoAlertasPayload & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generarEnlace = async () => {
    setGenerandoLink(true);
    setError(null);
    setDeepLink(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/campo/equipo`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      const json = await parseFetchJson<{ deepLink?: string; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo generar enlace');
      setDeepLink(json.deepLink ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGenerandoLink(false);
    }
  };

  const copiar = async () => {
    if (!deepLink) return;
    await navigator.clipboard.writeText(deepLink);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const ingeniero = data?.ingenieroAsignado;
  const sincronizado = Boolean(ingeniero?.telegram_chat_id);
  const rrhhHref = `/proyectos/modulo/${encodeURIComponent(proyectoId)}?tab=solicitados#ingeniero-residente`;

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-slate-900 p-3 text-white shadow-md">
            <HardHat className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Gestión de campo
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Alertas Telegram</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              El ingeniero residente se configura en <strong>RRHH</strong> del proyecto. Aquí solo
              vinculas su Telegram para el reporte diario de avance.
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          1. Asignar en RRHH
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {ingeniero ? (
            <>
              Ingeniero actual: <strong>{ingeniero.nombre}</strong>
              {ingeniero.cargo ? ` (${ingeniero.cargo})` : ''}
            </>
          ) : (
            <>Aún no hay ingeniero residente designado para esta obra.</>
          )}
        </p>
        <Link
          href={rrhhHref}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          <ExternalLink className="h-4 w-4" />
          Ir a RRHH del proyecto
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          <Link2 className="h-4 w-4 text-emerald-600" />
          2. Vincular Telegram
        </h3>

        {!ingeniero ? (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
            Primero asigne el ingeniero residente en RRHH (paso 1).
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800">{ingeniero.nombre}</span>
              {sincronizado ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sincronizado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Pendiente
                </span>
              )}
            </div>

            {!sincronizado ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-sm text-amber-950">
                  El ingeniero debe abrir el bot con el enlace de sincronización (válido 48 h).
                </p>
                <button
                  type="button"
                  disabled={generandoLink}
                  onClick={() => void generarEnlace()}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {generandoLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copiar enlace de sincronización
                </button>
                {deepLink ? (
                  <div className="mt-3 space-y-2">
                    <input
                      readOnly
                      value={deepLink}
                      className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => void copiar()}
                      className="text-xs font-semibold text-amber-800 underline"
                    >
                      {copiado ? '¡Copiado!' : 'Copiar de nuevo'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Chat ID: <code className="rounded bg-slate-100 px-1">{ingeniero.telegram_chat_id}</code>
                {ingeniero.telegram_username ? ` · @${ingeniero.telegram_username}` : ''}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
