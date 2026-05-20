'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Trash2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

type Pendiente = {
  id: string;
  canal: string;
  chat_id: string;
  chat_label: string | null;
  estado: string;
  document_file_name: string | null;
  extracted: {
    invoice_number?: string;
    supplier_name?: string;
    supplier_rif?: string;
    total_amount?: number | null;
    items?: unknown[];
  } | null;
  mensaje_error: string | null;
  created_at: string;
};

export default function FacturasCanalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('pendiente');
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/facturas-canal/pendientes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendientes(data.pendientes ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const abrirEnRecepcion = (p: Pendiente) => {
    if (p.estado !== 'extraido' || !p.extracted) {
      toast.error('La factura aún no está lista o falló la extracción');
      return;
    }
    sessionStorage.setItem(
      'telegram_pending_invoice',
      JSON.stringify({ pendingId: p.id, extracted: p.extracted }),
    );
    router.push(`/almacen/procurement?fromTelegram=${p.id}`);
  };

  const rechazar = async (id: string) => {
    if (!window.confirm('¿Rechazar esta factura pendiente?')) return;
    const res = await fetch(`/api/facturas-canal/pendientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'rechazado' }),
    });
    if (!res.ok) {
      toast.error('No se pudo rechazar');
      return;
    }
    setPendientes((prev) => prev.filter((p) => p.id !== id));
    toast.success('Rechazada');
  };

  const borrar = async (id: string) => {
    if (!window.confirm('¿Eliminar registro?')) return;
    const res = await fetch(`/api/facturas-canal/pendientes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('No se pudo borrar');
      return;
    }
    setPendientes((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white px-4 py-8 md:px-8 max-w-4xl mx-auto">
      <Link
        href="/contabilidad/compras"
        className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a compras
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-sky-400" />
            Facturas por Telegram
          </h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Envía fotos o PDF de facturas al bot. Se extraen con IA y quedan aquí para confirmar en
            recepción de mercancía.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Variables: <code className="text-zinc-400">TELEGRAM_BOT_TOKEN</code>,{' '}
            <code className="text-zinc-400">TELEGRAM_ALLOWED_CHAT_IDS</code> (opcional, separados
            por coma). Webhook:{' '}
            <code className="text-zinc-400 break-all">/api/webhooks/telegram</code>
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

      {loading ? (
        <div className="flex gap-2 text-zinc-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : pendientes.length === 0 ? (
        <p className="text-sm text-zinc-500 rounded-xl border border-white/10 p-8 text-center">
          No hay facturas pendientes. Envía una foto al bot de Telegram configurado.
        </p>
      ) : (
        <ul className="space-y-3">
          {pendientes.map((p) => (
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
                    {p.extracted?.invoice_number
                      ? `#${p.extracted.invoice_number}`
                      : 'Sin número'}{' '}
                    · {p.extracted?.supplier_name ?? 'Proveedor'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {p.canal} · {p.chat_label ?? p.chat_id} ·{' '}
                    <span
                      className={
                        p.estado === 'extraido'
                          ? 'text-emerald-400'
                          : p.estado === 'error'
                            ? 'text-red-400'
                            : 'text-amber-400'
                      }
                    >
                      {p.estado}
                    </span>
                  </p>
                  {p.mensaje_error ? (
                    <p className="text-xs text-red-400 mt-1">{p.mensaje_error}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.estado === 'extraido' ? (
                    <button
                      type="button"
                      onClick={() => abrirEnRecepcion(p)}
                      className="rounded-lg bg-[#34C759] text-black text-xs font-semibold px-3 py-2 flex items-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir en recepción
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
                    onClick={() => void borrar(p.id)}
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
    </div>
  );
}
