'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import { labelUbicacionOpcion } from '@/lib/almacen/ubicacionesInventario';
import type { UbicacionInventario } from '@/types/inventario-obra';
import CompraFacturaImagen from '@/components/contabilidad/CompraFacturaImagen';
import EditarFacturaCanalModal from '@/components/contabilidad/EditarFacturaCanalModal';
import { TarjetaSugerenciaConciliacionField } from '@/components/contabilidad/TarjetaSugerenciaConciliacionField';
import {
  normalizarMonedaExtracted,
  type ExtractedCanalHeader,
} from '@/lib/contabilidad/extractedCanal';
import type { MonedaOrigen } from '@/lib/finanzas/currency-converter';
import {
  actualizarPendienteCanal,
  confirmarCompraCanal,
  ingresoAlmacenCanal,
  type PendienteCanal,
} from '@/lib/contabilidad/facturaCanalApi';
import { reubicarCompra } from '@/lib/contabilidad/reubicarCompraApi';
import { createClient } from '@/lib/supabase/client';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

const selectClass =
  'w-full rounded-xl border border-white/10 bg-[#0A0A0F] px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';

const panelClass =
  'rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl';

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
  const [montado, setMontado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bloquearCompraNueva, setBloquearCompraNueva] = useState(false);
  const [pendiente, setPendiente] = useState<PendienteCanal | null>(null);
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [editandoUbicacion, setEditandoUbicacion] = useState(false);
  const [ubicacionesDisponibles, setUbicacionesDisponibles] = useState<UbicacionInventario[]>([]);
  const [editando, setEditando] = useState(false);
  const { isSubmitting: registrando, runLocked: runRegistro } = useSyncSubmitLock();
  const { isSubmitting: guardandoUbicacion, runLocked: runUbicacion } = useSyncSubmitLock();
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
        const { data, error } = await supabase
          .from('ci_proyectos')
          .select('id,nombre')
          .order('nombre');
        if (error) throw error;
        setProyectos(data ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudieron cargar proyectos');
      }
    })();
  }, []);

  /** Sincroniza formulario una sola vez por pendiente cargado (evita reponer almacén al cambiar obra). */
  useEffect(() => {
    if (!pendiente?.id) return;
    if (pendienteSyncIdRef.current === pendiente.id) return;
    pendienteSyncIdRef.current = pendiente.id;
    setProyectoId(pendiente.proyecto_id ?? '');
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
  const monedaFactura = normalizarMonedaExtracted(extracted?.moneda);
  const etiquetaMoneda = monedaFactura === 'USD' ? 'USD' : 'Bs';

  const actualizarMoneda = async (moneda: MonedaOrigen) => {
    if (!extracted) return;
    const next: ExtractedCanalHeader = { ...extracted, moneda };
    try {
      const actualizado = await actualizarPendienteCanal(pendingId, { extracted: next });
      setPendiente((prev) => (prev ? { ...prev, extracted: actualizado.extracted } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la moneda');
    }
  };

  const puedeRegistrar = useMemo(
    () =>
      pendiente &&
      ['extraido', 'error'].includes(pendiente.estado) &&
      extracted &&
      (extracted.supplier_name?.trim() || extracted.invoice_number?.trim()),
    [pendiente, extracted],
  );

  const guardarExtracted = async (next: ExtractedCanalHeader) => {
    const actualizado = await actualizarPendienteCanal(pendingId, { extracted: next });
    setPendiente((prev) => (prev ? { ...prev, extracted: actualizado.extracted } : prev));
    toast.success('Datos actualizados');
  };

  const guardarUbicacion = async () => {
    if (!proyectoId.trim() || !ubicacionId.trim()) {
      toast.error('Seleccione obra y almacén');
      return;
    }
    await runUbicacion(async () => {
      try {
        if (pendiente?.purchase_invoice_id) {
          await reubicarCompra(`canal-${pendingId}`, {
            proyecto_id: proyectoId,
            ubicacion_destino_id: ubicacionId,
          });
        } else {
          const actualizado = await actualizarPendienteCanal(pendingId, {
            proyecto_id: proyectoId,
            ubicacion_destino_id: ubicacionId,
          });
          setPendiente((prev) =>
            prev
              ? {
                  ...prev,
                  proyecto_id: actualizado.proyecto_id,
                  ubicacion_destino_id: actualizado.ubicacion_destino_id,
                }
              : actualizado,
          );
        }
        toast.success('Obra y almacén guardados');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      }
    });
  };

  const registrar = async () => {
    if (bloquearCompraNueva) {
      toast.error('Concilie primero el ingreso de campo (FRM) para no duplicar stock.');
      return;
    }
    if (!proyectoId.trim()) {
      toast.error('Seleccione el proyecto');
      return;
    }
    if (!ubicacionId.trim()) {
      toast.error('Seleccione el almacén de ingreso');
      return;
    }
    if (!extracted) {
      toast.error('No hay datos de la factura');
      return;
    }
    await runRegistro(async () => {
      try {
        const r = await confirmarCompraCanal(pendingId, {
          proyecto_id: proyectoId,
          ubicacion_destino_id: ubicacionId,
          extracted,
        });
        setCompraRegistrada(true);
        setPendiente((prev) => (prev ? { ...prev, estado: 'confirmado' } : prev));
        if (r.ingresoAlmacen?.success) {
          setIngresoAlmacenOk(true);
          toast.success(
            r.yaExistia
              ? 'Compra ya confirmada · stock liberado'
              : r.ingresoAlmacen.yaExistia
                ? 'Compra confirmada · ingreso a almacén ya existía'
                : r.ingresoAlmacen.viaCuarentena
                  ? `Compra confirmada · ${r.ingresoAlmacen.aprobadas ?? 0} línea(s) liberadas en almacén`
                  : 'Compra confirmada e ingreso a almacén registrado',
          );
        } else if (r.ingresoAlmacen && !r.ingresoAlmacen.success) {
          toast.warning(
            r.ingresoAlmacen.error
              ? `Compra confirmada. Ingreso pendiente: ${r.ingresoAlmacen.error}`
              : 'Compra confirmada. Pulse «Liberar en almacén» para completar el stock.',
            { duration: 10000 },
          );
        } else if (r.cuarentena && (r.cuarentena.lineasCreadas > 0 || r.cuarentena.yaExistia)) {
          toast.success(
            r.yaExistia
              ? 'Compra ya confirmada · material en cuarentena'
              : `Compra confirmada · ${r.cuarentena.lineasCreadas} línea(s) en cuarentena${
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

  const registrarIngresoAlmacen = async () => {
    await runIngreso(async () => {
      try {
        const r = await ingresoAlmacenCanal(pendingId);
        setIngresoAlmacenOk(true);
        toast.success(
          r.yaExistia
            ? 'Ingreso a almacén ya registrado'
            : 'Material liberado en almacén (cuarentena aprobada)',
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo registrar ingreso';
        toast.error(msg, { duration: 8000 });
      }
    });
  };

  const nLineas = extracted?.items?.filter((it) => String(it.description ?? '').trim()).length ?? 0;

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
          <h1 className="text-base font-black text-white">Registrar compra (Telegram)</h1>
          <p className="text-xs text-zinc-500">Obra y almacén de ingreso (desde Telegram o aquí)</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-5">
        {loading ? (
          <ConfirmarCompraCargando />
        ) : !pendiente ? (
          <div className={`${panelClass} text-center text-sm text-zinc-400`}>
            Factura no encontrada.
          </div>
        ) : compraRegistrada || pendiente.estado === 'confirmado' ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center space-y-4 backdrop-blur-xl">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-emerald-200">Compra cargada en contabilidad</p>
            <p className="text-xs text-zinc-400">
              {extracted?.supplier_name ?? 'Proveedor'} · Nº {extracted?.invoice_number ?? '—'}
            </p>
            <p className="text-xs text-amber-200/80">
              El material queda en cuarentena hasta inspección en almacén. Use el botón inferior solo
              para liberar todo sin revisar línea a línea.
            </p>
            <Link
              href="/almacen/procurement/quality"
              className="block w-full rounded-lg border border-[#FF9500]/40 text-[#FF9500] text-sm font-semibold px-4 py-2.5"
            >
              Abrir cuarentena
            </Link>
            <button
              type="button"
              onClick={() => {
                if (ingresandoAlmacen) return;
                void registrarIngresoAlmacen();
              }}
              disabled={ingresandoAlmacen || ingresoAlmacenOk}
              className="w-full rounded-lg bg-[#34C759] text-black text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
            >
              {ingresandoAlmacen
                ? 'Liberando…'
                : ingresoAlmacenOk
                  ? 'Stock liberado en almacén'
                  : 'Liberar en almacén (fast-track)'}
            </button>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/contabilidad/compras?fuente=telegram"
                className="rounded-lg bg-[#34C759] text-black text-sm font-semibold px-4 py-2.5"
              >
                Ver en libro de compras
              </Link>
              <Link
                href="/contabilidad/compras/canal"
                className="rounded-lg border border-white/10 text-sm px-4 py-2.5 text-zinc-300"
              >
                Volver a cargas Telegram
              </Link>
            </div>
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

            {pendiente.document_storage_path ? (
              <CompraFacturaImagen
                compraId={pendingId}
                tieneDocumento
                documentApiPath={`/api/facturas-canal/pendientes/${encodeURIComponent(pendingId)}/document`}
                expanded
              />
            ) : null}

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
                <dd className="flex flex-wrap items-center gap-2">
                  {extracted?.total_amount != null ? (
                    <span>
                      {extracted.total_amount} {etiquetaMoneda}
                    </span>
                  ) : (
                    <span>—</span>
                  )}
                  {extracted && !(compraRegistrada || pendiente?.estado === 'confirmado') ? (
                    <select
                      value={monedaFactura}
                      onChange={(e) => void actualizarMoneda(normalizarMonedaExtracted(e.target.value))}
                      className="rounded-md border border-white/10 bg-[#0A0A0F] px-2 py-0.5 text-[11px] font-bold text-zinc-200 outline-none focus:border-[#FF9500]/50"
                      aria-label="Moneda del total"
                    >
                      <option value="VES">VES</option>
                      <option value="USD">USD</option>
                    </select>
                  ) : (
                    <span className="text-[10px] text-zinc-500">{monedaFactura}</span>
                  )}
                </dd>
                <dt className="text-zinc-500">Líneas</dt>
                <dd>{nLineas}</dd>
              </dl>
            </section>

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

            <TarjetaSugerenciaConciliacionField
              facturaId={pendingId}
              proyectoId={proyectoId}
              proveedorRif={extracted?.supplier_rif}
              proveedorNombre={extracted?.supplier_name}
              extracted={extracted}
              onFrmPendienteChange={setBloquearCompraNueva}
              onConciliadoExito={() => {
                setBloquearCompraNueva(false);
                setCompraRegistrada(true);
                setIngresoAlmacenOk(true);
                setPendiente((prev) => (prev ? { ...prev, estado: 'confirmado' } : prev));
                void cargar();
              }}
            />

            {!mostrarPanelPrecargado ? (
              <button
                type="button"
                disabled={!proyectoId.trim() || !ubicacionId.trim() || guardandoUbicacion}
                onClick={() => {
                  if (guardandoUbicacion) return;
                  void guardarUbicacion();
                }}
                className="w-full rounded-xl border border-[#FF9500]/40 bg-[#FF9500]/10 disabled:opacity-40 text-[#FF9500] text-sm font-semibold py-2.5 flex items-center justify-center gap-2"
              >
                {guardandoUbicacion ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando ubicación…
                  </>
                ) : (
                  'Guardar solo obra y almacén'
                )}
              </button>
            ) : null}

            <button
              type="button"
              disabled={
                bloquearCompraNueva ||
                !puedeRegistrar ||
                !proyectoId.trim() ||
                !ubicacionId.trim() ||
                registrando ||
                guardandoUbicacion
              }
              onClick={() => {
                if (registrando || bloquearCompraNueva) return;
                void registrar();
              }}
              title={
                bloquearCompraNueva
                  ? 'Hay recepción FRM pendiente: use Conciliar e inyectar costo'
                  : undefined
              }
              className="w-full rounded-xl bg-[#34C759] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold py-3 flex items-center justify-center gap-2"
            >
              {registrando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmando…
                </>
              ) : bloquearCompraNueva ? (
                'Bloqueado — concilie FRM arriba'
              ) : (
                'Cargar compra en contabilidad'
              )}
            </button>

            <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
              {bloquearCompraNueva ? (
                <>
                  <span className="text-[#FF9500] font-semibold">
                    Ingreso manual detectado en obra.
                  </span>{' '}
                  Use <strong className="text-zinc-300">Conciliar e inyectar costo</strong> en la
                  tarjeta naranja. No cargue compra nueva ni duplicará inventario.
                </>
              ) : mostrarPanelPrecargado ? (
                <>
                  Almacén heredado de Telegram. Pulse{' '}
                  <strong className="text-zinc-300">Cargar compra en contabilidad</strong> para asentar
                  stock en un solo paso. Cada línea debe traer{' '}
                  <strong className="text-zinc-300">item_code (SKU)</strong> del catálogo.
                </>
              ) : (
                <>
                  Seleccione obra y almacén, luego{' '}
                  <strong className="text-zinc-300">Cargar compra en contabilidad</strong>. Cada línea
                  debe traer <strong className="text-zinc-300">item_code (SKU)</strong> del catálogo.
                </>
              )}
            </p>
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
