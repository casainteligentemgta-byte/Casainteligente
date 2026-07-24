'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  HardHat,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import IngenieroResidenteObraCard from '@/components/proyectos/IngenieroResidenteObraCard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EmpleadoNominaOpcion, FilaNominaProyecto } from '@/lib/proyectos/proyectoNomina';
import { ROLES_NOMINA_EMPLEADO } from '@/lib/proyectos/rolesProyectoNomina';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';

type Props = {
  proyectoModuloId: string;
};

type FormState = {
  rol: string;
  empleado_id: string;
  nombre: string;
  cedula: string;
  email: string;
  telegram_chat_id: string;
  telegram_telefono: string;
  notas: string;
};

const campoClase =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/15';

function formVacio(rol: string): FormState {
  return {
    rol,
    empleado_id: '',
    nombre: '',
    cedula: '',
    email: '',
    telegram_chat_id: '',
    telegram_telefono: '',
    notas: '',
  };
}

export default function ListaEmpleosHojasVida({ proyectoModuloId }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nomina, setNomina] = useState<FilaNominaProyecto[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoNominaOpcion[]>([]);
  const [ingenieroNombre, setIngenieroNombre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<FilaNominaProyecto | null>(null);
  const [rolLabelModal, setRolLabelModal] = useState('');
  const [form, setForm] = useState<FormState>(formVacio('depositario'));
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const pid = proyectoModuloId.trim();
    const [resNomina, resIng] = await Promise.all([
      fetch(
        `/api/proyectos/${encodeURIComponent(pid)}/nomina?empleados=1&categoria=empleado`,
        { cache: 'no-store' },
      ),
      fetch(`/api/proyectos/${encodeURIComponent(pid)}/campo/equipo`, { cache: 'no-store' }),
    ]);

    try {
      const json = await parseFetchJson<{
        filas?: FilaNominaProyecto[];
        empleadosDisponibles?: EmpleadoNominaOpcion[];
        error?: string;
      }>(resNomina);
      if (!resNomina.ok) throw new Error(json.error ?? 'Error al cargar empleos');
      setNomina((json.filas ?? []).filter((f) => f.rol !== 'ingeniero_residente'));
      setEmpleados(json.empleadosDisponibles ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar empleos');
      setNomina([]);
      setEmpleados([]);
    }

    try {
      const json = await parseFetchJson<{
        ingenieroAsignado?: { nombre?: string } | null;
      }>(resIng);
      const nom = json.ingenieroAsignado?.nombre?.trim();
      setIngenieroNombre(nom || null);
    } catch {
      setIngenieroNombre(null);
    }

    setLoading(false);
  }, [proyectoModuloId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filasPorRol = useMemo(() => {
    const m = new Map<string, FilaNominaProyecto[]>();
    for (const r of ROLES_NOMINA_EMPLEADO) {
      if (r.value === 'ingeniero_residente') continue;
      m.set(r.value, []);
    }
    for (const f of nomina) {
      const lista = m.get(f.rol);
      if (lista) lista.push(f);
      else m.set(f.rol, [f]);
    }
    return m;
  }, [nomina]);

  const toggle = (rol: string) => {
    setAbierto((prev) => (prev === rol ? null : rol));
  };

  const abrirNuevo = (rol: string, label: string) => {
    setEditando(null);
    setRolLabelModal(label);
    setForm(formVacio(rol));
    setModalAbierto(true);
  };

  const abrirEditar = (fila: FilaNominaProyecto, label: string) => {
    setEditando(fila);
    setRolLabelModal(label);
    setForm({
      rol: fila.rol,
      empleado_id: fila.empleado_id ?? '',
      nombre: fila.nombre ?? fila.nombre_display,
      cedula: fila.cedula ?? '',
      email: fila.email ?? fila.empleado_email ?? '',
      telegram_chat_id:
        fila.telegram_chat_id != null
          ? String(fila.telegram_chat_id)
          : fila.empleado_telegram_chat_id != null
            ? String(fila.empleado_telegram_chat_id)
            : '',
      telegram_telefono: fila.telegram_telefono ?? fila.empleado_celular ?? '',
      notas: fila.notas ?? '',
    });
    setModalAbierto(true);
  };

  const onEmpleadoChange = (empleadoId: string) => {
    const emp = empleados.find((e) => e.id === empleadoId);
    setForm((prev) => ({
      ...prev,
      empleado_id: empleadoId,
      nombre: emp?.nombre_completo ?? prev.nombre,
      cedula: emp?.cedula ?? prev.cedula,
      email: emp?.email ?? prev.email,
      telegram_chat_id:
        emp?.telegram_chat_id != null ? String(emp.telegram_chat_id) : prev.telegram_chat_id,
      telegram_telefono: emp?.celular ?? prev.telegram_telefono,
    }));
  };

  const guardar = async () => {
    if (!form.empleado_id.trim() && !form.nombre.trim()) {
      toast.error('Indica nombre o selecciona empleado de RRHH');
      return;
    }

    setGuardando(true);
    const pid = proyectoModuloId.trim();
    try {
      const body = {
        categoria: 'empleado' as const,
        rol: form.rol.trim(),
        empleado_id: form.empleado_id.trim() || null,
        nombre: form.nombre.trim() || null,
        cedula: form.cedula.trim() || null,
        email: form.email.trim() || null,
        telegram_chat_id: form.telegram_chat_id.trim() || null,
        telegram_telefono: form.telegram_telefono.trim() || null,
        notas: form.notas.trim() || null,
      };

      const url = editando
        ? `/api/proyectos/${encodeURIComponent(pid)}/nomina/${encodeURIComponent(editando.id)}`
        : `/api/proyectos/${encodeURIComponent(pid)}/nomina`;

      const res = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');

      toast.success(editando ? 'Registro actualizado' : 'Persona agregada al empleo');
      setModalAbierto(false);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (fila: FilaNominaProyecto, label: string) => {
    if (!window.confirm(`¿Quitar a ${fila.nombre_display} de ${label}?`)) {
      return;
    }
    const pid = proyectoModuloId.trim();
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(pid)}/nomina/${encodeURIComponent(fila.id)}`,
        { method: 'DELETE' },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo eliminar');
      toast.success('Registro eliminado');
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  if (loading) {
    return (
      <section className="mb-8 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Cargando empleos…
      </section>
    );
  }

  return (
    <>
      <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Empleos</h2>
        <ul className="overflow-hidden rounded-xl border border-white/10 divide-y divide-white/10">
          <li>
            <button
              type="button"
              onClick={() => toggle('ingeniero_residente')}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
            >
              <span className="flex min-w-0 items-center gap-2.5 font-semibold text-white">
                {abierto === 'ingeniero_residente' ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                )}
                <HardHat className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                <span className="truncate">Ingeniero residente</span>
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {ingenieroNombre ? ingenieroNombre : 'Sin asignar'}
              </span>
            </button>
            {abierto === 'ingeniero_residente' ? (
              <div className="border-t border-white/10 bg-zinc-950/40 px-3 py-3">
                <IngenieroResidenteObraCard
                  proyectoId={proyectoModuloId}
                  embedded
                  onGuardado={() => void cargar()}
                />
              </div>
            ) : null}
          </li>

          {ROLES_NOMINA_EMPLEADO.filter((r) => r.value !== 'ingeniero_residente').map((rol) => {
            const expandido = abierto === rol.value;
            const filas = filasPorRol.get(rol.value) ?? [];

            return (
              <li key={rol.value}>
                <button
                  type="button"
                  onClick={() => toggle(rol.value)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-2.5 font-semibold text-white">
                    {expandido ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    )}
                    <UserCog className="h-4 w-4 shrink-0 text-sky-400/80" aria-hidden />
                    <span className="truncate">{rol.label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {filas.length > 0
                      ? `${filas.length} asignado${filas.length === 1 ? '' : 's'}`
                      : 'Sin asignar'}
                  </span>
                </button>
                {expandido ? (
                  <div className="border-t border-white/10 bg-zinc-950/40 px-4 py-3">
                    {filas.length === 0 ? (
                      <p className="mb-3 text-sm text-zinc-500">
                        Sin personal asignado a este empleo.
                      </p>
                    ) : (
                      <ul className="mb-3 space-y-2">
                        {filas.map((f) => (
                          <li
                            key={f.id}
                            className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm sm:grid-cols-[1fr_auto_auto_auto]"
                          >
                            <div className="min-w-0">
                              {f.empleado_id ? (
                                <Link
                                  href={`/empleados/${encodeURIComponent(f.empleado_id)}`}
                                  className="font-medium text-sky-300 underline decoration-sky-500/30 hover:text-sky-200"
                                >
                                  {f.nombre_display}
                                </Link>
                              ) : (
                                <span className="font-medium text-zinc-100">{f.nombre_display}</span>
                              )}
                            </div>
                            <span className="tabular-nums text-zinc-400">{f.cedula || '—'}</span>
                            <span className="tabular-nums text-zinc-500">
                              {f.empleado_celular || f.telegram_telefono || '—'}
                            </span>
                            <div className="flex justify-end gap-1 sm:justify-start">
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => abrirEditar(f, rol.label)}
                                className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:border-sky-500/40 hover:text-sky-300"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Quitar"
                                onClick={() => void eliminar(f, rol.label)}
                                className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => abrirNuevo(rol.value, rol.label)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      {filas.length > 0 ? 'Agregar otro' : 'Agregar persona'}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#121218] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editando ? 'Editar' : 'Agregar'} · {rolLabelModal}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {empleados.length > 0 ? (
              <div>
                <Label className="text-zinc-400">Vincular RRHH (opcional)</Label>
                <select
                  value={form.empleado_id}
                  onChange={(e) => onEmpleadoChange(e.target.value)}
                  className={campoClase}
                >
                  <option value="">— Manual / sin vínculo —</option>
                  {empleados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre_completo}
                      {e.cargo_nombre ? ` · ${e.cargo_nombre}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <Label className="text-zinc-400">Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                disabled={Boolean(form.empleado_id)}
                className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
                placeholder="Nombre completo"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-zinc-400">Cédula</Label>
                <Input
                  value={form.cedula}
                  onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))}
                  className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
                />
              </div>
              <div>
                <Label className="text-zinc-400">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
                  placeholder="correo@empresa.com"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-zinc-400">Telegram chat ID</Label>
                <Input
                  value={form.telegram_chat_id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, telegram_chat_id: e.target.value }))
                  }
                  className="mt-1.5 border-white/10 bg-zinc-900/80 font-mono text-sm text-zinc-100"
                  placeholder="123456789"
                />
              </div>
              <div>
                <Label className="text-zinc-400">Teléfono</Label>
                <Input
                  value={form.telegram_telefono}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, telegram_telefono: e.target.value }))
                  }
                  className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
                  placeholder="04141234567"
                />
              </div>
            </div>

            <div>
              <Label className="text-zinc-400">Notas</Label>
              <Input
                value={form.notas}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalAbierto(false)}
                className="border-white/15 bg-transparent text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={guardando}
                onClick={() => void guardar()}
                className="bg-sky-600 text-white hover:bg-sky-500"
              >
                {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
