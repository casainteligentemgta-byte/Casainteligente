'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import UbicacionInventarioSelect from '@/components/almacen/UbicacionInventarioSelect';
import CompraFacturaImagen from '@/components/contabilidad/CompraFacturaImagen';
import EditarFacturaCanalModal from '@/components/contabilidad/EditarFacturaCanalModal';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
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
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/50';

type Props = {
  pendingId: string;
};

export default function ConfirmarCompraTelegramClient({ pendingId }: Props) {
  const [loading, setLoading] = useState(true);
  const [pendiente, setPendiente] = useState<PendienteCanal | null>(null);
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [editando, setEditando] = useState(false);
  const { isSubmitting: registrando, runLocked: runRegistro } = useSyncSubmitLock();
  const { isSubmitting: guardandoUbicacion, runLocked: runUbicacion } = useSyncSubmitLock();
  const { isSubmitting: ingresandoAlmacen, runLocked: runIngreso } = useSyncSubmitLock();
  const [compraRegistrada, setCompraRegistrada] = useState(false);
  const [autoConfirmando, setAutoConfirmando] = useState(false);
  const [ingresoAlmacenOk, setIngresoAlmacenOk] = useState(false);

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
    void cargar();
  }, [cargar]);

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

  useEffect(() => {
    if (pendiente?.proyecto_id && !proyectoId) {
      setProyectoId(pendiente.proyecto_id);
    }
    if (pendiente?.ubicacion_destino_id && !ubicacionId) {
      setUbicacionId(pendiente.ubicacion_destino_id);
    }
  }, [pendiente?.proyecto_id, pendiente?.ubicacion_destino_id, proyectoId, ubicacionId]);

  const extracted = pendiente?.extracted ?? null;
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
        await reubicarCompra(`canal-${pendingId}`, {
          proyecto_id: proyectoId,
          ubicacion_destino_id: ubicacionId,
        });
        toast.success('Obra y almacén guardados');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      }
    });
  };

  const registrar = async () => {
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
        toast.success(r.yaExistia ? 'Compra ya confirmada' : 'Compra confirmada');
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
        toast.success(r.yaExistia ? 'Ingreso a almacén ya registrado' : 'Ingreso a almacén registrado');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo registrar ingreso';
        toast.error(msg, { duration: 8000 });
      }
    });
  };

  const nLineas = extracted?.items?.filter((it) => String(it.description ?? '').trim()).length ?? 0;

  useEffect(() => {
    if (
      autoConfirmando ||
      registrando ||
      compraRegistrada ||
      !puedeRegistrar ||
      !proyectoId.trim() ||
      !ubicacionId.trim() ||
      !extracted
    ) {
      return;
    }

    setAutoConfirmando(true);
    void (async () => {
      try {
        const r = await confirmarCompraCanal(pendingId, {
          proyecto_id: proyectoId,
          ubicacion_destino_id: ubicacionId,
          extracted,
        });
        setCompraRegistrada(true);
        toast.success(r.yaExistia ? 'Compra ya confirmada' : 'Compra confirmada');
      } catch {
        // Si falla el intento automático, el usuario puede usar el botón manual.
      } finally {
        setAutoConfirmando(false);
      }
    })();
  }, [
    autoConfirmando,
    registrando,
    compraRegistrada,
    puedeRegistrar,
    proyectoId,
    ubicacionId,
    extracted,
    pendingId,
  ]);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <header className="border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link
          href="/contabilidad/compras/canal"
          className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold">Registrar compra (Telegram)</h1>
          <p className="text-xs text-zinc-500">Obra y almacén de ingreso (desde Telegram o aquí)</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex gap-2 text-zinc-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando factura…
          </div>
        ) : !pendiente ? (
          <div className="rounded-xl border border-white/10 p-6 text-center text-sm text-zinc-400">
            Factura no encontrada.
          </div>
        ) : compraRegistrada || pendiente.estado === 'confirmado' ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center space-y-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-emerald-200">Compra cargada en contabilidad</p>
            <p className="text-xs text-zinc-400">
              {extracted?.supplier_name ?? 'Proveedor'} · Nº {extracted?.invoice_number ?? '—'}
            </p>
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
                ? 'Registrando ingreso…'
                : ingresoAlmacenOk
                  ? 'Ingreso a almacén completado'
                  : 'Ingreso a almacén'}
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
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100/90 flex items-start gap-2">
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
              <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm">
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

            <section className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-3">
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
                  {extracted?.total_amount != null ? `${extracted.total_amount} Bs` : '—'}
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
              <UbicacionInventarioSelect
                id="ubicacion-telegram"
                proyectoId={proyectoId}
                value={ubicacionId}
                onChange={setUbicacionId}
              />
            </section>

            <button
              type="button"
              disabled={!proyectoId.trim() || !ubicacionId.trim() || guardandoUbicacion}
              onClick={() => {
                if (guardandoUbicacion) return;
                void guardarUbicacion();
              }}
              className="w-full rounded-xl border border-orange-500/40 bg-orange-500/10 disabled:opacity-40 text-orange-200 text-sm font-semibold py-2.5 flex items-center justify-center gap-2"
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

            <button
              type="button"
              disabled={
                !puedeRegistrar ||
                !proyectoId.trim() ||
                !ubicacionId.trim() ||
                registrando ||
                autoConfirmando
              }
              onClick={() => {
                if (registrando) return;
                void registrar();
              }}
              className="w-full rounded-xl bg-[#34C759] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold py-3 flex items-center justify-center gap-2"
            >
              {registrando || autoConfirmando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmando…
                </>
              ) : (
                'Cargar compra en contabilidad'
              )}
            </button>

            <p className="text-[11px] text-amber-200/90 text-center leading-relaxed">
              Tras confirmar, pulse <strong className="text-amber-100">Ingreso a almacén</strong>.
              Cada línea debe traer <strong className="text-amber-100">item_code (SKU)</strong>{' '}
              igual al catálogo Almacén; si falta, edite la factura antes del ingreso.
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
