'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
  ArrowLeft,
  Save,
  Package,
  Hash,
  MapPin,
  Settings2,
  AlertTriangle,
  Route,
} from 'lucide-react';
import InventarioClasificacionFields from '@/components/almacen/InventarioClasificacionFields';
import SelectorUnidadMedida from '@/components/almacen/SelectorUnidadMedida';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';

type StockFilaEdit = {
  stock_id: string;
  ubicacion_id: string;
  ubicacion_nombre: string;
  cantidad_disponible: number;
};

type Deposit = { id: string; code: string; name: string; locality: string | null; is_default: boolean };
type Furniture = {
  id: string;
  deposit_id: string;
  kind: string;
  name: string;
  code: string | null;
  repisas_count: number;
  sort_order: number;
};
type Category = { id: string; name: string };
type UnitRow = { id: string; code: string; name: string; active: boolean; sort_order: number };

type CatalogProductRow = {
  id: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  imagen: string | null;
};

type InventoryEditItem = {
  id: string;
  sap_code: string | null;
  name: string;
  category_id: string;
  unit: string;
  stock_available: number;
  stock_quarantine: number;
  reorder_point: number;
  average_weighted_cost: number;
  location: string | null;
  /** FK opcional a `products.id` (migración 024). */
  product_id: number | null;
  deposit_id: string | null;
  furniture_id: string | null;
  shelf_number: number | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: 'OPERATIVO' | 'EN REPARACION' | 'BAJA' | null;
  observations: string | null;
  image_url: string | null;
  entidad_id: string | null;
  proyecto_id: string | null;
  presupuesto_partida_id: string | null;
};

const STATUS_OPTIONS: { value: NonNullable<InventoryEditItem['status']>; label: string }[] = [
  { value: 'OPERATIVO', label: 'OPERATIVO' },
  { value: 'EN REPARACION', label: 'EN REPARACION' },
  { value: 'BAJA', label: 'BAJA' },
];

export default function EditInventoryItemPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const id = String(params?.id ?? '');

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);

  const [item, setItem] = useState<InventoryEditItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductRow[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [stockFilas, setStockFilas] = useState<StockFilaEdit[]>([]);
  const [stockTotal, setStockTotal] = useState(0);
  const [stockUbicacionId, setStockUbicacionId] = useState('');
  const [stockCantidad, setStockCantidad] = useState('');
  const [stockCantidadInicial, setStockCantidadInicial] = useState('');
  const [stockLoading, setStockLoading] = useState(false);

  const furnitureForDeposit = useMemo(() => {
    if (!item?.deposit_id) return [];
    return furniture.filter((f) => f.deposit_id === item.deposit_id);
  }, [furniture, item?.deposit_id]);

  const maxRepisasShelf = useMemo(() => {
    const f = furnitureForDeposit.find((x) => x.id === item?.furniture_id);
    return f ? Math.max(1, Number(f.repisas_count) || 1) : 1;
  }, [furnitureForDeposit, item?.furniture_id]);

  const loadMasters = useCallback(async () => {
    setLoadErr(null);
    const [d, f, c, u] = await Promise.all([
      supabase
        .from('inventory_deposits')
        .select('id,code,name,locality,is_default')
        .order('is_default', { ascending: false })
        .order('name'),
      supabase.from('inventory_furniture').select('*').order('sort_order').order('name'),
      supabase.from('material_categories').select('id,name').order('name'),
      supabase.from('inventory_units').select('*').eq('active', true).order('sort_order').order('code'),
    ]);

    const err = d.error || f.error || c.error || u.error;
    if (err) {
      setLoadErr(err.message);
      return;
    }

    setDeposits((d.data ?? []) as Deposit[]);
    setFurniture((f.data ?? []) as Furniture[]);
    setCategories((c.data ?? []) as Category[]);
    setUnits((u.data ?? []) as UnitRow[]);
  }, [supabase]);

  const loadCatalogProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id,nombre,marca,modelo,imagen')
      .order('nombre');
    if (!error && data) {
      setCatalogProducts(data as CatalogProductRow[]);
    }
  }, [supabase]);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadErr(null);
    const { data, error } = await supabase
      .from('global_inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      setLoadErr(error?.message ?? 'No se encontró el ítem');
      setItem(null);
      setLoading(false);
      return;
    }

    const rawPid = (data as { product_id?: unknown }).product_id;
    const product_id =
      rawPid != null && rawPid !== '' && !Number.isNaN(Number(rawPid)) ? Number(rawPid) : null;

    const normalized: InventoryEditItem = {
      id: String(data.id),
      sap_code: data.sap_code ?? null,
      name: String(data.name ?? ''),
      category_id: String(data.category_id ?? ''),
      unit: String(data.unit ?? 'UND'),
      stock_available: Number(data.stock_available ?? 0),
      stock_quarantine: Number(data.stock_quarantine ?? 0),
      reorder_point: Number(data.reorder_point ?? 0),
      average_weighted_cost: Number(data.average_weighted_cost ?? 0),
      location: data.location ?? null,
      product_id,
      deposit_id: data.deposit_id ?? null,
      furniture_id: data.furniture_id ?? null,
      shelf_number: (() => {
        const sn = data.shelf_number;
        if (sn == null || sn === '') return null;
        const n = Number(sn);
        return Number.isFinite(n) ? Math.trunc(n) : null;
      })(),
      brand: data.brand ?? null,
      model: data.model ?? null,
      serial_number: data.serial_number ?? null,
      status: (data.status ?? null) as InventoryEditItem['status'],
      observations: data.observations ?? null,
      image_url: data.image_url ?? null,
      entidad_id: (data as { entidad_id?: string | null }).entidad_id ?? null,
      proyecto_id: (data as { proyecto_id?: string | null }).proyecto_id ?? null,
      presupuesto_partida_id:
        (data as { presupuesto_partida_id?: string | null }).presupuesto_partida_id ?? null,
    };

    setItem(normalized);
    setLoading(false);
  }, [id, supabase]);

  const cargarStock = useCallback(async () => {
    if (!id) return;
    setStockLoading(true);
    try {
      const res = await fetch(`/api/almacen/inventario/${encodeURIComponent(id)}/stock`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        filas?: StockFilaEdit[];
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el stock');

      const filas = data.filas ?? [];
      setStockFilas(filas);
      setStockTotal(Number(data.total) || 0);

      const primera = filas[0];
      if (primera) {
        setStockUbicacionId(primera.ubicacion_id);
        const qty = String(primera.cantidad_disponible);
        setStockCantidad(qty);
        setStockCantidadInicial(qty);
      } else {
        setStockUbicacionId('');
        setStockCantidad('0');
        setStockCantidadInicial('0');
      }
    } catch {
      setStockFilas([]);
      setStockTotal(0);
      setStockUbicacionId('');
      setStockCantidad('0');
      setStockCantidadInicial('0');
    } finally {
      setStockLoading(false);
    }
  }, [id]);

  const seleccionarUbicacionStock = useCallback(
    (ubicacionId: string) => {
      setStockUbicacionId(ubicacionId);
      const fila = stockFilas.find((f) => f.ubicacion_id === ubicacionId);
      const qty = fila ? String(fila.cantidad_disponible) : '0';
      setStockCantidad(qty);
      setStockCantidadInicial(qty);
    },
    [stockFilas],
  );

  useEffect(() => {
    void (async () => {
      await loadMasters();
      await loadCatalogProducts();
      await fetchItem();
      await cargarStock();
    })();
  }, [loadMasters, loadCatalogProducts, fetchItem, cargarStock]);

  // Si el usuario cambia depósito, limpiamos furniture_id si ya no pertenece.
  useEffect(() => {
    if (!item) return;
    if (!item.deposit_id) return;
    if (!item.furniture_id) return;
    const ok = furnitureForDeposit.some((f) => f.id === item.furniture_id);
    if (!ok) {
      setItem((prev) => (prev ? { ...prev, furniture_id: null, shelf_number: null } : prev));
    }
  }, [furnitureForDeposit, item]);

  const selectedCategory = categories.find((c) => c.id === item?.category_id);
  const isHerramientas = selectedCategory?.name.toLowerCase().includes('herramient') ?? false;

  const filteredCatalogProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    let list = catalogProducts;
    if (q) {
      list = catalogProducts.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.marca ?? '').toLowerCase().includes(q) ||
          (p.modelo ?? '').toLowerCase().includes(q),
      );
    }
    const pid = item?.product_id;
    if (pid != null) {
      const sel = catalogProducts.find((p) => p.id === pid);
      if (sel && !list.some((p) => p.id === pid)) {
        list = [sel, ...list];
      }
    }
    return list;
  }, [catalogProducts, productSearch, item?.product_id]);

  const selectedCatalogProduct = useMemo(
    () => (item?.product_id != null ? catalogProducts.find((p) => p.id === item.product_id) : null),
    [catalogProducts, item?.product_id],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!item.name.trim() || !item.category_id) {
      alert('Nombre y categoría son obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      const cantidadStock = Number.parseFloat(String(stockCantidad).replace(',', '.'));
      const cantidadCambio = String(stockCantidad).trim() !== stockCantidadInicial.trim();
      const stockDirty = cantidadCambio;

      if (stockDirty) {
        if (!stockUbicacionId.trim()) {
          alert('Seleccione la ubicación donde registrar la cantidad.');
          setSubmitting(false);
          return;
        }
        if (!Number.isFinite(cantidadStock) || cantidadStock < 0) {
          alert('Indique una cantidad de stock válida (≥ 0).');
          setSubmitting(false);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        name: item.name.trim(),
        category_id: item.category_id,
        unit: item.unit,
        stock_quarantine: Number(item.stock_quarantine) || 0,
        reorder_point: Number(item.reorder_point) || 0,
        average_weighted_cost: Number(item.average_weighted_cost) || 0,
        location: item.location?.trim() ? item.location.trim() : null,
        deposit_id: item.deposit_id ?? null,
        furniture_id: item.furniture_id ?? null,
        shelf_number: item.shelf_number != null ? Math.trunc(Number(item.shelf_number)) : null,
        brand: item.brand?.trim() ? item.brand.trim() : null,
        model: item.model?.trim() ? item.model.trim() : null,
        serial_number: item.serial_number?.trim() ? item.serial_number.trim() : null,
        status: isHerramientas ? item.status ?? null : null,
        observations: item.observations?.trim() ? item.observations.trim() : null,
        product_id: item.product_id ?? null,
        entidad_id: item.entidad_id ?? null,
        proyecto_id: item.proyecto_id ?? null,
        presupuesto_partida_id: item.presupuesto_partida_id ?? null,
      };

      // Si trae sap_code y el usuario lo escribió, lo actualizamos (opcional)
      if (item.sap_code != null) payload.sap_code = item.sap_code;

      const { error } = await supabase.from('global_inventory').update(payload).eq('id', item.id);
      if (error) throw error;

      if (stockDirty) {
        const stockRes = await fetch(
          `/api/almacen/inventario/${encodeURIComponent(item.id)}/stock`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ubicacion_id: stockUbicacionId.trim(),
              cantidad: cantidadStock,
              notas: 'Ajuste desde editar activo',
            }),
          },
        );
        const stockData = (await stockRes.json()) as { error?: string };
        if (!stockRes.ok) {
          throw new Error(stockData.error || 'No se pudo actualizar la cantidad en inventario');
        }
      }

      router.push('/almacen');
    } catch (err: any) {
      alert(err?.message ?? 'Error al actualizar el ítem');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans flex items-center justify-center">
        <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Cargando…</p>
      </div>
    );
  }

  if (loadErr || !item) {
    return (
      <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/almacen">
              <button
                type="button"
                className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
            </Link>
            <h1 className="text-2xl font-black tracking-tighter">Editar inventario</h1>
          </div>

          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-red-400" size={18} />
              <div>
                <p className="font-bold">No se pudo cargar el ítem</p>
                <p className="text-zinc-300 text-sm mt-1">{loadErr ?? 'Error desconocido'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/almacen">
            <button type="button" className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tighter">EDITAR ACTIVO</h1>
            <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">
              Modifica cantidad, serial y ubicación
            </p>
          </div>
          <Link href={`/almacen/trazabilidad?materialId=${encodeURIComponent(id)}`}>
            <button
              type="button"
              className="flex items-center gap-2 p-3 bg-zinc-900 border border-amber-500/35 rounded-2xl hover:bg-zinc-800 transition-all text-xs font-bold uppercase text-amber-200"
            >
              <Route size={18} />
              Ruta
            </button>
          </Link>
          <Link href="/almacen/maestros">
            <button
              type="button"
              className="flex items-center gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all text-xs font-bold uppercase"
            >
              <Settings2 size={18} />
              Maestros
            </button>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <GlassCard className="p-8">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Nombre / descripción
                </label>
                <div className="relative">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                    required
                  />
                </div>
              </div>

              <InventarioClasificacionFields
                value={{
                  entidad_id: item.entidad_id,
                  proyecto_id: item.proyecto_id,
                  presupuesto_partida_id: item.presupuesto_partida_id,
                }}
                onChange={(next) =>
                  setItem((prev) =>
                    prev
                      ? {
                          ...prev,
                          entidad_id: next.entidad_id,
                          proyecto_id: next.proyecto_id,
                          presupuesto_partida_id: next.presupuesto_partida_id,
                        }
                      : prev,
                  )
                }
              />

              <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Producto del catálogo (opcional)
                </label>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Enlaza este material con un ítem de <span className="text-zinc-400">Productos</span> para usar su foto en
                  inventario sin depender de que el nombre coincida.
                </p>
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar por nombre, marca o modelo…"
                  className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 font-bold text-sm outline-none focus:border-blue-500/50 transition-all"
                />
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <select
                    value={item.product_id != null ? String(item.product_id) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItem((prev) =>
                        prev
                          ? {
                              ...prev,
                              product_id: v === '' ? null : Number(v),
                            }
                          : prev,
                      );
                    }}
                    className="w-full sm:flex-1 bg-black border border-zinc-800 rounded-xl py-3 px-4 font-bold text-sm outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  >
                    <option value="">Sin enlace al catálogo</option>
                    {filteredCatalogProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                        {p.marca ? ` · ${p.marca}` : ''}
                        {p.modelo ? ` · ${p.modelo}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedCatalogProduct?.imagen?.trim() ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Vista</span>
                      <img
                        src={selectedCatalogProduct.imagen.trim()}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover border border-zinc-700 bg-black"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Categoría</label>
                  <select
                    value={item.category_id}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, category_id: e.target.value } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  >
                    <option value="">Seleccionar…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Unidad</label>
                  <SelectorUnidadMedida
                    value={item.unit}
                    onChange={(unit) => setItem((prev) => (prev ? { ...prev, unit } : prev))}
                    units={units.map((u) => ({ code: u.code, name: u.name }))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                    inputClassName="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Cantidad disponible (inventario_stock)
                  </label>
                  {stockLoading ? (
                    <p className="text-zinc-500 text-sm font-bold">Cargando stock por ubicación…</p>
                  ) : (
                    <div className="space-y-4 rounded-xl border border-zinc-800 bg-black/40 p-4">
                      {stockFilas.length > 1 ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            Ubicación a editar
                          </label>
                          <select
                            value={stockUbicacionId}
                            onChange={(e) => seleccionarUbicacionStock(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                          >
                            {stockFilas.map((f) => (
                              <option key={f.ubicacion_id} value={f.ubicacion_id}>
                                {f.ubicacion_nombre} — {f.cantidad_disponible} u.
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : stockFilas.length === 1 ? (
                        <p className="text-sm text-zinc-400">
                          Ubicación: <span className="text-white font-bold">{stockFilas[0]!.ubicacion_nombre}</span>
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                            Ubicación del stock
                          </label>
                          <UbicacionInventarioSelect
                            proyectoId={item.proyecto_id ?? ''}
                            value={stockUbicacionId}
                            onChange={(uid) => {
                              setStockUbicacionId(uid);
                              setStockCantidad('0');
                              setStockCantidadInicial('0');
                            }}
                            permitirSinProyecto
                            soloAlmacenes={false}
                            placeholder="Seleccione almacén u obra…"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={stockCantidad}
                          onChange={(e) => setStockCantidad(e.target.value)}
                          disabled={!stockUbicacionId && stockFilas.length === 0}
                          className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all disabled:opacity-50"
                        />
                      </div>

                      {stockTotal > 0 && stockFilas.length > 1 ? (
                        <p className="text-[11px] text-zinc-500">
                          Total en todas las ubicaciones:{' '}
                          <span className="text-zinc-300 font-bold">{stockTotal.toLocaleString('es-VE')} u.</span>
                        </p>
                      ) : null}

                      <p className="text-[11px] text-zinc-600">
                        El ajuste queda registrado en el ledger (tipo ajuste) y en la trazabilidad del material.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Serial (si aplica)</label>
                  <input
                    type="text"
                    value={item.serial_number ?? ''}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, serial_number: e.target.value } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Stock en cuarentena</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.stock_quarantine}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, stock_quarantine: Number(e.target.value) } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Punto de reorden</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.reorder_point}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, reorder_point: Number(e.target.value) } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ubicación</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                  <input
                    type="text"
                    value={item.location ?? ''}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Depósito</label>
                  <select
                    value={item.deposit_id ?? ''}
                    onChange={(e) => {
                      const nextDep = e.target.value || null;
                      setItem((prev) =>
                        prev
                          ? {
                              ...prev,
                              deposit_id: nextDep,
                              furniture_id: null,
                              shelf_number: null,
                            }
                          : prev
                      );
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  >
                    <option value="">Sin depósito</option>
                    {deposits.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Armario / Estante</label>
                  <select
                    value={item.furniture_id ?? ''}
                    onChange={(e) => {
                      const nextFurnitureId = e.target.value || null;
                      setItem((prev) => (prev ? { ...prev, furniture_id: nextFurnitureId } : prev));
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                    disabled={!item.deposit_id}
                  >
                    <option value="">{item.deposit_id ? 'Seleccionar…' : 'Primero el depósito'}</option>
                    {furnitureForDeposit.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Repisa (shelf_number) · 1–{maxRepisasShelf}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxRepisasShelf}
                    step={1}
                    inputMode="numeric"
                    value={item.shelf_number ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setItem((prev) => (prev ? { ...prev, shelf_number: null } : prev));
                        return;
                      }
                      const raw = Number(e.target.value);
                      if (!Number.isFinite(raw)) return;
                      const int = Math.trunc(raw);
                      setItem((prev) =>
                        prev ? { ...prev, shelf_number: Math.min(maxRepisasShelf, Math.max(1, int)) } : prev,
                      );
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                    disabled={!item.furniture_id}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Costo ponderado</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.average_weighted_cost}
                    onChange={(e) =>
                      setItem((prev) => (prev ? { ...prev, average_weighted_cost: Number(e.target.value) } : prev))
                    }
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Marca</label>
                  <input
                    type="text"
                    value={item.brand ?? ''}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Modelo</label>
                  <input
                    type="text"
                    value={item.model ?? ''}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
                </div>
              </div>

              {isHerramientas ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Estado</label>
                  <select
                    value={item.status ?? 'OPERATIVO'}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, status: e.target.value as any } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Observaciones</label>
                <textarea
                  value={item.observations ?? ''}
                  onChange={(e) => setItem((prev) => (prev ? { ...prev, observations: e.target.value } : prev))}
                  rows={4}
                  className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                />
              </div>
            </div>
          </GlassCard>

          <div className="flex gap-3 justify-end">
            <Link href="/almacen" className="flex items-center">
              <button
                type="button"
                className="px-6 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all font-black"
              >
                Cancelar
              </button>
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 transition-all font-black flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

