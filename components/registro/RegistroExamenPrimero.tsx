'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  PREFIJOS_CELULAR_VE,
  composeCedulaHv,
  composeCelularVe,
  parseCedulaHv,
  parseCelularVe,
  celularDesdeEntrada,
  type LetraCedulaHv,
} from '@/lib/registro/catalogosHojaVidaVe';

const inputClass =
  'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-[#FF9500] focus:ring-1 focus:ring-[#FF9500]/40';
const inputCompactClass =
  'shrink-0 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-sm text-white outline-none transition focus:border-[#FF9500] focus:ring-1 focus:ring-[#FF9500]/40';
const labelClass = 'block text-[10px] font-bold uppercase tracking-wide text-zinc-500';

type Props = {
  captacionToken: string;
  cargo: string;
  proyectoNombre?: string;
};

/**
 * Paso 1 de las vacantes con «examen primero»: datos mínimos para abrir la evaluación.
 * La hoja de vida completa se pide después, solo si la evaluación no sale en rojo.
 */
export default function RegistroExamenPrimero({ captacionToken, cargo, proyectoNombre }: Props) {
  const [primerNombre, setPrimerNombre] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [cedula, setCedula] = useState('V-');
  const [celular, setCelular] = useState(composeCelularVe(PREFIJOS_CELULAR_VE[1], ''));
  const [correo, setCorreo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ced = parseCedulaHv(cedula);
  const cel = parseCelularVe(celular);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!primerNombre.trim()) return setError('Indica tu primer nombre.');
    if (!primerApellido.trim()) return setError('Indica tu primer apellido.');
    if (ced.numero.length < 6) return setError('Indica la cédula (V o E y el número).');
    if (cel.numero.length !== 7) return setError('Indica el celular con prefijo y 7 dígitos.');

    setEnviando(true);
    try {
      const res = await fetch('/api/reclutamiento/captacion-iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: captacionToken,
          primerNombre,
          primerApellido,
          cedula,
          celular,
          correo,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok || !j.url) {
        setError(j.error ?? 'No se pudo continuar. Intenta de nuevo.');
        return;
      }
      window.location.href = j.url;
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-16 pt-8 text-zinc-100">
      <div className="mx-auto max-w-md px-4">
        <header className="rounded-2xl border border-[#FF9500]/25 bg-gradient-to-br from-[#FF9500]/10 to-transparent p-5 shadow-lg shadow-black/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD60A]/90">Postulación</p>
          <h1 className="mt-2 text-xl font-bold leading-snug text-white">{cargo}</h1>
          {proyectoNombre ? (
            <p className="mt-2 text-sm text-zinc-300">
              Obra: <span className="font-semibold text-white">{proyectoNombre}</span>
            </p>
          ) : null}
        </header>

        <ol className="mt-5 grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-wide">
          <li className="rounded-lg bg-[#FF9500] px-2 py-1.5 text-black">1. Tus datos</li>
          <li className="rounded-lg bg-white/5 px-2 py-1.5 text-zinc-500">2. Evaluación</li>
          <li className="rounded-lg bg-white/5 px-2 py-1.5 text-zinc-500">3. Hoja de vida</li>
        </ol>

        <form
          onSubmit={enviar}
          className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
        >
          <p className="text-sm text-zinc-400">
            Primero unos datos básicos y una evaluación corta (unos 20 minutos). Si avanzas, completarás tu hoja de
            vida.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="ep-nombre">
                Primer nombre *
              </label>
              <input
                id="ep-nombre"
                className={inputClass}
                value={primerNombre}
                onChange={(e) => setPrimerNombre(e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ep-apellido">
                Primer apellido *
              </label>
              <input
                id="ep-apellido"
                className={inputClass}
                value={primerApellido}
                onChange={(e) => setPrimerApellido(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ep-cedula">
              Cédula *
            </label>
            <div className="mt-1 flex gap-2">
              <select
                aria-label="Nacionalidad de la cédula"
                className={inputCompactClass}
                value={ced.letra}
                onChange={(e) => setCedula(composeCedulaHv(e.target.value as LetraCedulaHv, ced.numero) || `${e.target.value}-`)}
              >
                <option value="V" className="bg-zinc-900">
                  V
                </option>
                <option value="E" className="bg-zinc-900">
                  E
                </option>
              </select>
              <input
                id="ep-cedula"
                inputMode="numeric"
                className={`${inputClass} mt-0`}
                placeholder="12345678"
                value={ced.numero}
                onChange={(e) => setCedula(composeCedulaHv(ced.letra, e.target.value) || `${ced.letra}-`)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ep-celular">
              Celular (WhatsApp) *
            </label>
            <div className="mt-1 flex gap-2">
              <select
                aria-label="Prefijo del celular"
                className={inputCompactClass}
                value={cel.prefijo}
                onChange={(e) => setCelular(composeCelularVe(e.target.value, cel.numero))}
              >
                {PREFIJOS_CELULAR_VE.map((p) => (
                  <option key={p} value={p} className="bg-zinc-900">
                    {p}
                  </option>
                ))}
              </select>
              <input
                id="ep-celular"
                inputMode="numeric"
                className={`${inputClass} mt-0`}
                placeholder="1234567"
                value={cel.numero}
                onChange={(e) => setCelular(celularDesdeEntrada(cel.prefijo, e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ep-correo">
              Correo (opcional)
            </label>
            <input
              id="ep-correo"
              type="email"
              className={inputClass}
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoComplete="email"
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF9500] px-4 py-3 text-sm font-bold text-black transition hover:bg-[#FFA733] disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {enviando ? 'Abriendo la evaluación…' : 'Continuar a la evaluación'}
          </button>
        </form>
      </div>
    </div>
  );
}
