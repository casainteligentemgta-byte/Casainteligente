'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Package,
  Users,
} from 'lucide-react';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { IngenieroResidente } from '@/types/campo';

type Payload = {
  proyectoId: string;
  proyectoNombre: string;
  depositarioAsignado: IngenieroResidente | null;
  telegramGrupoAlmacenId: number | null;
  botUsername: string | null;
};

type Props = {
  proyectoId: string;
};

export default function ProyectoDepositarioTelegramPanel({ proyectoId }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grupoInput, setGrupoInput] = useState('');
  const [guardandoGrupo, setGuardandoGrupo] = useState(false);
  const [guardandoDep, setGuardandoDep] = useState(false);
  const [nombres, setNombres] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [cedula, setCedula] = useState('');
  const [generandoLink, setGenerandoLink] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/almacen/telegram`,
        { cache: 'no-store' },
      );
      const json = await parseFetchJson<Payload & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setData(json);
      setGrupoInput(
        json.telegramGrupoAlmacenId != null ? String(json.telegramGrupoAlmacenId) : '',
      );
      const dep = json.depositarioAsignado;
      if (dep) {
        setNombres(dep.nombres ?? dep.nombre.split(' ')[0] ?? '');
        setPrimerApellido(dep.primerApellido ?? '');
        setSegundoApellido(dep.segundoApellido ?? '');
        setCedula(dep.cedula ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const guardarDepositario = async () => {
    setGuardandoDep(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/almacen/telegram`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manual: {
              nombres: nombres.trim(),
              primerApellido: primerApellido.trim(),
              segundoApellido: segundoApellido.trim() || undefined,
              cedula: cedula.trim(),
            },
          }),
        },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardandoDep(false);
    }
  };

  const guardarGrupo = async () => {
    setGuardandoGrupo(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/almacen/telegram`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramGrupoAlmacenId: grupoInput.trim() || null,
          }),
        },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardandoGrupo(false);
    }
  };

  const generarEnlace = async () => {
    setGenerandoLink(true);
    setError(null);
    setDeepLink(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/almacen/telegram`,
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

  const depositario = data?.depositarioAsignado;
  const sincronizado = Boolean(depositario?.telegram_chat_id);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-600 p-3 text-white shadow-md">
            <Package className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-800/70">
              Almacén · Telegram
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Enrutamiento cuarentena</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Las alertas de cuarentena de esta obra van al <strong>depositario</strong> (chat
              individual) y, opcionalmente, al <strong>grupo de la obra</strong>. Si no hay
              configuración, se usan depositarios globales o{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">TELEGRAM_ALMACEN_CHAT_IDS</code>.
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
          1. Depositario de obra
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Persona responsable de cuarentena, ingresos y egresos Telegram en esta obra.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600">
            Nombres
            <input
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Primer apellido
            <input
              value={primerApellido}
              onChange={(e) => setPrimerApellido(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Segundo apellido
            <input
              value={segundoApellido}
              onChange={(e) => setSegundoApellido(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Cédula
            <input
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={guardandoDep}
          onClick={() => void guardarDepositario()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {guardandoDep ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar depositario
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          <Link2 className="h-4 w-4 text-amber-600" />
          2. Vincular Telegram del depositario
        </h3>

        {!depositario ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Primero registre al depositario en la ficha del proyecto.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-800">{depositario.nombre}</span>
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
                <button
                  type="button"
                  disabled={generandoLink}
                  onClick={() => void generarEnlace()}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
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
                Chat ID:{' '}
                <code className="rounded bg-slate-100 px-1">{depositario.telegram_chat_id}</code>
                {depositario.telegram_username ? ` · @${depositario.telegram_username}` : ''}
              </p>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          <Users className="h-4 w-4 text-slate-600" />
          3. Grupo Telegram de la obra (opcional)
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Añada el bot al grupo, envíe un mensaje y obtenga el ID con{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">getUpdates</code> o @userinfobot
          (IDs de grupo suelen empezar con <code className="text-xs">-100</code>).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={grupoInput}
            onChange={(e) => setGrupoInput(e.target.value)}
            placeholder="-1001234567890"
            className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono"
          />
          <button
            type="button"
            disabled={guardandoGrupo}
            onClick={() => void guardarGrupo()}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {guardandoGrupo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar grupo'}
          </button>
        </div>
        {data?.telegramGrupoAlmacenId != null ? (
          <p className="mt-2 text-xs text-emerald-700">
            Grupo activo: {data.telegramGrupoAlmacenId}
          </p>
        ) : null}
      </section>
    </div>
  );
}
