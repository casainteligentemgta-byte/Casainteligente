'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Trash2,
  ExternalLink,
  RefreshCw,
  Filter,
  Pencil,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import EditarFacturaCanalModal from '@/components/contabilidad/EditarFacturaCanalModal';
import { linkConfirmarCompraTelegram } from '@/lib/contabilidad/confirmarCompraDesdeCanal';
import type { ExtractedCanalHeader } from '@/lib/contabilidad/extractedCanal';
import {
  actualizarPendienteCanal,
  eliminarPendienteCanal,
  listarPendientesCanal,
  type PendienteCanal,
} from '@/lib/contabilidad/facturaCanalApi';
import {
  aplanarFacturasCanal,
  filtrarFilasFacturaCanal,
  pendienteIdsDesdeFilas,
  type FilaFacturaCanal,
  type FiltrosFacturaCanal,
} from '@/lib/contabilidad/filtrosFacturaCanal';
import { esNotaEntregaExtracted } from '@/lib/telegram/notaEntregaRegistro';

type Pendiente = PendienteCanal;

type EstadoCanalTelegram = {
  totalPendientes: number;
  supabaseOk: boolean;
  telegramToken: boolean;
  webhookUrl: string | null;
  webhookEsperado: string;
  webhookOk: boolean;
  webhookPending: number;
  webhookError: string | null;
};

const TITULO_PANEL = 'Cargas de facturas (Telegram)';

async function copiarAlPortapapeles(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-sky-500/50';

export default function FacturasCanalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('pendiente');
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [vista, setVista] = useState<'facturas' | 'lineas'>('facturas');

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [rif, setRif] = useState('');
  const [articulo, setArticulo] = useState('');
  const [cantidadMin, setCantidadMin] = useState('');
  const [cantidadMax, setCantidadMax] = useState('');
  const [montoMinBs, setMontoMinBs] = useState('');
  const [montoMaxBs, setMontoMaxBs] = useState('');
  const [montoMinUsd, setMontoMinUsd] = useState('');
  const [montoMaxUsd, setMontoMaxUsd] = useState('');
  const [editando, setEditando] = useState<Pendiente | null>(null);
  const [estadoCanal, setEstadoCanal] = useState<EstadoCanalTelegram | null>(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);

  const filtros: FiltrosFacturaCanal = useMemo(
    () => ({
      fechaDesde,
      fechaHasta,
      proveedor,
      rif,
      articulo,
      cantidadMin,
      cantidadMax,
      montoMinBs,
      montoMaxBs,
      montoMinUsd,
      montoMaxUsd,
    }),
    [
      fechaDesde,
      fechaHasta,
      proveedor,
      rif,
      articulo,
      cantidadMin,
      cantidadMax,
      montoMinBs,
      montoMaxBs,
      montoMinUsd,
      montoMaxUsd,
    ],
  );

  const todasFilas = useMemo(() => aplanarFacturasCanal(pendientes), [pendientes]);
  const filasFiltradas = useMemo(
    () => filtrarFilasFacturaCanal(todasFilas, filtros),
    [todasFilas, filtros],
  );
  const idsVisibles = useMemo(() => pendienteIdsDesdeFilas(filasFiltradas), [filasFiltradas]);

  const hayFiltrosActivos = useMemo(
    () =>
      Boolean(
        fechaDesde ||
          fechaHasta ||
          proveedor ||
          rif ||
          articulo ||
          cantidadMin ||
          cantidadMax ||
          montoMinBs ||
          montoMaxBs ||
          montoMinUsd ||
          montoMaxUsd,
      ),
    [
      fechaDesde,
      fechaHasta,
      proveedor,
      rif,
      articulo,
      cantidadMin,
      cantidadMax,
      montoMinBs,
      montoMaxBs,
      montoMinUsd,
      montoMaxUsd,
    ],
  );

  const pendientesFiltrados = useMemo(() => {
    if (vista === 'facturas' && !hayFiltrosActivos) {
      return pendientes;
    }
    if (filasFiltradas.length === 0 && !hayFiltrosActivos) {
      return pendientes;
    }
    return pendientes.filter((p) => idsVisibles.has(p.id));
  }, [pendientes, idsVisibles, vista, hayFiltrosActivos, filasFiltradas.length]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, estadoRes] = await Promise.all([
        listarPendientesCanal('panel_canal'),
        fetch('/api/facturas-canal/estado', { cache: 'no-store' }),
      ]);
      setPendientes(lista);
      if (estadoRes.ok) {
        setEstadoCanal((await estadoRes.json()) as EstadoCanalTelegram);
      } else {
        setEstadoCanal(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const p = pendientes.find((x) => x.id === highlightId);
    if (p && ['extraido', 'error'].includes(p.estado)) {
      router.replace(`/contabilidad/compras/telegram/${highlightId}`);
    }
  }, [highlightId, loading, pendientes, router]);

  const limpiarFiltros = () => {
    setFechaDesde('');
    setFechaHasta('');
    setProveedor('');
    setRif('');
    setArticulo('');
    setCantidadMin('');
    setCantidadMax('');
    setMontoMinBs('');
    setMontoMaxBs('');
    setMontoMinUsd('');
    setMontoMaxUsd('');
  };

  const irRegistrarCompra = (p: Pendiente) => {
    if (!['extraido', 'error'].includes(p.estado)) {
      toast.error('La factura aún no está lista');
      return;
    }
    router.push(`/contabilidad/compras/telegram/${p.id}`);
  };

  const copiarLinkRegistro = async (pendienteId: string) => {
    const base =
      typeof window !== 'undefined' ? window.location.origin : undefined;
    const url = linkConfirmarCompraTelegram(pendienteId, base);
    const ok = await copiarAlPortapapeles(url);
    if (!ok) {
      toast.error('No se pudo copiar el enlace');
      return;
    }
    setLinkCopiadoId(pendienteId);
    toast.success('Enlace copiado');
    window.setTimeout(() => {
      setLinkCopiadoId((prev) => (prev === pendienteId ? null : prev));
    }, 2000);
  };

  const rechazar = async (facturaId: string) => {
    if (!window.confirm('¿Rechazar esta factura? No se registrará en compras.')) return;
    try {
      await actualizarPendienteCanal(facturaId, { estado: 'rechazado' });
      setPendientes((prev) => prev.filter((x) => x.id !== facturaId));
      toast.success('Rechazada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo rechazar');
    }
  };

  const borrar = async (facturaId: string, estado?: string) => {
    const vinculadaContabilidad =
      estado === 'confirmado' || estado === 'rechazado';
    const aviso = vinculadaContabilidad
      ? '¿Eliminar esta factura del canal y quitarla del listado de compras?\n\nSi el material ya ingresó al inventario, permanecerá en stock (solo se borra el registro de la factura).'
      : '¿Eliminar esta factura del canal? Se perderá la imagen y los datos extraídos.';
    if (!window.confirm(aviso)) return;
    try {
      const r = await eliminarPendienteCanal(facturaId, {
        eliminarComprasVinculadas: vinculadaContabilidad,
      });
      setPendientes((prev) => prev.filter((x) => x.id !== facturaId));
      if (r.materialPermaneceEnStock) {
        toast.success(
          'Eliminada del listado. El material sigue en inventario porque ya estaba aprobado.',
          { duration: 6000 },
        );
      } else {
        toast.success('Eliminada');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar');
    }
  };

  const guardarEdicion = async (extracted: ExtractedCanalHeader) => {
    if (!editando) return;
    const patch: { extracted: ExtractedCanalHeader; estado?: string; mensaje_error?: null } = {
      extracted,
      mensaje_error: null,
    };
    if (editando.estado === 'error') {
      patch.estado = 'extraido';
    }
    const actualizado = await actualizarPendienteCanal(editando.id, patch);
    setPendientes((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)));
    toast.success('Factura actualizada');
  };

  const puedeEditar = (p: Pendiente) =>
    Boolean(p.extracted) && !['procesando', 'pendiente'].includes(p.estado);

  return (
    <div className="min-h-screen bg-[#050508] text-white px-4 py-8 md:px-8 max-w-6xl mx-auto">
      <Link
        href="/contabilidad/compras"
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a compras
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" suppressHydrationWarning>
            <MessageCircle className="h-6 w-6 text-sky-400" />
            {TITULO_PANEL}
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl">
            Facturas enviadas al bot. Corrija los datos extraídos por IA y registre la compra en contabilidad (sin inventario ni
            recepción de mercancía).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5 inline mr-1" />
          Actualizar
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-violet-400" />
          <p className="text-xs font-bold uppercase text-zinc-400">Filtros</p>
          {hayFiltrosActivos ? (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="ml-auto text-[11px] text-zinc-500 hover:text-white"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <div>
            <label className="text-[10px] font-bold text-zinc-500">FECHA DESDE</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">FECHA HASTA</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">PROVEEDOR</label>
            <input
              type="search"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Nombre"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">RIF</label>
            <input
              type="search"
              value={rif}
              onChange={(e) => setRif(e.target.value)}
              placeholder="J-…"
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÍN. (Bs)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMinBs}
              onChange={(e) => setMontoMinBs(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÁX. (Bs)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMaxBs}
              onChange={(e) => setMontoMaxBs(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÍN. (USD)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMinUsd}
              onChange={(e) => setMontoMinUsd(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">MONTO MÁX. (USD)</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoMaxUsd}
              onChange={(e) => setMontoMaxUsd(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="text-[10px] font-bold text-zinc-500">ARTÍCULO</label>
            <input
              type="search"
              value={articulo}
              onChange={(e) => setArticulo(e.target.value)}
              placeholder="Descripción o código"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">CANT. MÍN.</label>
            <input
              type="text"
              inputMode="decimal"
              value={cantidadMin}
              onChange={(e) => setCantidadMin(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-500">CANT. MÁX.</label>
            <input
              type="text"
              inputMode="decimal"
              value={cantidadMax}
              onChange={(e) => setCantidadMax(e.target.value)}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-violet-300/90">
          {filasFiltradas.length} línea(s) · {pendientesFiltrados.length} factura(s) con estos filtros
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setVista('lineas')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            vista === 'lineas' ? 'bg-white/15 text-white' : 'text-zinc-500'
          }`}
        >
          Por línea / artículo
        </button>
        <button
          type="button"
          onClick={() => setVista('facturas')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            vista === 'facturas' ? 'bg-white/15 text-white' : 'text-zinc-500'
          }`}
        >
          Por factura
        </button>
      </div>

      {loading ? (
        <div className="flex gap-2 text-zinc-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : vista === 'lineas' ? (
        <TablaLineas
          filas={filasFiltradas}
          highlightId={highlightId}
          onAbrir={(id) => {
            const p = pendientes.find((x) => x.id === id);
            if (p) irRegistrarCompra(p);
          }}
          onCopiarLink={(id) => void copiarLinkRegistro(id)}
          linkCopiadoId={linkCopiadoId}
        />
      ) : pendientesFiltrados.length === 0 ? (
        <div className="rounded-xl border border-white/10 p-8 text-center space-y-4">
          <p className="text-sm text-zinc-400">
            {pendientes.length === 0
              ? 'No hay facturas en cola todavía.'
              : 'No hay facturas que coincidan con los filtros.'}
          </p>
          {pendientes.length === 0 ? (
            <>
              <ol className="text-left text-sm text-zinc-500 space-y-2 max-w-md mx-auto list-decimal pl-5">
                <li>Abre el bot de Telegram de Casa Inteligente.</li>
                <li>
                  Envía <span className="font-mono text-sky-300/90">/entrada</span> (nota de entrega del
                  depositario) o{' '}
                  <span className="font-mono text-sky-300/90">/factura</span> (factura completa).
                </li>
                <li>Adjunta la foto o PDF del documento (cámara, fototeca o archivo).</li>
                <li>Vuelve aquí y pulsa Actualizar; la factura aparecerá en unos segundos.</li>
              </ol>
              {estadoCanal ? (
                <div className="flex flex-wrap justify-center gap-2 pt-2 text-[11px] font-semibold">
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      estadoCanal.telegramToken
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-red-500/15 text-red-300'
                    }`}
                  >
                    Bot {estadoCanal.telegramToken ? 'OK' : 'sin token'}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      estadoCanal.webhookOk
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-200'
                    }`}
                  >
                    Webhook {estadoCanal.webhookOk ? 'OK' : 'revisar'}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      estadoCanal.supabaseOk
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-red-500/15 text-red-300'
                    }`}
                  >
                    Supabase {estadoCanal.supabaseOk ? 'OK' : 'sin service role'}
                  </span>
                </div>
              ) : null}
              {estadoCanal && !estadoCanal.telegramToken ? (
                <p className="text-xs text-red-300/90 max-w-lg mx-auto leading-relaxed">
                  Falta <span className="font-mono">TELEGRAM_BOT_TOKEN</span> en el servidor (Vercel →
                  Environment Variables → Production). Sin token, Telegram recibe 503 o el webhook falla.
                  Tras añadirlo, redeploy y ejecute{' '}
                  <span className="font-mono">npm run telegram:webhook</span>.
                </p>
              ) : null}
              {estadoCanal && !estadoCanal.webhookOk ? (
                <p className="text-xs text-amber-200/90 max-w-lg mx-auto leading-relaxed">
                  Webhook esperado:{' '}
                  <span className="font-mono break-all">{estadoCanal.webhookEsperado}</span>
                  {estadoCanal.webhookUrl ? (
                    <>
                      <br />
                      Actual: <span className="font-mono break-all">{estadoCanal.webhookUrl}</span>
                    </>
                  ) : null}
                  . Ejecute <span className="font-mono">npm run telegram:webhook</span> y configure{' '}
                  <span className="font-mono">TELEGRAM_BOT_TOKEN</span> y{' '}
                  <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> en Vercel.
                </p>
              ) : null}
              {estadoCanal?.webhookError ? (
                <p className="text-xs text-red-300/90 max-w-lg mx-auto">
                  Telegram reporta: {estadoCanal.webhookError}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {pendientesFiltrados.map((p) => (
            <li
              key={p.id}
              className={`rounded-xl border p-4 ${
                highlightId === p.id
                  ? 'border-sky-500/50 bg-sky-950/20'
                  : 'border-white/10 bg-zinc-900/60'
              }`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {p.extracted?.invoice_number ? `#${p.extracted.invoice_number}` : 'Sin número'} ·{' '}
                    {p.extracted?.supplier_name ?? 'Proveedor'}
                    {esNotaEntregaExtracted(p.extracted as Record<string, unknown> | null) ? (
                      <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                        Nota entrega · factura pendiente
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    <span className="text-violet-300/90 uppercase">{p.estado}</span>
                    {' · '}
                    {p.extracted?.date ?? '—'} · RIF {p.extracted?.supplier_rif ?? '—'} ·{' '}
                    {p.extracted?.total_amount != null ? `${p.extracted.total_amount} Bs` : '—'} · {p.canal}
                  </p>
                  {p.estado === 'error' && p.mensaje_error ? (
                    <p className="text-xs text-red-400/90 mt-1">{p.mensaje_error}</p>
                  ) : null}
                  {p.estado === 'pendiente' || p.estado === 'procesando' ? (
                    <p className="text-xs text-amber-400/90 mt-1">Procesando con IA… actualiza en unos segundos.</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copiarLinkRegistro(p.id)}
                    className="rounded-lg border border-white/10 text-xs px-3 py-2 text-zinc-300 hover:bg-white/5 flex items-center gap-1"
                    title="Copiar enlace directo para registrar la compra"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {linkCopiadoId === p.id ? 'Copiado' : 'Copiar enlace'}
                  </button>
                  {p.estado === 'extraido' || p.estado === 'error' ? (
                    <button
                      type="button"
                      onClick={() => irRegistrarCompra(p)}
                      className="rounded-lg bg-[#34C759] text-black text-xs font-semibold px-3 py-2 flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Registrar compra
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void rechazar(p.id)}
                    className="rounded-lg border border-white/10 text-xs px-3 py-2 text-zinc-400"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => void borrar(p.id, p.estado)}
                    className="text-red-400 hover:text-red-300 p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EditarFacturaCanalModal
        open={editando != null}
        extracted={editando?.extracted ?? null}
        onClose={() => setEditando(null)}
        onGuardar={guardarEdicion}
      />
    </div>
  );
}

function TablaLineas({
  filas,
  highlightId,
  onAbrir,
  onCopiarLink,
  linkCopiadoId,
}: {
  filas: FilaFacturaCanal[];
  highlightId: string | null;
  onAbrir: (pendienteId: string) => void;
  onCopiarLink: (pendienteId: string) => void;
  linkCopiadoId: string | null;
}) {
  if (filas.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-xl border border-white/10 p-8 text-center">
        Sin líneas con estos filtros. Envía una factura al bot o amplía los criterios.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-xs">
        <thead className="bg-white/5 text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-left">Factura</th>
            <th className="px-3 py-2 text-left">Proveedor</th>
            <th className="px-3 py-2 text-left">RIF</th>
            <th className="px-3 py-2 text-left">Artículo</th>
            <th className="px-3 py-2 text-right">Cant.</th>
            <th className="px-3 py-2 text-right">P.U. Bs</th>
            <th className="px-3 py-2 text-right">Subtotal Bs</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {filas.map((row, i) => {
            const subtotal = row.esLinea
              ? row.cantidad * row.precioUnitario
              : row.montoBs;
            return (
              <tr
                key={`${row.pendienteId}-${i}`}
                className={`border-t border-white/5 ${
                  highlightId === row.pendienteId ? 'bg-sky-950/25' : ''
                }`}
              >
                <td className="px-3 py-2 whitespace-nowrap">{row.fecha || '—'}</td>
                <td className="px-3 py-2 font-mono">{row.factura || '—'}</td>
                <td className="px-3 py-2 max-w-[140px] truncate">{row.proveedor}</td>
                <td className="px-3 py-2 text-zinc-400">{row.rif}</td>
                <td className="px-3 py-2 max-w-[180px] truncate">
                  {row.esLinea ? row.articulo : <span className="text-zinc-600">(cabecera)</span>}
                </td>
                <td className="px-3 py-2 text-right">{row.esLinea ? row.cantidad : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {row.esLinea ? row.precioUnitario.toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{subtotal.toLocaleString()}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onAbrir(row.pendienteId)}
                    className="text-sky-400 hover:text-sky-300 text-[11px] font-semibold mr-2"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => onCopiarLink(row.pendienteId)}
                    className="text-zinc-400 hover:text-zinc-200 text-[11px] font-semibold"
                    title="Copiar enlace de registro"
                  >
                    {linkCopiadoId === row.pendienteId ? 'Copiado' : 'Enlace'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
