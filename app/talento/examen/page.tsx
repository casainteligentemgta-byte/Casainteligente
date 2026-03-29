'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { generarExamenAdaptativo, PREGUNTAS_PERSONALIDAD } from '@/lib/talento/exam';
import { formatDocumentoCedulaVE, type PrefijoCedulaVE } from '@/lib/talento/documento';
import type { RolExamen } from '@/types/talento';

const DURACION_SEG = 15 * 60;

function fmtMmSs(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ExamenTalentoPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [docPrefijo, setDocPrefijo] = useState<PrefijoCedulaVE>('V');
  const [docNumero, setDocNumero] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rolBuscado, setRolBuscado] = useState('');
  const [rolExamen, setRolExamen] = useState<RolExamen | ''>('');
  const [fase, setFase] = useState<'datos' | 'examen' | 'fin'>('datos');
  const [examenInicio, setExamenInicio] = useState<number | null>(null);
  const [restante, setRestante] = useState(DURACION_SEG);
  const [expirado, setExpirado] = useState(false);
  const [pers, setPers] = useState<Record<string, number>>({});
  const [log, setLog] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    semaforo: string;
    puntaje_total: number;
    estado: string;
    motivo?: string;
  } | null>(null);

  const examen = useMemo(
    () => (rolExamen ? generarExamenAdaptativo(rolExamen) : null),
    [rolExamen],
  );

  useEffect(() => {
    if (fase !== 'examen' || examenInicio == null || expirado) return;
    const t = window.setInterval(() => {
      const transcurrido = Math.floor((Date.now() - examenInicio) / 1000);
      const rest = Math.max(0, DURACION_SEG - transcurrido);
      setRestante(rest);
      if (rest <= 0) {
        setExpirado(true);
        window.clearInterval(t);
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [fase, examenInicio, expirado]);

  const iniciarExamen = () => {
    if (!nombre.trim() || !rolBuscado.trim() || !rolExamen) return;
    setError(null);
    setExpirado(false);
    setPers({});
    setLog({});
    const start = Date.now();
    setExamenInicio(start);
    setRestante(DURACION_SEG);
    setFase('examen');
  };

  const enviar = useCallback(async () => {
    if (!examen || !rolExamen || examenInicio == null || expirado) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/talento/examen/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: nombre.trim(),
          email: email.trim() || undefined,
          documento: formatDocumentoCedulaVE(docPrefijo, docNumero) || undefined,
          telefono: telefono.trim() || undefined,
          rol_buscado: rolBuscado.trim(),
          rol_examen: rolExamen,
          examen_inicio_at: new Date(examenInicio).toISOString(),
          respuestas_personalidad: pers,
          respuestas_logica: log,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'Error al enviar');
        return;
      }
      setResultado({
        semaforo: data.semaforo,
        puntaje_total: data.puntaje_total,
        estado: data.estado,
        motivo: typeof data.motivo === 'string' ? data.motivo : undefined,
      });
      setFase('fin');
    } catch {
      setError('No se pudo conectar. Revisa la red y las migraciones 025/026.');
    } finally {
      setEnviando(false);
    }
  }, [
    examen,
    rolExamen,
    examenInicio,
    expirado,
    nombre,
    email,
    docPrefijo,
    docNumero,
    rolBuscado,
    telefono,
    pers,
    log,
  ]);

  const semaforoColor =
    resultado?.semaforo === 'verde'
      ? 'text-emerald-400'
      : resultado?.semaforo === 'amarillo'
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-28">
      <Link href="/talento" className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        ← Talento
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Evaluación adaptativa</h1>
      <p className="text-sm text-zinc-400 mb-8">
        20 ítems de personalidad (1–5) y 5 de lógica según rol. Tiempo máximo:{' '}
        <strong className="text-zinc-300">15 minutos</strong>. Al expirar, el envío se bloquea.
      </p>

      {fase === 'datos' && (
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Nombre completo *</label>
            <input
              className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Cédula</label>
              <div className="flex gap-2 items-stretch">
                <select
                  className="shrink-0 rounded-xl bg-black border border-zinc-800 px-3 py-3 text-white text-sm w-[4.5rem]"
                  value={docPrefijo}
                  onChange={(e) => setDocPrefijo(e.target.value as PrefijoCedulaVE)}
                  aria-label="Prefijo cédula"
                >
                  <option value="V">V-</option>
                  <option value="E">E-</option>
                </select>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Solo números"
                  className="min-w-0 flex-1 rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                  value={docNumero}
                  onChange={(e) => setDocNumero(e.target.value.replace(/\D/g, '').slice(0, 12))}
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">Venezolano (V) o extranjero (E), sin puntos.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Teléfono</label>
            <input
              className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Rol o puesto al que aplica *</label>
            <input
              className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-sm placeholder:text-zinc-600"
              placeholder="Ej. Desarrollador full stack, instalador de CCTV…"
              value={rolBuscado}
              onChange={(e) => setRolBuscado(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Perfil del examen (preguntas de lógica) *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRolExamen('programador')}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                  rolExamen === 'programador'
                    ? 'border-sky-500 bg-sky-950/50 text-sky-200'
                    : 'border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Programador
              </button>
              <button
                type="button"
                onClick={() => setRolExamen('tecnico')}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                  rolExamen === 'tecnico'
                    ? 'border-sky-500 bg-sky-950/50 text-sky-200'
                    : 'border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700'
                }`}
              >
                Técnico de campo
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">Define las 5 preguntas de lógica; es independiente del texto del puesto.</p>
          </div>
          <button
            type="button"
            disabled={!nombre.trim() || !rolBuscado.trim() || !rolExamen}
            onClick={iniciarExamen}
            className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold py-3 text-sm"
          >
            Iniciar examen
          </button>
        </div>
      )}

      {fase === 'examen' && examen && (
        <div className="space-y-6">
          <div
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${
              expirado ? 'border-red-500/50 bg-red-950/20' : 'border-zinc-800 bg-zinc-950/50'
            }`}
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Tiempo restante</p>
              <p className="text-2xl font-mono font-bold text-white">{fmtMmSs(restante)}</p>
            </div>
            {expirado && <p className="text-sm text-red-400 font-medium">Tiempo agotado — envío bloqueado.</p>}
          </div>

          <section>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Personalidad (1 = bajo · 5 = alto)</h2>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {PREGUNTAS_PERSONALIDAD.map((p) => (
                <div key={p.id} className="rounded-xl border border-zinc-800/80 p-4 bg-black/40">
                  <p className="text-xs text-zinc-500 mb-1">{p.bloque}</p>
                  <p className="text-sm text-zinc-200 mb-3">{p.texto}</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={expirado}
                        onClick={() => setPers((prev) => ({ ...prev, [p.id]: n }))}
                        className={`min-w-[2.5rem] rounded-lg py-2 text-sm font-medium ${
                          pers[p.id] === n ? 'bg-sky-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        } disabled:opacity-40`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">
              Lógica {rolExamen === 'programador' ? '(software)' : '(instalaciones)'}
            </h2>
            <div className="space-y-4">
              {examen.logica.map((q) => (
                <div key={q.id} className="rounded-xl border border-zinc-800/80 p-4 bg-black/40">
                  <p className="text-sm text-zinc-200 mb-3">{q.texto}</p>
                  <div className="space-y-2">
                    {q.opciones.map((op, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={expirado}
                        onClick={() => setLog((prev) => ({ ...prev, [q.id]: idx }))}
                        className={`block w-full text-left rounded-lg px-3 py-2 text-sm ${
                          log[q.id] === idx ? 'bg-violet-600/80 text-white' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                        } disabled:opacity-40`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            disabled={
              expirado ||
              enviando ||
              Object.keys(pers).length < PREGUNTAS_PERSONALIDAD.length ||
              Object.keys(log).length < examen.logica.length
            }
            onClick={() => void enviar()}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-3"
          >
            {enviando ? 'Enviando…' : 'Enviar respuestas'}
          </button>
        </div>
      )}

      {fase === 'fin' && resultado && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Resultado</p>
          <p className={`text-3xl font-bold mb-2 ${semaforoColor}`}>
            Semáforo: {resultado.semaforo.toUpperCase()}
          </p>
          <p className="text-zinc-400 text-sm mb-1">Puntaje total: {resultado.puntaje_total.toFixed(1)}</p>
          <p className="text-zinc-500 text-sm">Estado: {resultado.estado}</p>
          {resultado.motivo && (
            <p className="text-zinc-400 text-sm mt-4 max-w-md mx-auto leading-relaxed">{resultado.motivo}</p>
          )}
          <Link href="/talento" className="mt-8 inline-block text-sky-400 text-sm hover:underline">
            Volver al hub
          </Link>
        </div>
      )}
    </div>
  );
}
