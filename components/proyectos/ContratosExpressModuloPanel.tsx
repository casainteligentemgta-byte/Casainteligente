'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, RefreshCw, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';
import AccionesContratoPdfFila from '@/components/rrhh/AccionesContratoPdfFila';
import { Button } from '@/components/ui/button';

type ExpressRow = {
  id: string;
  created_at: string;
  obrero_nombre: string;
  obrero_cedula: string;
  formalizado_empleado_id?: string | null;
};

type Props = {
  moduloIntegralId: string;
  /** Si se define, lista express de todos estos `proyecto_id` (p. ej. alcance «Todos»). */
  proyectoIdsAlcance?: string[];
};

/**
 * Cuadro fijo en módulo integral (?tab=solicitados): obreros contratados vía express (fast-track)
 * para este módulo y proyectos/obra hija (`proyecto_id` en `ci_contratos_express`).
 */
export default function ContratosExpressModuloPanel({ moduloIntegralId, proyectoIdsAlcance }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ExpressRow[]>([]);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      let proyectoIds: string[];
      if (proyectoIdsAlcance?.length) {
        proyectoIds = Array.from(new Set(proyectoIdsAlcance.map((s) => s.trim()).filter(Boolean)));
      } else {
        const id = moduloIntegralId.trim();
        if (!id) {
          setLoading(false);
          setRows([]);
          return;
        }
        const hijas = await idsObrasHijasDesdeModuloIntegral(supabase, id);
        proyectoIds = Array.from(new Set([id, ...hijas]));
      }
      if (proyectoIds.length === 0) {
        setRows([]);
        return;
      }

      const resFull = await supabase
        .from('ci_contratos_express')
        .select('id,created_at,obrero_nombre,obrero_cedula,formalizado_empleado_id')
        .in('proyecto_id', proyectoIds)
        .order('created_at', { ascending: false });

      let data: unknown[] | null = resFull.data as unknown[] | null;
      let error = resFull.error;

      if (
        error &&
        /formalizado_empleado_id|42703|column|does not exist|schema cache/i.test(error.message ?? '')
      ) {
        const resBare = await supabase
          .from('ci_contratos_express')
          .select('id,created_at,obrero_nombre,obrero_cedula')
          .in('proyecto_id', proyectoIds)
          .order('created_at', { ascending: false });
        data = resBare.data;
        error = resBare.error;
      }

      if (error) {
        setErr(error.message);
        setRows([]);
        return;
      }

      setRows((data ?? []) as ExpressRow[]);
    } catch {
      setErr('No se pudo cargar la lista de contratos express.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [moduloIntegralId, proyectoIdsAlcance, supabase]);

  async function eliminarFila(id: string, nombre: string, formalizado: boolean) {
    const detalle = formalizado
      ? 'Este express ya fue formalizado: el expediente en Talento (ci_empleados) no se borra. Solo se elimina el registro express y los archivos en almacenamiento.'
      : 'Se eliminará el registro y los PDF/archivos asociados. Esta acción no se puede deshacer.';
    if (!window.confirm(`${detalle}\n\n¿Eliminar el contrato express de «${nombre}»?`)) return;
    setBusyDeleteId(id);
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}`, { method: 'DELETE' });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo eliminar');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ci-resumen-obreros-refresh'));
      }
      toast.success('Contrato express eliminado');
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyDeleteId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/35 to-zinc-950/80 p-5 shadow-[0_0_32px_rgba(245,158,11,0.08)] backdrop-blur-xl"
      aria-labelledby="cuadro-obreros-express-titulo"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15">
            <Users className="h-5 w-5 text-amber-200" aria-hidden />
          </div>
          <div>
            <h2 id="cuadro-obreros-express-titulo" className="text-base font-bold tracking-tight text-white">
              Cuadro de obreros — contratos express (fast-track)
            </h2>
            <p className="mt-0.5 max-w-2xl text-[11px] text-zinc-500">
              Contratados por Talento sin expediente previo en <span className="font-mono text-zinc-400">ci_empleados</span>
              ; mismo módulo integral y obras/proyectos hijos vinculados. Desde Talento: PDF, compartir enlace y
              formalizar.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="border-amber-500/40 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50"
            title="Recargar lista"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            <span className="ml-1.5 hidden sm:inline">Actualizar</span>
          </Button>
          <Link
            href="/rrhh/registro"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-950/50 px-3 py-2 text-xs font-bold text-amber-50 transition hover:border-amber-400/70 hover:bg-amber-900/55"
          >
            <FileText className="size-3.5 shrink-0" aria-hidden />
            Nuevo express
            <ExternalLink className="size-3.5 shrink-0 opacity-80" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Cargando contratos express…</p>
        ) : err ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">{err}</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
            No hay contratos express en este alcance. Crea uno en{' '}
            <Link href="/rrhh/registro" className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200">
              Talento → Nuevo express
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-black/25">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-500/25 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Obrero</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-center">Contrato</th>
                  <th className="px-4 py-3 text-right">Borrar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const formal = Boolean(r.formalizado_empleado_id);
                  const busy = busyDeleteId === r.id;
                  return (
                    <tr key={r.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-4 py-2.5 text-zinc-500">
                        {new Date(r.created_at).toLocaleDateString('es-VE')}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-zinc-100">{r.obrero_nombre}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{r.obrero_cedula}</td>
                      <td className="px-4 py-2.5">
                        {formal ? (
                          <span className="inline-block rounded-md border border-emerald-500/40 bg-emerald-950/45 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                            Formalizado en Talento
                          </span>
                        ) : (
                          <span className="inline-block rounded-md border border-amber-500/45 bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                            Express — pendiente expediente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <AccionesContratoPdfFila
                          empleadoRowId={`ci-express-${r.id}`}
                          nombreObrero={r.obrero_nombre}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy || loading}
                          className="h-8 gap-1 border-red-900/55 bg-red-950/30 px-2 text-xs font-semibold text-red-200 hover:bg-red-950/50 hover:text-red-50"
                          title="Eliminar este contrato express de la lista y el almacenamiento"
                          aria-label={`Borrar contrato express ${r.obrero_nombre}`}
                          onClick={() => void eliminarFila(r.id, r.obrero_nombre, formal)}
                        >
                          <Trash2 className="size-3.5 shrink-0" aria-hidden />
                          Borrar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !err && rows.length > 0 ? (
        <p className="mt-3 text-center text-[11px] text-zinc-600">
          {rows.length} registro{rows.length === 1 ? '' : 's'} — PDF, firmado y formalizar en la vista completa de Talento.
        </p>
      ) : null}
    </section>
  );
}
