'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HardHat,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { FilaNominaProyecto, EmpleadoNominaOpcion } from '@/lib/proyectos/proyectoNomina';
import {
  etiquetaRolNomina,
  rolesSugeridosNomina,
  type CategoriaNominaProyecto,
} from '@/lib/proyectos/rolesProyectoNomina';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Payload = {
  proyectoId: string;
  filas: FilaNominaProyecto[];
  empleadosDisponibles?: EmpleadoNominaOpcion[];
};

type Props = {
  proyectoId: string;
};

const campoClase =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/15';

type FormState = {
  categoria: CategoriaNominaProyecto;
  rol: string;
  rolPersonalizado: string;
  empleado_id: string;
  nombre: string;
  cedula: string;
  email: string;
  telegram_chat_id: string;
  telegram_telefono: string;
  notas: string;
};

function formVacio(categoria: CategoriaNominaProyecto): FormState {
  const roles = rolesSugeridosNomina(categoria);
  return {
    categoria,
    rol: roles[0]?.value ?? '',
    rolPersonalizado: '',
    empleado_id: '',
    nombre: '',
    cedula: '',
    email: '',
    telegram_chat_id: '',
    telegram_telefono: '',
    notas: '',
  };
}

function rolEfectivo(form: FormState): string {
  return form.rol === '__otro__' ? form.rolPersonalizado.trim() : form.rol;
}

function contactoTelegram(f: FilaNominaProyecto): string {
  if (f.telegram_chat_id != null) return String(f.telegram_chat_id);
  if (f.telegram_telefono) return f.telegram_telefono;
  if (f.empleado_telegram_chat_id != null) return String(f.empleado_telegram_chat_id);
  if (f.empleado_celular) return f.empleado_celular;
  return '—';
}

function contactoEmail(f: FilaNominaProyecto): string {
  return f.email || f.empleado_email || '—';
}

export default function ProyectoNominaRolesPanel({ proyectoId }: Props) {
  const [tab, setTab] = useState<CategoriaNominaProyecto>('obrero');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaNominaProyecto[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoNominaOpcion[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<FilaNominaProyecto | null>(null);
  const [form, setForm] = useState<FormState>(formVacio('obrero'));
  const [guardando, setGuardando] = useState(false);

  const rolesOpts = useMemo(() => rolesSugeridosNomina(form.categoria), [form.categoria]);

  const filasTab = useMemo(
    () => filas.filter((f) => f.categoria === tab),
    [filas, tab],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/nomina?empleados=1`,
        { cache: 'no-store' },
      );
      const json = await parseFetchJson<Payload & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar nómina');
      setFilas(json.filas ?? []);
      setEmpleados(json.empleadosDisponibles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formVacio(tab));
    setModalAbierto(true);
  };

  const abrirEditar = (fila: FilaNominaProyecto) => {
    const roles = rolesSugeridosNomina(fila.categoria);
    const rolEnLista = roles.some((r) => r.value === fila.rol);
    setEditando(fila);
    setForm({
      categoria: fila.categoria,
      rol: rolEnLista ? fila.rol : '__otro__',
      rolPersonalizado: rolEnLista ? '' : fila.rol,
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
      categoria: emp?.categoria_sugerida ?? prev.categoria,
      nombre: emp?.nombre_completo ?? prev.nombre,
      cedula: emp?.cedula ?? prev.cedula,
      email: emp?.email ?? prev.email,
      telegram_chat_id:
        emp?.telegram_chat_id != null ? String(emp.telegram_chat_id) : prev.telegram_chat_id,
      telegram_telefono: emp?.celular ?? prev.telegram_telefono,
    }));
  };

  const guardar = async () => {
    const rol = rolEfectivo(form);
    if (!rol) {
      toast.error('Indica el rol');
      return;
    }
    if (!form.empleado_id.trim() && !form.nombre.trim()) {
      toast.error('Indica nombre o selecciona empleado de RRHH');
      return;
    }

    setGuardando(true);
    try {
      const body = {
        categoria: form.categoria,
        rol,
        empleado_id: form.empleado_id.trim() || null,
        nombre: form.nombre.trim() || null,
        cedula: form.cedula.trim() || null,
        email: form.email.trim() || null,
        telegram_chat_id: form.telegram_chat_id.trim() || null,
        telegram_telefono: form.telegram_telefono.trim() || null,
        notas: form.notas.trim() || null,
      };

      const url = editando
        ? `/api/proyectos/${encodeURIComponent(proyectoId)}/nomina/${encodeURIComponent(editando.id)}`
        : `/api/proyectos/${encodeURIComponent(proyectoId)}/nomina`;

      const res = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');

      toast.success(editando ? 'Registro actualizado' : 'Persona agregada a la nómina');
      setModalAbierto(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (fila: FilaNominaProyecto) => {
    if (!window.confirm(`¿Quitar a ${fila.nombre_display} de la nómina del proyecto?`)) return;
    try {
      const res = await fetch(
        `/api/proyectos/${encodeURIComponent(proyectoId)}/nomina/${encodeURIComponent(fila.id)}`,
        { method: 'DELETE' },
      );
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo eliminar');
      toast.success('Registro eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF9500]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/10">
              <UserCog className="h-5 w-5 text-[#FF9500]" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Equipo · Roles
              </p>
              <h2 className="mt-1 text-lg font-bold text-white">Nómina del proyecto</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                Cuadro de obreros y empleados con rol operativo, correo y contacto Telegram por
                obra.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={abrirNuevo}
            className="rounded-xl bg-[#FF9500] text-black hover:bg-[#FF9500]/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar
          </Button>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('obrero')}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              tab === 'obrero'
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
            }`}
          >
            <HardHat className="h-4 w-4" />
            Obreros ({filas.filter((f) => f.categoria === 'obrero').length})
          </button>
          <button
            type="button"
            onClick={() => setTab('empleado')}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              tab === 'empleado'
                ? 'border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200'
                : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
            }`}
          >
            <Users className="h-4 w-4" />
            Empleados ({filas.filter((f) => f.categoria === 'empleado').length})
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
          {error.includes('ci_proyecto_nomina') || error.includes('42P01') ? (
            <span className="mt-1 block text-xs text-red-400/90">
              Ejecuta la migración 216_ci_proyecto_nomina_roles.sql en Supabase.
            </span>
          ) : null}
        </p>
      ) : null}

      {filasTab.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
          No hay {tab === 'obrero' ? 'obreros' : 'empleados'} en la nómina. Usa «Agregar» para
          registrar rol, email y Telegram.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Rol</TableHead>
                <TableHead className="text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </span>
                </TableHead>
                <TableHead className="text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" /> Telegram
                  </span>
                </TableHead>
                <TableHead className="text-right text-zinc-400">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasTab.map((f) => (
                <TableRow key={f.id} className="border-white/5 hover:bg-white/[0.03]">
                  <TableCell>
                    <div className="font-medium text-white">{f.nombre_display}</div>
                    {f.cargo_nombre ? (
                      <div className="text-xs text-zinc-500">{f.cargo_nombre}</div>
                    ) : null}
                    {f.cedula ? (
                      <div className="font-mono text-xs text-zinc-600">{f.cedula}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-zinc-300">{etiquetaRolNomina(f.rol)}</TableCell>
                  <TableCell className="text-sm text-zinc-400">{contactoEmail(f)}</TableCell>
                  <TableCell className="font-mono text-sm text-zinc-400">
                    {contactoTelegram(f)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => abrirEditar(f)}
                        className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:border-[#FF9500]/40 hover:text-[#FF9500]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Quitar"
                        onClick={() => void eliminar(f)}
                        className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#121218] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editando ? 'Editar en nómina' : 'Agregar a la nómina'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-zinc-400">Categoría</Label>
              <select
                value={form.categoria}
                onChange={(e) => {
                  const cat = e.target.value as CategoriaNominaProyecto;
                  setForm(formVacio(cat));
                }}
                className={campoClase}
              >
                <option value="obrero">Obrero</option>
                <option value="empleado">Empleado</option>
              </select>
            </div>

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
                <Label className="text-zinc-400">Rol en el proyecto</Label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value }))}
                  className={campoClase}
                >
                  {rolesOpts.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                  <option value="__otro__">Otro…</option>
                </select>
              </div>
              {form.rol === '__otro__' ? (
                <div>
                  <Label className="text-zinc-400">Rol personalizado</Label>
                  <Input
                    value={form.rolPersonalizado}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, rolPersonalizado: e.target.value }))
                    }
                    className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
                  />
                </div>
              ) : null}
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
                <Label className="text-zinc-400">Teléfono Telegram</Label>
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
                className="bg-[#FF9500] text-black hover:bg-[#FF9500]/90"
              >
                {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
