'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Loader2, MessageCircle, RefreshCw, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  ENCABEZADOS_PLANTILLA_CARGA,
  enlaceWhatsApp,
  etiquetaEstadoProceso,
  filasDesdeHoja,
  mensajeWhatsAppCarga,
  validarFilaCarga,
  whatsappInternacional,
  type FilaCargaMasivaEntrada,
  type FilaCargaMasivaValidada,
} from '@/lib/rrhh/cargaMasivaObreros';

type Obra = { id: string; nombre: string; entidad: string };

type Resultado = {
  fila: number;
  nombre: string;
  cedula: string;
  oficio: string;
  whatsapp: string;
  estado: 'creado' | 'existente' | 'error';
  mensaje?: string;
  enlace?: string;
};

type Avance = {
  id: string;
  nombre: string;
  cedula: string | null;
  whatsapp: string | null;
  oficio: string;
  estado_proceso: string | null;
  enlace: string | null;
};

const card = 'rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5';
const btn =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase disabled:opacity-40';

function colorEstado(estado: string | null | undefined): string {
  switch (estado) {
    case 'pendiente_cv':
    case 'prospecto_invitado':
      return 'text-zinc-400 bg-white/[0.05] border-white/[0.08]';
    case 'cv_completado':
    case 'examen_iniciado':
      return 'text-sky-300 bg-sky-500/10 border-sky-500/30';
    case 'examen_completado':
      return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
    case 'descartado':
      return 'text-red-300 bg-red-500/10 border-red-500/30';
    default:
      return 'text-zinc-400 bg-white/[0.05] border-white/[0.08]';
  }
}

export default function CargaMasivaObrerosClient() {
  const supabase = useMemo(() => createClient(), []);
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraId, setObraId] = useState('');
  const [filas, setFilas] = useState<FilaCargaMasivaValidada[]>([]);
  const [archivo, setArchivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [avance, setAvance] = useState<Avance[]>([]);
  const [cargandoAvance, setCargandoAvance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const obra = obras.find((o) => o.id === obraId) ?? null;

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

  const cargarAvance = useCallback(async () => {
    if (!obraId) {
      setAvance([]);
      return;
    }
    setCargandoAvance(true);
    try {
      const r = await fetch(`/api/rrhh/carga-masiva-obreros?proyecto_id=${encodeURIComponent(obraId)}`, {
        cache: 'no-store',
      });
      const j = (await r.json()) as { obreros?: Avance[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudo cargar el avance');
      setAvance(j.obreros ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargandoAvance(false);
    }
  }, [obraId]);

  useEffect(() => {
    setResultados([]);
    void cargarAvance();
  }, [cargarAvance]);

  // Refresco automático cada 30 s mientras la página esté abierta.
  useEffect(() => {
    if (!obraId) return;
    const t = setInterval(() => void cargarAvance(), 30000);
    return () => clearInterval(t);
  }, [obraId, cargarAvance]);

  const descargarPlantilla = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      [...ENCABEZADOS_PLANTILLA_CARGA],
      ['Pedro José Pérez Rojas', 'V-12345678', '5,1', '0414-1234567'],
    ]);
    ws['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Obreros');
    XLSX.writeFile(wb, 'plantilla_carga_obreros.xlsx');
  };

  const leerArchivo = async (f: File) => {
    setError(null);
    setResultados([]);
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '', raw: false });
      const entrada = filasDesdeHoja(rows);
      if (!entrada.length) {
        setError('No encontré obreros. Revisa que la primera fila tenga los encabezados de la plantilla.');
        setFilas([]);
        return;
      }
      setFilas(entrada.map(validarFilaCarga));
      setArchivo(f.name);
    } catch (e) {
      setError(`No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const validas = filas.filter((f) => f.errores.length === 0);
  const conError = filas.length - validas.length;

  const crearEnlaces = async () => {
    if (!obraId || !validas.length) return;
    setEnviando(true);
    setError(null);
    try {
      const payload: FilaCargaMasivaEntrada[] = validas.map(({ nombre, cedula, oficio, whatsapp }) => ({
        nombre,
        cedula,
        oficio,
        whatsapp,
      }));
      const r = await fetch('/api/rrhh/carga-masiva-obreros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: obraId, filas: payload }),
      });
      const j = (await r.json()) as { resultados?: Resultado[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? 'No se pudo procesar la carga');
      setResultados(j.resultados ?? []);
      setFilas([]);
      setArchivo('');
      if (inputRef.current) inputRef.current.value = '';
      void cargarAvance();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const linkWa = (nombre: string, oficio: string, whatsapp: string | null, enlace: string | null | undefined) => {
    const num = whatsappInternacional(whatsapp ?? '');
    if (!num || !enlace) return null;
    return enlaceWhatsApp(
      num,
      mensajeWhatsAppCarga({
        nombre,
        empresa: obra?.entidad ?? '',
        obra: obra?.nombre ?? '',
        oficio: oficio.replace(/^\d+[.,]\d+\s*/, ''),
        enlace,
      }),
    );
  };

  const copiar = async (enlace: string) => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(enlace);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      window.prompt('Copia el enlace:', enlace);
    }
  };

  const BotonesEnvio = ({ nombre, oficio, whatsapp, enlace }: { nombre: string; oficio: string; whatsapp: string | null; enlace: string | null | undefined }) => {
    const wa = linkWa(nombre, oficio, whatsapp, enlace);
    return (
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} bg-emerald-500 text-black px-3 py-2`}>
            <MessageCircle size={14} />
            WhatsApp
          </a>
        ) : null}
        {enlace ? (
          <button type="button" onClick={() => void copiar(enlace)} className={`${btn} border border-white/10 text-zinc-300 px-3 py-2`}>
            <Copy size={14} />
            {copiado === enlace ? 'Copiado' : 'Copiar'}
          </button>
        ) : null}
      </div>
    );
  };

  const resumen = useMemo(() => {
    const c = { total: avance.length, sinCv: 0, cv: 0, evaluados: 0 };
    for (const a of avance) {
      if (a.estado_proceso === 'pendiente_cv' || a.estado_proceso === 'prospecto_invitado') c.sinCv++;
      else if (a.estado_proceso === 'cv_completado' || a.estado_proceso === 'examen_iniciado') c.cv++;
      else if (a.estado_proceso === 'examen_completado') c.evaluados++;
    }
    return c;
  }, [avance]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-4 py-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <Link href="/rrhh" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-white">
            <ArrowLeft size={14} /> Recursos Humanos
          </Link>
          <h1 className="text-2xl font-black tracking-tight mt-2">Carga masiva de obreros</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Sube el Excel del administrador. Cada obrero recibe un enlace personal para llenar su hoja de vida, subir
            la cédula, firmar y presentar la evaluación. Oficio y obra quedan fijados por la empresa.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <section className={card}>
          <h2 className="text-xs font-black uppercase tracking-wider text-[#FF9500]">1 · Obra</h2>
          <select
            value={obraId}
            onChange={(e) => setObraId(e.target.value)}
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm"
          >
            <option value="">Elige la obra…</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
                {o.entidad ? ` — ${o.entidad}` : ''}
              </option>
            ))}
          </select>
        </section>

        <section className={card}>
          <h2 className="text-xs font-black uppercase tracking-wider text-[#FF9500]">2 · Excel del administrador</h2>
          <p className="text-xs text-zinc-500 mt-2">
            Columnas: Nombre completo · Cédula · Oficio (código del tabulador, p. ej. 5,1) · WhatsApp.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void descargarPlantilla()} className={`${btn} border border-white/10 text-zinc-200`}>
              <Download size={14} /> Plantilla
            </button>
            <label className={`${btn} bg-white/[0.08] text-white cursor-pointer ${!obraId ? 'opacity-40 pointer-events-none' : ''}`}>
              <Upload size={14} /> Subir Excel
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void leerArchivo(f);
                }}
              />
            </label>
            {!obraId ? <span className="self-center text-xs text-zinc-500">Primero elige la obra.</span> : null}
          </div>

          {filas.length ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                <span className="text-zinc-400">{archivo}:</span> {validas.length} listos
                {conError ? <span className="text-red-300"> · {conError} con errores (no se cargarán)</span> : null}
              </p>
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.04] text-zinc-400 text-left">
                    <tr>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Cédula</th>
                      <th className="px-3 py-2">Oficio</th>
                      <th className="px-3 py-2">WhatsApp</th>
                      <th className="px-3 py-2">Revisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} className="border-t border-white/[0.05]">
                        <td className="px-3 py-2">{f.nombre}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{f.cedulaNormalizada || f.cedula}</td>
                        <td className="px-3 py-2">
                          {f.cargo ? `${f.cargo.codigo.replace('.', ',')} ${f.cargo.nombre} (nivel ${f.cargo.nivel})` : f.oficio}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{f.whatsapp}</td>
                        <td className="px-3 py-2">
                          {f.errores.length ? (
                            <span className="text-red-300">{f.errores.join(' · ')}</span>
                          ) : (
                            <span className="text-emerald-300">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={!validas.length || enviando}
                onClick={() => void crearEnlaces()}
                className={`${btn} bg-[#FF9500] text-black`}
              >
                {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
                Crear {validas.length} expediente{validas.length === 1 ? '' : 's'} y enlaces
              </button>
            </div>
          ) : null}
        </section>

        {resultados.length ? (
          <section className={card}>
            <h2 className="text-xs font-black uppercase tracking-wider text-[#FF9500]">3 · Enviar enlaces</h2>
            <p className="text-xs text-zinc-500 mt-2">
              Toca «WhatsApp» en cada obrero: se abre el chat con el mensaje y su enlace listos para enviar.
            </p>
            <div className="mt-3 space-y-2">
              {resultados.map((r) => (
                <div
                  key={`${r.fila}-${r.cedula}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.nombre}</p>
                    <p className="text-xs text-zinc-500">
                      {r.cedula} · {r.oficio}
                      {r.estado === 'existente' ? <span className="text-amber-300"> · ya tenía expediente</span> : null}
                      {r.estado === 'error' ? <span className="text-red-300"> · {r.mensaje}</span> : null}
                    </p>
                  </div>
                  {r.estado !== 'error' ? (
                    <BotonesEnvio nombre={r.nombre} oficio={r.oficio} whatsapp={r.whatsapp} enlace={r.enlace} />
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {obraId ? (
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#FF9500]">Avance de la obra</h2>
              <button type="button" onClick={() => void cargarAvance()} className={`${btn} border border-white/10 text-zinc-300 px-3 py-2`}>
                {cargandoAvance ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Actualizar
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                ['Obreros', resumen.total],
                ['Sin hoja de vida', resumen.sinCv],
                ['Hoja de vida lista', resumen.cv],
                ['Evaluados', resumen.evaluados],
              ].map(([t, n]) => (
                <div key={String(t)} className="rounded-xl bg-black/30 border border-white/[0.05] py-3">
                  <p className="text-xl font-black">{n}</p>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t}</p>
                </div>
              ))}
            </div>
            {avance.length ? (
              <div className="mt-3 space-y-2">
                {avance.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{a.nombre}</p>
                      <p className="text-xs text-zinc-500">
                        {a.cedula} · {a.oficio}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase ${colorEstado(a.estado_proceso)}`}
                      >
                        {etiquetaEstadoProceso(a.estado_proceso)}
                      </span>
                    </div>
                    {a.estado_proceso === 'pendiente_cv' || a.estado_proceso === 'prospecto_invitado' ? (
                      <BotonesEnvio nombre={a.nombre} oficio={a.oficio} whatsapp={a.whatsapp} enlace={a.enlace} />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">{cargandoAvance ? 'Cargando…' : 'Aún no hay obreros cargados en esta obra.'}</p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
