'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ExamenTimer from '@/components/ExamenTimer';
import { generarExamenAdaptativo, PREGUNTAS_PERSONALIDAD } from '@/lib/talento/exam';
import { formatDocumentoCedulaVE, parseDocumentoCedulaVE, type PrefijoCedulaVE } from '@/lib/talento/documento';
import type { RolExamen } from '@/types/talento';

const DURACION_SEG = 15 * 60;

function ExamenTalentoPageInner() {
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [docPrefijo, setDocPrefijo] = useState<PrefijoCedulaVE>('V');
  const [docNumero, setDocNumero] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rolBuscado, setRolBuscado] = useState('');
  const [rolExamen, setRolExamen] = useState<RolExamen | ''>('');
  const [fase, setFase] = useState<'datos' | 'examen' | 'fin'>('datos');
  const [examenInicio, setExamenInicio] = useState<number | null>(null);
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

  const [empleadoInvId, setEmpleadoInvId] = useState<string | null>(null);
  const [examenInvToken, setExamenInvToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invitacionCargando, setInvitacionCargando] = useState(() => Boolean(urlToken));
  const [mensajeCierreTiempo, setMensajeCierreTiempo] = useState<string | null>(null);

  const persRef = useRef(pers);
  const logRef = useRef(log);
  persRef.current = pers;
  logRef.current = log;

  const onTimerFinish = useCallback(async () => {
    setExpirado(true);
    setMensajeCierreTiempo(null);
    const token = (examenInvToken ?? urlToken ?? '').trim();
    if (!token) return;
    try {
      const res = await fetch('/api/talento/examen/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          respuestas_personalidad: persRef.current,
          respuestas_logica: logRef.current,
        }),
      });
      const data = (await res.json()) as { error?: string; mensaje?: string };
      if (res.ok) {
        setMensajeCierreTiempo(
          typeof data.mensaje === 'string' ? data.mensaje : 'Evaluación parcial registrada por tiempo.',
        );
      } else {
        setError(data.error || 'No se pudo registrar el cierre por tiempo');
      }
    } catch {
      setError('No se pudo conectar al registrar el cierre por tiempo');
    }
  }, [examenInvToken, urlToken]);

  useEffect(() => {
    if (!urlToken) {
      setInviteError(null);
      setEmpleadoInvId(null);
      setExamenInvToken(null);
      setInvitacionCargando(false);
      return;
    }
    let cancelled = false;
    setInviteError(null);
    setInvitacionCargando(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/talento/examen/invitacion?token=${encodeURIComponent(urlToken)}`,
        );
        const data = (await res.json()) as {
          error?: string;
          nombre_completo?: string;
          email?: string | null;
          telefono?: string | null;
          whatsapp?: string | null;
          cedula?: string | null;
          rol_examen?: string;
          rol_buscado?: string | null;
          empleado_id?: string;
          examen_token?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setInviteError(data.error || 'Invitación no válida');
          setEmpleadoInvId(null);
          setExamenInvToken(null);
          return;
        }
        setNombre((data.nombre_completo ?? '').trim());
        setEmail((data.email ?? '').trim());
        const wa = ((data.whatsapp ?? data.telefono) ?? '').trim();
        setTelefono(wa);
        const cedRaw = (data.cedula ?? '').trim();
        const parsed = parseDocumentoCedulaVE(cedRaw);
        if (parsed) {
          setDocPrefijo(parsed.prefijo);
          setDocNumero(parsed.numero);
        } else {
          setDocPrefijo('V');
          setDocNumero('');
        }
        setRolBuscado((data.rol_buscado ?? '').trim());
        const rx = data.rol_examen === 'programador' || data.rol_examen === 'tecnico' ? data.rol_examen : 'tecnico';
        setRolExamen(rx);
        setEmpleadoInvId(data.empleado_id ?? null);
        setExamenInvToken(data.examen_token ?? null);
      } catch {
        if (!cancelled) setInviteError('No se pudo validar el enlace');
      } finally {
        if (!cancelled) setInvitacionCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlToken]);

  const examen = useMemo(
    () => (rolExamen ? generarExamenAdaptativo(rolExamen) : null),
    [rolExamen],
  );

  const iniciarExamen = () => {
    const docStr = formatDocumentoCedulaVE(docPrefijo, docNumero);
    if (!nombre.trim() || !rolBuscado.trim() || !rolExamen) {
      setError('Faltan datos en tu expediente (nombre o cargo). Contacta a RRHH para completar el registro.');
      return;
    }
    if (!docStr) {
      setError('Falta la cédula en tu expediente. Contacta a RRHH para actualizarla.');
      return;
    }
    setError(null);
    setMensajeCierreTiempo(null);
    setExpirado(false);
    setPers({});
    setLog({});
    const start = Date.now();
    setExamenInicio(start);
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
          ...(empleadoInvId && examenInvToken
            ? { empleado_id: empleadoInvId, examen_token: examenInvToken }
            : {}),
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
    empleadoInvId,
    examenInvToken,
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
      <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
        Veinte ítems de personalidad (escala 1–5) y cinco de lógica según tu perfil técnico. Con el{' '}
        <strong className="text-zinc-300">enlace de invitación</strong>, tu nombre, apellidos en razón social, cédula y
        WhatsApp se <strong className="text-zinc-300">precargan</strong> desde tu postulación. Al pulsar{' '}
        <strong className="text-zinc-300">Iniciar evaluación</strong> arranca el cronómetro: tienes{' '}
        <strong className="text-zinc-300">15 minutos</strong> para enviar; lo ideal es{' '}
        <strong className="text-zinc-300">terminar de una vez</strong>, sin pausas largas. Si se agota el tiempo, el envío
        completo se bloquea.
      </p>

      {inviteError && (
        <p className="text-sm text-amber-400/95 mb-4 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3">
          Enlace: {inviteError}
        </p>
      )}
      {fase === 'datos' && urlToken && invitacionCargando ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-6 text-center text-sm text-zinc-400">
          Validando tu enlace y cargando datos del expediente…
        </p>
      ) : null}

      {fase === 'datos' && urlToken && !invitacionCargando && empleadoInvId && !inviteError ? (
        <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
          <h2 className="text-lg font-semibold text-white">Tus datos (precargados)</h2>
          <p className="text-xs text-zinc-500">
            Tomados de tu postulación. Si ves un error, pide a RRHH que corrija el expediente antes de evaluarte.
          </p>
          <dl className="space-y-3 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-zinc-500">Nombre y apellidos</dt>
              <dd className="font-medium text-zinc-100">{nombre.trim() || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-zinc-500">Cédula</dt>
              <dd className="font-medium text-zinc-100">
                {formatDocumentoCedulaVE(docPrefijo, docNumero) || '—'}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-zinc-500">WhatsApp / móvil</dt>
              <dd className="font-medium text-zinc-100">{telefono.trim() || '—'}</dd>
            </div>
            {email.trim() ? (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-zinc-500">Correo</dt>
                <dd className="break-all font-medium text-zinc-100">{email.trim()}</dd>
              </div>
            ) : null}
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-zinc-500">Cargo / puesto</dt>
              <dd className="text-right font-medium text-zinc-100">{rolBuscado.trim() || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-zinc-500">Perfil de lógica del examen</dt>
              <dd className="font-medium capitalize text-sky-300">{rolExamen === 'programador' ? 'Programador' : 'Técnico de campo'}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-4 py-3 text-sm leading-relaxed text-amber-100/95">
            <strong className="text-amber-200">Importante:</strong> al pulsar «Iniciar evaluación ahora» comienza el tiempo
            de <strong>15 minutos</strong>. Lo recomendable es <strong>completar todo el cuestionario de una sola vez</strong>,
            sin salir ni dejar pasar mucho rato; si se vence el plazo, no podrás enviar las respuestas completas.
          </div>

          {!formatDocumentoCedulaVE(docPrefijo, docNumero) ? (
            <p className="text-sm text-amber-300/95">
              No hay cédula válida en el expediente: el botón de inicio permanecerá desactivado hasta que RRHH la registre.
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="button"
            disabled={!nombre.trim() || !rolBuscado.trim() || !rolExamen || !formatDocumentoCedulaVE(docPrefijo, docNumero)}
            onClick={iniciarExamen}
            className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
          >
            Iniciar evaluación ahora
          </button>
        </div>
      ) : null}

      {fase === 'datos' && !urlToken ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 text-center text-sm text-zinc-400">
          <p className="max-w-md mx-auto leading-relaxed">
            Para hacer esta evaluación necesitas el <strong className="text-zinc-200">enlace con token</strong> que te envía
            Casa Inteligente o RRHH (termina en <code className="text-zinc-500">?token=…</code>).
          </p>
          <Link href="/talento" className="mt-6 inline-block text-sky-400 hover:underline">
            Volver al hub Talento
          </Link>
        </div>
      ) : null}

      {fase === 'examen' && examen && examenInicio != null && (
        <ExamenTimer
          resetKey={examenInicio}
          expiraEnSegundos={DURACION_SEG}
          onFinish={() => void onTimerFinish()}
        />
      )}

      {fase === 'examen' && examen && (
        <div className="space-y-6">
          <div
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${
              expirado ? 'border-red-500/50 bg-red-950/20' : 'border-zinc-800 bg-zinc-950/50'
            }`}
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Tiempo</p>
              <p className="text-sm text-zinc-300">
                {expirado
                  ? 'Tiempo agotado — envío bloqueado.'
                  : 'Cuenta regresiva arriba (15:00 → 00:00). Intenta avanzar sin pausas largas hasta enviar.'}
              </p>
              {expirado && mensajeCierreTiempo && (
                <p className="text-sm text-emerald-400/95 mt-2 max-w-md">{mensajeCierreTiempo}</p>
              )}
            </div>
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
          {resultado.estado === 'aprobado' ? (
            <div className="mt-8 max-w-lg mx-auto rounded-xl border border-emerald-600/30 bg-emerald-950/20 px-4 py-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">Contrato laboral</p>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
                Con evaluación favorable, el siguiente paso es el <strong className="text-white">contrato de trabajo</strong>:
                RRHH lo generará en el sistema y te compartirá un enlace para revisarlo en PDF,{' '}
                <strong className="text-white">aceptarlo de forma electrónica</strong> y luego{' '}
                <strong className="text-white">imprimirlo y firmarlo en físico</strong> (firma autógrafa y huella), según
                las instrucciones del equipo.
              </p>
              <p className="mt-2 text-[11px] text-zinc-500">
                Ruta pública (cuando te envíen el enlace):{' '}
                <code className="text-zinc-400">/registro/contrato-laboral/[id]?token=…</code>
              </p>
            </div>
          ) : null}
          <Link href="/talento" className="mt-8 inline-block text-sky-400 text-sm hover:underline">
            Volver al hub
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ExamenTalentoPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-10 text-zinc-400 text-sm">Cargando examen…</div>
      }
    >
      <ExamenTalentoPageInner />
    </Suspense>
  );
}
