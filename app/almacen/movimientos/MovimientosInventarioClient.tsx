'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Box,
  Loader2,
  Package,
  RefreshCw,
  Search,
} from 'lucide-react';
import type {
  FilaMovimientoInventario,
  VistaMovimientoInventario,
} from '@/lib/almacen/listarMovimientosInventario';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50';

const VISTAS: { id: VistaMovimientoInventario; label: string; icon: typeof Package }[] = [
  { id: 'todos', label: 'Todos', icon: Box },
  { id: 'ingresado', label: 'Ingresado', icon: ArrowDownRight },
  { id: 'despachado', label: 'Despachado', icon: ArrowUpRight },
  { id: 'almacenado', label: 'Almacenado', icon: Package },
];

function badgeTipo(tipo: FilaMovimientoInventario['tipo']) {
  switch (tipo) {
    case 'ingreso':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'despacho':
      return 'bg-orange-500/15 text-orange-200';
    default:
      return 'bg-sky-500/15 text-sky-200';
  }
}

function labelTipo(tipo: FilaMovimientoInventario['tipo']) {
  switch (tipo) {
    case 'ingreso':
      return 'Ingreso';
    case 'despacho':
      return 'Despacho';
    default:
      return 'Stock';
  }
}

export default function MovimientosInventarioClient() {
  const [vista, setVista] = useState<VistaMovimientoInventario>('todos');
  const [proveedor, setProveedor] = useState('');
  const [destino, setDestino] = useState('');
  const [material, setMaterial] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filas, setFilas] = useState<FilaMovimientoInventario[]>([]);
  const [resumen, setResumen] = useState({ ingresado: 0, despachado: 0, almacenado: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('vista', vista);
    if (proveedor.trim()) p.set('proveedor', proveedor.trim());
    if (destino.trim()) p.set('destino', destino.trim());
    if (material.trim()) p.set('material', material.trim());
    if (fechaDesde) p.set('fecha_desde', fechaDesde);
    if (fechaHasta) p.set('fecha_hasta', fechaHasta);
    p.set('limite', '250');
    return p.toString();
  }, [vista, proveedor, destino, material, fechaDesde, fechaHasta]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/almacen/movimientos?${query}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setFilas(json.filas ?? []);
      setResumen(json.resumen ?? { ingresado: 0, despachado: 0, almacenado: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-screen bg-[#050508] text-white p-4 md:p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/almacen"
            className="p-2.5 rounded-xl border border-white/10 bg-zinc-900/80 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Movimientos de almacén</h1>
            <p className="text-xs text-zinc-500 mt-1">
              Material ingresado, despachado y stock actual — filtrable por proveedor, destino y fecha.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Ingresos</p>
            <p className="text-2xl font-black text-emerald-200">{resumen.ingresado}</p>
            <p className="text-[11px] text-zinc-500">líneas de compra registradas</p>
          </div>
          <div className="rounded-xl border border-orange-500/25 bg-orange-950/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300/80">Despachos</p>
            <p className="text-2xl font-black text-orange-100">{resumen.despachado}</p>
            <p className="text-[11px] text-zinc-500">transferencias y egresos Telegram</p>
          </div>
          <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300/80">Almacenado</p>
            <p className="text-2xl font-black text-sky-100">{resumen.almacenado}</p>
            <p className="text-[11px] text-zinc-500">SKUs con stock &gt; 0</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {VISTAS.map((v) => {
            const Icon = v.icon;
            const active = vista === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  active
                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
                    : 'border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            <Search className="h-3.5 w-3.5" />
            Filtros
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Proveedor</label>
              <input
                type="search"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre proveedor"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Destino / obra</label>
              <input
                type="search"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Almacén u obra"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Material</label>
              <input
                type="search"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="Nombre o código SAP"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-300 rounded-lg border border-red-500/30 bg-red-950/30 p-3">{error}</p>
        ) : null}

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Origen → Destino</th>
                  <th className="p-3">Capítulo</th>
                  <th className="p-3">Ref.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-zinc-500">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Cargando movimientos…
                    </td>
                  </tr>
                ) : filas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-zinc-600">
                      Sin registros con estos filtros.
                    </td>
                  </tr>
                ) : (
                  filas.map((f) => (
                    <tr key={f.id} className="hover:bg-white/[0.02]">
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeTipo(f.tipo)}`}
                        >
                          {labelTipo(f.tipo)}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400 whitespace-nowrap">{f.fecha}</td>
                      <td className="p-3">
                        <p className="font-medium text-zinc-100">{f.material_nombre}</p>
                        {f.material_codigo ? (
                          <p className="text-[10px] text-zinc-500">{f.material_codigo}</p>
                        ) : null}
                        {f.proyecto_nombre ? (
                          <p className="text-[10px] text-violet-300/90">{f.proyecto_nombre}</p>
                        ) : null}
                      </td>
                      <td className="p-3 text-right font-mono text-zinc-200">
                        {f.cantidad > 0 ? `${f.cantidad} ${f.unidad}` : '—'}
                      </td>
                      <td className="p-3 text-zinc-400 max-w-[140px] truncate">{f.proveedor ?? '—'}</td>
                      <td className="p-3 text-zinc-400 text-xs max-w-[180px]">
                        {f.origen && f.destino
                          ? `${f.origen} → ${f.destino}`
                          : f.destino ?? f.origen ?? '—'}
                      </td>
                      <td className="p-3 text-amber-200/90 text-xs max-w-[120px] truncate">
                        {f.capitulo ?? '—'}
                      </td>
                      <td className="p-3 text-zinc-500 text-xs max-w-[100px] truncate">{f.referencia ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-zinc-600 text-center">
          {filas.length} fila(s) mostradas · Ingresos desde compras registradas · Despachos desde transferencias y{' '}
          <code className="text-zinc-500">/salida</code> Telegram
        </p>
      </div>
    </div>
  );
}
