'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { apiUrl } from '@/lib/http/apiUrl';
import { ROLES_APLICACION_PROYECTO } from '@/lib/proyectos/rolesAplicacionProyecto';
import type { RolAplicacionProyectoSlot } from '@/lib/proyectos/proyectoRolesAplicacion';

type Props = {
  proyectoId: string;
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/20';

const ROL_PERSONALIZADO = '__personalizado__';

function nuevaFilaExtra(): RolAplicacionProyectoSlot {
  const key = `new:${crypto.randomUUID()}`;
  return {
    filaKey: key,
    slug: '',
    label: '',
    sincronizarComprasTelegram: false,
    nomina_id: null,
    nombre: '',
    telegram: '',
    esExtra: true,
  };
}

export default function ProyectoRolesAplicacionPanel({
  proyectoId,
  embedded = true,
  onDirtyChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RolAplicacionProyectoSlot[]>([]);
  const [eliminados, setEliminados] = useState<string[]>([]);

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
      setEliminados([]);
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

  const marcarDirty = () => onDirtyChange?.(true);

  const patchRol = (
    filaKey: string,
    patch: Partial<
      Pick<
        RolAplicacionProyectoSlot,
        'nombre' | 'telegram' | 'label' | 'slug' | 'sincronizarComprasTelegram'
      >
    >,
  ) => {
    setRoles((prev) => prev.map((r) => (r.filaKey === filaKey ? { ...r, ...patch } : r)));
    marcarDirty();
  };

  const agregarFila = () => {
    setRoles((prev) => [...prev, nuevaFilaExtra()]);
    marcarDirty();
  };

  const quitarFila = (fila: RolAplicacionProyectoSlot) => {
    if (!fila.esExtra) return;
    if (fila.nomina_id) {
      setEliminados((prev) => [...prev, fila.nomina_id!]);
    }
    setRoles((prev) => prev.filter((r) => r.filaKey !== fila.filaKey));
    marcarDirty();
  };

  const onRolExtraSelect = (filaKey: string, value: string) => {
    if (value === ROL_PERSONALIZADO) {
      patchRol(filaKey, { slug: '', label: '' });
      return;
    }
    const def = ROLES_APLICACION_PROYECTO.find((r) => r.slug === value);
    patchRol(filaKey, {
      slug: value,
      label: def?.label ?? value,
      sincronizarComprasTelegram: Boolean(def?.sincronizarComprasTelegram),
    });
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
              filaKey: r.filaKey,
              slug: r.slug,
              label: r.label,
              nomina_id: r.nomina_id,
              nombre: r.nombre.trim(),
              telegram: r.telegram.trim(),
              esExtra: r.esExtra,
            })),
            eliminados,
          }),
        },
      );
      const json = await parseFetchJson<{ roles?: RolAplicacionProyectoSlot[]; error?: string }>(
        res,
      );
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron guardar los roles');
      setRoles(json.roles ?? []);
      setEliminados([]);
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

  const filasCatalogo = roles.filter((r) => !r.esExtra);
  const filasExtra = roles.filter((r) => r.esExtra);

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#007AFF]/30 bg-[#007AFF]/10">
            <UserCog className="h-4 w-4 text-[#007AFF]" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Roles de la aplicación</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Asigna nombre y Telegram por rol. Usa «Agregar usuario o rol» para más personas o
              cargos personalizados.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={agregarFila}
          disabled={guardando}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#007AFF]/40 bg-[#007AFF]/10 px-3 py-2 text-xs font-bold text-[#64B5FF] transition hover:bg-[#007AFF]/20 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Agregar usuario o rol
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#12121a] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Rol</th>
              <th className="px-3 py-2.5 font-semibold">Nombre</th>
              <th className="px-3 py-2.5 font-semibold">Telegram</th>
              <th className="w-10 px-2 py-2.5" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filasCatalogo.map((r) => (
              <tr key={r.filaKey} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2 align-top text-xs font-medium leading-snug text-zinc-300">
                  {r.label}
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={r.nombre}
                    onChange={(e) => patchRol(r.filaKey, { nombre: e.target.value })}
                    placeholder="Nombre completo"
                    className={inputClass}
                    disabled={guardando}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={r.telegram}
                    onChange={(e) => patchRol(r.filaKey, { telegram: e.target.value })}
                    placeholder="ID o teléfono"
                    className={`${inputClass} font-mono text-xs`}
                    disabled={guardando}
                  />
                </td>
                <td className="px-2 py-2 align-top" />
              </tr>
            ))}

            {filasExtra.map((r) => {
              const selectValue =
                r.slug && ROLES_APLICACION_PROYECTO.some((d) => d.slug === r.slug)
                  ? r.slug
                  : ROL_PERSONALIZADO;
              return (
                <tr
                  key={r.filaKey}
                  className="border-t border-[#007AFF]/20 bg-[#007AFF]/[0.04] hover:bg-[#007AFF]/[0.07]"
                >
                  <td className="px-3 py-2 align-top">
                    <select
                      value={selectValue}
                      onChange={(e) => onRolExtraSelect(r.filaKey, e.target.value)}
                      className={`${inputClass} text-xs`}
                      disabled={guardando}
                    >
                      <option value={ROL_PERSONALIZADO}>Otro rol (personalizado)</option>
                      {ROLES_APLICACION_PROYECTO.map((d) => (
                        <option key={d.slug} value={d.slug}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    {selectValue === ROL_PERSONALIZADO ? (
                      <input
                        type="text"
                        value={r.label}
                        onChange={(e) =>
                          patchRol(r.filaKey, { label: e.target.value, slug: '' })
                        }
                        placeholder="Nombre del rol"
                        className={`${inputClass} mt-1.5 text-xs`}
                        disabled={guardando}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={r.nombre}
                      onChange={(e) => patchRol(r.filaKey, { nombre: e.target.value })}
                      placeholder="Nombre completo"
                      className={inputClass}
                      disabled={guardando}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={r.telegram}
                      onChange={(e) => patchRol(r.filaKey, { telegram: e.target.value })}
                      placeholder="ID o teléfono"
                      className={`${inputClass} font-mono text-xs`}
                      disabled={guardando}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <button
                      type="button"
                      title="Quitar fila"
                      onClick={() => quitarFila(r)}
                      disabled={guardando}
                      className="rounded-lg border border-white/10 p-2 text-zinc-500 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filasExtra.length === 0 ? (
        <p className="text-center text-xs text-zinc-600">
          ¿Necesitas otro cargo o una segunda persona en el mismo rol? Pulsa{' '}
          <strong className="text-zinc-400">Agregar usuario o rol</strong>.
        </p>
      ) : null}

      {!embedded ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={agregarFila}
            disabled={guardando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.08] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Agregar usuario o rol
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="rounded-lg bg-[#007AFF] px-4 py-2 text-sm font-bold text-white hover:bg-[#007AFF]/90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar roles'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function useGuardarRolesAplicacionProyecto(proyectoId: string) {
  return async (roles: RolAplicacionProyectoSlot[], eliminados: string[] = []) => {
    const res = await fetch(
      apiUrl(`/api/proyectos/${encodeURIComponent(proyectoId)}/roles-aplicacion`),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: roles.map((r) => ({
            filaKey: r.filaKey,
            slug: r.slug,
            label: r.label,
            nomina_id: r.nomina_id,
            nombre: r.nombre.trim(),
            telegram: r.telegram.trim(),
            esExtra: r.esExtra,
          })),
          eliminados,
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
