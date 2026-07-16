'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
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
import type { UsuarioBotProyectoRow } from '@/lib/proyectos/proyectoBotUsuarios';

type RolOpcion = { slug: string; label: string };

type Props = {
  proyectoId: string;
  proyectoNombre: string;
  triggerClassName?: string;
};

type FormState = {
  rol: string;
  nombre: string;
  id_chat: string;
  activo: boolean;
};

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0A0F] px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-[#34C759]/50 focus:ring-2 focus:ring-[#34C759]/20';

const formVacio = (rolDefault = ''): FormState => ({
  rol: rolDefault,
  nombre: '',
  id_chat: '',
  activo: true,
});

export default function ModalBotUsuariosProyecto({
  proyectoId,
  proyectoNombre,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioBotProyectoRow[]>([]);
  const [roles, setRoles] = useState<RolOpcion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(formVacio());

  const rolDefault = roles[0]?.slug ?? 'pm_obra';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/proyectos/${encodeURIComponent(proyectoId)}/bot-usuarios`),
        { cache: 'no-store' },
      );
      const json = await parseFetchJson<{
        usuarios?: UsuarioBotProyectoRow[];
        roles?: RolOpcion[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron cargar los usuarios');
      setUsuarios(json.usuarios ?? []);
      setRoles(json.roles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const activos = useMemo(() => usuarios.filter((u) => u.activo).length, [usuarios]);

  function resetForm() {
    setEditingId(null);
    setShowAdd(false);
    setForm(formVacio(rolDefault));
  }

  function iniciarEdicion(u: UsuarioBotProyectoRow) {
    setShowAdd(false);
    setEditingId(u.id);
    setForm({
      rol: u.rol,
      nombre: u.nombre,
      id_chat: u.id_chat,
      activo: u.activo,
    });
  }

  async function guardarNuevo() {
    setSaving(true);
    try {
      const res = await fetch(
        apiUrl(`/api/proyectos/${encodeURIComponent(proyectoId)}/bot-usuarios`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const json = await parseFetchJson<{ usuario?: UsuarioBotProyectoRow; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo crear');
      if (json.usuario) {
        setUsuarios((prev) => [...prev, json.usuario!]);
      } else {
        await load();
      }
      toast.success('Usuario agregado al bot.');
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  }

  async function guardarEdicion() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(
        apiUrl(
          `/api/proyectos/${encodeURIComponent(proyectoId)}/bot-usuarios/${encodeURIComponent(editingId)}`,
        ),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const json = await parseFetchJson<{ usuario?: UsuarioBotProyectoRow; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      if (json.usuario) {
        setUsuarios((prev) => prev.map((u) => (u.id === editingId ? json.usuario! : u)));
      } else {
        await load();
      }
      toast.success('Usuario actualizado.');
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(u: UsuarioBotProyectoRow) {
    const nuevo = !u.activo;
    setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: nuevo } : x)));
    try {
      const res = await fetch(
        apiUrl(
          `/api/proyectos/${encodeURIComponent(proyectoId)}/bot-usuarios/${encodeURIComponent(u.id)}`,
        ),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: nuevo }),
        },
      );
      const json = await parseFetchJson<{ usuario?: UsuarioBotProyectoRow; error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo cambiar el estado');
      if (json.usuario) {
        setUsuarios((prev) => prev.map((x) => (x.id === u.id ? json.usuario! : x)));
      }
      toast.success(nuevo ? 'Usuario activado.' : 'Usuario desactivado.');
    } catch (e) {
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: u.activo } : x)));
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  }

  async function borrarUsuario(u: UsuarioBotProyectoRow) {
    if (!window.confirm(`¿Eliminar a «${u.nombre || u.rol_label}» del bot de esta obra?`)) return;
    try {
      const res = await fetch(
        apiUrl(
          `/api/proyectos/${encodeURIComponent(proyectoId)}/bot-usuarios/${encodeURIComponent(u.id)}`,
        ),
        { method: 'DELETE' },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo eliminar');
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id));
      if (editingId === u.id) resetForm();
      toast.success('Usuario eliminado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function FormularioUsuario({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) {
    return (
      <div className="space-y-3 rounded-xl border border-[#34C759]/25 bg-[#34C759]/5 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500">
            Rol
            <select
              value={form.rol}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
              className={`${inputClass} mt-1`}
              disabled={saving}
            >
              {roles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500">
            ID chat Telegram
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej. 123456789"
              value={form.id_chat}
              onChange={(e) => setForm((f) => ({ ...f, id_chat: e.target.value }))}
              className={`${inputClass} mt-1 font-mono`}
              disabled={saving}
            />
          </label>
        </div>
        <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500">
          Nombre
          <input
            type="text"
            placeholder="Nombre visible en el bot"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className={`${inputClass} mt-1`}
            disabled={saving}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
            disabled={saving}
            className="h-4 w-4 rounded border-white/20 bg-[#0A0A0F] accent-[#34C759]"
          />
          Activo en el bot
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-lg bg-[#34C759] px-4 py-2 text-sm font-bold text-black hover:bg-[#34C759]/90 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : submitLabel}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        title="Usuarios del bot Telegram"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'inline-flex items-center gap-1.5 rounded-lg border border-[#34C759]/35 bg-[#34C759]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#6ee7a0] backdrop-blur-xl transition hover:bg-[#34C759]/20'
        }
      >
        <Bot className="h-4 w-4 shrink-0" aria-hidden />
        <span>BOT</span>
        {usuarios.length > 0 ? (
          <span className="rounded-full bg-[#34C759] px-1.5 py-0.5 text-[10px] font-bold text-black">
            {activos}/{usuarios.length}
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0A0A0F]/95 backdrop-blur-xl text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#34C759]">
              <Bot className="h-5 w-5" aria-hidden />
              Bot Telegram — usuarios por rol
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Obra: <span className="font-semibold text-zinc-200">{proyectoNombre}</span>
              {usuarios.length > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-zinc-300">
                    {activos} activo{activos === 1 ? '' : 's'} de {usuarios.length}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex min-h-[160px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#34C759]" />
            </div>
          ) : error ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
              {error}
            </p>
          ) : (
            <>
              {showAdd ? (
                <FormularioUsuario
                  onSubmit={() => void guardarNuevo()}
                  submitLabel="Agregar usuario"
                />
              ) : editingId ? (
                <FormularioUsuario
                  onSubmit={() => void guardarEdicion()}
                  submitLabel="Guardar cambios"
                />
              ) : null}

              {usuarios.length === 0 && !showAdd ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-10 text-center">
                  <p className="text-sm text-zinc-400">No hay usuarios del bot en esta obra.</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Agrega roles con ID de chat de Telegram para /procura, compras y alertas.
                  </p>
                </div>
              ) : usuarios.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-[#12121a] text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Rol</th>
                        <th className="px-3 py-2.5 font-semibold">Nombre</th>
                        <th className="px-3 py-2.5 font-semibold">ID chat</th>
                        <th className="px-3 py-2.5 font-semibold text-center">Activo</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u) => (
                        <tr
                          key={u.id}
                          className={`border-t border-white/5 ${u.activo ? '' : 'opacity-55'} ${editingId === u.id ? 'bg-[#34C759]/10' : 'hover:bg-white/[0.02]'}`}
                        >
                          <td className="px-3 py-2.5 align-top text-xs font-medium leading-snug text-zinc-300">
                            {u.rol_label}
                          </td>
                          <td className="px-3 py-2.5 align-top text-sm text-white">
                            {u.nombre || '—'}
                          </td>
                          <td className="px-3 py-2.5 align-top font-mono text-xs text-[#6ee7a0]">
                            {u.id_chat || '—'}
                          </td>
                          <td className="px-3 py-2.5 align-top text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={u.activo}
                              title={u.activo ? 'Desactivar' : 'Activar'}
                              onClick={() => void toggleActivo(u)}
                              disabled={editingId === u.id}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${u.activo ? 'bg-[#34C759]' : 'bg-zinc-600'} disabled:opacity-40`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${u.activo ? 'translate-x-6' : 'translate-x-1'}`}
                              />
                            </button>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                title="Modificar"
                                onClick={() => iniciarEdicion(u)}
                                disabled={Boolean(editingId) || showAdd}
                                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-[#34C759] disabled:opacity-40"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Borrar"
                                onClick={() => void borrarUsuario(u)}
                                disabled={Boolean(editingId) || showAdd}
                                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            {!showAdd && !editingId ? (
              <button
                type="button"
                onClick={() => {
                  setForm(formVacio(rolDefault));
                  setShowAdd(true);
                }}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#34C759]/40 bg-[#34C759]/10 px-4 py-2 text-sm font-semibold text-[#6ee7a0] hover:bg-[#34C759]/20 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Agregar usuario
              </button>
            ) : (
              <span />
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
