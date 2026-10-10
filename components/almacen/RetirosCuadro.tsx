'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, RefreshCw, Truck } from 'lucide-react';
import {
  ESTADOS_RETIRO_ACTIVOS,
  ETIQUETA_ESTADO_RETIRO,
  type ListaRetirosCompra,
  type RetiroCompraVista,
} from '@/lib/compras/listarRetirosCompra';
import type { EstadoRetiroCompra } from '@/lib/compras/retiroCompra';

type Filtro = 'activos' | 'todos';

const COLOR_ESTADO: Record<EstadoRetiroCompra, string> = {
  pendiente: 'border-[#FF9500]/40 bg-[#FF9500]/15 text-[#FF9500]',
  asignado: 'border-sky-400/40 bg-sky-400/15 text-sky-300',
  en_camino: 'border-violet-400/40 bg-violet-400/15 text-violet-300',
  entregado: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
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

/** Qué falta para que este retiro avance, en palabras de quien lo mira. */
function siguientePaso(r: RetiroCompraVista): string {
  switch (r.estado) {
    case 'pendiente':
      return 'Nadie lo ha tomado todavía.';
    case 'asignado':
      return `${r.transportista_nombre ?? 'Quien lo tomó'} debe enviar la foto al recogerla.`;
    case 'en_camino':
      return 'Falta que el almacén registre el ingreso.';
    case 'entregado':
      return `Recibido en almacén el ${fechaHora(r.entregado_at)}.`;
    default:
      return 'Cancelado.';
  }
}

function TarjetaRetiro({ r }: { r: RetiroCompraVista }) {
  return (
    <li className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            Factura #{r.numero_factura ?? 'S/N'}
            <span className="ml-2 font-semibold text-zinc-400">{r.proveedor_nombre ?? 'Proveedor'}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {r.obra ?? 'Sin obra'} → {r.almacen ?? 'Sin almacén'}
            {r.ticket_procura ? ` · ${r.ticket_procura}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${COLOR_ESTADO[r.estado]}`}
        >
          {ETIQUETA_ESTADO_RETIRO[r.estado]}
        </span>
      </div>

      <p className="mt-3 text-xs text-zinc-300">{siguientePaso(r)}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Retira</dt>
          <dd className="font-semibold text-zinc-200">{r.transportista_nombre ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Avisado</dt>
          <dd className="tabular-nums text-zinc-200">{fechaHora(r.created_at)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Retirado</dt>
          <dd className="tabular-nums text-zinc-200">{fechaHora(r.retirado_at)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Entregado</dt>
          <dd className="tabular-nums text-zinc-200">{fechaHora(r.entregado_at)}</dd>
        </div>
      </dl>

      {r.fotos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.fotos.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
            >
              <Camera size={13} aria-hidden />
              Foto del retiro{r.fotos.length > 1 ? ` ${i + 1}` : ''}
            </a>
          ))}
        </div>
      )}
    </li>
  );
}

export default function RetirosCuadro() {
  const [filtro, setFiltro] = useState<Filtro>('activos');
  const [lista, setLista] = useState<ListaRetirosCompra | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (f: Filtro) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/almacen/retiros${f === 'activos' ? '?activos=1' : ''}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as ListaRetirosCompra & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar los retiros.');
      setLista(json);
    } catch (e) {
      setLista(null);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los retiros.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(filtro);
  }, [cargar, filtro]);

  const retiros = lista?.retiros ?? [];
  const activos = retiros.filter((r) => ESTADOS_RETIRO_ACTIVOS.includes(r.estado)).length;

  return (
    <section aria-label="Retiros de mercancía">
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
            {f === 'activos' ? 'En curso' : 'Todos'}
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
          Cargando retiros…
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {lista?.sinMigracion && (
        <p className="rounded-2xl border border-[#FF9500]/30 bg-[#FF9500]/10 p-4 text-sm text-[#FFB84D]">
          El registro de retiros aún no está activado en la base de datos (falta aplicar la
          migración 341). Hasta entonces el bot no avisa retiros.
        </p>
      )}

      {lista && !lista.sinMigracion && retiros.length === 0 && !error && (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <Truck className="mx-auto mb-2 text-zinc-600" size={28} aria-hidden />
          <p className="text-sm font-bold text-zinc-300">
            {filtro === 'activos' ? 'No hay mercancía por retirar ni en camino.' : 'Todavía no hay retiros.'}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Aparecen aquí cuando el comprador confirma una factura con mercancía por recibir.
          </p>
        </div>
      )}

      {retiros.length > 0 && (
        <>
          {filtro === 'todos' && (
            <p className="mb-2 text-[11px] text-zinc-500">
              {retiros.length} retiro(s), {activos} en curso.
            </p>
          )}
          <ul className="grid gap-3">
            {retiros.map((r) => (
              <TarjetaRetiro key={r.id} r={r} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
