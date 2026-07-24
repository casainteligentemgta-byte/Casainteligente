'use client';

import { Bell, UserCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export type FeedNotificacionesRealtimeProps = {
  /** UUID de `ci_proyectos` (misma ruta que `[id]`). */
  proyectoId: string;
  /** Cambia a la pestaña «Gestión de Talento» en el detalle del proyecto. */
  onIrGestionTalento?: () => void;
};

type NotificacionRow = {
  id: string;
  proyecto_id: string;
  mensaje: string;
  tipo: string;
  empleado_id: string | null;
  leida: boolean;
  created_at: string;
};

const MAX_NO_LEIDAS = 5;

function mergeUniqById(prev: NotificacionRow[], incoming: NotificacionRow[]): NotificacionRow[] {
  const map = new Map<string, NotificacionRow>();
  for (const r of incoming) map.set(r.id, r);
  for (const r of prev) if (!map.has(r.id)) map.set(r.id, r);
  return Array.from(map.values())
    .filter((r) => !r.leida)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_NO_LEIDAS);
}

export default function FeedNotificacionesRealtime({
  proyectoId,
  onIrGestionTalento,
}: FeedNotificacionesRealtimeProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<NotificacionRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const botonRef = useRef<HTMLButtonElement | null>(null);

  const pid = proyectoId.trim();

  const cargarNoLeidas = useCallback(async () => {
    if (!pid) return;
    setCargando(true);
    setErrorCarga(null);
    const { data, error } = await supabase
      .from('ci_notificaciones')
      .select('id,proyecto_id,mensaje,tipo,empleado_id,leida,created_at')
      .eq('proyecto_id', pid)
      .eq('leida', false)
      .order('created_at', { ascending: false })
      .limit(MAX_NO_LEIDAS);
    setCargando(false);
    if (error) {
      setItems([]);
      setErrorCarga(error.message);
      return;
    }
    setItems((data ?? []) as NotificacionRow[]);
  }, [pid, supabase]);

  useEffect(() => {
    void cargarNoLeidas();
  }, [cargarNoLeidas]);

  useEffect(() => {
    if (!pid) return;

    const channel = supabase
      .channel(`ci_notificaciones:${pid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ci_notificaciones',
          filter: `proyecto_id=eq.${pid}`,
        },
        (payload) => {
          const row = payload.new as NotificacionRow | undefined;
          if (!row?.id || row.leida) return;
          setItems((prev) => mergeUniqById(prev, [row]));
          toast.success('Nueva notificación', {
            description: row.mensaje ?? 'Sin mensaje',
            duration: 5200,
          });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[FeedNotificacionesRealtime]', status, err?.message ?? err);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pid, supabase]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || botonRef.current?.contains(t)) return;
      setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, [abierto]);

  const marcarLeida = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('ci_notificaciones').update({ leida: true }).eq('id', id);
      if (error) {
        toast.error('No se pudo marcar como leída', { description: error.message });
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
    },
    [supabase],
  );

  const alClicNotificacion = useCallback(
    async (n: NotificacionRow) => {
      await marcarLeida(n.id);
      setAbierto(false);
      if (n.empleado_id) {
        router.push(`/empleados/${encodeURIComponent(n.empleado_id)}`);
        return;
      }
      onIrGestionTalento?.();
    },
    [marcarLeida, onIrGestionTalento, router],
  );

  if (!pid) return null;

  return (
    <div className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 backdrop-blur-md transition hover:scale-105 hover:border-[#FF9500]/40 hover:text-white"
        aria-expanded={abierto}
        aria-haspopup="dialog"
        title="Notificaciones"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {items.length > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#FF9500] shadow-[0_0_10px_#FF9500]" />
        ) : null}
      </button>

      {abierto ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notificaciones del proyecto"
          className="absolute right-0 z-[60] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/50 backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">Actividad</span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg p-1 text-zinc-500 transition hover:scale-105 hover:bg-white/10 hover:text-white"
              title="Cerrar"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto px-2 py-2">
            {cargando ? (
              <p className="px-2 py-4 text-center text-xs text-zinc-500">Cargando…</p>
            ) : errorCarga ? (
              <p className="px-2 py-3 text-center text-xs text-amber-400/95">{errorCarga}</p>
            ) : items.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-zinc-500">Sin notificaciones sin leer.</p>
            ) : (
              <ul className="space-y-1">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void alClicNotificacion(n)}
                      className="flex w-full items-start gap-2 rounded-xl px-2 py-2.5 text-left transition hover:scale-[1.02] hover:bg-white/10"
                    >
                      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                        {n.empleado_id ? (
                          <UserCheck className="h-4 w-4 text-[#FF9500]" aria-hidden />
                        ) : (
                          <Bell className="h-4 w-4 text-zinc-400" aria-hidden />
                        )}
                        {!n.leida ? (
                          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FF9500] shadow-[0_0_8px_#FF9500]" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-3 text-xs leading-snug text-zinc-100">{n.mensaje}</span>
                        <span className="mt-1 block text-[10px] text-zinc-600">
                          {new Date(n.created_at).toLocaleString('es-VE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
