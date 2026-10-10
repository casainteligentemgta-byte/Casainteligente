'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import {
  ESTADOS_PEDIDO_ACTIVOS,
  ETIQUETA_ESTADO_PEDIDO,
  type ListaPedidosMaterial,
  type PedidoMaterialVista,
} from '@/lib/almacen/listarPedidosMaterial';
import {
  ETIQUETA_TIPO_REQUERIMIENTO,
  type EstadoRequerimientoSalida,
} from '@/lib/almacen/requerimientoSalida';

type Filtro = 'activos' | 'todos';

const COLOR_ESTADO: Record<EstadoRequerimientoSalida, string> = {
  solicitado: 'border-[#FF9500]/40 bg-[#FF9500]/15 text-[#FF9500]',
  en_despacho: 'border-sky-400/40 bg-sky-400/15 text-sky-300',
  despachado: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  rechazado: 'border-red-500/40 bg-red-500/15 text-red-300',
  cancelado: 'border-zinc-500/40 bg-zinc-500/15 text-zinc-400',
};

function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cantidadTexto(n: number): string {
  return n.toLocaleString('es-VE', { maximumFractionDigits: 4 });
}

/** Qué falta para que este pedido avance, en palabras de quien lo mira. */
function siguientePaso(p: PedidoMaterialVista): string {
  switch (p.estado) {
    case 'solicitado':
      return 'Nadie del almacén lo ha tomado todavía.';
    case 'en_despacho':
      return `${p.despachador_nombre ?? 'Quien lo tomó'} debe enviar la foto del material para que salga del almacén.`;
    case 'despachado':
      return `Entregado el ${fechaHora(p.despachado_at)}; el stock ya se descontó.`;
    case 'rechazado':
      return `Rechazado${p.motivo_rechazo ? `: ${p.motivo_rechazo}` : '.'} El stock no se movió.`;
    default:
      return 'Cancelado. El stock no se movió.';
  }
}

function TarjetaPedido({ p }: { p: PedidoMaterialVista }) {
  return (
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">
            <span className="tabular-nums">{cantidadTexto(p.cantidad)}</span> {p.unidad}
            <span className="ml-2 font-semibold text-zinc-300">{p.material_nombre}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {p.codigo} · {ETIQUETA_TIPO_REQUERIMIENTO[p.tipo]}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {p.obra ?? 'Sin obra'} · sale de {p.origen ?? 'almacén'}
            {p.destino ? ` → ${p.destino}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${COLOR_ESTADO[p.estado]}`}
        >
          {ETIQUETA_ESTADO_PEDIDO[p.estado]}
        </span>
      </div>

      <p className="mt-3 text-xs text-zinc-300">{siguientePaso(p)}</p>
      {p.motivo && <p className="mt-1 text-[11px] text-zinc-400">Para: {p.motivo}</p>}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Pidió</dt>
          <dd className="font-semibold text-zinc-200">{p.solicitante_nombre ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Despacha</dt>
          <dd className="font-semibold text-zinc-200">{p.despachador_nombre ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pedido</dt>
          <dd className="tabular-nums text-zinc-200">{fechaHora(p.created_at)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Despachado</dt>
          <dd className="tabular-nums text-zinc-200">{fechaHora(p.despachado_at)}</dd>
        </div>
      </dl>

      {(p.fotos.length > 0 || p.movimiento_codigo) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.fotos.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
            >
              <Camera size={13} aria-hidden />
              Foto del despacho{p.fotos.length > 1 ? ` ${i + 1}` : ''}
            </a>
          ))}
          {p.movimiento_codigo && (
            <span className="text-[11px] text-zinc-500">
              Movimiento <span className="font-mono text-zinc-300">{p.movimiento_codigo}</span>
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export default function PedidosMaterialCuadro() {
  const [filtro, setFiltro] = useState<Filtro>('activos');
  const [lista, setLista] = useState<ListaPedidosMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (f: Filtro) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/almacen/pedidos${f === 'activos' ? '?activos=1' : ''}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as ListaPedidosMaterial & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar los pedidos.');
      setLista(json);
    } catch (e) {
      setLista(null);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los pedidos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(filtro);
  }, [cargar, filtro]);

  const pedidos = lista?.pedidos ?? [];
  const activos = pedidos.filter((p) => ESTADOS_PEDIDO_ACTIVOS.includes(p.estado)).length;

  return (
    <section aria-label="Pedidos de material">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(['activos', 'todos'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            aria-pressed={filtro === f}
            className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${
              filtro === f
                ? 'border-[#FF9500]/40 bg-[#FF9500]/20 text-[#FF9500]'
                : 'border-white/10 text-zinc-400 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {f === 'activos' ? 'Por despachar' : 'Todos'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void cargar(filtro)}
          disabled={cargando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} aria-hidden />
          Actualizar
        </button>
      </div>

      {cargando && !lista && (
        <p className="flex items-center gap-2 py-10 text-sm text-zinc-500">
          <Loader2 className="animate-spin text-[#FF9500]" size={18} aria-hidden />
          Cargando pedidos…
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {lista?.sinMigracion && (
        <p className="rounded-2xl border border-[#FF9500]/30 bg-[#FF9500]/10 p-4 text-sm text-[#FFB84D]">
          Los pedidos de material aún no están activados en la base de datos (falta aplicar la
          migración 343). Hasta entonces el bot no ofrece «Pedir material».
        </p>
      )}

      {lista && !lista.sinMigracion && pedidos.length === 0 && !error && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <ClipboardList className="mx-auto mb-2 text-zinc-600" size={28} aria-hidden />
          <p className="text-sm font-bold text-zinc-300">
            {filtro === 'activos' ? 'No hay pedidos por despachar.' : 'Todavía no hay pedidos de material.'}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Aparecen aquí cuando alguien pide material por Telegram: /salida → Pedir material.
          </p>
        </div>
      )}

      {pedidos.length > 0 && (
        <>
          {filtro === 'todos' && (
            <p className="mb-2 text-[11px] text-zinc-500">
              {pedidos.length} pedido(s), {activos} por despachar.
            </p>
          )}
          <ul className="grid gap-3">
            {pedidos.map((p) => (
              <TarjetaPedido key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
