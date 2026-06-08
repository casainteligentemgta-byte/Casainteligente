'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';
import type { UbicacionInventario } from '@/types/inventario-obra';
import EditarFacturaCanalModal from '@/components/contabilidad/EditarFacturaCanalModal';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import {
  formatTotalExtracted,
  monedaExtractedConfirmada,
  normalizarMonedaExtracted,
} from '@/lib/contabilidad/extractedCanal';
import {
  actualizarPendienteCanal,
  confirmarCompraCanal,
  ingresoAlmacenCanal,
  type PendienteCanal,
} from '@/lib/contabilidad/facturaCanalApi';
import { createClient } from '@/lib/supabase/client';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { TarjetaSugerenciaConciliacionField } from '@/components/contabilidad/TarjetaSugerenciaConciliacionField';

const selectClass =
  'w-full rounded-xl border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';

const panelClass =
  'rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl';

const MENSAJE_INGRESO_CONFIRMADA = 'Ingreso Confirmada.';

function esErrorCompraNoConfirmadaContabilidad(msg: string): boolean {
  return /aún no está confirmada en contabilidad/i.test(msg);
}

function ConfirmarCompraCargando() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
      <Loader2 className="h-4 w-4 animate-spin text-[#FF9500]" />
      Cargando factura…
    </div>
  );
}

type Props = {
  pendingId: string;
};

export default function ConfirmarCompraTelegramClient({ pendingId }: Props) {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendiente, setPendiente] = useState<PendienteCanal | null>(null);
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [entidadId, setEntidadId] = useState('');
  const [entidades, setEntidades] = useState<{ id: string; nombre: string }[]>([]);
  const [gastoEntidad, setGastoEntidad] = useState(false);
  const [ubicacionId, setUbicacionId] = useState('');
  const [editandoUbicacion, setEditandoUbicacion] = useState(false);
  const [ubicacionesDisponibles, setUbicacionesDisponibles] = useState<UbicacionInventario[]>([]);
  const [editando, setEditando] = useState(false);
  const [frmPendienteBloquea, setFrmPendienteBloquea] = useState(false);
  const { isSubmitting: registrando, runLocked: runRegistro } = useSyncSubmitLock();
  const { isSubmitting: ingresandoAlmacen, runLocked: runIngreso } = useSyncSubmitLock();
  const [compraRegistrada, setCompraRegistrada] = useState(false);
  const [ingresoAlmacenOk, setIngresoAlmacenOk] = useState(false);

  const pendienteSyncIdRef = useRef<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/facturas-canal/pendientes/${encodeURIComponent(pendingId)}`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as PendienteCanal & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Factura no encontrada');
      setPendiente(data);
      if (data.estado === 'confirmado') setCompraRegistrada(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
      setPendiente(null);
    } finally {
      setLoading(false);
    }
  }, [pendingId]);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    void cargar();
  }, [cargar, montado]);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const [proyRes, entRes] = await Promise.all([
          supabase.from('ci_proyectos').select('id,nombre').order('nombre'),
          fetch('/api/almacen/entidades', { cache: 'no-store' }),
        ]);
        if (proyRes.error) throw proyRes.error;
        setProyectos(proyRes.data ?? []);
        const entData = (await entRes.json()) as { entidades?: { id: string; nombre: string }[] };
        setEntidades(entData.entidades ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudieron cargar catálogos');
      }
    })();
  }, []);

  /** Sincroniza formulario una sola vez por pendiente cargado (evita reponer almacén al cambiar obra). */
  useEffect(() => {
    if (!pendiente?.id) return;
    if (pendienteSyncIdRef.current === pendiente.id) return;
    pendienteSyncIdRef.current = pendiente.id;
    setProyectoId(pendiente.proyecto_id ?? '');
    setEntidadId(pendiente.entidad_id ?? '');
    setUbicacionId(pendiente.ubicacion_destino_id ?? '');
    setEditandoUbicacion(false);
  }, [pendiente]);

  useEffect(() => {
    if (!montado || !proyectoId.trim()) {
      setUbicacionesDisponibles([]);
      return;
    }
    void (async () => {
      try {
        const q = new URLSearchParams({ flat: '1', proyecto_id: proyectoId, solo_almacenes: '1' });
        const res = await fetch(`/api/almacen/ubicaciones?${q}`, { cache: 'no-store' });
        const data = (await res.json()) as { ubicaciones?: UbicacionInventario[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'No se pudieron cargar almacenes');
        setUbicacionesDisponibles(data.ubicaciones ?? []);
      } catch {
        setUbicacionesDisponibles([]);
      }
    })();
  }, [montado, proyectoId]);

  const factura = pendiente;
  const almacenPrecargado = useMemo(
    () => ubicacionesDisponibles.find((u) => u.id === factura?.ubicacion_destino_id),
    [ubicacionesDisponibles, factura?.ubicacion_destino_id],
  );
  const mostrarPanelPrecargado = Boolean(almacenPrecargado) && !editandoUbicacion;
  const mostrarSelectorUbicacion =
    editandoUbicacion || !factura?.ubicacion_destino_id || !almacenPrecargado;

  const revertirUbicacionTelegram = useCallback(() => {
    setUbicacionId(factura?.ubicacion_destino_id ?? '');
    setEditandoUbicacion(false);
  }, [factura?.ubicacion_destino_id]);

  const extracted = pendiente?.extracted ?? null;

  const yaEnContabilidad = useMemo(
    () =>
      Boolean(
        compraRegistrada ||
          pendiente?.estado === 'confirmado' ||
          pendiente?.purchase_invoice_id,
      ),
    [compraRegistrada, pendiente],
  );

  const estadosListosParaIngreso = useMemo(
    () => new Set(['extraido', 'error', 'aprobado_sistema', 'confirmado']),
    [],
  );

  const lineasConDescripcion = useMemo(
    () =>
      (extracted?.items ?? []).filter((it) => String(it.description ?? '').trim()).length,
    [extracted?.items],
  );

  const puedeIngresarAlmacen = useMemo(
    () =>
      Boolean(
        pendiente &&
          !ingresoAlmacenOk &&
          !loading &&
          (yaEnContabilidad ||
            (estadosListosParaIngreso.has(pendiente.estado) &&
              extracted &&
              (lineasConDescripcion > 0 ||
                extracted.supplier_name?.trim() ||
                extracted.invoice_number?.trim()))),
      ),
    [
      pendiente,
      extracted,
      yaEnContabilidad,
      ingresoAlmacenOk,
      loading,
      estadosListosParaIngreso,
      lineasConDescripcion,
    ],
  );

  const proyectoEfectivo = useMemo(
    () => proyectoId.trim() || pendiente?.proyecto_id?.trim() || '',
    [proyectoId, pendiente?.proyecto_id],
  );

  const entidadEfectiva = useMemo(
    () => entidadId.trim() || pendiente?.entidad_id?.trim() || '',
    [entidadId, pendiente?.entidad_id],
  );

  const ubicacionEfectiva = useMemo(
    () => ubicacionId.trim() || pendiente?.ubicacion_destino_id?.trim() || '',
    [ubicacionId, pendiente?.ubicacion_destino_id],
  );

  /** Restaura almacén precargado si el select lo vació durante la carga de ubicaciones. */
  useEffect(() => {
    const destino = pendiente?.ubicacion_destino_id?.trim();
    if (!destino || editandoUbicacion) return;
    if (ubicacionId.trim() === destino) return;
    if (ubicacionesDisponibles.length && !ubicacionesDisponibles.some((u) => u.id === destino)) {
      return;
    }
    setUbicacionId(destino);
  }, [pendiente?.ubicacion_destino_id, ubicacionId, ubicacionesDisponibles, editandoUbicacion]);

  /** Asegura proyecto heredado del pendiente Telegram. */
  useEffect(() => {
    const pid = pendiente?.proyecto_id?.trim();
    if (!pid || proyectoId.trim() === pid) return;
    if (!proyectoId.trim()) setProyectoId(pid);
  }, [pendiente?.proyecto_id, proyectoId]);

  const guardarExtracted = async (next: ExtractedCanalHeader) => {
    const actualizado = await actualizarPendienteCanal(pendingId, { extracted: next });
    setPendiente((prev) => (prev ? { ...prev, extracted: actualizado.extracted } : prev));
    toast.success('Datos actualizados');
  };

  const elegirMoneda = async (moneda: 'VES' | 'USD') => {
    if (!extracted) return;
    const next: ExtractedCanalHeader = {
      ...extracted,
      moneda: normalizarMonedaExtracted(moneda),
    };
    await guardarExtracted(next);
  };

  const monedaConfirmada = monedaExtractedConfirmada(extracted?.moneda);
  const monedaActual = normalizarMonedaExtracted(extracted?.moneda);

  const finalizarIngresoYIrAlmacen = useCallback(
    (mensaje: string) => {
      setCompraRegistrada(true);
      setIngresoAlmacenOk(true);
      setPendiente((prev) => (prev ? { ...prev, estado: 'confirmado' } : prev));
      toast.success(mensaje);
      router.push('/almacen');
    },
    [router],
  );

  const registrar = async () => {
    if (gastoEntidad) {
      if (!entidadEfectiva) {
        toast.error('Seleccione la entidad que absorbe el gasto');
        return;
      }
    } else {
      if (!proyectoEfectivo) {
        toast.error('Seleccione el proyecto');
        return;
      }
      if (!ubicacionEfectiva) {
        toast.error('Seleccione el almacén de ingreso');
        return;
      }
    }
    if (!extracted) {
      toast.error('No hay datos de la factura');
      return;
    }
    await runRegistro(async () => {
      try {
        const r = await confirmarCompraCanal(pendingId, {
          proyecto_id: gastoEntidad ? '' : proyectoEfectivo,
          ubicacion_destino_id: gastoEntidad ? '' : ubicacionEfectiva,
          entidad_id: entidadEfectiva || undefined,
          imputacion_entidad: gastoEntidad,
          extracted,
          ingreso_almacen_automatico: !gastoEntidad,
        });
        if (gastoEntidad) {
          setCompraRegistrada(true);
          setPendiente((prev) => (prev ? { ...prev, estado: 'confirmado' } : prev));
          toast.success(
            r.yaExistia
              ? 'Gasto de entidad ya registrado (fuera de valuación AD)'
              : 'Gasto registrado a la entidad — no afecta administración delegada',
          );
          return;
        }
        if (r.ingresoAlmacen?.success) {
          finalizarIngresoYIrAlmacen(
            r.yaExistia
              ? 'Compra ya confirmada · stock liberado'
              : r.ingresoAlmacen.yaExistia
                ? 'Compra confirmada · ingreso a almacén ya existía'
                : r.ingresoAlmacen.viaCuarentena
                  ? `Compra confirmada · ${r.ingresoAlmacen.aprobadas ?? 0} línea(s) liberadas en almacén`
                  : 'Compra confirmada e ingreso a almacén registrado',
          );
          return;
        }
        setCompraRegistrada(true);
        setPendiente((prev) => (prev ? { ...prev, estado: 'confirmado' } : prev));
        if (r.ingresoAlmacen && !r.ingresoAlmacen.success) {
          const errIngreso = r.ingresoAlmacen.error ?? '';
          if (r.purchaseInvoiceId) {
            try {
              await ingresoAlmacenCanal(pendingId);
              finalizarIngresoYIrAlmacen('Ingreso Confirmada.');
              return;
            } catch (retryErr) {
              const retryMsg =
                retryErr instanceof Error ? retryErr.message : 'No se pudo registrar ingreso';
              if (!esErrorCompraNoConfirmadaContabilidad(retryMsg)) {
                toast.error(retryMsg, { duration: 8000 });
                return;
              }
            }
          }
          toast.warning(
            errIngreso
              ? `Compra confirmada. Ingreso pendiente: ${errIngreso}`
              : 'Compra confirmada. Pulse de nuevo «Ingresar mercancía» para completar el stock.',
            { duration: 10000 },
          );
          return;
        }
        if (r.cuarentena && (r.cuarentena.lineasCreadas > 0 || r.cuarentena.yaExistia)) {
          toast.success(
            r.yaExistia
              ? 'Compra ya confirmada · material en tránsito'
              : `Compra confirmada · ${r.cuarentena.lineasCreadas} línea(s) en tránsito${
                  r.cuarentena.notificado ? ' (Telegram enviado)' : ''
                }`,
            { duration: 8000 },
          );
        } else {
          toast.success(r.yaExistia ? 'Compra ya confirmada' : 'Compra confirmada');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo registrar');
      }
    });
  };

  const persistirDestinoIngreso = async () => {
    const pid = proyectoEfectivo;
    const uid = ubicacionEfectiva;
    if (!pid || !uid) return;
    const actualizado = await actualizarPendienteCanal(pendingId, {
      proyecto_id: pid,
      ubicacion_destino_id: uid,
    });
    setPendiente((prev) => (prev ? { ...prev, ...actualizado } : prev));
    setProyectoId(pid);
    setUbicacionId(uid);
  };

  const registrarIngresoAlmacen = async () => {
    await runIngreso(async () => {
      try {
        await persistirDestinoIngreso();
        const r = await ingresoAlmacenCanal(pendingId);
        finalizarIngresoYIrAlmacen(
          r.yaExistia
            ? 'Ingreso a almacén ya registrado'
            : 'Mercancía ingresada al almacén de la obra',
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo registrar ingreso';
        toast.error(msg, { duration: 8000 });
      }
    });
  };

  /** Un solo paso: confirma en contabilidad (si falta) e ingresa al almacén de la obra. */
  const ingresarMercanciaAlmacen = async () => {
    if (!proyectoEfectivo) {
      toast.error('Seleccione el proyecto / obra');
      return;
    }
    if (!ubicacionEfectiva) {
      toast.error('Seleccione el almacén de ingreso');
      return;
    }
    if (yaEnContabilidad) {
      await registrarIngresoAlmacen();
      return;
    }
    await registrar();
  };

  const nLineas = lineasConDescripcion;

  const lineasParaConteo = useMemo(
    () =>
      (extracted?.items ?? []).filter((it) => String(it.description ?? '').trim()),
    [extracted?.items],
  );

  const botonIngresoListo = Boolean(
    !gastoEntidad &&
      puedeIngresarAlmacen &&
      monedaConfirmada &&
      proyectoEfectivo &&
      ubicacionEfectiva &&
      !frmPendienteBloquea &&
      !registrando &&
      !ingresandoAlmacen,
  );

  const botonGastoEntidadListo = Boolean(
    gastoEntidad &&
      puedeIngresarAlmacen &&
      monedaConfirmada &&
      entidadEfectiva &&
      !frmPendienteBloquea &&
      !registrando,
  );

  const motivoBotonInactivo = useMemo(() => {
    if (loading || !pendiente) return null;
    if (gastoEntidad ? botonGastoEntidadListo : botonIngresoListo) return null;
    if (registrando || ingresandoAlmacen) return null;
    if (frmPendienteBloquea) {
      return 'Hay ingresos de campo sin conciliar. Use «Conciliar e inyectar costo» arriba.';
    }
    if (gastoEntidad) {
      if (!entidadEfectiva) return 'Seleccione la entidad que absorbe el gasto.';
    } else {
      if (!proyectoEfectivo) return 'Seleccione la obra (proyecto).';
      if (!ubicacionEfectiva) return 'Seleccione el almacén de ingreso.';
    }
    if (!monedaConfirmada) return 'Indique si la factura está en bolívares o dólares.';
    if (pendiente.estado === 'pendiente' || pendiente.estado === 'procesando') {
      return 'Espere el procesamiento IA o pulse Actualizar arriba.';
    }
    if (!puedeIngresarAlmacen) {
      return 'Revise los datos de la factura (al menos una línea con descripción).';
    }
    return null;
  }, [
    loading,
    pendiente,
    botonIngresoListo,
    botonGastoEntidadListo,
    registrando,
    ingresandoAlmacen,
    proyectoEfectivo,
    ubicacionEfectiva,
    entidadEfectiva,
    gastoEntidad,
    puedeIngresarAlmacen,
    frmPendienteBloquea,
    monedaConfirmada,
  ]);

  if (!montado) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-zinc-100">
        <ConfirmarCompraCargando />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0A0F]/90 backdrop-blur-xl px-4 py-4 flex items-center gap-3">
        <Link
          href="/contabilidad/compras/canal"
          className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF9500]">
            Contabilidad · Canal
          </p>
          <h1 className="text-base font-black text-white">Ingreso de mercancía al almacén</h1>
          <p className="text-xs text-zinc-500">
            {yaEnContabilidad
              ? 'La compra ya está en contabilidad · indique el almacén de la obra'
              : 'Obra, almacén e ingreso de stock en un solo paso'}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-5">
        {loading ? (
          <ConfirmarCompraCargando />
        ) : !pendiente ? (
          <div className={`${panelClass} text-center text-sm text-zinc-400`}>
            Factura no encontrada.
          </div>
        ) : ingresoAlmacenOk ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center space-y-4 backdrop-blur-xl">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-emerald-200">Mercancía ingresada al almacén</p>
            <p className="text-xs text-zinc-400">
              {extracted?.supplier_name ?? 'Proveedor'} · Nº {extracted?.invoice_number ?? '—'}
            </p>
            <p className="text-xs text-zinc-500">
              <Link href="/contabilidad/compras?fuente=telegram" className="text-[#FF9500] underline">
                Ver en libro de compras
              </Link>
              {' · '}
              <Link href="/contabilidad/compras/canal" className="text-zinc-400 underline">
                Cargas Telegram
              </Link>
            </p>
          </div>
        ) : (
          <>
            {(pendiente.estado === 'pendiente' || pendiente.estado === 'procesando') && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100/90 flex items-start gap-2 backdrop-blur-xl">
                <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Procesando con IA…</p>
                  <p className="text-xs mt-1 text-amber-200/80">
                    Espere unos segundos y pulse Actualizar.
                  </p>
                  <button
                    type="button"
                    onClick={() => void cargar()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-200"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Actualizar
                  </button>
                </div>
              </div>
            )}

            {pendiente.estado === 'error' && (
              <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm backdrop-blur-xl">
                <p className="font-semibold text-red-200">Error al leer la factura</p>
                {pendiente.mensaje_error ? (
                  <p className="text-xs text-red-300/90 mt-1">{pendiente.mensaje_error}</p>
                ) : null}
                <p className="text-xs text-zinc-400 mt-2">
                  Puede corregir los datos manualmente y registrar igualmente.
                </p>
              </div>
            )}

            {yaEnContabilidad ? (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-3 text-xs text-emerald-200/90">
                Compra registrada en contabilidad. Solo falta el ingreso de mercancía al almacén de la
                obra.
              </div>
            ) : null}

            {!yaEnContabilidad && pendiente ? (
              <TarjetaSugerenciaConciliacionField
                facturaId={pendingId}
                proyectoId={proyectoEfectivo}
                proveedorRif={extracted?.supplier_rif ?? undefined}
                proveedorNombre={extracted?.supplier_name ?? undefined}
                extracted={extracted}
                onConciliadoExito={() => {
                  void cargar().then(() => {
                    setCompraRegistrada(true);
                    setFrmPendienteBloquea(false);
                  });
                }}
                onFrmPendienteChange={setFrmPendienteBloquea}
              />
            ) : null}

            <section className={`${panelClass} space-y-3 border-[#FF9500]/30`}>
              <h2 className="text-sm font-bold text-[#FF9500]">Moneda de la factura</h2>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Indique en qué moneda están el total y los precios unitarios extraídos por la IA.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void elegirMoneda('VES')}
                  className={`rounded-xl border py-3 text-sm font-bold transition ${
                    monedaConfirmada && monedaActual === 'VES'
                      ? 'border-[#FF9500] bg-[#FF9500]/15 text-white'
                      : 'border-white/10 bg-black/30 text-zinc-300 hover:border-white/20'
                  }`}
                >
                  Bolívares (Bs)
                </button>
                <button
                  type="button"
                  onClick={() => void elegirMoneda('USD')}
                  className={`rounded-xl border py-3 text-sm font-bold transition ${
                    monedaConfirmada && monedaActual === 'USD'
                      ? 'border-[#FF9500] bg-[#FF9500]/15 text-white'
                      : 'border-white/10 bg-black/30 text-zinc-300 hover:border-white/20'
                  }`}
                >
                  Dólares (USD)
                </button>
              </div>
              {extracted?.total_amount != null ? (
                <p className="text-xs text-zinc-400">
                  Total detectado:{' '}
                  <span className="font-semibold text-zinc-200">
                    {formatTotalExtracted(extracted, { sinMoneda: !monedaConfirmada })}
                  </span>
                </p>
              ) : null}
            </section>

            <section className={`${panelClass} space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">Datos de la factura</h2>
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <dt className="text-zinc-500">Nº factura</dt>
                <dd>{extracted?.invoice_number ?? '—'}</dd>
                <dt className="text-zinc-500">Proveedor</dt>
                <dd>{extracted?.supplier_name ?? '—'}</dd>
                <dt className="text-zinc-500">RIF</dt>
                <dd>{extracted?.supplier_rif ?? '—'}</dd>
                <dt className="text-zinc-500">Fecha</dt>
                <dd>{extracted?.date ?? '—'}</dd>
                <dt className="text-zinc-500">Total</dt>
                <dd>
                  {extracted
                    ? formatTotalExtracted(extracted, { sinMoneda: !monedaConfirmada })
                    : '—'}
                </dd>
                <dt className="text-zinc-500">Ítems</dt>
                <dd>{nLineas}</dd>
              </dl>
            </section>

            <section className={`${panelClass} space-y-3`}>
              <h2 className="text-sm font-bold">Detalle para conteo físico</h2>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Verifique cantidad y producto recibidos. Los precios no se muestran en esta vista.
              </p>
              {lineasParaConteo.length === 0 ? (
                <p className="text-xs text-amber-300/90">
                  Sin líneas con descripción. Pulse <strong>Editar</strong> arriba para cargar los
                  productos.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {lineasParaConteo.map((it, idx) => {
                    const cantidad = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
                    const unidad = String(it.unit ?? 'UND').trim() || 'UND';
                    const codigo = String(it.item_code ?? '').trim();
                    return (
                      <li
                        key={`${idx}-${String(it.description ?? '').slice(0, 24)}`}
                        className="rounded-xl border border-white/10 bg-[#0A0A0F]/80 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              Ítem {idx + 1}
                            </p>
                            <p className="text-sm font-semibold text-zinc-100 leading-snug">
                              {String(it.description ?? '').trim()}
                            </p>
                            {codigo ? (
                              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                                Código: {codigo}
                              </p>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF9500]">
                              Cantidad
                            </p>
                            <p className="text-lg font-black tabular-nums text-white">
                              {cantidad}
                            </p>
                            <p className="text-[10px] text-zinc-500">{unidad}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className={`${panelClass} space-y-3`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={gastoEntidad}
                  onChange={(e) => setGastoEntidad(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-zinc-900 accent-[#FF9500]"
                />
                <span>
                  <span className="block text-sm font-semibold text-zinc-100">
                    Gasto de la entidad (no valuación AD)
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    OpEx del patrono (ej. gasolina del vehículo del comprador). No entra en el
                    porcentaje de administración delegada.
                  </span>
                </span>
              </label>
            </section>

            {gastoEntidad ? (
              <section className="space-y-2">
                <label htmlFor="entidad-telegram" className="text-xs font-bold text-zinc-500">
                  ENTIDAD (PATRONO)
                </label>
                <select
                  id="entidad-telegram"
                  value={entidadId}
                  onChange={(e) => setEntidadId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Seleccione entidad…</option>
                  {entidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </section>
            ) : (
              <>
            <section className="space-y-2">
              <label htmlFor="proyecto-telegram" className="text-xs font-bold text-zinc-500">
                PROYECTO
              </label>
              <select
                id="proyecto-telegram"
                value={proyectoId}
                onChange={(e) => {
                  setProyectoId(e.target.value);
                  setUbicacionId('');
                }}
                className={selectClass}
              >
                <option value="">Seleccione proyecto…</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-2">
              <label htmlFor="ubicacion-telegram" className="text-xs font-bold text-zinc-500">
                ALMACÉN DE INGRESO
              </label>

              {mostrarPanelPrecargado && almacenPrecargado ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-mono text-sm text-zinc-100 truncate">
                      {labelUbicacionOpcion(almacenPrecargado)}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: '#FFD60A', border: '1px solid rgba(255, 214, 10, 0.35)' }}
                    >
                      PRECARGADO
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditandoUbicacion(true)}
                    className="shrink-0 text-sm font-semibold underline-offset-2 hover:underline"
                    style={{ color: '#FF9500' }}
                  >
                    Modificar Ubicación
                  </button>
                </div>
              ) : null}

              {montado && mostrarSelectorUbicacion ? (
                <div className="space-y-1.5">
                  <UbicacionInventarioSelect
                    id="ubicacion-telegram"
                    proyectoId={proyectoId}
                    value={ubicacionId}
                    onChange={setUbicacionId}
                    disabled={!proyectoId.trim()}
                  />
                  {factura?.ubicacion_destino_id ? (
                    <button
                      type="button"
                      onClick={revertirUbicacionTelegram}
                      className="text-xs text-[#FF9500] underline-offset-2 hover:underline"
                    >
                      Revertir al almacén original de Telegram
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
              </>
            )}

            {gastoEntidad ? (
              <>
                <button
                  key={`${pendiente.id}-entidad-${entidadEfectiva}`}
                  type="button"
                  data-cta="registrar-gasto-entidad"
                  disabled={!botonGastoEntidadListo}
                  onClick={() => {
                    if (!botonGastoEntidadListo) return;
                    void registrar();
                  }}
                  className="w-full rounded-xl bg-[#FF9500] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-[#FF9500]/25"
                >
                  {registrando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando gasto…
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando datos…
                    </>
                  ) : (
                    'Registrar gasto de entidad'
                  )}
                </button>

                {motivoBotonInactivo ? (
                  <p className="text-center text-xs text-amber-300/90">{motivoBotonInactivo}</p>
                ) : null}

                <p className="text-[11px] text-zinc-500 text-center leading-relaxed pb-2">
                  El gasto queda imputado al patrono y no entra en la base de administración
                  delegada. No se ingresa stock ni se envía a cuarentena.
                </p>
              </>
            ) : (
              <>
            <button
              key={`${pendiente.id}-${proyectoEfectivo}-${ubicacionEfectiva}`}
              type="button"
              data-cta="ingreso-almacen-obra"
              disabled={!botonIngresoListo}
              onClick={() => {
                if (!botonIngresoListo) return;
                void ingresarMercanciaAlmacen();
              }}
              className="w-full rounded-xl bg-[#34C759] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-[#34C759]/25"
            >
              {registrando || ingresandoAlmacen ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {yaEnContabilidad ? 'Ingresando al almacén…' : 'Registrando ingreso…'}
                </>
              ) : loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando datos…
                </>
              ) : (
                'Ingresar mercancía al almacén de la obra'
              )}
            </button>

            {motivoBotonInactivo ? (
              <p className="text-center text-xs text-amber-300/90">{motivoBotonInactivo}</p>
            ) : null}

            <p className="text-[11px] text-zinc-500 text-center leading-relaxed pb-2">
              {yaEnContabilidad ? (
                <>
                  La factura ya está en el libro de compras. Este paso solo mueve el stock al
                  almacén de la obra seleccionada. Las líneas se vinculan por SKU o por nombre en el
                  catálogo de la obra.
                </>
              ) : mostrarPanelPrecargado ? (
                <>
                  Almacén heredado de Telegram. Un solo paso: contabilidad e ingreso al almacén. Las
                  líneas se vinculan por SKU o por nombre en el catálogo de la obra.
                </>
              ) : (
                <>
                  Seleccione <strong className="text-zinc-300">obra</strong> y{' '}
                  <strong className="text-zinc-300">almacén</strong> para habilitar el botón verde. Si
                  la compra aún no está en contabilidad, se registrará automáticamente antes del
                  ingreso. Las líneas se vinculan por SKU o por nombre en el catálogo de la obra.
                </>
              )}
            </p>
              </>
            )}
          </>
        )}
      </main>

      <EditarFacturaCanalModal
        open={editando}
        titulo="Corregir datos de la factura"
        extracted={extracted}
        onClose={() => setEditando(false)}
        onGuardar={guardarExtracted}
      />
    </div>
  );
}
