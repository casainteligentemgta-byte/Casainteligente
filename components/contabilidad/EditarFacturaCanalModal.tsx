'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  auditoriaFechaCompra,
  exigeConfirmacionFechaAnomala,
} from '@/lib/contabilidad/auditoriaFechaCompra';
import {
  extractedDesdeForm,
  formDesdeExtracted,
  lineaVacia,
  type ExtractedCanalHeader,
  type FacturaCanalForm,
  normalizarMonedaExtracted,
} from '@/lib/contabilidad/extractedCanal';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { esGastoEntidadImputacion } from '@/lib/contabilidad/imputacionCompra';
import { createClient } from '@/lib/supabase/client';
import {
  filtrarProyectosPorEntidad,
  type ProyectoRow,
} from '@/lib/almacen/inventoryClasificacion';
import { loadCatalogoProyectosApp } from '@/lib/proyectos/proyectosUnificados';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50';

const selectClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-sky-500/50';

export type DestinoCompraEdicion = {
  /** contabilidad_compras.id o canal-{uuid} para reubicar */
  compraId: string;
  imputacion?: 'obra' | 'entidad' | null;
  entidadId?: string | null;
  proyectoId?: string | null;
  ubicacionId?: string | null;
};

export type GuardarFacturaCanalOpts = {
  confirmarFechaAnomala?: boolean;
  destino?: {
    entidad_id?: string;
    proyecto_id: string;
    ubicacion_destino_id: string;
    nombre_obra?: string;
  } | null;
};

type EntidadRow = { id: string; nombre: string };

type Props = {
  open: boolean;
  titulo?: string;
  extracted: ExtractedCanalHeader | null;
  destino?: DestinoCompraEdicion | null;
  onClose: () => void;
  onGuardar: (extracted: ExtractedCanalHeader, opts?: GuardarFacturaCanalOpts) => Promise<void>;
};

export default function EditarFacturaCanalModal({
  open,
  titulo = 'Modificar factura',
  extracted,
  destino,
  onClose,
  onGuardar,
}: Props) {
  const [form, setForm] = useState<FacturaCanalForm>(() => formDesdeExtracted(extracted));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmarFechaCritica, setConfirmarFechaCritica] = useState(false);
  const [entidades, setEntidades] = useState<EntidadRow[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoRow[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');

  const mostrarDestino = Boolean(destino) && !esGastoEntidadImputacion(destino?.imputacion);

  useEffect(() => {
    if (open) {
      setForm(formDesdeExtracted(extracted));
      setError(null);
      setConfirmarFechaCritica(false);
      setEntidadId(destino?.entidadId ?? '');
      setProyectoId(destino?.proyectoId ?? '');
      setUbicacionId(destino?.ubicacionId ?? '');
    }
  }, [open, extracted, destino?.entidadId, destino?.proyectoId, destino?.ubicacionId]);

  useEffect(() => {
    if (!open || !mostrarDestino) return;
    void (async () => {
      try {
        const [entRes, cat] = await Promise.all([
          fetch('/api/almacen/entidades', { cache: 'no-store' }),
          loadCatalogoProyectosApp(createClient()),
        ]);
        const entData = (await entRes.json()) as { entidades?: EntidadRow[] };
        const proyRows = (cat.proyectos ?? []).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          entidad_id: p.entidad_id ?? null,
        }));
        setEntidades(entData.entidades ?? []);
        setProyectos(proyRows);

        if (!destino?.entidadId?.trim() && destino?.proyectoId?.trim()) {
          const proy = proyRows.find((p) => p.id === destino.proyectoId);
          if (proy?.entidad_id) setEntidadId(proy.entidad_id);
        }
      } catch {
        /* opcional */
      }
    })();
  }, [open, mostrarDestino, destino?.entidadId, destino?.proyectoId]);

  const proyectosFiltrados = useMemo(
    () => filtrarProyectosPorEntidad(proyectos, entidadId || null),
    [proyectos, entidadId],
  );

  const auditFecha = useMemo(() => auditoriaFechaCompra(form.date), [form.date]);
  const requiereConfirmacionFecha = exigeConfirmacionFechaAnomala(auditFecha);

  if (!open) return null;

  const simboloMoneda = form.moneda === 'USD' ? 'USD' : 'Bs';

  const actualizarLinea = (idx: number, patch: Partial<FacturaCanalForm['items'][0]>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };

  const guardar = async () => {
    if (!form.supplier_name.trim()) {
      setError('Indique el nombre del proveedor.');
      return;
    }
    if (requiereConfirmacionFecha && !confirmarFechaCritica) {
      setError('Debe confirmar que la fecha es correcta antes de guardar.');
      return;
    }
    if (mostrarDestino && (!entidadId.trim() || !proyectoId.trim())) {
      setError('Seleccione entidad y obra.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const next = extractedDesdeForm(form, extracted);
      const nombreObra = proyectos.find((p) => p.id === proyectoId)?.nombre;
      await onGuardar(next, {
        confirmarFechaAnomala: requiereConfirmacionFecha ? confirmarFechaCritica : undefined,
        destino: mostrarDestino
          ? {
              entidad_id: entidadId.trim(),
              proyecto_id: proyectoId.trim(),
              ubicacion_destino_id: ubicacionId.trim(),
              nombre_obra: nombreObra,
            }
          : null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c10] shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-white/10 bg-[#0c0c10] px-4 py-3">
          <h2 className="text-sm font-bold text-white">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-[#FF9500]/35 bg-[#FF9500]/5 p-3 space-y-2">
            <p className="text-[10px] font-bold text-[#FF9500] uppercase tracking-wider">
              Moneda de la factura
            </p>
            <p className="text-[11px] text-zinc-400">
              Total y precios unitarios están en la moneda que elija.
            </p>
            <select
              className={`${inputClass} mt-0`}
              value={form.moneda}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  moneda: normalizarMonedaExtracted(e.target.value),
                }))
              }
            >
              <option value="VES">Bolívares (Bs)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>

          {mostrarDestino ? (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                  Obra y almacén
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  El almacén es opcional en contabilidad: puede asignarlo después, al ingresar el
                  material. Si ya ingresó a inventario, el stock se traslada al cambiar almacén.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500">ENTIDAD</label>
                <select
                  className={`${selectClass} mt-1`}
                  value={entidadId}
                  onChange={(e) => {
                    setEntidadId(e.target.value);
                    setProyectoId('');
                    setUbicacionId('');
                  }}
                >
                  <option value="">Seleccione entidad…</option>
                  {entidades.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500">OBRA / PROYECTO</label>
                <select
                  className={`${selectClass} mt-1`}
                  value={proyectoId}
                  disabled={!entidadId}
                  onChange={(e) => {
                    setProyectoId(e.target.value);
                    setUbicacionId('');
                  }}
                >
                  <option value="">
                    {entidadId ? 'Seleccione obra…' : 'Primero elija entidad…'}
                  </option>
                  {proyectosFiltrados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-500">
                  ALMACÉN DE INGRESO <span className="font-normal text-zinc-600">(opcional)</span>
                </label>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Déjelo vacío si aún no ha ingresado el material a ningún almacén.
                </p>
                <div className="mt-1">
                  <UbicacionInventarioSelect
                    proyectoId={proyectoId}
                    value={ubicacionId}
                    onChange={setUbicacionId}
                    disabled={!proyectoId}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold text-zinc-500">Nº FACTURA</label>
              <input
                className={`${inputClass} mt-1`}
                value={form.invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500">FECHA</label>
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={form.date}
                onChange={(e) => {
                  setConfirmarFechaCritica(false);
                  setForm((f) => ({ ...f, date: e.target.value }));
                }}
              />
              {auditFecha.nivel !== 'ok' ? (
                <p
                  className={`mt-1.5 text-[11px] leading-snug ${
                    auditFecha.nivel === 'critico' ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {auditFecha.mensaje}
                  {auditFecha.nivel !== 'critico'
                    ? ' Al guardar, la tasa BCV se recalculará para esta fecha.'
                    : null}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-zinc-500">
                  Si cambia la fecha, la tasa BCV se actualizará automáticamente.
                </p>
              )}
              {requiereConfirmacionFecha ? (
                <label className="mt-2 flex items-start gap-2 text-[11px] text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={confirmarFechaCritica}
                    onChange={(e) => setConfirmarFechaCritica(e.target.checked)}
                  />
                  <span>Confirmo que la fecha {form.date} es la real de la factura fiscal.</span>
                </label>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-zinc-500">PROVEEDOR</label>
              <input
                className={`${inputClass} mt-1`}
                value={form.supplier_name}
                onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500">RIF</label>
              <input
                className={`${inputClass} mt-1`}
                value={form.supplier_rif}
                onChange={(e) => setForm((f) => ({ ...f, supplier_rif: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500">
                TOTAL ({simboloMoneda})
              </label>
              <input
                type="text"
                inputMode="decimal"
                className={`${inputClass} mt-1`}
                value={form.total_amount}
                onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                placeholder="Vacío = suma de líneas"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase">Líneas / artículos</p>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, items: [...f.items, lineaVacia()] }))}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Añadir línea
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((linea, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-[1fr_72px_72px_72px_32px]"
                >
                  <input
                    className={inputClass}
                    placeholder="Descripción"
                    value={linea.description}
                    onChange={(e) => actualizarLinea(idx, { description: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Cant."
                    inputMode="decimal"
                    value={linea.quantity}
                    onChange={(e) => actualizarLinea(idx, { quantity: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder={`P.U. ${simboloMoneda}`}
                    inputMode="decimal"
                    value={linea.unit_price}
                    onChange={(e) => actualizarLinea(idx, { unit_price: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Código"
                    value={linea.item_code}
                    onChange={(e) => actualizarLinea(idx, { item_code: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : [lineaVacia()],
                      }))
                    }
                    className="flex items-center justify-center text-red-400 hover:text-red-300"
                    aria-label="Quitar línea"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-white/10 bg-[#0c0c10] p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs font-semibold text-zinc-400 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar()}
            className="flex-1 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
