'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { apiUrl } from '@/lib/http/apiUrl';
import type { RolAplicacionProyectoSlot } from '@/lib/proyectos/proyectoRolesAplicacion';

type Props = {
  proyectoId: string;
  /** Si false, el padre guarda con su botón global. */
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';

export default function ProyectoRolesAplicacionPanel({
  proyectoId,
  embedded = true,
  onDirtyChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RolAplicacionProyectoSlot[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/proyectos/${encodeURIComponent(proyectoId)}/roles-aplicacion`),
        { cache: 'no-store' },
      );
      const json = await parseFetchJson<{ roles?: RolAplicacionProyectoSlot[]; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar roles');
      setRoles(json.roles ?? []);
      onDirtyChange?.(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId, onDirtyChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchRol = (slug: string, patch: Partial<Pick<RolAplicacionProyectoSlot, 'nombre' | 'telegram'>>) => {
    setRoles((prev) =>
      prev.map((r) => (r.slug === slug ? { ...r, ...patch } : r)),
    );
    onDirtyChange?.(true);
  };

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch(
        apiUrl(`/api/proyectos/${encodeURIComponent(proyectoId)}/roles-aplicacion`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roles: roles.map((r) => ({
              slug: r.slug,
              nombre: r.nombre.trim(),
              telegram: r.telegram.trim(),
            })),
          }),
        },
      );
      const json = await parseFetchJson<{ roles?: RolAplicacionProyectoSlot[]; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron guardar los roles');
      setRoles(json.roles ?? []);
      onDirtyChange?.(false);
      toast.success('Roles del proyecto guardados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF9500]" />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#007AFF]/30 bg-[#007AFF]/10">
          <UserCog className="h-4 w-4 text-[#007AFF]" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-100">Roles de la aplicación</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Asigna nombre y número de Telegram por rol en esta obra. Los roles de /procura se
            sincronizan al bot automáticamente.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#12121a] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Rol</th>
              <th className="px-3 py-2.5 font-semibold">Nombre</th>
              <th className="px-3 py-2.5 font-semibold">Telegram</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.slug} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2 align-top text-xs font-medium leading-snug text-zinc-300">
                  {r.label}
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={r.nombre}
                    onChange={(e) => patchRol(r.slug, { nombre: e.target.value })}
                    placeholder="Nombre completo"
                    className={inputClass}
                    disabled={guardando}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={r.telegram}
                    onChange={(e) => patchRol(r.slug, { telegram: e.target.value })}
                    placeholder="ID o teléfono"
                    className={`${inputClass} font-mono text-xs`}
                    disabled={guardando}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!embedded ? (
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className="rounded-lg bg-[#007AFF] px-4 py-2 text-sm font-bold text-white hover:bg-[#007AFF]/90 disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar roles'}
        </button>
      ) : null}
    </section>
  );
}

export function useGuardarRolesAplicacionProyecto(proyectoId: string) {
  return async (roles: RolAplicacionProyectoSlot[]) => {
    const res = await fetch(
      apiUrl(`/api/proyectos/${encodeURIComponent(proyectoId)}/roles-aplicacion`),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: roles.map((r) => ({
            slug: r.slug,
            nombre: r.nombre.trim(),
            telegram: r.telegram.trim(),
          })),
        }),
      },
    );
    const json = await parseFetchJson<{ roles?: RolAplicacionProyectoSlot[]; error?: string }>(
      res,
    );
    if (!res.ok) throw new Error(json.error ?? 'No se pudieron guardar los roles');
    return json.roles ?? [];
  };
}
