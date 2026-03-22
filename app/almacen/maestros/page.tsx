'use client';

/**
 * Maestros de almacén: depósitos (localidades), armarios/estantes con repisas,
 * categorías de material y unidades de medida — CRUD vía Supabase.
 * Requiere migración: supabase/migrations/014_almacen_maestros_sap.sql
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { GlassCard } from '@/components/inventory/GlassCard';
import { ArrowLeft, Building2, Layers, Tag, Ruler, Plus, Trash2 } from 'lucide-react';

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
type Category = { id: string; name: string; level: number; parent_id: string | null };
type UnitRow = { id: string; code: string; name: string; active: boolean; sort_order: number };

const KINDS = [
  { value: 'armario', label: 'Armario' },
  { value: 'estante', label: 'Estante / estantería' },
  { value: 'otro', label: 'Otro mueble / zona' },
];

export default function AlmacenMaestrosPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<'depositos' | 'muebles' | 'categorias' | 'unidades'>('depositos');
  const [err, setErr] = useState<string | null>(null);

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);

  const [depForm, setDepForm] = useState({ code: '', name: '', locality: '', is_default: false });
  const [furDepositId, setFurDepositId] = useState('');
  const [furForm, setFurForm] = useState({
    kind: 'armario',
    name: '',
    code: '',
    repisas_count: 4,
    sort_order: 0,
  });
  const [catName, setCatName] = useState('');
  const [unitForm, setUnitForm] = useState({ code: '', name: '' });

  const loadAll = useCallback(async () => {
    setErr(null);
    const [d, f, c, u] = await Promise.all([
      supabase.from('inventory_deposits').select('*').order('is_default', { ascending: false }).order('name'),
      supabase.from('inventory_furniture').select('*').order('sort_order').order('name'),
      supabase.from('material_categories').select('*').order('name'),
      supabase.from('inventory_units').select('*').order('sort_order').order('code'),
    ]);
    if (d.error) setErr(d.error.message);
    else if (f.error) setErr(f.error.message);
    else if (c.error) setErr(c.error.message);
    else if (u.error) setErr(u.error.message);
    if (d.data) {
      const list = d.data as Deposit[];
      setDeposits(list);
      setFurDepositId((prev) => {
        if (prev && list.some((x) => x.id === prev)) return prev;
        const def = list.find((x) => x.is_default);
        return def?.id ?? list[0]?.id ?? '';
      });
    }
    if (f.data) setFurniture(f.data as Furniture[]);
    if (c.data) setCategories(c.data as Category[]);
    if (u.data) setUnits(u.data as UnitRow[]);
  }, [supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function addDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depForm.code.trim() || !depForm.name.trim()) return;
    if (depForm.is_default) {
      await supabase
        .from('inventory_deposits')
        .update({ is_default: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { error } = await supabase.from('inventory_deposits').insert({
      code: depForm.code.trim().toUpperCase(),
      name: depForm.name.trim(),
      locality: depForm.locality.trim() || null,
      is_default: depForm.is_default,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setDepForm({ code: '', name: '', locality: '', is_default: false });
    loadAll();
  }

  async function deleteDeposit(id: string) {
    if (!confirm('¿Eliminar depósito? No debe tener ítems asociados.')) return;
    const { error } = await supabase.from('inventory_deposits').delete().eq('id', id);
    if (error) alert(error.message);
    else loadAll();
  }

  async function addFurniture(e: React.FormEvent) {
    e.preventDefault();
    if (!furDepositId || !furForm.name.trim()) return;
    const { error } = await supabase.from('inventory_furniture').insert({
      deposit_id: furDepositId,
      kind: furForm.kind,
      name: furForm.name.trim(),
      code: furForm.code.trim() || null,
      repisas_count: Math.min(99, Math.max(1, Number(furForm.repisas_count) || 1)),
      sort_order: Number(furForm.sort_order) || 0,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setFurForm({ kind: 'armario', name: '', code: '', repisas_count: 4, sort_order: 0 });
    loadAll();
  }

  async function deleteFurniture(id: string) {
    if (!confirm('¿Eliminar este armario/estante?')) return;
    const { error } = await supabase.from('inventory_furniture').delete().eq('id', id);
    if (error) alert(error.message);
    else loadAll();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    const { error } = await supabase.from('material_categories').insert({
      name: catName.trim(),
      level: 1,
      parent_id: null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setCatName('');
    loadAll();
  }

  async function deleteCategory(id: string) {
    if (!confirm('¿Eliminar categoría?')) return;
    const { error } = await supabase.from('material_categories').delete().eq('id', id);
    if (error) alert(error.message);
    else loadAll();
  }

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitForm.code.trim() || !unitForm.name.trim()) return;
    const { error } = await supabase.from('inventory_units').insert({
      code: unitForm.code.trim().toUpperCase(),
      name: unitForm.name.trim(),
      sort_order: 99,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setUnitForm({ code: '', name: '' });
    loadAll();
  }

  async function deleteUnit(id: string) {
    if (!confirm('¿Eliminar unidad?')) return;
    const { error } = await supabase.from('inventory_units').delete().eq('id', id);
    if (error) alert(error.message);
    else loadAll();
  }

  const tabs: { id: typeof tab; label: string; icon: React.ReactNode }[] = [
    { id: 'depositos', label: 'Depósitos', icon: <Building2 size={16} /> },
    { id: 'muebles', label: 'Armarios / estantes', icon: <Layers size={16} /> },
    { id: 'categorias', label: 'Categorías', icon: <Tag size={16} /> },
    { id: 'unidades', label: 'Unidades', icon: <Ruler size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/almacen">
            <button
              type="button"
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tighter">MAESTROS DE ALMACÉN</h1>
            <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">
              Depósitos, ubicación física, categorías y unidades
            </p>
          </div>
        </div>

        {err && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {err}{' '}
            <span className="block mt-2 text-zinc-400 text-xs">
              Si la tabla no existe, ejecuta en Supabase la migración{' '}
              <code className="text-white">014_almacen_maestros_sap.sql</code>.
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider ${
                tab === t.id ? 'bg-blue-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'depositos' && (
          <GlassCard className="p-6 space-y-6">
            <h2 className="font-black text-sm uppercase tracking-widest text-zinc-400">Nuevo depósito</h2>
            <form onSubmit={addDeposit} className="grid gap-3 sm:grid-cols-2">
              <input
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Código (ej. CCS, MAR)"
                value={depForm.code}
                onChange={(e) => setDepForm({ ...depForm, code: e.target.value })}
              />
              <input
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Nombre (ej. Bodega principal)"
                value={depForm.name}
                onChange={(e) => setDepForm({ ...depForm, name: e.target.value })}
              />
              <input
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold sm:col-span-2"
                placeholder="Localidad / ciudad (opcional)"
                value={depForm.locality}
                onChange={(e) => setDepForm({ ...depForm, locality: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-400 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={depForm.is_default}
                  onChange={(e) => setDepForm({ ...depForm, is_default: e.target.checked })}
                />
                Marcar como depósito por defecto (solo uno; al guardar se quita el flag a los demás en este alta)
              </label>
              <button
                type="submit"
                className="sm:col-span-2 flex items-center justify-center gap-2 bg-white text-black py-3 rounded-xl font-black"
              >
                <Plus size={18} />
                Añadir depósito
              </button>
            </form>
            <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
              {deposits.map((d) => (
                <li key={d.id} className="flex items-center justify-between p-4 bg-zinc-900/40">
                  <div>
                    <p className="font-black">
                      {d.code} — {d.name}
                      {d.is_default && (
                        <span className="ml-2 text-[10px] bg-blue-600 px-2 py-0.5 rounded">POR DEFECTO</span>
                      )}
                    </p>
                    {d.locality && <p className="text-xs text-zinc-500">{d.locality}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteDeposit(d.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {tab === 'muebles' && (
          <GlassCard className="p-6 space-y-6">
            <h2 className="font-black text-sm uppercase tracking-widest text-zinc-400">Armarios, estantes y repisas</h2>
            <form onSubmit={addFurniture} className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs text-zinc-500 uppercase font-bold">
                Depósito
                <select
                  className="mt-1 w-full bg-black border border-zinc-800 rounded-xl p-3 font-bold text-white"
                  value={furDepositId}
                  onChange={(e) => setFurDepositId(e.target.value)}
                >
                  {deposits.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </label>
              <select
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                value={furForm.kind}
                onChange={(e) => setFurForm({ ...furForm, kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Nombre (ej. Armario herramientas A)"
                value={furForm.name}
                onChange={(e) => setFurForm({ ...furForm, name: e.target.value })}
              />
              <input
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Código corto (opcional)"
                value={furForm.code}
                onChange={(e) => setFurForm({ ...furForm, code: e.target.value })}
              />
              <input
                type="number"
                min={1}
                max={99}
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Nº de repisas"
                value={furForm.repisas_count}
                onChange={(e) => setFurForm({ ...furForm, repisas_count: Number(e.target.value) })}
              />
              <input
                type="number"
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Orden"
                value={furForm.sort_order}
                onChange={(e) => setFurForm({ ...furForm, sort_order: Number(e.target.value) })}
              />
              <button
                type="submit"
                className="sm:col-span-2 flex items-center justify-center gap-2 bg-white text-black py-3 rounded-xl font-black"
              >
                <Plus size={18} />
                Guardar mueble
              </button>
            </form>
            <ul className="space-y-2">
              {furniture.map((f) => {
                const dep = deposits.find((d) => d.id === f.deposit_id);
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40"
                  >
                    <div>
                      <p className="font-black text-sm">
                        {f.name}{' '}
                        <span className="text-zinc-500 font-bold">({f.kind})</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {dep?.name ?? f.deposit_id} · {f.repisas_count} repisas
                        {f.code ? ` · ${f.code}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteFurniture(f.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        )}

        {tab === 'categorias' && (
          <GlassCard className="p-6 space-y-6">
            <h2 className="font-black text-sm uppercase tracking-widest text-zinc-400">Categorías de material</h2>
            <form onSubmit={addCategory} className="flex gap-2">
              <input
                className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Nombre de la categoría"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
              <button type="submit" className="px-6 bg-white text-black rounded-xl font-black">
                <Plus className="inline mr-1" size={16} />
                Añadir
              </button>
            </form>
            <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-4 bg-zinc-900/40">
                  <span className="font-bold">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => deleteCategory(c.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {tab === 'unidades' && (
          <GlassCard className="p-6 space-y-6">
            <h2 className="font-black text-sm uppercase tracking-widest text-zinc-400">Unidades de medida</h2>
            <form onSubmit={addUnit} className="grid gap-3 sm:grid-cols-2">
              <input
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold uppercase"
                placeholder="Código (ej. CAJA)"
                value={unitForm.code}
                onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })}
              />
              <input
                className="bg-black border border-zinc-800 rounded-xl p-3 font-bold"
                placeholder="Nombre legible"
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
              />
              <button
                type="submit"
                className="sm:col-span-2 flex items-center justify-center gap-2 bg-white text-black py-3 rounded-xl font-black"
              >
                <Plus size={18} />
                Añadir unidad
              </button>
            </form>
            <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
              {units.map((u) => (
                <li key={u.id} className="flex items-center justify-between p-4 bg-zinc-900/40">
                  <span className="font-bold">
                    {u.code} <span className="text-zinc-500 font-normal">— {u.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteUnit(u.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
