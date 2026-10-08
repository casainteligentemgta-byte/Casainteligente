'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Copy, Loader2, MessageCircle, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CARGOS_OBREROS } from '@/lib/constants/cargosObreros';
import { enlaceWhatsApp, whatsappInternacional } from '@/lib/rrhh/cargaMasivaObreros';

type Obra = { id: string; nombre: string; entidad: string };

type Registrado = {
  id: string;
  nombre: string;
  cedula: string;
  whatsapp: string;
  oficio: string;
  cargo_codigo: string | null;
  etapa: 'enlace_enviado' | 'hoja_lista' | 'descartado';
  evaluacion: 'no_pedida' | 'pendiente' | 'hecha';
  resultado: string;
  enlace_hoja_vida: string | null;
  enlace_evaluacion: string | null;
};

type Solicitud = {
  id: string;
  general: boolean;
  oficio: string;
  codigo: string | null;
  nivel: number | null;
  plazas: number;
  cubiertas: number;
  abierta: boolean;
  enlace_sin_evaluacion: string;
  enlace_con_evaluacion: string;
  registrados: Registrado[];
};

type Linea = { clave: number; oficio: string; cantidad: string };
type EnlaceListo = { url: string; etiqueta: string };

const card = 'rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black uppercase disabled:opacity-40';
const btnGhost = `${btn} border border-white/10 text-zinc-300 hover:bg-white/[0.06]`;
const input = 'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600';
/** Cantidad: solo 4 dígitos; el resto del renglón es el cargo del tabulador. */
const inputCantidad =
  'w-[4.75rem] shrink-0 rounded-xl border border-white/10 bg-black/40 px-1.5 py-2.5 text-center text-sm font-semibold tabular-nums text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const inputOficioTabulador =
  'min-h-[48px] min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-base font-medium text-white';
const chip = 'inline-block rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase';
const CANTIDAD_MAX = 9999;

const NIVELES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function OpcionesOficio() {
  return (
    <>
      {NIVELES.map((nivel) => (
        <optgroup key={nivel} label={`Nivel ${nivel}`} className="bg-zinc-900 text-zinc-300">
          {CARGOS_OBREROS.filter((c) => c.nivel === nivel).map((c) => (
            <option key={c.codigo} value={c.codigo} className="bg-zinc-900 text-white">
              {c.codigo.replace('.', ',')} · {c.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

function chipEtapa(r: Registrado): { texto: string; clase: string } {
  if (r.etapa === 'descartado') return { texto: 'Descartado', clase: 'border-red-500/30 bg-red-500/10 text-red-300' };
  if (r.etapa === 'hoja_lista') return { texto: 'Hoja de vida lista', clase: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' };
  return { texto: 'Enlace enviado', clase: 'border-white/10 bg-white/[0.05] text-zinc-400' };
}

function chipEvaluacion(r: Registrado): { texto: string; clase: string } | null {
  if (r.evaluacion === 'no_pedida') return null;
  if (r.evaluacion === 'pendiente') return { texto: 'Evaluación pendiente', clase: 'border-amber-500/30 bg-amber-500/10 text-amber-200' };
  const res = (r.resultado || '').toLowerCase();
  const clase = res.includes('rojo') || res.includes('reprob')
    ? 'border-red-500/30 bg-red-500/10 text-red-300'
    : res.includes('amar') || res.includes('observ')
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : 'border-sky-500/30 bg-sky-500/10 text-sky-300';
  return { texto: `Evaluado${r.resultado ? ` · ${r.resultado.replace(/_/g, ' ')}` : ''}`, clase };
}

export default function SolicitudPersonalClient() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const obraInicial = (searchParams.get('proyecto_modulo') ?? '').trim();

  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState(obraInicial);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [sinSolicitud, setSinSolicitud] = useState<Registrado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([{ clave: 1, oficio: '', cantidad: '1' }]);
  const [creando, setCreando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  /** Enlaces recién generados por persona, listos para tocar «WhatsApp». */
  const [enlaces, setEnlaces] = useState<Record<string, EnlaceListo>>({});
  const [persona, setPersona] = useState<Record<string, { nombre: string; whatsapp: string; cedula: string; evaluacion: boolean }>>({});
  const [formAbierto, setFormAbierto] = useState<string | null>(null);

  const obra = obras.find((o) => o.id === obraId) ?? null;
  const empresa = obra?.entidad || 'la empresa';

  useEffect(() => {
    void (async () => {
      const [{ data: pr }, { data: ent }] = await Promise.all([
        supabase.from('ci_proyectos').select('id,nombre,entidad_id,created_at').order('created_at', { ascending: false }).limit(300),
        supabase.from('ci_entidades').select('id,nombre'),
      ]);
      const nombreEnt = new Map(((ent ?? []) as Array<{ id: string; nombre: string }>).map((e) => [e.id, e.nombre]));
      setObras(
        ((pr ?? []) as Array<{ id: string; nombre: string | null; entidad_id: string | null }>).map((p) => ({
          id: p.id,
          nombre: p.nombre ?? '(sin nombre)',
          entidad: (p.entidad_id && nombreEnt.get(p.entidad_id)) || '',
        })),
      );
    })();
  }, [supabase]);

  const cargar = useCallback(async () => {
    if (!obraId) {
      setSolicitudes([]);
      setSinSolicitud([]);
      return;
    }
    setCargando(true);
    try {
      const r = await fetch(`/api/rrhh/solicitudes-personal?proyecto_id=${encodeURIComponent(obraId)}`, { cache: 'no-store' });
      const j = (await r.json()) as { solicitudes?: Solicitud[]; sin_solicitud?: Registrado[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudieron cargar las solicitudes');
      setSolicitudes(j.solicitudes ?? []);
      setSinSolicitud(j.sin_solicitud ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [obraId]);

  useEffect(() => {
    setEnlaces({});
    setAviso(null);
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!obraId) return;
    const t = setInterval(() => void cargar(), 30000);
    return () => clearInterval(t);
  }, [obraId, cargar]);

  const llamar = async (url: string, init: RequestInit): Promise<Record<string, unknown> | null> => {
    setError(null);
    try {
      const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(String(j.error ?? 'No se pudo completar la acción'));
      return j;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  const crearSolicitud = async () => {
    const validas = lineas
      .filter((l) => l.oficio)
      .map((l) => ({
        oficio: l.oficio,
        cantidad: Math.max(1, Math.min(CANTIDAD_MAX, Math.floor(Number(l.cantidad) || 1))),
      }));
    if (!obraId || !validas.length) {
      setError('Elige la obra y al menos un oficio.');
      return;
    }
    setCreando(true);
    const j = await llamar('/api/rrhh/solicitudes-personal', {
      method: 'POST',
      body: JSON.stringify({ proyecto_id: obraId, lineas: validas }),
    });
    setCreando(false);
    if (j) {
      setLineas([{ clave: Date.now(), oficio: '', cantidad: '1' }]);
      setAviso('Solicitud creada. Ya puedes enviar su enlace.');
      void cargar();
    }
  };

  const accionSolicitud = async (id: string, accion: 'cerrar' | 'reabrir') => {
    setOcupado(id);
    const j = await llamar('/api/rrhh/solicitudes-personal', { method: 'PATCH', body: JSON.stringify({ id, accion }) });
    setOcupado(null);
    if (j) void cargar();
  };

  const borrarSolicitud = async (id: string) => {
    if (!window.confirm('¿Borrar esta solicitud?')) return;
    setOcupado(id);
    const j = await llamar(`/api/rrhh/solicitudes-personal?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setOcupado(null);
    if (j) void cargar();
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      window.prompt('Copia el enlace:', texto);
    }
  };

  const mensajeAbierto = (s: Solicitud, enlace: string, conEvaluacion: boolean) =>
    [
      `${empresa} solicita personal para la obra ${obra?.nombre ?? ''}${s.general ? '' : `: ${s.oficio}`}.`,
      'Llena tu hoja de vida desde este enlace. Ten a mano tu cédula para tomarle una foto:',
      enlace,
      conEvaluacion ? 'Al terminar se abre una evaluación corta; hay que completarla.' : '',
    ]
      .filter(Boolean)
      .join('\n\n');

  const mensajePersonal = (nombre: string, oficio: string, enlace: string, conEvaluacion: boolean) =>
    [
      `Hola ${nombre.trim().split(/\s+/)[0] ?? ''}. Te escribimos de ${empresa} por la obra ${obra?.nombre ?? ''}.`,
      `Para tu ingreso como ${oficio}, llena tu hoja de vida desde este enlace personal (es solo para ti):`,
      enlace,
      conEvaluacion ? 'Al terminar se abre una evaluación corta; hay que completarla.' : '',
    ]
      .filter(Boolean)
      .join('\n\n');

  const mensajeEvaluacion = (nombre: string, enlace: string) =>
    [
      `Hola ${nombre.trim().split(/[\s,]+/)[0] ?? ''}. Para completar tu ingreso a la obra ${obra?.nombre ?? ''}, presenta esta evaluación corta:`,
      enlace,
    ].join('\n\n');

  const waA = (numero: string, mensaje: string): string => {
    const n = whatsappInternacional(numero);
    return n ? enlaceWhatsApp(n, mensaje) : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  };

  const crearEnlacePersona = async (s: Solicitud) => {
    const p = persona[s.id] ?? { nombre: '', whatsapp: '', cedula: '', evaluacion: false };
    setOcupado(`persona-${s.id}`);
    const j = await llamar('/api/rrhh/solicitudes-personal/persona', {
      method: 'POST',
      body: JSON.stringify({ solicitud_id: s.id, nombre: p.nombre, whatsapp: p.whatsapp, cedula: p.cedula, evaluacion: p.evaluacion }),
    });
    setOcupado(null);
    if (!j) return;
    const id = String(j.empleado_id ?? '');
    const enlace = typeof j.enlace === 'string' ? j.enlace : '';
    if (enlace && id) {
      const esEvaluacion = j.hoja_vida_lista === true;
      setEnlaces((prev) => ({
        ...prev,
        [id]: {
          url: waA(p.whatsapp, esEvaluacion ? mensajeEvaluacion(p.nombre, enlace) : mensajePersonal(p.nombre, s.oficio, enlace, p.evaluacion)),
          etiqueta: esEvaluacion ? 'Enviar evaluación' : 'Enviar enlace',
        },
      }));
    }
    setAviso(
      j.ya_tenia_expediente === true
        ? j.hoja_vida_lista === true
          ? 'Esta persona ya tenía expediente con hoja de vida: quedó asignada a la solicitud.'
          : 'Esta persona ya tenía expediente: se reutilizó. Envíale el enlace para completar su hoja de vida.'
        : 'Enlace creado. Toca «Enviar enlace» en su fila.',
    );
    setPersona((prev) => ({ ...prev, [s.id]: { nombre: '', whatsapp: '', cedula: '', evaluacion: false } }));
    setFormAbierto(null);
    void cargar();
  };

  const accionPersona = async (r: Registrado, accion: 'pedir_evaluacion' | 'reenviar_enlace' | 'descartar' | 'reactivar') => {
    if (accion === 'descartar' && !window.confirm(`¿Descartar a ${r.nombre}?`)) return;
    setOcupado(r.id);
    const j = await llamar('/api/rrhh/solicitudes-personal/accion', {
      method: 'POST',
      body: JSON.stringify({ empleado_id: r.id, accion }),
    });
    setOcupado(null);
    if (!j) return;
    const enlace = typeof j.enlace === 'string' ? j.enlace : '';
    if (accion === 'pedir_evaluacion') {
      if (j.ya_evaluado === true) setAviso(`${r.nombre} ya presentó la evaluación.`);
      else if (enlace) {
        setEnlaces((prev) => ({ ...prev, [r.id]: { url: waA(r.whatsapp, mensajeEvaluacion(r.nombre, enlace)), etiqueta: 'Enviar evaluación' } }));
        setAviso('Evaluación activada. Toca «Enviar evaluación» en su fila.');
      }
    }
    if (accion === 'reenviar_enlace' && enlace) {
      setEnlaces((prev) => ({
        ...prev,
        [r.id]: { url: waA(r.whatsapp, mensajePersonal(r.nombre, r.oficio.replace(/^\d+[.,]\d+\s*/, ''), enlace, r.evaluacion === 'pendiente')), etiqueta: 'Enviar enlace' },
      }));
    }
    void cargar();
  };

  const cambiarOficio = async (r: Registrado, codigo: string) => {
    if (!codigo) return;
    setOcupado(r.id);
    const j = await llamar('/api/rrhh/carga-masiva-obreros', {
      method: 'PATCH',
      body: JSON.stringify({ empleado_id: r.id, oficio: codigo }),
    });
    setOcupado(null);
    if (j) void cargar();
  };

  const filaRegistrado = (r: Registrado, oficioEditable: boolean) => {
    const etapa = chipEtapa(r);
    const evaluacion = chipEvaluacion(r);
    const listo = enlaces[r.id];
    const trabajando = ocupado === r.id;
    return (
      <div key={r.id} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{r.nombre || 'Sin nombre'}</p>
            <p className="text-xs text-zinc-500">
              {[r.cedula, r.oficio].filter(Boolean).join(' · ') || 'Aún sin datos'}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className={`${chip} ${etapa.clase}`}>{etapa.texto}</span>
              {evaluacion ? <span className={`${chip} ${evaluacion.clase}`}>{evaluacion.texto}</span> : null}
            </div>
          </div>
          {trabajando ? <Loader2 size={14} className="mt-1 animate-spin text-zinc-400" /> : null}
        </div>

        {oficioEditable && r.etapa !== 'descartado' ? (
          <label className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            Oficio
            <select
              value={r.cargo_codigo ?? ''}
              disabled={trabajando}
              onChange={(e) => void cambiarOficio(r, e.target.value)}
              className="max-w-[230px] rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs font-normal normal-case tracking-normal text-white"
            >
              {r.cargo_codigo ? null : (
                <option value="" className="bg-zinc-900">
                  Sin oficio
                </option>
              )}
              <OpcionesOficio />
            </select>
          </label>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-2">
          {listo ? (
            <a href={listo.url} target="_blank" rel="noopener noreferrer" className={`${btn} bg-emerald-500 text-black`}>
              <MessageCircle size={14} /> {listo.etiqueta}
            </a>
          ) : null}
          {r.etapa === 'enlace_enviado' && !listo ? (
            <button type="button" disabled={trabajando} onClick={() => void accionPersona(r, 'reenviar_enlace')} className={btnGhost}>
              Reenviar enlace
            </button>
          ) : null}
          {r.etapa === 'hoja_lista' && r.evaluacion === 'no_pedida' && !listo ? (
            <button type="button" disabled={trabajando} onClick={() => void accionPersona(r, 'pedir_evaluacion')} className={btnGhost}>
              Pedir evaluación
            </button>
          ) : null}
          {r.etapa === 'hoja_lista' && r.evaluacion === 'pendiente' && r.enlace_evaluacion && !listo ? (
            <a
              href={waA(r.whatsapp, mensajeEvaluacion(r.nombre, r.enlace_evaluacion))}
              target="_blank"
              rel="noopener noreferrer"
              className={btnGhost}
            >
              <MessageCircle size={14} /> Reenviar evaluación
            </a>
          ) : null}
          {r.etapa === 'descartado' ? (
            <button type="button" disabled={trabajando} onClick={() => void accionPersona(r, 'reactivar')} className={btnGhost}>
              Reactivar
            </button>
          ) : (
            <button type="button" disabled={trabajando} onClick={() => void accionPersona(r, 'descartar')} className={`${btn} text-zinc-500 hover:text-red-300`}>
              Descartar
            </button>
          )}
        </div>
      </div>
    );
  };

  const filaEnlace = (s: Solicitud, conEvaluacion: boolean) => {
    const enlace = conEvaluacion ? s.enlace_con_evaluacion : s.enlace_sin_evaluacion;
    return (
      <div
        key={conEvaluacion ? 'con' : 'sin'}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
      >
        <p className="text-sm font-semibold">{conEvaluacion ? 'Con evaluación obligatoria' : 'Sin evaluación'}</p>
        <div className="flex gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(mensajeAbierto(s, enlace, conEvaluacion))}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn} bg-emerald-500 text-black`}
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
          <button type="button" onClick={() => void copiar(enlace)} className={btnGhost}>
            <Copy size={14} /> {copiado === enlace ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-6 pb-28 text-white">
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <Link href="/rrhh/hojas-vida" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-white">
            <ArrowLeft size={14} /> RRHH
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Solicitud de personal</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pide personal por oficio, envía el enlace y sigue quién completó su hoja de vida. Al completarla, el trabajador
            entra a la banca de obreros.
          </p>
        </div>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {aviso ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{aviso}</div> : null}

        <section className={card}>
          <h2 className="text-xs font-black uppercase tracking-wider text-[#FF9500]">Obra</h2>
          <select value={obraId} onChange={(e) => setObraId(e.target.value)} className={`${input} mt-3`}>
            <option value="" className="bg-zinc-900">
              Elige la obra…
            </option>
            {obras.map((o) => (
              <option key={o.id} value={o.id} className="bg-zinc-900">
                {o.nombre}
                {o.entidad ? ` — ${o.entidad}` : ''}
              </option>
            ))}
          </select>
        </section>

        {obraId ? (
          <section className={card}>
            <h2 className="text-xs font-black uppercase tracking-wider text-[#FF9500]">Nueva solicitud</h2>
            <div className="mt-3 space-y-2">
              {lineas.map((l) => (
                <div key={l.clave} className="flex items-stretch gap-2">
                  <input
                    type="number"
                    min={1}
                    max={CANTIDAD_MAX}
                    maxLength={4}
                    inputMode="numeric"
                    value={l.cantidad}
                    onChange={(e) => {
                      const crudo = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setLineas((prev) => prev.map((x) => (x.clave === l.clave ? { ...x, cantidad: crudo } : x)));
                    }}
                    className={inputCantidad}
                    aria-label="Cantidad de obreros de este oficio"
                    title="Cantidad (hasta 4 dígitos)"
                  />
                  <select
                    value={l.oficio}
                    onChange={(e) => setLineas((prev) => prev.map((x) => (x.clave === l.clave ? { ...x, oficio: e.target.value } : x)))}
                    className={inputOficioTabulador}
                    aria-label="Tipo de obrero según tabulador"
                    title="Nombre del cargo según tabulador"
                  >
                    <option value="" className="bg-zinc-900">
                      Tipo de obrero según tabulador…
                    </option>
                    <OpcionesOficio />
                  </select>
                  {lineas.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setLineas((prev) => prev.filter((x) => x.clave !== l.clave))}
                      className="shrink-0 p-2 text-zinc-500 hover:text-red-300"
                      aria-label="Quitar"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLineas((prev) => [...prev, { clave: Date.now(), oficio: '', cantidad: '1' }])}
                className={btnGhost}
              >
                <Plus size={14} /> Otro oficio
              </button>
              <button type="button" disabled={creando} onClick={() => void crearSolicitud()} className={`${btn} bg-[#FF9500] text-black`}>
                {creando ? <Loader2 size={14} className="animate-spin" /> : null} Crear solicitud
              </button>
              <Link href="/rrhh/carga-masiva" className={btnGhost}>
                <Upload size={14} /> Subir Excel
              </Link>
            </div>
          </section>
        ) : null}

        {obraId ? (
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400">Solicitudes de la obra</h2>
            <button type="button" onClick={() => void cargar()} className={btnGhost}>
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Actualizar
            </button>
          </div>
        ) : null}

        {obraId && !cargando && solicitudes.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no hay solicitudes en esta obra.</p>
        ) : null}

        {solicitudes.map((s) => {
          const p = persona[s.id] ?? { nombre: '', whatsapp: '', cedula: '', evaluacion: false };
          const trabajando = ocupado === s.id;
          return (
            <section key={s.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black">
                    {s.general ? 'Enlace general de la obra' : `${(s.codigo ?? '').replace('.', ',')} · ${s.oficio}`}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {s.general
                      ? `El trabajador elige su oficio · ${s.cubiertas} con hoja de vida`
                      : `${s.plazas} plaza${s.plazas === 1 ? '' : 's'} · ${s.cubiertas} cubierta${s.cubiertas === 1 ? '' : 's'} · ${Math.max(0, s.plazas - s.cubiertas)} por cubrir`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${chip} ${s.abierta ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.05] text-zinc-400'}`}>
                    {s.abierta ? 'Abierta' : 'Cerrada'}
                  </span>
                  <button type="button" disabled={trabajando} onClick={() => void accionSolicitud(s.id, s.abierta ? 'cerrar' : 'reabrir')} className={btnGhost}>
                    {s.abierta ? 'Cerrar' : 'Reabrir'}
                  </button>
                  {s.registrados.length === 0 ? (
                    <button type="button" disabled={trabajando} onClick={() => void borrarSolicitud(s.id)} className="p-2 text-zinc-500 hover:text-red-300" aria-label="Borrar solicitud">
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
              </div>

              {s.abierta ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Enlace para el sindicato</p>
                  {filaEnlace(s, false)}
                  {filaEnlace(s, true)}
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">Cerrada: el enlace abierto ya no acepta registros. Reábrela para seguir recibiendo.</p>
              )}

              {!s.general ? (
                <div className="mt-4">
                  {formAbierto === s.id ? (
                    <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Enviar a una persona</p>
                      <input
                        className={input}
                        placeholder="Nombre y apellido"
                        value={p.nombre}
                        onChange={(e) => setPersona((prev) => ({ ...prev, [s.id]: { ...p, nombre: e.target.value } }))}
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          className={input}
                          placeholder="WhatsApp (0414-1234567)"
                          inputMode="tel"
                          value={p.whatsapp}
                          onChange={(e) => setPersona((prev) => ({ ...prev, [s.id]: { ...p, whatsapp: e.target.value } }))}
                        />
                        <input
                          className={input}
                          placeholder="Cédula (opcional)"
                          value={p.cedula}
                          onChange={(e) => setPersona((prev) => ({ ...prev, [s.id]: { ...p, cedula: e.target.value } }))}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={p.evaluacion}
                          onChange={(e) => setPersona((prev) => ({ ...prev, [s.id]: { ...p, evaluacion: e.target.checked } }))}
                          className="h-4 w-4"
                        />
                        Con evaluación
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={ocupado === `persona-${s.id}`}
                          onClick={() => void crearEnlacePersona(s)}
                          className={`${btn} bg-[#FF9500] text-black`}
                        >
                          {ocupado === `persona-${s.id}` ? <Loader2 size={14} className="animate-spin" /> : null} Crear enlace
                        </button>
                        <button type="button" onClick={() => setFormAbierto(null)} className={btnGhost}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setFormAbierto(s.id)} className={btnGhost}>
                      <Plus size={14} /> Enviar a una persona
                    </button>
                  )}
                </div>
              ) : null}

              {s.registrados.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Quiénes respondieron</p>
                  {s.registrados.map((r) => filaRegistrado(r, s.general))}
                </div>
              ) : null}
            </section>
          );
        })}

        {sinSolicitud.length ? (
          <section className={card}>
            <h3 className="text-base font-black">Registrados sin solicitud</h3>
            <p className="mt-0.5 text-xs text-zinc-400">Cargados por Excel o por un enlace anterior.</p>
            <div className="mt-3 space-y-2">
              {sinSolicitud.map((r) => filaRegistrado(r, true))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
