'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import { actualizarMaterialCatalogoObra } from '@/lib/almacen/actualizarMaterialCatalogoObra';
import { confirmarYEliminarMaterialInventario } from '@/lib/almacen/eliminarMaterialInventarioUi';
import { listarMaterialesObraRecepcion } from '@/lib/almacen/listarMaterialesObraRecepcion';
import { crearMaterialParaLineaCompra } from '@/lib/almacen/resolverMaterialParaCompra';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SelectorUnidadMedida from '@/components/almacen/SelectorUnidadMedida';

const NUEVO_MATERIAL = '__nuevo_material__';

type Props = {
  proyectoId: string;
  ubicacionId?: string;
  value: string;
  onChange: (materialId: string) => void;
  onMaterialSeleccionado?: (material: MaterialCampoOpcion | null) => void;
  onMaterialesChange?: (materiales: MaterialCampoOpcion[]) => void;
  onMaterialEliminado?: (materialId: string) => void;
  onMaterialActualizado?: (material: MaterialCampoOpcion) => void;
  disabled?: boolean;
  selectClassName?: string;
  inputClassName?: string;
};

export default function SelectorMaterialObraRecepcion({
  proyectoId,
  ubicacionId,
  value,
  onChange,
  onMaterialSeleccionado,
  onMaterialesChange,
  onMaterialEliminado,
  onMaterialActualizado,
  disabled = false,
  selectClassName = 'w-full rounded-xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20 min-h-[46px]',
  inputClassName = selectClassName,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [materiales, setMateriales] = useState<MaterialCampoOpcion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [unidadNuevo, setUnidadNuevo] = useState('UND');
  const [skuNuevo, setSkuNuevo] = useState('');
  const [creando, setCreando] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editUnidad, setEditUnidad] = useState('');
  const [editSku, setEditSku] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const notificarSeleccion = useCallback(
    (id: string, lista: MaterialCampoOpcion[]) => {
      if (!id) {
        onMaterialSeleccionado?.(null);
        return;
      }
      const m = lista.find((x) => x.id === id) ?? null;
      onMaterialSeleccionado?.(m);
    },
    [onMaterialSeleccionado],
  );

  const cargarLista = useCallback(async () => {
    const pid = proyectoId.trim();
    if (!pid) {
      setMateriales([]);
      onMaterialesChange?.([]);
      return;
    }
    setCargando(true);
    setErrorLista(null);
    try {
      const lista = await listarMaterialesObraRecepcion(supabase, pid);
      setMateriales(lista);
      onMaterialesChange?.(lista);
    } catch (e) {
      setErrorLista(e instanceof Error ? e.message : 'No se pudo cargar materiales de la obra');
      setMateriales([]);
      onMaterialesChange?.([]);
    } finally {
      setCargando(false);
    }
  }, [proyectoId, supabase, onMaterialesChange]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    setModoNuevo(false);
    setNombreNuevo('');
    setUnidadNuevo('UND');
    setSkuNuevo('');
    setErrorNuevo(null);
    setEditandoId(null);
    onChange('');
    onMaterialSeleccionado?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar obra
  }, [proyectoId]);

  const iniciarEdicion = (m: MaterialCampoOpcion) => {
    setEditandoId(m.id);
    setEditNombre(m.name);
    setEditUnidad(m.unit);
    setEditSku(m.sap_code ?? '');
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditNombre('');
    setEditUnidad('');
    setEditSku('');
  };

  const guardarEdicion = async (materialId: string) => {
    if (!proyectoId.trim()) return;
    setGuardandoEdicion(true);
    try {
      await actualizarMaterialCatalogoObra(supabase, materialId, {
        proyectoId: proyectoId.trim(),
        name: editNombre,
        unit: editUnidad,
        sap_code: editSku.trim() || null,
      });
      const actualizado: MaterialCampoOpcion = {
        id: materialId,
        name: editNombre.trim(),
        unit: (editUnidad || 'UND').trim() || 'UND',
        sap_code: editSku.trim() || null,
      };
      const merged = materiales
        .map((m) => (m.id === materialId ? actualizado : m))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      setMateriales(merged);
      onMaterialesChange?.(merged);
      onMaterialActualizado?.(actualizado);
      if (value === materialId) {
        onMaterialSeleccionado?.(actualizado);
      }
      cancelarEdicion();
      toast.success('Material actualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el material');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const eliminarMaterial = async (m: MaterialCampoOpcion) => {
    if (eliminandoId) return;
    setEliminandoId(m.id);
    try {
      const ok = await confirmarYEliminarMaterialInventario(m.id, m.name);
      if (!ok) return;
      const merged = materiales.filter((x) => x.id !== m.id);
      setMateriales(merged);
      onMaterialesChange?.(merged);
      onMaterialEliminado?.(m.id);
      if (value === m.id) {
        onChange('');
        onMaterialSeleccionado?.(null);
      }
      if (editandoId === m.id) cancelarEdicion();
      toast.success('Material eliminado de la lista.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el material');
    } finally {
      setEliminandoId(null);
    }
  };

  const handleSelect = (next: string) => {
    if (next === NUEVO_MATERIAL) {
      setModoNuevo(true);
      setNombreNuevo('');
      setUnidadNuevo('UND');
      setSkuNuevo('');
      setErrorNuevo(null);
      onChange('');
      onMaterialSeleccionado?.(null);
      return;
    }
    setModoNuevo(false);
    onChange(next);
    notificarSeleccion(next, materiales);
  };

  const resolverDepositId = async (): Promise<string | null> => {
    const ubId = ubicacionId?.trim();
    if (!ubId) return null;
    const { data } = await supabase
      .from('inv_ubicaciones')
      .select('deposit_id')
      .eq('id', ubId)
      .maybeSingle();
    return data?.deposit_id ? String(data.deposit_id) : null;
  };

  const guardarNuevo = async () => {
    const nombre = nombreNuevo.trim();
    if (nombre.length < 2) {
      setErrorNuevo('Indique un nombre de al menos 2 caracteres.');
      return;
    }
    if (!proyectoId.trim()) {
      setErrorNuevo('Seleccione primero el proyecto / obra.');
      return;
    }

    setCreando(true);
    setErrorNuevo(null);
    try {
      const depositId = await resolverDepositId();
      const hoy = new Date().toISOString().slice(0, 10);
      const nuevoId = await crearMaterialParaLineaCompra(supabase, {
        descripcion: nombre,
        item_code: skuNuevo.trim() || null,
        unidad: unidadNuevo.trim() || 'UND',
        precio_unitario: 0,
        fecha: hoy,
        proyectoId: proyectoId.trim(),
        depositId,
      });

      const nuevo: MaterialCampoOpcion = {
        id: nuevoId,
        name: nombre,
        sap_code: skuNuevo.trim() || null,
        unit: unidadNuevo.trim() || 'UND',
      };

      const merged = [...materiales.filter((m) => m.id !== nuevoId), nuevo].sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      );
      setMateriales(merged);
      onMaterialesChange?.(merged);
      setModoNuevo(false);
      onChange(nuevoId);
      onMaterialSeleccionado?.(nuevo);
    } catch (e) {
      setErrorNuevo(e instanceof Error ? e.message : 'No se pudo crear el material');
    } finally {
      setCreando(false);
    }
  };

  const placeholderLista = cargando
    ? 'Cargando materiales…'
    : materiales.length
      ? 'Seleccione material de la obra…'
      : 'Sin materiales — agregue uno nuevo';

  if (!proyectoId.trim()) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 bg-[#0A0A0F] px-4 py-3 text-xs text-zinc-500">
        Seleccione primero el proyecto / obra para ver los materiales de la construcción.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!modoNuevo ? (
        <div className="space-y-2">
          <Select
            value={value}
            onValueChange={handleSelect}
            disabled={disabled || cargando}
          >
            <SelectValue placeholder={placeholderLista} />
            <SelectTrigger className={selectClassName} aria-busy={cargando}>
              {cargando ? (
                <span className="flex items-center gap-2 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin text-[#FF9500]" />
                  Cargando materiales…
                </span>
              ) : undefined}
            </SelectTrigger>
            <SelectContent>
              {materiales.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {m.sap_code ? ` · ${m.sap_code}` : ''} ({m.unit})
                </SelectItem>
              ))}
              <SelectItem value={NUEVO_MATERIAL}>+ Agregar material nuevo a la obra…</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            disabled={disabled || cargando}
            onClick={() => handleSelect(NUEVO_MATERIAL)}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#FF9500] hover:text-[#FFB340] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar material nuevo a la lista
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9500]">
            Nuevo material para esta obra
          </p>
          <label className="block">
            <span className="text-[10px] font-bold text-zinc-500">Nombre / descripción</span>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              disabled={creando || disabled}
              placeholder="Ej. Cemento gris tipo I"
              className={inputClassName}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">Unidad</span>
              <SelectorUnidadMedida
                value={unidadNuevo}
                onChange={setUnidadNuevo}
                disabled={creando || disabled}
                className={inputClassName}
                inputClassName={inputClassName}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-zinc-500">SKU / código (opcional)</span>
              <input
                type="text"
                value={skuNuevo}
                onChange={(e) => setSkuNuevo(e.target.value)}
                disabled={creando || disabled}
                placeholder="Opcional"
                className={inputClassName}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={creando || disabled}
              onClick={() => void guardarNuevo()}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
            >
              {creando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Guardar en lista
            </button>
            <button
              type="button"
              disabled={creando}
              onClick={() => {
                setModoNuevo(false);
                setErrorNuevo(null);
              }}
              className="rounded-xl border border-zinc-700 px-3 py-2.5 text-[10px] font-bold uppercase text-zinc-400 hover:bg-zinc-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {errorLista ? <p className="text-[10px] font-bold text-red-400">{errorLista}</p> : null}
      {errorNuevo ? <p className="text-[10px] font-bold text-red-400">{errorNuevo}</p> : null}
      {!modoNuevo && materiales.length > 0 ? (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Lista de materiales de la obra
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {materiales.length} material(es). Puede modificar el nombre o borrar un elemento completo.
            </p>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#0A0A0F] p-2">
            {materiales.map((m) => {
              const editando = editandoId === m.id;
              return (
                <li
                  key={m.id}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5"
                >
                  {editando ? (
                    <div className="space-y-2">
                      <label className="block">
                        <span className="text-[10px] font-bold text-zinc-500">Nombre</span>
                        <input
                          type="text"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          disabled={guardandoEdicion || disabled}
                          className={inputClassName}
                        />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-[10px] font-bold text-zinc-500">Unidad</span>
                          <SelectorUnidadMedida
                            value={editUnidad}
                            onChange={setEditUnidad}
                            disabled={guardandoEdicion || disabled}
                            className={inputClassName}
                            inputClassName={inputClassName}
                          />
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-bold text-zinc-500">SKU / código</span>
                          <input
                            type="text"
                            value={editSku}
                            onChange={(e) => setEditSku(e.target.value)}
                            disabled={guardandoEdicion || disabled}
                            className={inputClassName}
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={guardandoEdicion || disabled}
                          onClick={() => void guardarEdicion(m.id)}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-200 disabled:opacity-50"
                        >
                          {guardandoEdicion ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          disabled={guardandoEdicion}
                          onClick={cancelarEdicion}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[10px] font-bold uppercase text-zinc-400"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">{m.name}</p>
                        <p className="text-[10px] text-zinc-500">
                          {m.unit}
                          {m.sap_code ? ` · ${m.sap_code}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={disabled || eliminandoId === m.id}
                        onClick={() => iniciarEdicion(m)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] font-bold text-zinc-300 hover:border-[#FF9500]/40 hover:text-[#FF9500] disabled:opacity-40"
                        title="Modificar nombre"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Modificar
                      </button>
                      <button
                        type="button"
                        disabled={disabled || eliminandoId === m.id}
                        onClick={() => void eliminarMaterial(m)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                        title="Borrar material"
                      >
                        {eliminandoId === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Borrar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
