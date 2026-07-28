'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, FileUp, Link2, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { nombreMaterialProcuraVisible } from '@/lib/compras/procuraMaterialTexto';
import { validateProcurementDocument } from '@/lib/almacen/procurementDocumentStorage';
import type { ExtractedPurchaseInvoice } from '@/lib/almacen/extractPurchaseInvoiceGemini';

export type ProcuraVinculoFactura = {
  id: string;
  ticket: string;
  material_txt: string;
  proyecto_id?: string | null;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
};

type FacturaOpcion = {
  id: string;
  invoice_number: string | null;
  supplier_name: string | null;
  supplier_rif: string | null;
  fecha: string | null;
  total_amount: number | null;
  moneda: string | null;
  obra: string | null;
};

type ModoVinculo = 'precargadas' | 'archivo';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Una o varias procuras a vincular a la misma factura. */
  procuras: ProcuraVinculoFactura[];
  onVinculada?: () => void;
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF9500]/50 placeholder:text-zinc-600';

function nombreObra(
  v: { nombre?: string } | { nombre?: string }[] | null | undefined,
): string {
  if (!v) return '';
  if (Array.isArray(v)) return v[0]?.nombre?.trim() ?? '';
  return v.nombre?.trim() ?? '';
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function VincularFacturaProcuraModal({
  open,
  onClose,
  procuras,
  onVinculada,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<ModoVinculo>('precargadas');
  const [busqueda, setBusqueda] = useState('');
  const [soloObra, setSoloObra] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [facturas, setFacturas] = useState<FacturaOpcion[]>([]);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedPurchaseInvoice | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierRif, setSupplierRif] = useState('');
  const [fecha, setFecha] = useState(hoyIso());
  const [totalAmount, setTotalAmount] = useState('');
  const [tasaBcv, setTasaBcv] = useState('');

  const lista = useMemo(() => procuras.filter((p) => p.id?.trim()), [procuras]);
  const referencia = lista[0] ?? null;
  const proyectoId = useMemo(() => {
    const ids = new Set(lista.map((p) => p.proyecto_id?.trim()).filter(Boolean));
    return ids.size === 1 ? Array.from(ids)[0]! : referencia?.proyecto_id?.trim() || null;
  }, [lista, referencia]);

  const resetArchivo = useCallback(() => {
    setArchivo(null);
    setExtracted(null);
    setInvoiceNumber('');
    setSupplierName('');
    setSupplierRif('');
    setFecha(hoyIso());
    setTotalAmount('');
    setTasaBcv('');
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const buscar = useCallback(async () => {
    if (!lista.length) return;
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (proyectoId) params.set('proyecto_id', proyectoId);
      params.set('solo_obra', soloObra && proyectoId ? '1' : '0');
      params.set('limit', '30');

      const res = await fetch(apiUrl(`/api/compras/procuras/buscar-facturas?${params}`), {
        cache: 'no-store',
      });
      const json = (await res.json()) as { facturas?: FacturaOpcion[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al buscar facturas');
      setFacturas(json.facturas ?? []);
      setSeleccionId((prev) =>
        prev && (json.facturas ?? []).some((f) => f.id === prev) ? prev : null,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al buscar');
      setFacturas([]);
    } finally {
      setCargando(false);
    }
  }, [busqueda, lista.length, proyectoId, soloObra]);

  useEffect(() => {
    if (!open || !lista.length) return;
    setBusqueda('');
    setSeleccionId(null);
    setSoloObra(Boolean(proyectoId));
    setModo('precargadas');
    resetArchivo();
  }, [open, lista, proyectoId, resetArchivo]);

  useEffect(() => {
    if (!open || !lista.length || modo !== 'precargadas') return;
    const t = window.setTimeout(() => void buscar(), 120);
    return () => window.clearTimeout(t);
  }, [open, lista.length, buscar, modo]);

  const aplicarExtracted = (payload: ExtractedPurchaseInvoice) => {
    setExtracted(payload);
    setInvoiceNumber(payload.invoice_number?.trim() || '');
    setSupplierName(payload.supplier_name?.trim() || '');
    setSupplierRif(payload.supplier_rif?.trim() || '');
    setFecha(fechaIsoOrHoy(payload.date));
    setTotalAmount(
      payload.total_amount != null && Number.isFinite(Number(payload.total_amount))
        ? String(payload.total_amount)
        : '',
    );
  };

  const procesarArchivo = async (file: File) => {
    const valid = validateProcurementDocument(file);
    if (valid) {
      toast.error(valid);
      return;
    }
    setArchivo(file);
    setExtrayendo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(apiUrl('/api/almacen/procurement/extract-invoice'), {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(180_000),
      });
      const json = (await res.json()) as ExtractedPurchaseInvoice & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'No se pudo leer la factura');
      aplicarExtracted(json);
      toast.success('Factura leída. Revise los datos y confirme.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al leer el archivo');
      setExtracted(null);
    } finally {
      setExtrayendo(false);
    }
  };

  const vincularPrecargada = async () => {
    if (!lista.length || !seleccionId) return;
    setVinculando(true);
    try {
      const res = await fetch(apiUrl('/api/compras/procuras/vincular-factura'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procura_ids: lista.map((p) => p.id),
          contabilidad_compra_id: seleccionId,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        tickets?: string[];
        invoice_number?: string;
        vinculadas?: Array<{ ticket: string }>;
        errores?: string[];
      };
      if (!res.ok) throw new Error(json.error ?? 'No se pudo vincular');
      const num = json.invoice_number?.trim();
      const n = json.vinculadas?.length ?? json.tickets?.length ?? lista.length;
      toast.success(
        num
          ? `${n} procura(s) vinculada(s) a factura #${num}`
          : `${n} procura(s) vinculada(s)`,
      );
      if (json.errores?.length) toast.warning(json.errores.join(' · '));
      onVinculada?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al vincular');
    } finally {
      setVinculando(false);
    }
  };

  const importarYVincular = async () => {
    if (!lista.length || !archivo) return;
    if (!invoiceNumber.trim()) {
      toast.error('Indique el número de factura.');
      return;
    }
    setVinculando(true);
    try {
      const form = new FormData();
      form.append('file', archivo);
      form.append('procura_ids', JSON.stringify(lista.map((p) => p.id)));
      form.append('invoice_number', invoiceNumber.trim());
      form.append('supplier_name', supplierName.trim() || 'Proveedor');
      if (supplierRif.trim()) form.append('supplier_rif', supplierRif.trim());
      if (fecha.trim()) form.append('fecha', fecha.trim());
      if (totalAmount.trim()) form.append('total_amount', totalAmount.trim().replace(',', '.'));
      if (tasaBcv.trim()) form.append('tasa_bcv', tasaBcv.trim().replace(',', '.'));
      if (extracted) form.append('extracted', JSON.stringify(extracted));

      const res = await fetch(apiUrl('/api/compras/procuras/importar-factura'), {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(180_000),
      });
      const json = (await res.json()) as {
        error?: string;
        invoice_number?: string;
        vinculadas?: Array<{ ticket: string }>;
        errores?: string[];
      };
      if (!res.ok) throw new Error(json.error ?? 'No se pudo importar');
      const num = json.invoice_number?.trim() || invoiceNumber.trim();
      const n = json.vinculadas?.length ?? lista.length;
      toast.success(`${n} procura(s) vinculada(s) a factura #${num}`);
      if (json.errores?.length) toast.warning(json.errores.join(' · '));
      onVinculada?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setVinculando(false);
    }
  };

  if (!open || !lista.length) return null;

  const obra = referencia ? nombreObra(referencia.ci_proyectos) : '';
  const varias = lista.length > 1;
  const puedeImportar =
    Boolean(archivo) && Boolean(invoiceNumber.trim()) && !extrayendo && !vinculando;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141418] p-5 shadow-2xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-labelledby="vincular-factura-procura-title"
      >
        <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="h-5 w-5 text-[#FF9500] shrink-0" />
            <div className="min-w-0">
              <h2 id="vincular-factura-procura-title" className="text-base font-bold text-white">
                {varias ? 'Vincular factura (varias procuras)' : 'Pendiente por factura'}
              </h2>
              <p className="text-[11px] text-zinc-500 truncate">
                {varias
                  ? `${lista.length} procuras${obra ? ` · ${obra}` : ''}`
                  : `${lista[0].ticket}${obra ? ` · ${obra}` : ''}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-xs text-zinc-500 mb-3 leading-relaxed shrink-0 space-y-2">
          {varias ? (
            <ul className="max-h-20 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 space-y-1">
              {lista.map((p) => (
                <li key={p.id} className="text-zinc-300">
                  <span className="font-mono text-[#FF9500]">{p.ticket}</span>
                  {' · '}
                  {nombreMaterialProcuraVisible(p.material_txt)}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Material:{' '}
              <span className="text-zinc-300">
                {nombreMaterialProcuraVisible(lista[0].material_txt)}
              </span>
            </p>
          )}
        </div>

        <div className="flex gap-1.5 p-1 rounded-xl border border-white/[0.06] bg-black/30 mb-3 shrink-0">
          {(
            [
              ['precargadas', 'Precargadas'],
              ['archivo', 'Importar archivo'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setModo(id)}
              className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wide transition-colors ${
                modo === id
                  ? 'bg-[#FF9500]/20 text-[#FF9500] border border-[#FF9500]/35'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {modo === 'precargadas' ? (
          <>
            <div className="space-y-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nº factura, proveedor, RIF…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              {proyectoId ? (
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soloObra}
                    onChange={(e) => setSoloObra(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  Solo facturas de la misma obra (incluye ya vinculadas parcialmente)
                </label>
              ) : null}
            </div>

            <div className="mt-4 flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/20">
              {cargando ? (
                <div className="flex items-center justify-center gap-2 py-12 text-zinc-500 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-[#FF9500]" />
                  Buscando…
                </div>
              ) : facturas.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-500 px-4">
                  No hay facturas precargadas
                  {soloObra && obra ? ` para ${obra}` : ''}. Use «Importar archivo» o amplíe la
                  búsqueda.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {facturas.map((f) => {
                    const activa = seleccionId === f.id;
                    const num = f.invoice_number?.trim() || 'S/N';
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setSeleccionId(f.id)}
                          className={`w-full text-left px-3 py-3 transition-colors ${
                            activa ? 'bg-[#FF9500]/10' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <FileText
                              className={`h-4 w-4 mt-0.5 shrink-0 ${activa ? 'text-[#FF9500]' : 'text-zinc-500'}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white truncate">
                                #{num} · {f.supplier_name?.trim() || 'Proveedor'}
                              </p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">
                                {fmtFecha(f.fecha)}
                                {f.obra ? ` · ${f.obra}` : ''}
                                {f.total_amount != null
                                  ? ` · ${Number(f.total_amount).toLocaleString('es-VE', { minimumFractionDigits: 2 })} ${f.moneda ?? ''}`
                                  : ''}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!seleccionId || vinculando}
                onClick={() => void vincularPrecargada()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF9500] px-4 py-2.5 text-sm font-black uppercase text-black disabled:opacity-50"
              >
                {vinculando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Vincular{varias ? ` (${lista.length})` : ''}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 shrink-0 flex-1 min-h-0 overflow-y-auto">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/*,.pdf"
                className="hidden"
                disabled={extrayendo || vinculando}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void procesarArchivo(f);
                }}
              />
              <button
                type="button"
                disabled={extrayendo || vinculando}
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border border-dashed border-[#FF9500]/40 bg-[#FF9500]/5 px-4 py-6 text-center hover:bg-[#FF9500]/10 disabled:opacity-50 transition-colors"
              >
                <div className="inline-flex items-center justify-center gap-2 text-[#FF9500] font-bold text-sm">
                  {extrayendo ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileUp className="h-5 w-5" />
                  )}
                  {extrayendo
                    ? 'Leyendo factura…'
                    : archivo
                      ? 'Cambiar archivo'
                      : 'Elegir PDF o imagen'}
                </div>
                {archivo ? (
                  <p className="mt-2 text-[11px] text-zinc-400 truncate px-2">{archivo.name}</p>
                ) : (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Se lee con OCR y se crea en contabilidad al vincular
                  </p>
                )}
              </button>

              {(extracted || archivo) && !extrayendo ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                      Nº factura
                    </span>
                    <input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className={inputClass}
                      placeholder="000123"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                      Proveedor
                    </span>
                    <input
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className={inputClass}
                      placeholder="Razón social"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                      RIF
                    </span>
                    <input
                      value={supplierRif}
                      onChange={(e) => setSupplierRif(e.target.value)}
                      className={inputClass}
                      placeholder="J-12345678-9"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                      Fecha
                    </span>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                      Total Bs
                    </span>
                    <input
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className={inputClass}
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">
                      Tasa BCV (opcional)
                    </span>
                    <input
                      value={tasaBcv}
                      onChange={(e) => setTasaBcv(e.target.value)}
                      className={inputClass}
                      inputMode="decimal"
                      placeholder="Auto"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!puedeImportar}
                onClick={() => void importarYVincular()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF9500] px-4 py-2.5 text-sm font-black uppercase text-black disabled:opacity-50"
              >
                {vinculando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Importar y vincular{varias ? ` (${lista.length})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function fechaIsoOrHoy(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : hoyIso();
}
