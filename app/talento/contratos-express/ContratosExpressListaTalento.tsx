'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = {
  id: string;
  created_at: string;
  obrero_nombre: string;
  obrero_cedula: string;
  proyecto_id: string;
  formalizado_empleado_id?: string | null;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
};

function nombreProyecto(r: Row): string {
  const p = r.ci_proyectos;
  if (p == null) return r.proyecto_id?.slice(0, 8) ?? '—';
  const o = Array.isArray(p) ? p[0] : p;
  const n = o?.nombre?.trim();
  return n || r.proyecto_id?.slice(0, 8) || '—';
}

export function ContratosExpressListaTalento() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const selects = [
      'id,created_at,obrero_nombre,obrero_cedula,proyecto_id,formalizado_empleado_id,ci_proyectos(nombre)',
      'id,created_at,obrero_nombre,obrero_cedula,proyecto_id,formalizado_empleado_id',
      'id,created_at,obrero_nombre,obrero_cedula,proyecto_id',
    ];
    try {
      for (const sel of selects) {
        const { data, error } = await supabase
          .from('ci_contratos_express')
          .select(sel)
          .order('created_at', { ascending: false });
        if (error) continue;
        setRows(((data ?? []) as unknown) as Row[]);
        setLoading(false);
        return;
      }
      setErr('No se pudo leer ci_contratos_express (permisos o columnas).');
      setRows([]);
    } catch {
      setErr('Error de red o sesión al cargar contratos express.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function eliminar(id: string, nombre: string, formalizado: boolean) {
    const detalle = formalizado
      ? 'Ya formalizado: no se borra ci_empleados; solo el registro express y archivos en storage.'
      : 'Se eliminará el registro y los archivos asociados.';
    if (!window.confirm(`${detalle}\n\n¿Eliminar «${nombre}»?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}`, { method: 'DELETE' });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo eliminar');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Eliminado');
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyId(null);
    }
  }

  async function abrirPdfGenerado(id: string) {
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}/pdf-url`);
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        toast.error(j.error ?? 'No se obtuvo enlace del PDF');
        return;
      }
      window.open(j.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Error de red');
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <p className="text-sm text-zinc-400">
          Registros en <code className="text-zinc-500">ci_contratos_express</code> visibles con tu sesión (RLS).
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="border-zinc-600 bg-zinc-900 text-zinc-100"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="ml-2">Actualizar</span>
        </Button>
      </div>
      {loading ? (
        <p className="p-6 text-sm text-zinc-500">Cargando…</p>
      ) : err ? (
        <p className="p-6 text-sm text-red-400">{err}</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-sm text-zinc-500">
          No hay contratos express.{' '}
          <Link href="/talento/admin/contratos/fast-create" className="text-amber-400 underline">
            Crear uno
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Obrero</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const formal = Boolean(r.formalizado_empleado_id);
                const busy = busyId === r.id;
                const pid = (r.proyecto_id ?? '').trim();
                return (
                  <TableRow key={r.id} className="border-zinc-800">
                    <TableCell className="whitespace-nowrap text-zinc-400">
                      {new Date(r.created_at).toLocaleDateString('es-VE')}
                    </TableCell>
                    <TableCell className="font-medium text-white">{r.obrero_nombre}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-300">{r.obrero_cedula}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-zinc-300">
                      {pid ? (
                        <Link
                          href={`/proyectos/modulo/${encodeURIComponent(pid)}?tab=solicitados`}
                          className="text-sky-400 hover:underline"
                        >
                          {nombreProyecto(r)}
                        </Link>
                      ) : (
                        nombreProyecto(r)
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formal ? (
                        <span className="text-emerald-400">Formalizado</span>
                      ) : (
                        <span className="text-zinc-500">Pendiente</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          className="border-zinc-600"
                          title="Abrir PDF generado (enlace temporal)"
                          onClick={() => void abrirPdfGenerado(r.id)}
                        >
                          <FileText className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          className="border-red-800/60 text-red-200"
                          onClick={() => void eliminar(r.id, r.obrero_nombre, formal)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
