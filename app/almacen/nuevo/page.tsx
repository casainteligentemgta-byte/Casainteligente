'use client';

/**
 * Alta de ítem en global_inventory: categorías y unidades desde BD,
 * depósito → armario/estante → repisa; SAP autogenerado si se deja vacío (trigger en BD).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import {
  ArrowLeft,
  Save,
  Package,
  Hash,
  MapPin,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Deposit = { id: string; code: string; name: string; locality: string | null; is_default: boolean };
type Furniture = {
  id: string;
  deposit_id: string;
  kind: string;
  name: string;
  repisas_count: number;
};
type Category = { id: string; name: string };
type UnitRow = { id: string; code: string; name: string };

type CatalogProductRow = {
  id: number;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  imagen: string | null;
};

export default function NewInventoryItemPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductRow[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [depositId, setDepositId] = useState('');
  const [furnitureId, setFurnitureId] = useState('');
  const [shelfNumber, setShelfNumber] = useState<number | ''>('');
  const [item, setItem] = useState({
    sap_code: '',
    name: '',
    category_id: '',
    unit: 'UND',
    reorder_point: 0,
    location: '',
    brand: '',
    model: '',
    serial_number: '',
    last_purchase_date: '',
    status: 'OPERATIVO',
    observations: '',
    product_id: null as number | null,
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const loadMasters = useCallback(async () => {
    setLoadErr(null);
    const [d, f, c, u] = await Promise.all([
      supabase.from('inventory_deposits').select('id,code,name,locality,is_default').order('is_default', { ascending: false }).order('name'),
      supabase.from('inventory_furniture').select('id,deposit_id,kind,name,repisas_count').order('sort_order').order('name'),
      supabase.from('material_categories').select('id,name').order('name'),
      supabase.from('inventory_units').select('id,code,name').eq('active', true).order('sort_order').order('code'),
    ]);
    const err = d.error || f.error || c.error || u.error;
    if (err) {
      setLoadErr(err.message);
      return;
    }
    const depList = (d.data ?? []) as Deposit[];
    const furList = (f.data ?? []) as Furniture[];
    setDeposits(depList);
    setFurniture(furList);
    setCategories((c.data ?? []) as Category[]);
    setUnits((u.data ?? []) as UnitRow[]);

    setDepositId((prev) => {
      if (prev && depList.some((x) => x.id === prev)) return prev;
      const def = depList.find((x) => x.is_default);
      return def?.id ?? depList[0]?.id ?? '';
    });
    setItem((prev) => ({
      ...prev,
      category_id: prev.category_id || (c.data as Category[] | undefined)?.[0]?.id || '',
      unit: prev.unit || (u.data as UnitRow[] | undefined)?.find((x) => x.code === 'UND')?.code || (u.data as UnitRow[])?.[0]?.code || 'UND',
    }));

    const { data: prodData, error: prodErr } = await supabase
      .from('products')
      .select('id,nombre,marca,modelo,imagen')
      .order('nombre');
    if (!prodErr && prodData) {
      setCatalogProducts(prodData as CatalogProductRow[]);
    }
  }, [supabase]);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  const furnitureForDeposit = useMemo(
    () => furniture.filter((f) => f.deposit_id === depositId),
    [furniture, depositId]
  );

  useEffect(() => {
    if (!furnitureForDeposit.length) {
      setFurnitureId('');
      setShelfNumber('');
      return;
    }
    setFurnitureId((prev) => (prev && furnitureForDeposit.some((f) => f.id === prev) ? prev : furnitureForDeposit[0].id));
  }, [depositId, furnitureForDeposit]);

  const selectedFurniture = furnitureForDeposit.find((f) => f.id === furnitureId);
  const maxRepisas = selectedFurniture?.repisas_count ?? 0;

  useEffect(() => {
    if (!selectedFurniture) {
      setShelfNumber('');
      return;
    }
    setShelfNumber((n) => {
      if (n === '') return 1;
      const num = typeof n === 'number' ? n : 1;
      return Math.min(maxRepisas, Math.max(1, num));
    });
  }, [selectedFurniture, maxRepisas]);

  const selectedCategory = categories.find((c) => c.id === item.category_id);
  const isHerramientas =
    selectedCategory?.name.toLowerCase().includes('herramient') ?? false;

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
    const pid = item.product_id;
    if (pid != null) {
      const sel = catalogProducts.find((p) => p.id === pid);
      if (sel && !list.some((p) => p.id === pid)) {
        list = [sel, ...list];
      }
    }
    return list;
  }, [catalogProducts, productSearch, item.product_id]);

  const selectedCatalogProduct = useMemo(
    () => (item.product_id != null ? catalogProducts.find((p) => p.id === item.product_id) : null),
    [catalogProducts, item.product_id],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.name.trim() || !item.category_id) {
      alert('Nombre y categoría son obligatorios.');
      return;
    }
    setLoading(true);
    try {
      const sapTrim = item.sap_code.trim();
      const payload: Record<string, unknown> = {
        name: item.name.trim(),
        category_id: item.category_id,
        unit: item.unit,
        stock_available: isHerramientas ? 1 : 0,
        stock_quarantine: 0,
        reorder_point: item.reorder_point,
        average_weighted_cost: 0,
        location: item.location.trim() || null,
        last_purchase_date: item.last_purchase_date || null,
        deposit_id: depositId || null,
        furniture_id: furnitureId || null,
        shelf_number: shelfNumber === '' ? null : Number(shelfNumber),
        brand: item.brand.trim() || null,
        model: item.model.trim() || null,
        serial_number: item.serial_number.trim() || null,
        status: isHerramientas ? item.status : null,
        observations: item.observations.trim() || null,
      };
      if (sapTrim) payload.sap_code = sapTrim;

      const { error } = await supabase.from('global_inventory').insert([payload]);
      if (error) throw error;
      router.push('/almacen');
    } catch (error) {
      console.error('Error creating item:', error);
      alert('Error al crear el material. ¿Ejecutaste la migración 014 y tienes categorías en BD?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/almacen">
            <button
              type="button"
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tighter">ALTA DE ACTIVO</h1>
            <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">
              Maestro de inventario — SAP automático si dejas el código vacío
            </p>
          </div>
          <Link href="/almacen/maestros">
            <button
              type="button"
              className="flex items-center gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 text-xs font-bold uppercase"
            >
              <Settings2 size={18} />
              Maestros
            </button>
          </Link>
        </div>

        {loadErr && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            {loadErr}
            <p className="mt-2 text-xs text-zinc-400">
              Aplica <code className="text-white">014_almacen_maestros_sap.sql</code> en Supabase SQL Editor.
            </p>
          </div>
        )}

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
                    required
                    value={item.name}
                    onChange={(e) => setItem({ ...item, name: e.target.value })}
                    placeholder="Ej: Taladro percutor Milwaukee 18V"
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:bg-white focus:text-black focus:border-blue-500 transition-all text-lg"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Producto del catálogo (opcional)
                </label>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Enlaza con un producto de ventas para mostrar su foto en la lista de inventario.
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
                      setItem((prev) => ({
                        ...prev,
                        product_id: v === '' ? null : Number(v),
                      }));
                    }}
                    className="w-full sm:flex-1 bg-black border border-zinc-800 rounded-xl py-3 px-4 font-bold text-sm outline-none focus:bg-white focus:text-black transition-all"
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

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Categoría
                  </label>
                  <select
                    required
                    value={item.category_id}
                    onChange={(e) => setItem({ ...item, category_id: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="text-black">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Unidad
                  </label>
                  <select
                    value={item.unit}
                    onChange={(e) => setItem({ ...item, unit: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.code} className="text-black">
                        {u.code} — {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Depósito
                  </label>
                  <select
                    value={depositId}
                    onChange={(e) => setDepositId(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black"
                  >
                    {deposits.map((d) => (
                      <option key={d.id} value={d.id} className="text-black">
                        {d.name} ({d.code})
                        {d.locality ? ` · ${d.locality}` : ''}
                        {d.is_default ? ' — por defecto' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Armario / estante
                  </label>
                  <select
                    value={furnitureId}
                    onChange={(e) => setFurnitureId(e.target.value)}
                    disabled={!furnitureForDeposit.length}
                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:bg-white focus:text-black disabled:opacity-50"
                  >
                    {furnitureForDeposit.length === 0 ? (
                      <option value="">Crea muebles en Maestros</option>
                    ) : (
                      furnitureForDeposit.map((f) => (
                        <option key={f.id} value={f.id} className="text-black">
                          {f.name} ({f.kind}) — {f.repisas_count} repisas
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {selectedFurniture && maxRepisas > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Repisa (1–{maxRepisas})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxRepisas}
                    value={shelfNumber}
                    onChange={(e) => {
                      const v = e.target.value === '' ? '' : Number(e.target.value);
                      if (v === '') setShelfNumber('');
                      else setShelfNumber(Math.min(maxRepisas, Math.max(1, v)));
                    }}
                    className="w-full sm:max-w-xs bg-black border border-zinc-800 rounded-xl p-4 font-bold outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {isHerramientas && (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Marca</label>
                      <input
                        type="text"
                        value={item.brand}
                        onChange={(e) => setItem({ ...item, brand: e.target.value })}
                        placeholder="Ej: Milwaukee"
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Modelo</label>
                      <input
                        type="text"
                        value={item.model}
                        onChange={(e) => setItem({ ...item, model: e.target.value })}
                        placeholder="Ej: 2804-20"
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Nº de serie</label>
                      <input
                        type="text"
                        value={item.serial_number}
                        onChange={(e) => setItem({ ...item, serial_number: e.target.value })}
                        placeholder="S/N"
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Estatus</label>
                      <select
                        value={item.status}
                        onChange={(e) => setItem({ ...item, status: e.target.value })}
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:bg-white focus:text-black"
                      >
                        <option value="OPERATIVO" className="text-black">
                          OPERATIVO
                        </option>
                        <option value="EN REPARACION" className="text-black">
                          EN REPARACIÓN
                        </option>
                        <option value="BAJA" className="text-black">
                          FUERA DE SERVICIO (BAJA)
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">
                      Fecha de ingreso / compra
                    </label>
                    <input
                      type="date"
                      value={item.last_purchase_date}
                      onChange={(e) => setItem({ ...item, last_purchase_date: e.target.value })}
                      className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">
                      Observaciones
                    </label>
                    <textarea
                      value={item.observations}
                      onChange={(e) => setItem({ ...item, observations: e.target.value })}
                      rows={3}
                      placeholder="Accesorios, estado..."
                      className="w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold outline-none focus:bg-white focus:text-black resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Código SAP (opcional)
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      type="text"
                      value={item.sap_code}
                      onChange={(e) => setItem({ ...item, sap_code: e.target.value })}
                      placeholder="Vacío → SAP-000001 automático"
                      className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:border-white transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Ubicación libre (opcional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      type="text"
                      value={item.location}
                      onChange={(e) => setItem({ ...item, location: e.target.value })}
                      placeholder="Nota adicional de ubicación"
                      className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 font-bold outline-none focus:border-white transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <button
                type="submit"
                disabled={loading || !categories.length}
                className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black" />
                ) : (
                  <>
                    <Save size={24} />
                    CREAR MATERIAL
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </form>
      </div>
    </div>
  );
}
