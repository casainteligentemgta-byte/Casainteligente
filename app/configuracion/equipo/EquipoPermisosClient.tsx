'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Loader2,
  MessageCircle,
  Shield,
  Users,
  UserCog,
} from 'lucide-react';
import AsignarRolUsuario from '@/components/configuracion/AsignarRolUsuario';
import InvitarUsuarioAcceso from '@/components/configuracion/InvitarUsuarioAcceso';
import { Badge } from '@/components/ui/badge';
import { PERMISOS, ROLES_EMPRESA } from '@/lib/auth/permisosCatalogo';

type PermisosPayload = {
  enforcement: boolean;
  roles_empresa: string[];
  roles_obra: Array<{ proyectoId: string; rol: string; nombre?: string | null }>;
  permisos: string[];
  usuario?: { email?: string };
};

type FilaRol = {
  id: string;
  rol: string;
  entidad_id: string;
  ci_entidades?: { nombre?: string } | { nombre?: string }[] | null;
};

export default function EquipoPermisosClient() {
  const [permisos, setPermisos] = useState<PermisosPayload | null>(null);
  const [filasRoles, setFilasRoles] = useState<FilaRol[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch('/api/auth/permisos', { cache: 'no-store' }),
        fetch('/api/auth/usuarios-roles', { cache: 'no-store' }),
      ]);
      const pData = (await pRes.json()) as PermisosPayload & { error?: string };
      if (!pRes.ok) throw new Error(pData.error ?? 'No se pudieron cargar permisos');

      setPermisos(pData);
      if (rRes.ok) {
        const rData = (await rRes.json()) as { filas?: FilaRol[] };
        setFilasRoles(rData.filas ?? []);
      } else {
        setFilasRoles([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-28 pt-4 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4">
        <Link href="/" className="text-xs font-semibold text-sky-400/90 hover:text-sky-300">
          ← Inicio
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF9500]/35 bg-[#FF9500]/10">
            <Shield className="h-6 w-6 text-[#FFD60A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Equipo y permisos</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Roles de empresa (web), nómina de obra (Telegram) y matriz de autorizaciones.
            </p>
          </div>
        </div>

        {cargando ? (
          <div className="mt-10 flex justify-center text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {permisos ? (
          <div className="mt-8 space-y-8">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <UserCog size={16} className="text-[#FF9500]" />
                Tu sesión
              </h2>
              <p className="mt-2 text-xs text-zinc-500">
                {permisos.usuario?.email ?? '—'} · enforcement{' '}
                {permisos.enforcement ? (
                  <Badge className="ml-1 bg-amber-500/20 text-amber-200">activo en prod</Badge>
                ) : (
                  <Badge className="ml-1 bg-zinc-700 text-zinc-300">relajado (dev)</Badge>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {permisos.permisos.length ? (
                  permisos.permisos.map((p) => (
                    <Badge key={p} variant="outline" className="border-white/10 text-[10px] text-zinc-300">
                      {p}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-zinc-600">Sin permisos asignados aún.</span>
                )}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <Link
                href="/configuracion/entidades"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#FF9500]/40"
              >
                <Building2 className="mb-2 h-5 w-5 text-sky-400" />
                <h3 className="font-bold text-white">Roles web por entidad</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Asigna admin, PM, contador, comprador… vinculado al email de login.
                </p>
              </Link>
              <Link
                href="/configuracion/telegram"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#FF9500]/40"
              >
                <MessageCircle className="mb-2 h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-white">Telegram: whitelist y compras</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Lista blanca del bot y usuarios /procura (Solicitante, Aprobador, Comprador).
                </p>
              </Link>
            </section>

            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <Users size={16} />
                Invitar y dar acceso
              </h2>
              <InvitarUsuarioAcceso onListo={() => void cargar()} />
            </section>

            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <UserCog size={16} />
                Solo asignar rol (usuario ya en Auth)
              </h2>
              <AsignarRolUsuario onAsignado={() => void cargar()} />
            </section>

            {filasRoles.length > 0 ? (
              <section className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="border-b border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Asignaciones registradas
                </div>
                <ul className="divide-y divide-white/5">
                  {filasRoles.map((f) => {
                    const ent = f.ci_entidades;
                    const nombreEnt = Array.isArray(ent) ? ent[0]?.nombre : ent?.nombre;
                    return (
                      <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                        <span className="text-zinc-300">{nombreEnt ?? f.entidad_id.slice(0, 8)}</span>
                        <Badge className="bg-[#FF9500]/15 text-[#FFD60A]">{f.rol}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="text-sm font-bold text-white">Catálogo de roles empresa</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {ROLES_EMPRESA.map((r) => (
                  <li key={r.value} className="text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-200">{r.label}</span>
                    <span className="text-zinc-600"> · {r.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-zinc-600">
                Roles de obra (ingeniero, depositario, supervisor…) se configuran en Control de obra →
                Nómina del proyecto. Permisos disponibles: {PERMISOS.join(', ')}.
              </p>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
