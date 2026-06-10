'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { RolComprasTelegram } from '@/lib/compras/usuariosSistemaTelegram';
import { ROLES_COMPRAS_TELEGRAM } from '@/lib/compras/usuariosSistemaTelegram';
import { Button } from '@/components/ui/button';
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

type UsuarioRow = {
  id: string;
  nombre: string;
  telegram_id: number;
  rol: RolComprasTelegram;
  proyecto_id: string | null;
  activo: boolean;
};

const ROL_HINT: Record<RolComprasTelegram, string> = {
  Solicitante: 'Puede usar /procura',
  Aprobador: 'Aprueba vía larga en canal admin',
  Comprador: 'Facturas y ejecución de compra',
  Administrador: 'Acceso completo departamento',
};

export default function UsuariosComprasTelegramPanel() {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [nombre, setNombre] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [rol, setRol] = useState<RolComprasTelegram>('Solicitante');
  const [tambienWhitelist, setTambienWhitelist] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compras/usuarios-telegram', { cache: 'no-store' });
      const json = await parseFetchJson<{ usuarios?: UsuarioRow[]; error?: string; hint?: string }>(
        res,
      );
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setUsuarios((json.usuarios ?? []) as UsuarioRow[]);
      if (json.hint) setError(json.hint);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const agregarUsuario = async () => {
    const nombreTrim = nombre.trim();
    const tidTrim = telegramId.trim();
    if (!nombreTrim) {
      toast.error('Indica el nombre');
      return;
    }
    if (!tidTrim) {
      toast.error('Indica el telegram_id');
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch('/api/compras/usuarios-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreTrim,
          telegram_id: tidTrim,
          rol,
          activo: true,
        }),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo registrar');

      if (tambienWhitelist) {
        const wl = await fetch('/api/telegram/whitelist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombreTrim, chat_id: tidTrim }),
        });
        if (!wl.ok) {
          const wlJson = await parseFetchJson<{ error?: string }>(wl);
          toast.warning(
            `Usuario compras OK, pero whitelist: ${wlJson.error ?? 'error'}`,
          );
        }
      }

      toast.success(`${nombreTrim} registrado como ${rol}`);
      setNombre('');
      setTelegramId('');
      setRol('Solicitante');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarRol = async (u: UsuarioRow, nuevoRol: RolComprasTelegram) => {
    if (nuevoRol === u.rol) return;
    try {
      const res = await fetch(`/api/compras/usuarios-telegram/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: nuevoRol }),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error');
      toast.success(`Rol actualizado: ${nuevoRol}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const toggleActivo = async (u: UsuarioRow) => {
    try {
      const res = await fetch(`/api/compras/usuarios-telegram/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !u.activo }),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const eliminar = async (u: UsuarioRow) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre} del departamento de compras?`)) return;
    try {
      const res = await fetch(`/api/compras/usuarios-telegram/${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error');
      toast.success('Usuario eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/10">
            <ShoppingCart className="h-5 w-5 text-[#FF9500]" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Departamento de compras
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Usuarios Telegram (/procura)</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Roles para el flujo de procuras por capítulo (CAP-I, CAP-IV…), vía rápida y
              aprobación. Distinto de la lista blanca global del bot.
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-[#FF9500]/25 bg-[#FF9500]/5 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#FF9500]">
          <Plus className="h-4 w-4" />
          Registrar usuario
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-zinc-400">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Neomar Cárdenas"
              className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Telegram ID</Label>
            <Input
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="8684897057"
              className="mt-1.5 border-white/10 bg-zinc-900/80 font-mono text-sm text-zinc-100"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Rol</Label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as RolComprasTelegram)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#FF9500]/50"
            >
              {ROLES_COMPRAS_TELEGRAM.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">{ROL_HINT[rol]}</p>
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={tambienWhitelist}
                onChange={(e) => setTambienWhitelist(e.target.checked)}
                className="rounded border-white/20"
              />
              También en lista blanca
            </label>
            <Button
              type="button"
              disabled={guardando}
              onClick={() => void agregarUsuario()}
              className="mt-3 rounded-xl bg-[#FF9500] text-black hover:bg-[#FF9500]/90"
            >
              {guardando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF9500]" />
        </div>
      ) : usuarios.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
          Sin usuarios del departamento. Registra al menos un Solicitante y un Aprobador.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Telegram ID</TableHead>
                <TableHead className="text-zinc-400">Rol</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-right text-zinc-400">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.03]">
                  <TableCell className="font-medium text-white">{u.nombre}</TableCell>
                  <TableCell className="font-mono text-sm text-zinc-400">{u.telegram_id}</TableCell>
                  <TableCell>
                    <select
                      value={u.rol}
                      onChange={(e) =>
                        void cambiarRol(u, e.target.value as RolComprasTelegram)
                      }
                      className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1 text-sm text-zinc-100"
                    >
                      {ROLES_COMPRAS_TELEGRAM.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => void toggleActivo(u)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        u.activo
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border border-zinc-600 bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => void eliminar(u)}
                      className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <details className="rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
        <summary className="cursor-pointer font-medium text-zinc-400">
          API y scripts (también disponibles)
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <code className="text-zinc-400">POST /api/compras/usuarios-telegram</code> — mismo
            alta que el formulario
          </li>
          <li>
            <code className="text-zinc-400">PATCH /api/compras/usuarios-telegram/[id]</code> —
            rol / activo
          </li>
          <li>
            <code className="text-zinc-400">
              node scripts/register-usuarios-telegram-compras.mjs
            </code>
          </li>
        </ul>
      </details>
    </section>
  );
}
