'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  FileText,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import BuscadorMaterialCampo, { type MaterialCampoOpcion } from '@/components/almacen/BuscadorMaterialCampo';
import SelectorMaterialObraRecepcion from '@/components/almacen/SelectorMaterialObraRecepcion';
import { ProcurementDocumentAttach } from '@/components/almacen/ProcurementDocumentAttach';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { apiUrl } from '@/lib/http/apiUrl';
import { loadCatalogoProyectosApp } from '@/lib/proyectos/proyectosUnificados';
import type { LineaRecepcionCampoInput, TipoRecepcionCampo } from '@/lib/almacen/recepcionCampoTypes';
import { createClient } from '@/lib/supabase/client';
import { uploadRecepcionCampoDocument } from '@/lib/almacen/uploadRecepcionCampoDocument';

type TabRecepcion = 'ingreso' | 'transito';
type TipoIngresoManual = 'nota_entrega' | 'emergencia';

type ProyectoOpt = { id: string; nombre: string };

type PendienteCanal = {
  id: string;
  estado: string;
  chat_label: string | null;
  proyecto_id: string | null;
  ubicacion_destino_id: string | null;
  purchase_invoice_id: string | null;
  document_file_name: string | null;
  extracted: Record<string, unknown> | null;
  created_at: string;
};

type LineaForm = {
  key: string;
  material_id: string;
  nombre: string;
  unidad: string;
  cantidad: string;
};

const tabBtn =
  'flex-1 min-w-[140px] rounded-2xl border px-4 py-4 text-sm font-black transition backdrop-blur-xl';
const panelClass =
  'rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl overflow-visible';
const inputClass =
  'w-full rounded-xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';
const selectClass = inputClass;

function lineKey(): string {
  return `ln-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function extraerProveedor(extracted: Record<string, unknown> | null): string {
  if (!extracted) return '—';
  const n = extracted.supplier_name ?? extracted.proveedor;
  return String(n ?? '—').trim() || '—';
}

function extraerNumero(extracted: Record<string, unknown> | null): string {
  if (!extracted) return '—';
  return String(extracted.invoice_number ?? extracted.numero ?? '—').trim() || '—';
}

function RecepcionCargando() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#0A0A0F] text-sm text-zinc-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#FF9500]" />
      Cargando recepción…
    </div>
  );
}

export default function RecepcionCampoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [montado, setMontado] = useState(false);
  const { isSubmitting, runLocked } = useSyncSubmitLock();
  const pendienteDestacadoRef = useRef<HTMLLIElement | null>(null);

  const pendienteDestacado = searchParams.get('pendiente')?.trim() || '';
  const tabInicial = searchParams.get('tab');
  const [tab, setTab] = useState<TabRecepcion>(
    tabInicial === 'transito' || tabInicial === 'nota' || tabInicial === 'emergencia'
      ? tabInicial === 'transito'
        ? 'transito'
        : 'ingreso'
      : 'ingreso',
  );
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngresoManual>(
    tabInicial === 'emergencia' ? 'emergencia' : 'nota_entrega',
  );
  const [cantidadNueva, setCantidadNueva] = useState('1');
  const [materialObraId, setMaterialObraId] = useState('');
  const [materialObraSel, setMaterialObraSel] = useState<MaterialCampoOpcion | null>(null);
  const [busquedaGlobalAbierta, setBusquedaGlobalAbierta] = useState(false);

  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [proyectoId, setProyectoId] = useState(searchParams.get('proyectoId')?.trim() || '');
  const [ubicacionId, setUbicacionId] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [numDoc, setNumDoc] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [lineaEditandoKey, setLineaEditandoKey] = useState<string | null>(null);
  const [editLineaMaterialId, setEditLineaMaterialId] = useState('');
  const [editLineaMaterial, setEditLineaMaterial] = useState<MaterialCampoOpcion | null>(null);
  const [editLineaCantidad, setEditLineaCantidad] = useState('1');
  const [soporteFile, setSoporteFile] = useState<File | null>(null);
  const [ingresandoId, setIngresandoId] = useState<string | null>(null);

  const [pendientes, setPendientes] = useState<PendienteCanal[]>([]);

  useEffect(() => {
    setMontado(true);
  }, []);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  const tipoManual: TipoRecepcionCampo =
    tipoIngreso === 'emergencia' ? 'emergencia' : 'nota_entrega';

  useEffect(() => {
    void loadCatalogoProyectosApp(supabase).then(({ proyectos: lista }) => {
      if (lista.length) setProyectos(lista.map((r) => ({ id: r.id, nombre: r.nombre })));
    });
  }, [supabase]);

  const cargarPendientes = useCallback(async () => {
    setLoadingPendientes(true);
    try {
      const res = await fetch(apiUrl('/api/facturas-canal/pendientes?para=panel_canal'), {
        cache: 'no-store',
      });
      const json = (await res.json()) as { pendientes?: PendienteCanal[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar facturas');
      const lista = (json.pendientes ?? []).filter((p) =>
        ['extraido', 'aprobado_sistema', 'confirmado', 'pendiente', 'procesando'].includes(p.estado),
      );
      setPendientes(lista);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar facturas en tránsito');
      setPendientes([]);
    } finally {
      setLoadingPendientes(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'transito') void cargarPendientes();
  }, [tab, cargarPendientes]);

  useEffect(() => {
    if (!pendienteDestacado || loadingPendientes || tab !== 'transito') return;
    const t = window.setTimeout(() => {
      pendienteDestacadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [pendienteDestacado, loadingPendientes, tab, pendientes.length]);

  function agregarMaterial(m: MaterialCampoOpcion, cantidadOverride?: string) {
    const qty = (cantidadOverride ?? cantidadNueva).trim().replace(',', '.');
    const qtyNum = Number(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error('Indique una cantidad mayor a cero.');
      return;
    }
    const qtyStr = String(qtyNum);

    setLineas((prev) => {
      const existente = prev.find((l) => l.material_id === m.id);
      if (existente) {
        const suma = (Number(existente.cantidad.replace(',', '.')) || 0) + qtyNum;
        toast.message(`${m.name}: cantidad actualizada a ${suma}`);
        return prev.map((l) =>
          l.material_id === m.id ? { ...l, cantidad: String(suma) } : l,
        );
      }
      return [
        ...prev,
        {
          key: lineKey(),
          material_id: m.id,
          nombre: m.name,
          unidad: m.unit,
          cantidad: qtyStr,
        },
      ];
    });
    setCantidadNueva('1');
  }

  function quitarLinea(key: string, nombre: string) {
    if (!confirm(`¿Quitar «${nombre}» de la nota de ingreso?`)) return;
    setLineas((prev) => prev.filter((x) => x.key !== key));
    if (lineaEditandoKey === key) setLineaEditandoKey(null);
  }

  function iniciarEdicionLinea(l: LineaForm) {
    setLineaEditandoKey(l.key);
    setEditLineaMaterialId(l.material_id);
    setEditLineaMaterial({
      id: l.material_id,
      name: l.nombre,
      unit: l.unidad,
      sap_code: null,
    });
    setEditLineaCantidad(l.cantidad);
  }

  function cancelarEdicionLinea() {
    setLineaEditandoKey(null);
    setEditLineaMaterialId('');
    setEditLineaMaterial(null);
    setEditLineaCantidad('1');
  }

  function guardarEdicionLinea() {
    if (!lineaEditandoKey || !editLineaMaterial) {
      toast.error('Seleccione un material válido.');
      return;
    }
    const qtyNum = Number(editLineaCantidad.replace(',', '.'));
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error('Indique una cantidad mayor a cero.');
      return;
    }

    const duplicado = lineas.find(
      (l) => l.material_id === editLineaMaterial.id && l.key !== lineaEditandoKey,
    );
    if (duplicado) {
      toast.error('Ese material ya está en la nota. Modifique la otra línea o elimínela.');
      return;
    }

    setLineas((prev) =>
      prev.map((l) =>
        l.key === lineaEditandoKey
          ? {
              ...l,
              material_id: editLineaMaterial.id,
              nombre: editLineaMaterial.name,
              unidad: editLineaMaterial.unit,
              cantidad: String(qtyNum),
            }
          : l,
      ),
    );
    cancelarEdicionLinea();
    toast.success('Artículo actualizado.');
  }

  function sincronizarMaterialActualizado(m: MaterialCampoOpcion) {
    setLineas((prev) =>
      prev.map((l) =>
        l.material_id === m.id ? { ...l, nombre: m.name, unidad: m.unit } : l,
      ),
    );
    if (materialObraId === m.id) {
      setMaterialObraSel(m);
    }
  }

  function sincronizarMaterialEliminado(materialId: string) {
    setLineas((prev) => prev.filter((l) => l.material_id !== materialId));
    if (materialObraId === materialId) {
      setMaterialObraId('');
      setMaterialObraSel(null);
    }
    if (editLineaMaterialId === materialId) {
      cancelarEdicionLinea();
    }
  }

  function agregarMaterialSeleccionado() {
    if (!materialObraSel) {
      toast.error('Seleccione un material de la lista de la obra.');
      return;
    }
    agregarMaterial(materialObraSel);
  }

  async function ingresarFacturaAlmacen(p: PendienteCanal) {
    if (isSubmitting) return;
    setIngresandoId(p.id);
    await runLocked(async () => {
      try {
        const res = await fetch(apiUrl(`/api/facturas-canal/pendientes/${p.id}/ingreso-almacen`), {
          method: 'POST',
        });
        const json = (await res.json()) as { error?: string; success?: boolean; yaExistia?: boolean };
        if (!res.ok) throw new Error(json.error ?? 'No se pudo registrar ingreso');
        toast.success(
          json.yaExistia ? 'Ingreso ya estaba registrado.' : 'Stock ingresado desde factura Telegram.',
        );
        router.push('/almacen');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error de ingreso');
      } finally {
        setIngresandoId(null);
      }
    });
  }

  async function guardarManual() {
    if (!proyectoId.trim()) {
      toast.error('Seleccione el proyecto de obra.');
      return;
    }
    if (!ubicacionId.trim()) {
      toast.error('Seleccione el almacén de destino.');
      return;
    }

    const lineasPayload: LineaRecepcionCampoInput[] = lineas
      .map((l) => ({
        material_id: l.material_id,
        cantidad: Number(l.cantidad.replace(',', '.')),
        unidad: l.unidad,
        descripcion: l.nombre,
      }))
      .filter((l) => Number.isFinite(l.cantidad) && l.cantidad > 0);

    if (!lineasPayload.length) {
      toast.error('Agregue materiales con cantidad válida.');
      return;
    }

    await runLocked(async () => {
      const draftId = crypto.randomUUID();
      let soporte:
        | { path: string; fileName: string; mimeType: string }
        | null = null;

      if (soporteFile) {
        try {
          soporte = await uploadRecepcionCampoDocument(supabase, draftId, soporteFile);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'No se pudo subir el soporte fotográfico');
          return;
        }
      }

      const res = await fetch(apiUrl('/api/almacen/recepcion/manual'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          ubicacion_id: ubicacionId,
          proveedor_id: null,
          proveedor_nombre: proveedorNombre.trim() || (tipoIngreso === 'emergencia' ? 'Proveedor no identificado' : ''),
          tipo: tipoManual,
          num_doc: numDoc.trim() || (tipoIngreso === 'emergencia' ? 'EMERGENCIA' : 'NOTA-ENTREGA'),
          lineas: lineasPayload,
          observaciones: observaciones.trim() || null,
          soporte_storage_path: soporte?.path ?? null,
          soporte_file_name: soporte?.fileName ?? null,
          soporte_mime_type: soporte?.mimeType ?? null,
        }),
      });

      const json = (await res.json()) as {
        error?: string;
        recepcion_id?: string;
        ok?: boolean;
      };

      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo registrar la recepción');
        return;
      }

      toast.success(
        `Recepción registrada (${json.recepcion_id?.slice(0, 8) ?? 'OK'}). Stock actualizado en almacén.`,
      );
      router.push('/almacen');
    });
  }

  const tabs: { id: TabRecepcion; label: string; icon: typeof FileText }[] = [
    { id: 'ingreso', label: 'Ingreso manual', icon: Package },
    { id: 'transito', label: 'Facturas en Tránsito', icon: FileText },
  ];

  if (!montado) return <RecepcionCargando />;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0A0F]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4">
          <Link
            href="/almacen"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-300 hover:text-[#FF9500]"
          >
            <ArrowLeft className="h-4 w-4" />
            Almacén
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF9500]">
              Recepción de materiales
            </p>
            <h1 className="text-lg font-black text-white">FRM · Campo Margarita</h1>
          </div>
          <Package className="h-8 w-8 text-[#FF9500]/80" aria-hidden />
        </div>

        <div className="mx-auto flex max-w-4xl flex-wrap gap-2 px-4 pb-4">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`${tabBtn} ${
                  active
                    ? 'border-[#FF9500]/60 bg-[#FF9500]/15 text-[#FF9500] shadow-[0_0_24px_rgba(255,149,0,0.12)]'
                    : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                <Icon className="mx-auto mb-1.5 h-5 w-5" />
                <span className="block leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 pb-24">
        {tab === 'transito' ? (
          <section className={panelClass}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-black text-white">Facturas precargadas (Telegram)</h2>
              <button
                type="button"
                onClick={() => void cargarPendientes()}
                disabled={loadingPendientes}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:border-[#FF9500]/40"
              >
                Actualizar
              </button>
            </div>

            {loadingPendientes ? (
              <p className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#FF9500]" />
                Cargando…
              </p>
            ) : pendientes.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay facturas en tránsito en este momento.</p>
            ) : (
              <ul className="space-y-3">
                {pendientes.map((p) => {
                  const puedeIngreso =
                    p.estado === 'confirmado' && Boolean(p.purchase_invoice_id) && p.ubicacion_destino_id;
                  const puedeConfirmar = ['extraido', 'aprobado_sistema'].includes(p.estado);
                  const destacado = pendienteDestacado === p.id;
                  return (
                    <li
                      key={p.id}
                      ref={destacado ? pendienteDestacadoRef : undefined}
                      className={`rounded-xl border bg-[#0A0A0F] p-4 ${
                        destacado
                          ? 'border-[#FF9500]/60 shadow-[0_0_24px_rgba(255,149,0,0.15)]'
                          : 'border-white/10'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-[#FF9500]">
                            {p.estado.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm font-bold text-white">
                            {extraerNumero(p.extracted)} · {extraerProveedor(p.extracted)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {p.chat_label ?? 'Telegram'} ·{' '}
                            {new Date(p.created_at).toLocaleString('es-VE')}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                          {p.document_file_name ?? 'documento'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {puedeConfirmar ? (
                          <Link
                            href={`/contabilidad/compras/telegram/${p.id}`}
                            className="rounded-xl bg-[#FF9500] px-4 py-2.5 text-xs font-black text-black hover:bg-[#FF9500]/90"
                          >
                            Ingreso
                          </Link>
                        ) : puedeIngreso ? (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => {
                              if (isSubmitting) return;
                              void ingresarFacturaAlmacen(p);
                            }}
                            className="rounded-xl bg-[#FF9500] px-4 py-2.5 text-xs font-black text-black hover:bg-[#FF9500]/90 disabled:opacity-50"
                          >
                            {ingresandoId === p.id ? 'Ingresando…' : 'Ingreso'}
                          </button>
                        ) : null}
                        {p.estado === 'aprobado_sistema' ? (
                          <span className="self-center text-xs font-bold text-emerald-400">
                            Fast-Track aplicado
                          </span>
                        ) : null}
                        <Link
                          href={`/almacen/procurement?fromTelegram=${p.id}`}
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-zinc-300"
                        >
                          Abrir recepción IA
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <div className={`${panelClass} flex flex-wrap gap-2`}>
              <button
                type="button"
                onClick={() => setTipoIngreso('nota_entrega')}
                className={`flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black transition ${
                  tipoIngreso === 'nota_entrega'
                    ? 'border-[#FF9500]/60 bg-[#FF9500]/15 text-[#FF9500]'
                    : 'border-white/10 bg-[#0A0A0F] text-zinc-400 hover:border-white/20'
                }`}
              >
                <Truck className="h-4 w-4" />
                Nota de entrega
              </button>
              <button
                type="button"
                onClick={() => setTipoIngreso('emergencia')}
                className={`flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black transition ${
                  tipoIngreso === 'emergencia'
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-[#0A0A0F] text-zinc-400 hover:border-white/20'
                }`}
              >
                <Zap className="h-4 w-4" />
                Emergencia (sin papeles)
              </button>
            </div>

            <div className={panelClass}>
              <h2 className="mb-4 text-sm font-black text-white">
                {tipoIngreso === 'emergencia'
                  ? 'Ingreso de emergencia (sin documentos)'
                  : 'Nota de entrega sin factura fiscal'}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Proyecto / obra
                  </span>
                  <div className="mt-1.5">
                    <Select
                      value={proyectoId}
                      onValueChange={(id) => {
                        setProyectoId(id);
                        setUbicacionId('');
                        setMaterialObraId('');
                        setMaterialObraSel(null);
                      }}
                      disabled={isSubmitting}
                    >
                      <SelectValue placeholder="Seleccione proyecto…" />
                      <SelectTrigger className={selectClass} />
                      <SelectContent>
                        {proyectos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Almacén de ingreso
                  </span>
                  <UbicacionInventarioSelect
                    proyectoId={proyectoId}
                    value={ubicacionId}
                    onChange={setUbicacionId}
                    disabled={isSubmitting || !proyectoId}
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Proveedor / transportista
                  </span>
                  <input
                    value={proveedorNombre}
                    onChange={(e) => setProveedorNombre(e.target.value)}
                    disabled={isSubmitting}
                    placeholder={tipoIngreso === 'emergencia' ? 'Opcional' : 'Nombre del proveedor'}
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Nº nota / referencia
                  </span>
                  <input
                    value={numDoc}
                    onChange={(e) => setNumDoc(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="NE-000123"
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            <div className={panelClass}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Artículos a ingresar
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Elija materiales de la obra en el listado o agregue nuevos a esa lista.
                  </p>
                </div>
                {lineas.length > 0 ? (
                  <span className="rounded-full border border-[#FF9500]/30 bg-[#FF9500]/10 px-2.5 py-1 text-[10px] font-black text-[#FF9500]">
                    {lineas.length} artículo{lineas.length === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>

              <div className="mb-3 space-y-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Material de la construcción
                  </span>
                  <div className="mt-1.5">
                    <SelectorMaterialObraRecepcion
                      proyectoId={proyectoId}
                      ubicacionId={ubicacionId}
                      value={materialObraId}
                      onChange={setMaterialObraId}
                      onMaterialSeleccionado={setMaterialObraSel}
                      onMaterialActualizado={sincronizarMaterialActualizado}
                      onMaterialEliminado={sincronizarMaterialEliminado}
                      disabled={isSubmitting || !proyectoId}
                      selectClassName={selectClass}
                      inputClassName={inputClass}
                    />
                  </div>
                </label>

                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF9500]">
                      Cantidad
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={cantidadNueva}
                      onChange={(e) => setCantidadNueva(e.target.value)}
                      disabled={isSubmitting}
                      className={`${inputClass} py-4 text-center text-xl font-black`}
                      aria-label="Cantidad del artículo"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={agregarMaterialSeleccionado}
                      disabled={isSubmitting || !proyectoId || !materialObraSel}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF9500]/50 bg-[#FF9500]/15 px-4 py-4 text-sm font-black text-[#FF9500] hover:bg-[#FF9500]/25 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar artículo
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setBusquedaGlobalAbierta((v) => !v)}
                  className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
                >
                  {busquedaGlobalAbierta ? '▾ Ocultar catálogo global' : '▸ Buscar en catálogo global'}
                </button>
                {busquedaGlobalAbierta ? (
                  <div className="mt-2">
                    <BuscadorMaterialCampo
                      onSeleccionar={(m) => agregarMaterial(m)}
                      disabled={isSubmitting}
                      placeholder="Buscar en todo el inventario…"
                    />
                  </div>
                ) : null}
              </div>

              <p className="text-[11px] font-bold text-zinc-600">
                Puede agregar varios artículos a la nota. Si el material no está en la lista, use
                «Agregar material nuevo a la obra».
              </p>

              {lineas.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {lineas.map((l, idx) => {
                    const editando = lineaEditandoKey === l.key;
                    return (
                      <li
                        key={l.key}
                        className="rounded-xl border border-white/10 bg-[#0A0A0F] p-3"
                      >
                        {editando ? (
                          <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#FF9500]">
                              Modificar artículo {idx + 1}
                            </p>
                            <SelectorMaterialObraRecepcion
                              proyectoId={proyectoId}
                              ubicacionId={ubicacionId}
                              value={editLineaMaterialId}
                              onChange={setEditLineaMaterialId}
                              onMaterialSeleccionado={setEditLineaMaterial}
                              onMaterialActualizado={sincronizarMaterialActualizado}
                              onMaterialEliminado={sincronizarMaterialEliminado}
                              disabled={isSubmitting || !proyectoId}
                              selectClassName={selectClass}
                              inputClassName={inputClass}
                            />
                            <label className="block w-36">
                              <span className="text-[10px] font-bold uppercase text-[#FF9500]">
                                Cantidad
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                inputMode="decimal"
                                value={editLineaCantidad}
                                onChange={(e) => setEditLineaCantidad(e.target.value)}
                                disabled={isSubmitting}
                                className={`${inputClass} py-3 text-center text-lg font-black`}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={guardarEdicionLinea}
                                disabled={isSubmitting}
                                className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-[10px] font-black uppercase text-emerald-200"
                              >
                                Guardar cambios
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicionLinea}
                                disabled={isSubmitting}
                                className="rounded-lg border border-zinc-700 px-3 py-2 text-[10px] font-bold uppercase text-zinc-400"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-black text-zinc-500">
                              {idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white">{l.nombre}</p>
                              <p className="text-xs text-zinc-500">Unidad: {l.unidad}</p>
                            </div>
                            <label className="w-36">
                              <span className="text-[10px] font-bold uppercase text-[#FF9500]">
                                Cantidad ingresada
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                inputMode="decimal"
                                value={l.cantidad}
                                onChange={(e) =>
                                  setLineas((prev) =>
                                    prev.map((x) =>
                                      x.key === l.key ? { ...x, cantidad: e.target.value } : x,
                                    ),
                                  )
                                }
                                disabled={isSubmitting}
                                required
                                className={`${inputClass} py-4 text-center text-xl font-black`}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => iniciarEdicionLinea(l)}
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] font-bold text-zinc-300 hover:border-[#FF9500]/40 hover:text-[#FF9500] disabled:opacity-40"
                              >
                                <Pencil className="h-4 w-4" />
                                Modificar
                              </button>
                              <button
                                type="button"
                                onClick={() => quitarLinea(l.key, l.nombre)}
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-2 text-[10px] font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                                Borrar
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Aún no hay artículos. Seleccione un material de la obra, indique cantidad y pulse
                  «Agregar artículo».
                </p>
              )}

              {lineas.length > 0 ? (
                <p className="mt-3 text-[11px] font-bold text-zinc-500">
                  Puede modificar cantidad, cambiar material o borrar artículos antes de registrar el
                  ingreso.
                </p>
              ) : null}
            </div>

            <div className={panelClass}>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
                <Camera className="h-4 w-4 text-[#FF9500]" />
                Soporte fotográfico
              </h3>
              <ProcurementDocumentAttach
                variant="primary"
                disabled={isSubmitting}
                onSelect={(file) => setSoporteFile(file)}
              />
              {soporteFile ? (
                <p className="mt-2 text-xs font-bold text-[#FF9500]">{soporteFile.name}</p>
              ) : null}

              <label className="mt-4 block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Observaciones
                </span>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  disabled={isSubmitting}
                  rows={2}
                  className={inputClass}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void guardarManual()}
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-[#FF9500] py-4 text-base font-black text-black shadow-lg shadow-[#FF9500]/20 hover:bg-[#FF9500]/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Registrando ingreso…' : 'Registrar ingreso y actualizar stock'}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
