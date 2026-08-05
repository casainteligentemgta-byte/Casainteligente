'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, HardHat, Loader2, Save, Trash2 } from 'lucide-react';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { IngenieroResidente } from '@/types/campo';

type Props = {
  proyectoId: string;
  className?: string;
  /** Dentro de acordeón en hojas-vida: sin borde ni título duplicado. */
  embedded?: boolean;
  onGuardado?: () => void;
};

function datosDesdeIngeniero(ing: IngenieroResidente | null) {
  if (!ing) {
    return { nombres: '', primerApellido: '', segundoApellido: '', cedula: '' };
  }
  const partes = ing.nombre.split(/\s+/).filter(Boolean);
  return {
    nombres: ing.nombres ?? partes[0] ?? '',
    primerApellido: ing.primerApellido ?? partes[1] ?? '',
    segundoApellido: ing.segundoApellido ?? partes.slice(2).join(' '),
    cedula: ing.cedula ?? '',
  };
}

function resumenIngeniero(ing: IngenieroResidente): string {
  const nombre = (ing.nombre ?? '').trim();
  const ced = (ing.cedula ?? '').trim();
  if (nombre && ced) return `${nombre} · C.I. ${ced}`;
  return nombre || ced || 'Registrado';
}

export default function IngenieroResidenteObraCard({
  proyectoId,
  className = '',
  embedded = false,
  onGuardado,
}: Props) {
  const [asignado, setAsignado] = useState<IngenieroResidente | null>(null);
  const [nombres, setNombres] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [cedula, setCedula] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /** Con datos guardados: campos contraídos; se puede expandir para editar. */
  const [expandido, setExpandido] = useState(true);

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
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      const ing = json.ingenieroAsignado ?? null;
      setAsignado(ing);
      const d = datosDesdeIngeniero(ing);
      setNombres(d.nombres);
      setPrimerApellido(d.primerApellido);
      setSegundoApellido(d.segundoApellido);
      setCedula(d.cedula);
      setExpandido(!ing);
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
          body: JSON.stringify({
            manual: { nombres, primerApellido, segundoApellido, cedula },
          }),
        },
      );
      const json = await parseFetchJson<{ error?: string; ingenieroAsignado?: IngenieroResidente }>(
        res,
      );
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      const ing = json.ingenieroAsignado ?? null;
      setAsignado(ing);
      if (ing) {
        const d = datosDesdeIngeniero(ing);
        setNombres(d.nombres);
        setPrimerApellido(d.primerApellido);
        setSegundoApellido(d.segundoApellido);
        setCedula(d.cedula);
      }
      setOk('Ingeniero residente guardado.');
      setExpandido(false);
      onGuardado?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const quitar = async () => {
    if (!asignado) return;
    if (!window.confirm('¿Quitar el ingeniero residente de esta obra?')) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/campo/equipo`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limpiar: true }),
        },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo quitar');
      setAsignado(null);
      setNombres('');
      setPrimerApellido('');
      setSegundoApellido('');
      setCedula('');
      setOk('Ingeniero residente eliminado.');
      setExpandido(true);
      onGuardado?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600';

  const mostrarCampos = !asignado || expandido;

  return (
    <section
      id={embedded ? undefined : 'ingeniero-residente'}
      className={
        embedded
          ? className
          : `rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-zinc-900/80 p-4 ${className}`
      }
    >
      {!embedded ? (
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-emerald-100">Ingeniero residente de obra</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Registre nombre, apellidos y cédula. Recibirá el recordatorio diario de avance por
              Telegram (5:00 PM) tras vincular su cuenta en Equipo y alertas.
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className={`flex justify-center py-4 ${embedded ? '' : 'mt-4'}`}>
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          ) : null}
          {ok && mostrarCampos ? (
            <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-200">
              {ok}
            </p>
          ) : null}

          {asignado && !expandido ? (
            <div className={embedded ? 'mt-0' : 'mt-3'}>
              <button
                type="button"
                onClick={() => {
                  setOk(null);
                  setExpandido(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-3 py-3 text-left transition hover:border-emerald-400/50 hover:bg-emerald-950/55"
                aria-expanded={false}
              >
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/80">
                    Guardado
                  </p>
                  <p className="truncate text-sm font-semibold text-emerald-50">
                    {resumenIngeniero(asignado)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {asignado.telegram_chat_id
                      ? 'Telegram vinculado · pulse para editar'
                      : 'Pulse para editar o vincular Telegram'}
                  </p>
                </div>
              </button>
            </div>
          ) : null}

          {mostrarCampos ? (
            <>
              {asignado ? (
                <button
                  type="button"
                  onClick={() => setExpandido(false)}
                  className={`flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-semibold text-emerald-200/90 hover:text-emerald-100 ${embedded ? '' : 'mt-3'}`}
                  aria-expanded
                >
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  Contraer datos
                </button>
              ) : null}

              <div className={embedded || asignado ? 'mt-2 grid gap-3 sm:grid-cols-2' : 'mt-4 grid gap-3 sm:grid-cols-2'}>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-zinc-500">Nombres *</span>
                  <input
                    type="text"
                    className={inputClass}
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    placeholder="Ej. Luis Alberto"
                    autoComplete="given-name"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-500">Primer apellido *</span>
                  <input
                    type="text"
                    className={inputClass}
                    value={primerApellido}
                    onChange={(e) => setPrimerApellido(e.target.value)}
                    placeholder="Ej. Mata"
                    autoComplete="family-name"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-500">Segundo apellido</span>
                  <input
                    type="text"
                    className={inputClass}
                    value={segundoApellido}
                    onChange={(e) => setSegundoApellido(e.target.value)}
                    placeholder="Opcional"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-zinc-500">Cédula *</span>
                  <input
                    type="text"
                    className={inputClass}
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="Ej. V-12.345.678"
                    inputMode="text"
                  />
                </label>
              </div>

              {asignado?.telegram_chat_id ? (
                <p className="mt-2 text-xs text-emerald-300/90">Telegram vinculado ✓</p>
              ) : asignado ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  Falta vincular Telegram en Control obra → Equipo y alertas.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void guardar()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar ingeniero residente
                </button>
                {asignado ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void quitar()}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-950/40 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
