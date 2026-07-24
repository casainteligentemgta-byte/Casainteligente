'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Loader2, Scale, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  PLANES_LEGAL_COMERCIALES,
  planComercialPorId,
  type PlanLegalComercialId,
} from '@/lib/legal/planesLegalComercial';

const campo =
  'mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500/40';

function RegistroForm() {
  const search = useSearchParams();
  const planParam = search.get('plan') || 'trial';
  const planInicial = (planComercialPorId(planParam)?.id ?? 'trial') as PlanLegalComercialId;

  const [plan, setPlan] = useState<PlanLegalComercialId>(planInicial);
  const [nombreDespacho, setNombreDespacho] = useState('');
  const [contacto, setContacto] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);

  const planInfo = useMemo(() => planComercialPorId(plan), [plan]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreDespacho.trim() || !contacto.trim() || !email.trim()) {
      toast.error('Completa despacho, contacto y correo');
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(apiUrl('/api/legal/solicitudes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_despacho: nombreDespacho.trim(),
          contacto_nombre: contacto.trim(),
          email: email.trim(),
          telefono: telefono.trim() || null,
          plan_solicitado: plan,
          mensaje: mensaje.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        toast.error([data.error, data.hint].filter(Boolean).join(' — ') || 'Error');
        return;
      }
      setOk(true);
      toast.success('Solicitud enviada');
    } catch {
      toast.error('Error de red');
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-6 py-10 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <h1 className="mt-4 text-xl font-bold text-white">Solicitud recibida</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Revisaremos tu pedido del plan <strong className="text-zinc-200">{planInfo?.nombre}</strong>{' '}
          y te enviaremos la invitación a <strong className="text-zinc-200">{email}</strong>.
        </p>
        <Link href="/abogado" className="mt-6 inline-block text-sm font-semibold text-amber-300">
          ← Volver al producto
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <Scale className="mx-auto h-8 w-8 text-amber-300" />
        <h1 className="mt-3 text-2xl font-bold text-white">Solicitar acceso</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Módulo Abogado independiente · sin CRM de obras
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-4 rounded-2xl border border-amber-500/20 bg-[#0c1018] p-5"
      >
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">Plan</label>
          <select
            className={campo}
            value={plan}
            onChange={(e) => setPlan(e.target.value as PlanLegalComercialId)}
          >
            {PLANES_LEGAL_COMERCIALES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.precioLabel}
                {p.periodo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">
            Nombre del despacho *
          </label>
          <input
            className={campo}
            value={nombreDespacho}
            onChange={(e) => setNombreDespacho(e.target.value)}
            placeholder="Estudio Pérez & Asociados"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">
            Tu nombre *
          </label>
          <input
            className={campo}
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">Correo *</label>
          <input
            type="email"
            className={campo}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">Teléfono</label>
          <input
            className={campo}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+58…"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-zinc-500">
            Comentario (opcional)
          </label>
          <textarea
            className={`${campo} min-h-[80px]`}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar solicitud
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-zinc-600">
        <Link href="/abogado" className="text-zinc-400 hover:text-zinc-200">
          ← Planes
        </Link>
        {' · '}
        <Link href="/login?next=/legal" className="text-zinc-400 hover:text-zinc-200">
          Ya tengo acceso
        </Link>
      </p>
    </div>
  );
}

export default function AbogadoRegistroPage() {
  return (
    <div className="px-4 py-12">
      <Suspense
        fallback={
          <div className="flex justify-center py-20 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        }
      >
        <RegistroForm />
      </Suspense>
    </div>
  );
}
