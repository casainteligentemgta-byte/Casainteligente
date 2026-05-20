'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Trash2,
  ExternalLink,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  aplanarFacturasCanal,
  filtrarFilasFacturaCanal,
  pendienteIdsDesdeFilas,
  type FilaFacturaCanal,
  type FiltrosFacturaCanal,
} from '@/lib/contabilidad/filtrosFacturaCanal';

type Pendiente = {
  id: string;
  canal: string;
  chat_id: string;
  chat_label: string | null;
  estado: string;
  document_file_name: string | null;
  extracted: {
    invoice_number?: string;
    supplier_name?: string;
    supplier_rif?: string;
    date?: string;
    total_amount?: number | null;
    items?: Array<{
      description?: string;
      item_code?: string;
      quantity?: number;
      unit_price?: number;
    }>;
  } | null;
  mensaje_error: string | null;
  created_at: string;
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50';

export default function FacturasCanalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('pendiente');
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [vista, setVista] = useState<'facturas' | 'lineas'>('lineas');

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [rif, setRif] = useState('');
  const [articulo, setArticulo] = useState('');
  const [cantidadMin, setCantidadMin] = useState('');
  const [cantidadMax, setCantidadMax] = useState('');
  const [montoMinBs, setMontoMinBs] = useState('');
  const [montoMaxBs, setMontoMaxBs] = useState('');
  const [montoMinUsd, setMontoMinUsd] = useState('');
  const [montoMaxUsd, setMontoMaxUsd] = useState('');

  const filtros: FiltrosFacturaCanal = useMemo(
    () => ({
      fechaDesde,
      fechaHasta,
      proveedor,
      rif,
      articulo,
      cantidadMin,
      cantidadMax,
      montoMinBs,
      montoMaxBs,
      montoMinUsd,
      montoMaxUsd,
    }),
    [
      fechaDesde,
      fechaHasta,
      proveedor,
      rif,
      articulo,
      cantidadMin,
      cantidadMax,
      montoMinBs,
      montoMaxBs,
      montoMinUsd,
      montoMaxUsd,
    ],
  );

  const todasFilas = useMemo(() => aplanarFacturasCanal(pendientes), [pendientes]);
  const filasFiltradas = useMemo(
    () => filtrarFilasFacturaCanal(todasFilas, filtros),
    [todasFilas, filtros],
  );
  const idsVisibles = useMemo(() => pendienteIdsDesdeFilas(filasFiltradas), [filasFiltradas]);

  const pendientesFiltrados = useMemo(
    () => pendientes.filter((p) => idsVisibles.has(p.id)),
    [pendientes, idsVisibles],
  );

  const hayFiltrosActivos = useMemo(
    () =>
      Boolean(
        fechaDesde ||
          fechaHasta ||
          proveedor ||
          rif ||
          articulo ||
          cantidadMin ||
          cantidadMax ||
          montoMinBs ||
          montoMaxBs ||
          montoMinUsd ||
          montoMaxUsd,
      ),
    [
      fechaDesde,
      fechaHasta,
      proveedor,
      rif,
      articulo,
      cantidadMin,
      cantidadMax,
      montoMinBs,
      montoMaxBs,
      montoMinUsd,
      montoMaxUsd,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/facturas-canal/pendientes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendientes(data.pendientes ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const limpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setProveedor('');
    setRif('');
    setArticulo('');
    setCantidadMin('');
    setCantidadMax('');
    setMontoMinBs('');
    setMontoMaxBs('');
    setMontoMinUsd('');
    setMontoMaxUsd('');
  };

  const abrirEnRecepcion = (p: Pendiente) => {
    if (p.estado !== 'extraido' || !p.extracted) {
      toast.error('La factura aún no está lista o falló la extracción');
      return;
    }
    sessionStorage.setItem(
      'telegram_pending_invoice',
      JSON.stringify({ pendingId: p.id, extracted: p.extracted }),
    );
    router.push(`/almacen/procurement?fromTelegram=${p.id}`);
  };

  const rechazar = async (id: string) => {
    if (!window.confirm('¿Rechazar esta factura pendiente?')) return;
    const res = await fetch(`/api/facturas-canal/pendientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'rechazado' }),
    });
    if (!res.ok) {
      toast.error('No se pudo rechazar');
      return;
    }
    setPendientes((prev) => prev.filter((p) => p.id !== id));
    toast.success('Rechazada');
  };

  const borrar = async (id: string) => {
    if (!window.confirm('¿Eliminar registro?')) return;
    const res = await fetch(`/api/facturas-canal/pendientes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('No se pudo borrar');
      return;
    }
    setPendientes((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white px-4 py-8 md:px-8 max-w-6xl mx-auto">
      <Link
        href="/contabilidad/compras"
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a compras
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-sky-400" />
            Facturas extraídas (Telegram / WhatsApp)
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl">
            Datos leídos por IA desde la foto. Filtra por fecha, montos, proveedor, RIF, artículo y cantidad antes de
            confirmar en recepción.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5 inline mr-1" />
          Actualizar
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-violet-400" />
          <p className="text-xs font-bold uppercase text-zinc-400">Filtros</p>
          {hayFiltrosActivos ? (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="ml-auto text-[11px] text-zinc-500 hover:text-white"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <div>
            <label className="text-[10px] font-bold text-zinc-500">FECHA DESDE</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">FECHA HASTA</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">PROVEEDOR</label>
            <input
              type="search"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Nombre"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">RIF</label>
            <input
              type="search"
              value={rif}
              onChange={(e) => setRif(e.target.value)}
              placeholder="J-…"
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÍN. (Bs)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMinBs}
              onChange={(e) => setMontoMinBs(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÁX. (Bs)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMaxBs}
              onChange={(e) => setMontoMaxBs(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÍN. (USD)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMinUsd}
              onChange={(e) => setMontoMinUsd(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÁX. (USD)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMaxUsd}
              onChange={(e) => setMontoMaxUsd(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="text-[10px] font-bold text-zinc-500">ARTÍCULO</label>
            <input
              type="search"
              value={articulo}
              onChange={(e) => setArticulo(e.target.value)}
              placeholder="Descripción o código"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">CANT. MÍN.</label>
            <input
              type="text"
              inputMode="decimal"
              value={cantidadMin}
              onChange={(e) => setCantidadMin(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">CANT. MÁX.</label>
            <input
              type="text"
              inputMode="decimal"
              value={cantidadMax}
              onChange={(e) => setCantidadMax(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-violet-300/90">
          {filasFiltradas.length} línea(s) · {pendientesFiltrados.length} factura(s) con estos filtros
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setVista('lineas')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            vista === 'lineas' ? 'bg-white/15 text-white' : 'text-zinc-500'
          }`}
        >
          Por línea / artículo
        </button>
        <button
          type="button"
          onClick={() => setVista('facturas')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            vista === 'facturas' ? 'bg-white/15 text-white' : 'text-zinc-500'
          }`}
        >
          Por factura
        </button>
      </div>

      {loading ? (
        <div className="flex gap-2 text-zinc-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : vista === 'lineas' ? (
        <TablaLineas
          filas={filasFiltradas}
          highlightId={highlightId}
          onAbrir={(id) => {
            const p = pendientes.find((x) => x.id === id);
            if (p) abrirEnRecepcion(p);
          }}
        />
      ) : pendientesFiltrados.length === 0 ? (
        <p className="text-sm text-zinc-500 rounded-xl border border-white/10 p-8 text-center">
          No hay facturas que coincidan con los filtros.
        </p>
      ) : (
        <ul className="space-y-3">
          {pendientesFiltrados.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border p-4 ${
                highlightId === p.id
                  ? 'border-sky-500/50 bg-sky-950/20'
                  : 'border-white/10 bg-zinc-900/60'
              }`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {p.extracted?.invoice_number ? `#${p.extracted.invoice_number}` : 'Sin número'} ·{' '}
                    {p.extracted?.supplier_name ?? 'Proveedor'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {p.extracted?.date ?? '—'} · RIF {p.extracted?.supplier_rif ?? '—'} ·{' '}
                    {p.extracted?.total_amount != null ? `${p.extracted.total_amount} Bs` : '—'} · {p.canal}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.estado === 'extraido' ? (
                    <button
                      type="button"
                      onClick={() => abrirEnRecepcion(p)}
                      className="rounded-lg bg-[#34C759] text-black text-xs font-semibold px-3 py-2 flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Confirmar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void rechazar(p.id)}
                    className="rounded-lg border border-white/10 text-xs px-3 py-2 text-zinc-400"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => void borrar(p.id)}
                    className="text-red-400 hover:text-red-300 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TablaLineas({
  filas,
  highlightId,
  onAbrir,
}: {
  filas: FilaFacturaCanal[];
  highlightId: string | null;
  onAbrir: (pendienteId: string) => void;
}) {
  if (filas.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-xl border border-white/10 p-8 text-center">
        Sin líneas con estos filtros. Envía una factura al bot o amplía los criterios.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-xs">
        <thead className="bg-white/5 text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-left">Factura</th>
            <th className="px-3 py-2 text-left">Proveedor</th>
            <th className="px-3 py-2 text-left">RIF</th>
            <th className="px-3 py-2 text-left">Artículo</th>
            <th className="px-3 py-2 text-right">Cant.</th>
            <th className="px-3 py-2 text-right">P.U. Bs</th>
            <th className="px-3 py-2 text-right">Subtotal Bs</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {filas.map((row, i) => {
            const subtotal = row.esLinea
              ? row.cantidad * row.precioUnitario
              : row.montoBs;
            return (
              <tr
                key={`${row.pendienteId}-${i}`}
                className={`border-t border-white/5 ${
                  highlightId === row.pendienteId ? 'bg-sky-950/25' : ''
                }`}
              >
                <td className="px-3 py-2 whitespace-nowrap">{row.fecha || '—'}</td>
                <td className="px-3 py-2 font-mono">{row.factura || '—'}</td>
                <td className="px-3 py-2 max-w-[140px] truncate">{row.proveedor}</td>
                <td className="px-3 py-2 text-zinc-400">{row.rif}</td>
                <td className="px-3 py-2 max-w-[180px] truncate">
                  {row.esLinea ? row.articulo : <span className="text-zinc-600">(cabecera)</span>}
                </td>
                <td className="px-3 py-2 text-right">{row.esLinea ? row.cantidad : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {row.esLinea ? row.precioUnitario.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{subtotal.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onAbrir(row.pendienteId)}
                    className="text-sky-400 hover:text-sky-300 text-[11px] font-semibold"
                  >
                    Abrir
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
