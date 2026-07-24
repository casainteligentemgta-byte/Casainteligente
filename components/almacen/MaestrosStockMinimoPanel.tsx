'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/inventory/GlassCard';
import { loadProyectos, type ProyectoRow } from '@/lib/almacen/inventoryClasificacion';
import { getStockAgregadoPorMaterialObra } from '@/lib/almacen/getStockRealObra';
import {
  cargarReordenPorObra,
  guardarReordenObraMaterial,
  reorderPointEfectivo,
} from '@/lib/almacen/inventarioReordenObra';
import { filtrarObrasConstruccion } from '@/lib/proyectos/naturalezaProyecto';

type MaterialReordenRow = {
  id: string;
  name: string;
  unit: string;
  sap_code: string | null;
  reorder_point_global: number;
  stock: number;
};

type Props = {
  supabase: SupabaseClient;
};

export default function MaestrosStockMinimoPanel({ supabase }: Props) {
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState<MaterialReordenRow[]>([]);
  const [reordenObra, setReordenObra] = useState<Map<string, number>>(new Map());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const obras = useMemo(() => filtrarObrasConstruccion(proyectos), [proyectos]);

  useEffect(() => {
    void loadProyectos(supabase)
      .then(setProyectos)
      .catch((e) => setErr(e instanceof Error ? e.message : 'No se cargaron obras'));
  }, [supabase]);

  const cargarMateriales = useCallback(async () => {
    const pid = proyectoId.trim();
    if (!pid) {
      setFilas([]);
      setReordenObra(new Map());
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const [stockMap, reordenMap, invRes] = await Promise.all([
        getStockAgregadoPorMaterialObra(supabase, pid),
        cargarReordenPorObra(supabase, pid),
        supabase
          .from('global_inventory')
          .select('id,name,unit,sap_code,reorder_point')
          .eq('proyecto_id', pid)
          .order('name'),
      ]);

      if (invRes.error) throw new Error(invRes.error.message);

      const byId = new Map<string, MaterialReordenRow>();

      for (const row of invRes.data ?? []) {
        const id = String(row.id);
        byId.set(id, {
          id,
          name: String(row.name ?? 'Material'),
          unit: String(row.unit ?? 'UND'),
          sap_code: row.sap_code ? String(row.sap_code) : null,
          reorder_point_global: Number(row.reorder_point) || 0,
          stock: stockMap.get(id) ?? 0,
        });
      }

      for (const [id, qty] of Array.from(stockMap.entries())) {
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          name: 'Material',
          unit: 'UND',
          sap_code: null,
          reorder_point_global: 0,
          stock: qty,
        });
      }

      const idsSinNombre = Array.from(byId.values()).filter((r) => r.name === 'Material');
      if (idsSinNombre.length) {
        const { data: names } = await supabase
          .from('global_inventory')
          .select('id,name,unit,sap_code,reorder_point')
          .in(
            'id',
            idsSinNombre.map((r) => r.id),
          );
        for (const row of names ?? []) {
          const hit = byId.get(String(row.id));
          if (!hit) continue;
          hit.name = String(row.name ?? 'Material');
          hit.unit = String(row.unit ?? 'UND');
          hit.sap_code = row.sap_code ? String(row.sap_code) : null;
          hit.reorder_point_global = Number(row.reorder_point) || 0;
        }
      }

      const lista = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      setFilas(lista);
      setReordenObra(reordenMap);
      const nextDrafts: Record<string, string> = {};
      for (const f of lista) {
        nextDrafts[f.id] = String(
          reorderPointEfectivo(f.id, f.reorder_point_global, reordenMap),
        );
      }
      setDrafts(nextDrafts);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar materiales');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, supabase]);

  useEffect(() => {
    void cargarMateriales();
  }, [cargarMateriales]);

  const filasVisibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter(
      (f) =>
        f.name.toLowerCase().includes(t) ||
        (f.sap_code?.toLowerCase().includes(t) ?? false),
    );
  }, [filas, busqueda]);

  async function guardarFila(materialId: string) {
    const pid = proyectoId.trim();
    if (!pid) return;
    const parsed = Number.parseFloat(String(drafts[materialId] ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert('Cantidad mínima inválida');
      return;
    }
    setSavingId(materialId);
    try {
      await guardarReordenObraMaterial(supabase, {
        proyectoId: pid,
        materialId,
        reorderPoint: parsed,
      });
      setReordenObra((prev) => {
        const next = new Map(prev);
        next.set(materialId, parsed);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <GlassCard className="p-6 space-y-5">
      <div>
        <h2 className="font-black text-sm uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          Stock mínimo por obra
        </h2>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Define el umbral de alerta por material y obra. El KPI «Stock bajo» en Almacenes usa este
          valor cuando hay filtro de obra; si no hay fila, usa el punto de reorden global del
          material.
        </p>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {err}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1.5 block">
            Obra (construcción)
          </span>
          <select
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-black p-3 font-bold"
          >
            <option value="">Seleccione obra…</option>
            {obras.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
            Buscar material
          </span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre o código SAP"
            className="w-full rounded-xl border border-zinc-800 bg-black p-3 font-bold"
            disabled={!proyectoId}
          />
        </label>
      </div>

      {!proyectoId ? (
        <p className="text-sm text-zinc-500">Seleccione una obra para configurar umbrales.</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
          <Loader2 className="animate-spin" size={18} />
          Cargando materiales…
        </div>
      ) : filasVisibles.length === 0 ? (
        <p className="text-sm text-zinc-500">Sin materiales para esta obra.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-[10px] uppercase tracking-widest text-zinc-500">
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2 w-24">Stock</th>
                <th className="px-3 py-2 w-28">Mínimo</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filasVisibles.map((f) => {
                const min = reorderPointEfectivo(f.id, f.reorder_point_global, reordenObra);
                const bajo = f.stock <= min && min > 0;
                return (
                  <tr key={f.id} className={bajo ? 'bg-red-500/5' : undefined}>
                    <td className="px-3 py-2">
                      <p className="font-bold text-zinc-100">{f.name}</p>
                      {f.sap_code ? (
                        <p className="text-[10px] text-zinc-500 font-mono">{f.sap_code}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {f.stock} {f.unit}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={drafts[f.id] ?? ''}
                        disabled={savingId === f.id}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void guardarFila(f.id);
                        }}
                        className="w-full rounded-lg border border-zinc-700 bg-black px-2 py-1 font-bold tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={savingId === f.id}
                        onClick={() => void guardarFila(f.id)}
                        className="text-[10px] font-black uppercase tracking-wide text-sky-400 hover:text-sky-300 disabled:opacity-50"
                      >
                        {savingId === f.id ? '…' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
