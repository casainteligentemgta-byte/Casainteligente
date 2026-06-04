'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Box,
  ChevronDown,
  Filter,
  Loader2,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  FilaMovimientoInventario,
  VistaMovimientoInventario,
} from '@/lib/almacen/listarMovimientosInventario';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50';

const VISTAS: { id: VistaMovimientoInventario; label: string; icon: typeof Package }[] = [
  { id: 'ingresado', label: 'Ingresos', icon: ArrowDownRight },
  { id: 'almacenado', label: 'Stock', icon: Package },
  { id: 'despachado', label: 'Salidas', icon: ArrowUpRight },
  { id: 'todos', label: 'Todos', icon: Box },
];

function clasesBotonVista(id: VistaMovimientoInventario, active: boolean): string {
  const base =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors';
  if (!active) {
    if (id === 'despachado') {
      return `${base} border-red-500/25 text-red-400/80 hover:border-red-500/45 hover:text-red-300`;
    }
    return `${base} border-white/10 text-zinc-400 hover:text-zinc-200`;
  }
  switch (id) {
    case 'ingresado':
      return `${base} border-emerald-500/50 bg-emerald-500/15 text-emerald-100`;
    case 'almacenado':
      return `${base} border-sky-500/50 bg-sky-500/15 text-sky-100`;
    case 'despachado':
      return `${base} border-red-500/55 bg-red-500/15 text-red-100`;
    default:
      return `${base} border-sky-500/50 bg-sky-500/15 text-sky-100`;
  }
}

function badgeTipo(tipo: FilaMovimientoInventario['tipo']) {
  switch (tipo) {
    case 'ingreso':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'despacho':
      return 'bg-red-500/15 text-red-300';
    default:
      return 'bg-sky-500/15 text-sky-200';
  }
}

function labelTipo(tipo: FilaMovimientoInventario['tipo']) {
  switch (tipo) {
    case 'ingreso':
      return 'Ingreso';
    case 'despacho':
      return 'Salida';
    default:
      return 'Stock';
  }
}

function parseVistaInicial(raw: string | null): VistaMovimientoInventario {
  if (raw === 'ingresado' || raw === 'despachado' || raw === 'almacenado' || raw === 'todos') {
    return raw;
  }
  return 'todos';
}

export default function MovimientosInventarioClient() {
  const searchParams = useSearchParams();
  const [vista, setVista] = useState<VistaMovimientoInventario>(() =>
    parseVistaInicial(searchParams.get('vista')),
  );
  const [proveedorInput, setProveedorInput] = useState('');
  const [destinoInput, setDestinoInput] = useState('');
  const [materialInput, setMaterialInput] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [destino, setDestino] = useState('');
  const [material, setMaterial] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filas, setFilas] = useState<FilaMovimientoInventario[]>([]);
  const [resumen, setResumen] = useState({ ingresado: 0, despachado: 0, almacenado: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminandoBulk, setEliminandoBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const filtrosActivos = useMemo(() => {
    const activos: string[] = [];
    if (proveedorInput.trim()) activos.push('proveedor');
    if (destinoInput.trim()) activos.push('destino');
    if (materialInput.trim()) activos.push('material');
    if (fechaDesde) activos.push('desde');
    if (fechaHasta) activos.push('hasta');
    return activos;
  }, [proveedorInput, destinoInput, materialInput, fechaDesde, fechaHasta]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProveedor(proveedorInput.trim());
      setDestino(destinoInput.trim());
      setMaterial(materialInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [proveedorInput, destinoInput, materialInput]);

  const limpiarFiltros = useCallback(() => {
    setProveedorInput('');
    setDestinoInput('');
    setMaterialInput('');
    setProveedor('');
    setDestino('');
    setMaterial('');
    setFechaDesde('');
    setFechaHasta('');
  }, []);

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

  const todasSeleccionadas = useMemo(
    () => filas.length > 0 && filas.every((f) => selectedIds.has(f.id)),
    [filas, selectedIds],
  );
  const algunaSeleccionada = selectedIds.size > 0;
  const seleccionIndeterminada = algunaSeleccionada && !todasSeleccionadas;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = seleccionIndeterminada;
  }, [seleccionIndeterminada]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(filas.map((f) => f.id));
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filas]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (filas.length > 0 && filas.every((f) => prev.has(f.id))) {
        return new Set();
      }
      return new Set(filas.map((f) => f.id));
    });
  }, [filas]);

  const toggleSelectFila = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const eliminarMovimientoPorId = async (id: string): Promise<boolean> => {
    const res = await fetch('/api/almacen/movimientos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      cache: 'no-store',
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? 'No se pudo eliminar');
    return true;
  };

  const eliminarMovimiento = async (f: FilaMovimientoInventario) => {
    if (!f.eliminable) return;
    const etiqueta = `${labelTipo(f.tipo)} · ${f.material_nombre}`.slice(0, 80);
    const ok = window.confirm(
      `¿Eliminar este movimiento?\n\n${etiqueta}\n\nSe ajustará el inventario si el registro ya impactó stock.`,
    );
    if (!ok) return;

    setEliminandoId(f.id);
    setError(null);
    try {
      await eliminarMovimientoPorId(f.id);
      setFilas((prev) => prev.filter((row) => row.id !== f.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(f.id);
        return next;
      });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setEliminandoId(null);
    }
  };

  const eliminarSeleccionados = async () => {
    const items = filas.filter((f) => selectedIds.has(f.id));
    if (!items.length) return;
    const eliminables = items.filter((f) => f.eliminable);
    if (!eliminables.length) {
      setError('Ninguno de los movimientos seleccionados se puede eliminar.');
      return;
    }
    const ok = window.confirm(
      `¿Eliminar ${eliminables.length} movimiento(s)?\n\nSe ajustará el inventario según corresponda.`,
    );
    if (!ok) return;

    setEliminandoBulk(true);
    setError(null);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const f of eliminables) {
        setEliminandoId(f.id);
        try {
          await eliminarMovimientoPorId(f.id);
          okCount += 1;
        } catch {
          failCount += 1;
        }
      }
      setSelectedIds(new Set());
      await cargar();
      if (failCount > 0) {
        setError(`${okCount} eliminado(s). ${failCount} no se pudieron borrar.`);
      } else if (items.length > eliminables.length) {
        setError(
          `${okCount} eliminado(s). ${items.length - eliminables.length} no eran eliminables.`,
        );
      }
    } finally {
      setEliminandoId(null);
      setEliminandoBulk(false);
    }
  };

  const filaSeleccionada = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return filas.find((f) => f.id === id) ?? null;
  }, [selectedIds, filas]);

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
              Ingresos: compras, cuarentena y recepción en campo (manual, nota, emergencia, tránsito). Salidas: egresos. Stock: ingresado − salido.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              aria-expanded={filtrosAbiertos}
              aria-controls="panel-filtros-movimientos"
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                filtrosAbiertos
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
                  : 'border-white/10 text-zinc-300 hover:bg-white/5'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtros
              <ChevronDown
                className={`h-4 w-4 transition-transform ${filtrosAbiertos ? 'rotate-180' : ''}`}
              />
              {filtrosActivos.length > 0 && !filtrosAbiertos ? (
                <span className="min-w-4 h-4 px-1 rounded-full bg-sky-500 text-[9px] font-black leading-4 text-white">
                  {filtrosActivos.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void cargar()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">Ingresos</p>
            <p className="text-2xl font-black text-emerald-200">{resumen.ingresado}</p>
            <p className="text-[11px] text-zinc-500">compras, cuarentena y recepción en campo</p>
          </div>
          <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300/80">Stock</p>
            <p className="text-2xl font-black text-sky-100">{resumen.almacenado}</p>
            <p className="text-[11px] text-zinc-500">materiales con saldo ingresado − salido</p>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-950/25 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/90">Salidas</p>
            <p className="text-2xl font-black text-red-100">{resumen.despachado}</p>
            <p className="text-[11px] text-zinc-500">egresos del almacén (transferencias y Telegram)</p>
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
                className={clasesBotonVista(v.id, active)}
              >
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>

        {filtrosAbiertos ? (
          <div
            id="panel-filtros-movimientos"
            className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                <Search className="h-3.5 w-3.5" />
                Filtros
              </div>
              {filtrosActivos.length > 0 ? (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Proveedor</label>
                <input
                  type="search"
                  value={proveedorInput}
                  onChange={(e) => setProveedorInput(e.target.value)}
                  placeholder="Nombre proveedor"
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Destino / obra</label>
                <input
                  type="search"
                  value={destinoInput}
                  onChange={(e) => setDestinoInput(e.target.value)}
                  placeholder="Almacén, obra u origen"
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Material</label>
                <input
                  type="search"
                  value={materialInput}
                  onChange={(e) => setMaterialInput(e.target.value)}
                  placeholder="Nombre, SAP o N° factura"
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
        ) : null}

        {error ? (
          <p className="text-sm text-red-300 rounded-lg border border-red-500/30 bg-red-950/30 p-3">{error}</p>
        ) : null}

        {!loading && filas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-zinc-300">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={todasSeleccionadas}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-zinc-600 accent-sky-500"
              />
              {todasSeleccionadas ? 'Quitar selección' : `Seleccionar todos (${filas.length})`}
            </label>
            {algunaSeleccionada ? (
              <>
                <span className="text-xs font-black text-sky-400">{selectedIds.size} seleccionado(s)</span>
                <button
                  type="button"
                  disabled={eliminandoBulk || eliminandoId !== null}
                  onClick={() => void eliminarSeleccionados()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-1.5 text-[10px] font-black uppercase text-red-300 hover:bg-red-950/50 disabled:opacity-40"
                >
                  {eliminandoBulk ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Borrar seleccionados
                </button>
                {filaSeleccionada?.material_id ? (
                  <Link
                    href={`/almacen/editar/${filaSeleccionada.material_id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-sky-300 hover:bg-sky-500/20"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar material
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="p-3 w-10">
                    <span className="sr-only">Seleccionar</span>
                  </th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Origen → Destino</th>
                  <th className="p-3">Capítulo</th>
                  <th className="p-3">Ref.</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-zinc-500">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Cargando movimientos…
                    </td>
                  </tr>
                ) : filas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-zinc-600">
                      Sin registros con estos filtros.
                    </td>
                  </tr>
                ) : (
                  filas.map((f) => (
                    <tr
                      key={f.id}
                      className={
                        selectedIds.has(f.id) ? 'bg-sky-500/10 hover:bg-sky-500/15' : 'hover:bg-white/[0.02]'
                      }
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(f.id)}
                          onChange={() => toggleSelectFila(f.id)}
                          className="h-4 w-4 rounded border-zinc-600 accent-sky-500"
                          aria-label={`Seleccionar ${f.material_nombre}`}
                        />
                      </td>
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
                        {f.tipo === 'almacenado' && f.notas ? (
                          <p className="text-[10px] text-zinc-500 font-sans mt-0.5">{f.notas}</p>
                        ) : null}
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
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {f.material_id ? (
                            <Link
                              href={`/almacen/editar/${f.material_id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-950/30 px-2 py-1 text-[10px] font-bold uppercase text-sky-300 hover:bg-sky-950/50"
                              title="Editar material"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                          {f.eliminable ? (
                            <button
                              type="button"
                              disabled={eliminandoId === f.id || eliminandoBulk}
                              onClick={() => void eliminarMovimiento(f)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-950/30 px-2 py-1 text-[10px] font-bold uppercase text-red-300 hover:bg-red-950/50 disabled:opacity-40"
                              title="Eliminar movimiento"
                            >
                              {eliminandoId === f.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="text-zinc-600 text-xs px-1">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
