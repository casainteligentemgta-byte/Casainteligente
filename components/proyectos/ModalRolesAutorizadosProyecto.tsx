'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Settings, ShieldCheck, UserCog } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { apiUrl } from '@/lib/http/apiUrl';
import type { RolAplicacionProyectoSlot } from '@/lib/proyectos/proyectoRolesAplicacion';

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  /** Abre el modal ⚙ de configuración (editar roles). */
  onEditarRoles?: () => void;
  triggerClassName?: string;
};

function filaAutorizada(r: RolAplicacionProyectoSlot): boolean {
  return Boolean(r.nombre?.trim() || r.telegram?.trim());
}

export function contarRolesAutorizadosProyecto(roles: RolAplicacionProyectoSlot[]): number {
  return roles.filter(filaAutorizada).length;
}

export default function ModalRolesAutorizadosProyecto({
  proyectoId,
  proyectoNombre,
  onEditarRoles,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar los roles');
      setRoles(json.roles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const autorizados = useMemo(() => roles.filter(filaAutorizada), [roles]);
  const count = autorizados.length;

  return (
    <>
      <button
        type="button"
        title="Ver roles autorizados"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'inline-flex items-center gap-1.5 rounded-lg border border-[#007AFF]/35 bg-[#007AFF]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#64B5FF] backdrop-blur-xl transition hover:bg-[#007AFF]/20'
        }
      >
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        <span>Roles</span>
        {count > 0 ? (
          <span className="rounded-full bg-[#007AFF] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-white/10 bg-[#0A0A0F]/95 backdrop-blur-xl text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#007AFF]">
              <UserCog className="h-5 w-5" aria-hidden />
              Roles autorizados
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Obra: <span className="font-semibold text-zinc-200">{proyectoNombre}</span>
              {count > 0 ? (
                <>
                  {' '}
                  · <span className="text-zinc-300">{count} asignado{count === 1 ? '' : 's'}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex min-h-[140px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#007AFF]" />
            </div>
          ) : error ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
              {error}
            </p>
          ) : autorizados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-center">
              <p className="text-sm text-zinc-400">Aún no hay roles con nombre o Telegram en esta obra.</p>
              <p className="mt-2 text-xs text-zinc-500">
                Asigna Project manager, Comprador, Solicitante, etc. desde configuración ⚙.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#12121a] text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Rol</th>
                    <th className="px-3 py-2.5 font-semibold">Nombre</th>
                    <th className="px-3 py-2.5 font-semibold">Telegram</th>
                  </tr>
                </thead>
                <tbody>
                  {autorizados.map((r) => (
                    <tr key={r.filaKey} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 align-top text-xs font-medium leading-snug text-zinc-300">
                        {r.label}
                        {r.esExtra ? (
                          <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                            adicional
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top text-sm text-white">
                        {r.nombre.trim() || '—'}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-xs text-[#64B5FF]">
                        {r.telegram.trim() || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {onEditarRoles ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEditarRoles();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#FF9500]/40 bg-[#FF9500]/10 px-4 py-2 text-sm font-semibold text-[#FF9500] hover:bg-[#FF9500]/20"
              >
                <Settings className="h-4 w-4" />
                Editar roles
              </button>
            ) : (
              <span className="text-xs text-zinc-500">Edita en ⚙ Configuración del proyecto.</span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.08]"
            >
              Cerrar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
