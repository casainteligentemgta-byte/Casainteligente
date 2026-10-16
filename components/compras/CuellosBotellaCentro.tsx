'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { apiUrl } from '@/lib/http/apiUrl';
import type { ClaveEtapa, EtapaCuello, ItemCuello, ResumenCuellos } from '@/lib/compras/cuellosBotella';

/** Dónde se resuelve cada etapa. */
const ENLACE_ETAPA: Record<ClaveEtapa, (it: ItemCuello) => string> = {
  aprobacion: () => '/contabilidad/procuras',
  compra: () => '/contabilidad/procuras',
  ingreso: () => '/contabilidad/procuras',
  canal: (it) => `/contabilidad/compras/canal?pendiente=${it.id}`,
  retiro: () => '/almacen/retiros',
  transporte: () => '/almacen/retiros',
  cuarentena: () => '/almacen/recepcion?tab=transito',
  pedidos: () => '/almacen/pedidos',
};

function edad(horas: number): string {
  if (horas < 1) return '< 1 h';
  if (horas < 24) return `${Math.round(horas)} h`;
  const d = Math.floor(horas / 24);
  return `${d} d`;
}

function tono(e: EtapaCuello): { borde: string; texto: string; punto: string } {
  if (e.criticos > 0) return { borde: 'border-red-500/50 bg-red-500/10', texto: 'text-red-300', punto: 'bg-red-500' };
  if (e.detenidos > 0) return { borde: 'border-[#FF9500]/50 bg-[#FF9500]/10', texto: 'text-[#FF9500]', punto: 'bg-[#FF9500]' };
  if (e.items.length > 0) return { borde: 'border-sky-400/30 bg-sky-400/5', texto: 'text-sky-300', punto: 'bg-sky-400' };
  return { borde: 'border-white/[0.08] bg-white/[0.02]', texto: 'text-emerald-300', punto: 'bg-emerald-500' };
}

export default function CuellosBotellaCentro() {
  const [datos, setDatos] = useState<ResumenCuellos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [obra, setObra] = useState<string>('');
  const [abierta, setAbierta] = useState<ClaveEtapa | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/compras/cuellos-botella'), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'No se pudo cargar');
      setDatos(json as ResumenCuellos);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const obras = useMemo(() => {
    const s = new Set<string>();
    for (const e of datos?.etapas ?? []) for (const i of e.items) if (i.obra) s.add(i.obra);
    return Array.from(s).sort();
  }, [datos]);

  const etapas = useMemo(() => {
    return (datos?.etapas ?? []).map((e) => {
      const items = obra ? e.items.filter((i) => i.obra === obra) : e.items;
      return {
        ...e,
        items,
        detenidos: items.filter((i) => i.detenido).length,
        criticos: items.filter((i) => i.critico).length,
        horasMaximas: items[0]?.horas ?? 0,
      };
    });
  }, [datos, obra]);

  const peor = useMemo(() => {
    const conDetenidos = etapas.filter((e) => e.detenidos > 0);
    return conDetenidos.sort((a, b) => b.criticos - a.criticos || b.detenidos - a.detenidos || b.horasMaximas - a.horasMaximas)[0];
  }, [etapas]);

  const totalDetenidos = etapas.reduce((s, e) => s + e.detenidos, 0);
  const totalCriticos = etapas.reduce((s, e) => s + e.criticos, 0);
  const totalAbiertos = etapas.reduce((s, e) => s + e.items.length, 0);

  async function enviarAvisos() {
    if (!window.confirm('¿Enviar ahora por Telegram a cada responsable lo que tiene detenido?')) return;
    setEnviando(true);
    setAvisoEnvio(null);
    try {
      const res = await fetch(apiUrl('/api/compras/cuellos-botella'), { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'No se pudieron enviar');
      setAvisoEnvio(
        json.detenidos === 0
          ? 'No hay nada detenido: no se envió ningún aviso.'
          : `Avisos enviados a ${json.enviados} de ${json.destinatarios} persona(s) por ${json.detenidos} pendiente(s).`,
      );
    } catch (e) {
      setAvisoEnvio(e instanceof Error ? e.message : 'No se pudieron enviar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {obras.length > 0 && (
          <select
            value={obra}
            onChange={(e) => setObra(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-200"
            aria-label="Filtrar por obra"
          >
            <option value="">Todas las obras</option>
            {obras.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => void enviarAvisos()}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF9500]/40 bg-[#FF9500]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#FF9500] hover:bg-[#FF9500]/20 disabled:opacity-50"
        >
          {enviando ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <BellRing size={13} aria-hidden />}
          Enviar avisos ahora
        </button>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} aria-hidden />
          Actualizar
        </button>
      </div>

      {avisoEnvio && (
        <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-zinc-300">{avisoEnvio}</p>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</p>
      )}

      {cargando && !datos ? (
        <p className="flex items-center gap-2 py-10 text-sm text-zinc-500">
          <Loader2 className="animate-spin text-[#FF9500]" size={18} aria-hidden />
          Calculando…
        </p>
      ) : datos ? (
        <>
          <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-xl">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">En curso</p>
              <p className="text-2xl font-black tabular-nums">{totalAbiertos}</p>
            </div>
            <div className="rounded-2xl border border-[#FF9500]/30 bg-[#FF9500]/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF9500]">Detenidos</p>
              <p className="text-2xl font-black tabular-nums text-[#FF9500]">{totalDetenidos}</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">Críticos</p>
              <p className="text-2xl font-black tabular-nums text-red-300">{totalCriticos}</p>
            </div>
          </div>

          {peor ? (
            <p className="mb-4 flex items-start gap-2 rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/5 px-3 py-2 text-[12px] text-zinc-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#FF9500]" aria-hidden />
              <span>
                El cuello de botella ahora es <b>{peor.titulo.toLowerCase()}</b>: {peor.detenidos} detenido(s), el más
                viejo lleva {edad(peor.horasMaximas)}. Le toca a <b>{peor.responsable}</b>.
              </span>
            </p>
          ) : (
            <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-300">
              Nada detenido: todo está dentro de su plazo.
            </p>
          )}

          <ol className="space-y-2">
            {etapas.map((e, idx) => {
              const t = tono(e);
              const abiertaEsta = abierta === e.clave;
              return (
                <li key={e.clave} className={`rounded-2xl border ${t.borde}`}>
                  <button
                    type="button"
                    onClick={() => setAbierta(abiertaEsta ? null : e.clave)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={abiertaEsta}
                  >
                    <span className="w-5 text-[11px] font-black tabular-nums text-zinc-500">{idx + 1}</span>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.punto}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-white">{e.titulo}</span>
                      <span className="block truncate text-[11px] text-zinc-500">
                        {e.responsable} · plazo {edad(e.umbralHoras)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`block text-sm font-black tabular-nums ${t.texto}`}>
                        {e.detenidos > 0 ? `${e.detenidos} detenido${e.detenidos === 1 ? '' : 's'}` : e.items.length > 0 ? 'en plazo' : 'vacío'}
                      </span>
                      <span className="block text-[11px] tabular-nums text-zinc-500">
                        {e.items.length} en curso{e.items.length ? ` · máx ${edad(e.horasMaximas)}` : ''}
                      </span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={`shrink-0 text-zinc-500 transition-transform ${abiertaEsta ? 'rotate-90' : ''}`}
                      aria-hidden
                    />
                  </button>

                  {abiertaEsta && (
                    <div className="border-t border-white/[0.06] px-4 py-3">
                      {e.items.length === 0 ? (
                        <p className="text-[12px] text-zinc-500">Nada en esta etapa.</p>
                      ) : (
                        <ul className="space-y-2">
                          {e.items.map((it) => (
                            <li key={`${e.clave}-${it.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                                  it.critico
                                    ? 'bg-red-500/20 text-red-300'
                                    : it.detenido
                                      ? 'bg-[#FF9500]/20 text-[#FF9500]'
                                      : 'bg-white/[0.06] text-zinc-400'
                                }`}
                              >
                                {edad(it.horas)}
                              </span>
                              <span className="font-bold text-white">{it.referencia}</span>
                              <span className="min-w-0 flex-1 truncate text-zinc-400">
                                {it.detalle}
                                {it.obra ? ` · ${it.obra}` : ''}
                              </span>
                              <Link
                                href={ENLACE_ETAPA[e.clave](it)}
                                className="text-[11px] font-bold text-[#FF9500] hover:underline"
                              >
                                Resolver
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
            Cada mañana (8:30) el bot de Telegram le envía a cada responsable lo que tiene detenido. Si algo lleva el
            doble del plazo, también se avisa a administración. Si la obra no tiene a nadie con ese rol en su nómina,
            el aviso va a administración.
          </p>
        </>
      ) : null}
    </div>
  );
}
