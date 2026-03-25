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
} from 'lucide-react';

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
  deposit_id: string | null;
  furniture_id: string | null;
  shelf_number: number | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: 'OPERATIVO' | 'EN REPARACION' | 'BAJA' | null;
  observations: string | null;
  image_url: string | null;
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

  const furnitureForDeposit = useMemo(() => {
    if (!item?.deposit_id) return [];
    return furniture.filter((f) => f.deposit_id === item.deposit_id);
  }, [furniture, item?.deposit_id]);

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
      deposit_id: data.deposit_id ?? null,
      furniture_id: data.furniture_id ?? null,
      shelf_number: data.shelf_number ?? null,
      brand: data.brand ?? null,
      model: data.model ?? null,
      serial_number: data.serial_number ?? null,
      status: (data.status ?? null) as InventoryEditItem['status'],
      observations: data.observations ?? null,
      image_url: data.image_url ?? null,
    };

    setItem(normalized);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    void (async () => {
      await loadMasters();
      await fetchItem();
    })();
  }, [loadMasters, fetchItem]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!item.name.trim() || !item.category_id) {
      alert('Nombre y categoría son obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: item.name.trim(),
        category_id: item.category_id,
        unit: item.unit,
        stock_available: Number(item.stock_available) || 0,
        stock_quarantine: Number(item.stock_quarantine) || 0,
        reorder_point: Number(item.reorder_point) || 0,
        average_weighted_cost: Number(item.average_weighted_cost) || 0,
        location: item.location?.trim() ? item.location.trim() : null,
        deposit_id: item.deposit_id ?? null,
        furniture_id: item.furniture_id ?? null,
        shelf_number: item.shelf_number != null ? Number(item.shelf_number) : null,
        brand: item.brand?.trim() ? item.brand.trim() : null,
        model: item.model?.trim() ? item.model.trim() : null,
        serial_number: item.serial_number?.trim() ? item.serial_number.trim() : null,
        status: isHerramientas ? item.status ?? null : null,
        observations: item.observations?.trim() ? item.observations.trim() : null,
        // Mantener sap_code, image_url: no es necesario tocarlos si no se envían en payload.
      };

      // Si trae sap_code y el usuario lo escribió, lo actualizamos (opcional)
      if (item.sap_code != null) payload.sap_code = item.sap_code;

      const { error } = await supabase.from('global_inventory').update(payload).eq('id', item.id);
      if (error) throw error;

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
                  <select
                    value={item.unit}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, unit: e.target.value } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.code}>
                        {u.code} - {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Stock disponible (cantidad)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.stock_available}
                    onChange={(e) => setItem((prev) => (prev ? { ...prev, stock_available: Number(e.target.value) } : prev))}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 px-4 font-bold outline-none focus:bg-white focus:text-black focus:border-white transition-all"
                  />
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
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Repisa (shelf_number)</label>
                  <input
                    type="number"
                    value={item.shelf_number ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setItem((prev) => (prev ? { ...prev, shelf_number: val } : prev));
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

