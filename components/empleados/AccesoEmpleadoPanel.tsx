'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  provisionarAccesoEmpleadoClient,
  resetPasswordEmpleadoClient,
} from '@/lib/auth/clientEmployeeAccess';
import type { ProvisionMode } from '@/lib/auth/provisionEmployee';
import { ROLES_EMPRESA } from '@/lib/auth/permisosCatalogo';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type EntidadOpcion = { id: string; nombre: string };

type Props = {
  employeeId: string;
  email: string;
  nombres?: string;
  apellidos?: string;
  authUserId?: string | null;
  accesoHabilitado?: boolean;
  className?: string;
  onChanged?: (next: { authUserId: string | null; accesoHabilitado: boolean }) => void;
};

export default function AccesoEmpleadoPanel({
  employeeId,
  email,
  nombres,
  apellidos,
  authUserId: authUserIdProp,
  accesoHabilitado: accesoProp,
  className,
  onChanged,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [authUserId, setAuthUserId] = useState<string | null>(authUserIdProp ?? null);
  const [acceso, setAcceso] = useState(Boolean(accesoProp));
  const [mode, setMode] = useState<ProvisionMode>('invite');
  const [rol, setRol] = useState('solo_lectura');
  const [entidadId, setEntidadId] = useState('');
  const [entidades, setEntidades] = useState<EntidadOpcion[]>([]);
  const [busy, setBusy] = useState(false);
  const [oneTime, setOneTime] = useState<string | null>(null);

  useEffect(() => {
    setAuthUserId(authUserIdProp ?? null);
    setAcceso(Boolean(accesoProp));
  }, [authUserIdProp, accesoProp]);

  const cargarEntidades = useCallback(async () => {
    const { data } = await supabase
      .from('ci_entidades')
      .select('id,nombre')
      .order('nombre', { ascending: true });
    setEntidades((data ?? []) as EntidadOpcion[]);
  }, [supabase]);

  useEffect(() => {
    void cargarEntidades();
  }, [cargarEntidades]);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  async function habilitar() {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim.includes('@')) {
      toast.error('Guarda un correo válido en la ficha antes de habilitar el acceso');
      return;
    }
    setBusy(true);
    setOneTime(null);
    try {
      const res = await provisionarAccesoEmpleadoClient({
        employeeId,
        email: emailTrim,
        nombres,
        apellidos,
        mode,
        rol: entidadId ? rol : null,
        entidadId: entidadId || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      if (res.oneTimePassword) setOneTime(res.oneTimePassword);
      setAcceso(true);
      onChanged?.({ authUserId: authUserId ?? 'linked', accesoHabilitado: true });
      // Recargar auth_user_id desde BD
      const { data } = await supabase
        .from('employees')
        .select('auth_user_id, acceso_habilitado')
        .eq('id', employeeId)
        .maybeSingle();
      if (data) {
        const uid = (data as { auth_user_id?: string | null }).auth_user_id ?? null;
        const hab = Boolean((data as { acceso_habilitado?: boolean }).acceso_habilitado);
        setAuthUserId(uid);
        setAcceso(hab);
        onChanged?.({ authUserId: uid, accesoHabilitado: hab });
      }
    } finally {
      setBusy(false);
    }
  }

  async function regenerar() {
    if (
      !confirm(
        '¿Regenerar una clave de un solo uso? La anterior dejará de funcionar y el empleado deberá cambiarla al entrar.',
      )
    ) {
      return;
    }
    setBusy(true);
    setOneTime(null);
    try {
      const res = await resetPasswordEmpleadoClient(employeeId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      if (res.oneTimePassword) setOneTime(res.oneTimePassword);
      setAcceso(true);
    } finally {
      setBusy(false);
    }
  }

  const emailOk = email.trim().includes('@');

  return (
    <section
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.03] p-5',
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#5AC8FA]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-white">Acceso web</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            Invita por correo (recomendado) o genera una clave aleatoria de un solo uso.
            Nunca se usa una clave fija.
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold',
            acceso
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-zinc-500/15 text-zinc-400',
          )}
        >
          {acceso ? 'Habilitado' : 'Sin acceso'}
        </span>
      </div>

      <dl className="mb-4 grid gap-2 text-sm text-zinc-300">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Correo</dt>
          <dd className="truncate font-medium text-white">{emailOk ? email : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Usuario Auth</dt>
          <dd className="font-mono text-xs text-zinc-400">
            {authUserId ? `${authUserId.slice(0, 8)}…` : 'No vinculado'}
          </dd>
        </div>
      </dl>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Método
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ProvisionMode)}
            disabled={busy}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#007AFF]/50"
          >
            <option value="invite">Invitación por correo</option>
            <option value="password">Clave de un solo uso</option>
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Rol (opcional)
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            disabled={busy || !entidadId}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#007AFF]/50 disabled:opacity-50"
          >
            {ROLES_EMPRESA.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
          Entidad / patrono (opcional, para asignar rol)
          <select
            value={entidadId}
            onChange={(e) => setEntidadId(e.target.value)}
            disabled={busy}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#007AFF]/50"
          >
            <option value="">Sin rol de app por ahora</option>
            {entidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !emailOk}
          onClick={() => void habilitar()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {mode === 'invite' ? (
            <Mail className="h-4 w-4" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          {acceso ? 'Reenviar / vincular' : 'Habilitar acceso'}
        </button>
        <button
          type="button"
          disabled={busy || !authUserId}
          onClick={() => void regenerar()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerar clave
        </button>
      </div>

      {oneTime ? (
        <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Clave de un solo uso (mostrar una vez)
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-sm text-white">
              {oneTime}
            </code>
            <button
              type="button"
              onClick={() => void copiar(oneTime)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-200/80">
            Entrégala por un canal seguro. El empleado deberá cambiarla en el primer ingreso.
          </p>
        </div>
      ) : null}
    </section>
  );
}
