'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  MessageCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import type { FilaTelegramWhitelist } from '@/lib/telegram/chatWhitelist';
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

type Payload = {
  filas: FilaTelegramWhitelist[];
  activa: boolean;
  envCount: number;
};

const campoClase =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#FF9500]/50 focus:ring-2 focus:ring-[#FF9500]/15';

type Props = { embedded?: boolean };

export default function TelegramWhitelistPanel({ embedded = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaTelegramWhitelist[]>([]);
  const [activa, setActiva] = useState(false);
  const [envCount, setEnvCount] = useState(0);
  const [nombre, setNombre] = useState('');
  const [chatId, setChatId] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargosCompras, setCargosCompras] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/whitelist', { cache: 'no-store' });
      const json = await parseFetchJson<Payload & { error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setFilas(json.filas ?? []);
      setActiva(Boolean(json.activa));
      setEnvCount(json.envCount ?? 0);

      try {
        const cr = await fetch('/api/compras/usuarios-telegram', { cache: 'no-store' });
        if (cr.ok) {
          const cj = await parseFetchJson<{
            usuarios?: { telegram_id: number; rol: string }[];
          }>(cr);
          const map: Record<number, string> = {};
          for (const u of cj.usuarios ?? []) {
            map[u.telegram_id] = u.rol;
          }
          setCargosCompras(map);
        }
      } catch {
        setCargosCompras({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const agregarRapido = async () => {
    const nombreTrim = nombre.trim();
    const chatTrim = chatId.trim();
    if (!nombreTrim) {
      toast.error('Indica el nombre');
      return;
    }
    if (!chatTrim) {
      toast.error('Indica el chat ID de Telegram');
      return;
    }

    setGuardando(true);
    try {
      const res = await fetch('/api/telegram/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreTrim,
          chat_id: chatTrim,
          cargo: cargo.trim() || null,
          telefono: telefono.trim() || null,
        }),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'No se pudo agregar');
      toast.success(`${nombreTrim} autorizado en el bot`);
      setNombre('');
      setChatId('');
      setCargo('');
      setTelefono('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  };

  const guardarCargo = async (fila: FilaTelegramWhitelist, nuevoCargo: string) => {
    const cargoTrim = nuevoCargo.trim();
    const actual = (fila.cargo ?? cargosCompras[fila.chat_id] ?? '').trim();
    if (cargoTrim === actual) return;
    try {
      const res = await fetch(`/api/telegram/whitelist/${encodeURIComponent(fila.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargo: cargoTrim || null }),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar cargo');
    }
  };

  const toggleActivo = async (fila: FilaTelegramWhitelist) => {
    try {
      const res = await fetch(`/api/telegram/whitelist/${encodeURIComponent(fila.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !fila.activo }),
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  const eliminar = async (fila: FilaTelegramWhitelist) => {
    if (!window.confirm(`¿Quitar a ${fila.nombre} de la lista blanca?`)) return;
    try {
      const res = await fetch(`/api/telegram/whitelist/${encodeURIComponent(fila.id)}`, {
        method: 'DELETE',
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error ?? 'Error');
      toast.success('Eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-4xl space-y-6 px-4 py-8'}>
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10">
            <ShieldCheck className="h-5 w-5 text-sky-400" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Configuración · Telegram
            </p>
            <h1 className="mt-1 text-xl font-bold text-white">Lista blanca del bot</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Solo los chats autorizados pueden usar comandos del bot. Para{' '}
              <strong className="font-medium text-zinc-300">/procura por capítulos</strong>, registra
              también al usuario en la sección «Departamento de compras» más abajo. Roles web en{' '}
              <Link href="/configuracion/equipo" className="text-sky-400 hover:underline">
                Equipo y permisos
              </Link>
              .
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Estado:{' '}
              <span className={activa ? 'text-emerald-400' : 'text-amber-400'}>
                {activa ? 'Lista blanca activa' : 'Modo abierto (sin restricciones)'}
              </span>
              {envCount > 0 ? ` · ${envCount} en variable env` : ''}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-[#FF9500]/25 bg-[#FF9500]/5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#FF9500]">
          <Zap className="h-4 w-4" />
          Alta rápida
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Escribe al bot una vez, copia el chat ID con @userinfobot o desde los logs, y agrégalo aquí.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-zinc-400">Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Luis Mata"
              className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Chat ID Telegram</Label>
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="123456789"
              className="mt-1.5 border-white/10 bg-zinc-900/80 font-mono text-sm text-zinc-100"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Cargo</Label>
            <Input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Comprador, Residente…"
              className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
            />
          </div>
          <div>
            <Label className="text-zinc-400">Teléfono (opcional)</Label>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="04141234567"
              className="mt-1.5 border-white/10 bg-zinc-900/80 text-zinc-100"
            />
          </div>
        </div>
        <Button
          type="button"
          disabled={guardando}
          onClick={() => void agregarRapido()}
          className="mt-4 rounded-xl bg-[#FF9500] text-black hover:bg-[#FF9500]/90"
        >
          {guardando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Autorizar ahora
        </Button>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
          {error.includes('ci_telegram_whitelist') ||
          error.includes('42P01') ||
          error.includes('cargo') ? (
            <span className="mt-1 block text-xs">
              Si falta la columna cargo, ejecuta en Supabase SQL Editor la migración{' '}
              <code className="text-[10px]">267_repair_ci_telegram_whitelist_cargo.sql</code> (o{' '}
              <code className="text-[10px]">231</code>), no la 218.
            </span>
          ) : null}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF9500]" />
        </div>
      ) : filas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
          No hay entradas manuales. Usa «Alta rápida» o agrega Telegram en la nómina del proyecto.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Cargo</TableHead>
                <TableHead className="text-zinc-400">Chat ID</TableHead>
                <TableHead className="text-zinc-400">Origen</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-right text-zinc-400">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id} className="border-white/5 hover:bg-white/[0.03]">
                  <TableCell className="font-medium text-white">{f.nombre}</TableCell>
                  <TableCell>
                    <Input
                      key={`${f.id}-${f.cargo ?? ''}`}
                      defaultValue={f.cargo ?? cargosCompras[f.chat_id] ?? ''}
                      placeholder="Sin cargo"
                      onBlur={(e) => void guardarCargo(f, e.target.value)}
                      className="h-8 min-w-[8rem] border-white/10 bg-zinc-900/60 text-sm text-zinc-200"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm text-zinc-400">{f.chat_id}</TableCell>
                  <TableCell className="text-sm capitalize text-zinc-500">{f.origen}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => void toggleActivo(f)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        f.activo
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border border-zinc-600 bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {f.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    {f.origen === 'manual' ? (
                      <button
                        type="button"
                        title="Eliminar"
                        onClick={() => void eliminar(f)}
                        className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">vía nómina</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-zinc-500">
        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        En producción puedes forzar la lista con{' '}
        <code className="rounded bg-zinc-900 px-1">TELEGRAM_WHITELIST_ENFORCED=true</code> en Vercel,
        además de <code className="rounded bg-zinc-900 px-1">TELEGRAM_ALLOWED_CHAT_IDS</code>.
      </p>
    </div>
  );
}
