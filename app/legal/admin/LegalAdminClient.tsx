'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, X, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import { useAccesoLegal } from '@/lib/legal/AccesoLegalContext';

type Solicitud = {
  id: string;
  nombre_despacho: string;
  contacto_nombre: string;
  email: string;
  telefono: string | null;
  plan_solicitado: string;
  mensaje: string | null;
  estado: string;
  created_at: string;
};

export default function LegalAdminClient() {
  const acceso = useAccesoLegal();
  const [items, setItems] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const esDuenio = acceso.plan === 'owner' || acceso.motivo === 'owner';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/legal/solicitudes/admin?estado=pendiente'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        solicitudes?: Solicitud[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        setItems([]);
        return;
      }
      setItems(data.solicitudes ?? []);
    } catch {
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (esDuenio) void cargar();
  }, [esDuenio, cargar]);

  async function aprobar(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(apiUrl(`/api/legal/solicitudes/${id}/aprobar`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { error?: string; mensaje?: string; hint?: string };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      toast.success(data.mensaje || 'Aprobado e invitado');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyId(null);
    }
  }

  async function rechazar(id: string) {
    if (!confirm('¿Rechazar esta solicitud?')) return;
    setBusyId(id);
    try {
      const res = await fetch(apiUrl(`/api/legal/solicitudes/${id}/rechazar`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Error');
        return;
      }
      toast.success('Solicitud rechazada');
      void cargar();
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyId(null);
    }
  }

  if (acceso.loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </p>
    );
  }

  if (!esDuenio) {
    return (
      <div className="rounded-2xl border border-white/10 px-5 py-10 text-center">
        <p className="text-sm text-zinc-400">
          Este panel es solo para el dueño de Casa Inteligente.
        </p>
        <Link href="/legal" className="mt-3 inline-block text-sm text-amber-300">
          ← Resumen
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-sm text-amber-200/80">
          <Inbox className="h-4 w-4" />
          Comercial · módulo abogado
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">Solicitudes de acceso</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Aprueba para invitar por correo, crear la org standalone y dar acceso a{' '}
          <code className="text-zinc-400">/legal</code>. Landing pública:{' '}
          <Link href="/abogado" className="text-amber-300 hover:underline">
            /abogado
          </Link>
          .
        </p>
      </header>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-zinc-500">
          No hay solicitudes pendientes.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((s) => {
            const busy = busyId === s.id;
            return (
              <li
                key={s.id}
                className="rounded-2xl border border-white/10 bg-[#0c1018] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-100">{s.nombre_despacho}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {s.contacto_nombre} · {s.email}
                      {s.telefono ? ` · ${s.telefono}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-amber-200/80">
                      Plan: {s.plan_solicitado} ·{' '}
                      {new Date(s.created_at).toLocaleString('es-VE')}
                    </p>
                    {s.mensaje ? (
                      <p className="mt-2 text-xs text-zinc-400">{s.mensaje}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void aprobar(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Aprobar e invitar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void rechazar(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Rechazar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
