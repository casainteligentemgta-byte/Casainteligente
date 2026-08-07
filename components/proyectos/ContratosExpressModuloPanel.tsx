'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Files, Loader2, Pencil, Printer, RefreshCw, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { idsObrasHijasDesdeModuloIntegral } from '@/lib/proyectos/obraHijasDesdeModulo';
import AccionesContratoPdfFila from '@/components/rrhh/AccionesContratoPdfFila';
import ModalEditarContratoExpress from '@/components/rrhh/express/ModalEditarContratoExpress';
import { Button } from '@/components/ui/button';
import { descargarPdfUnicoContratosExpress } from '@/lib/rrhh/descargarPdfUnicoCliente';
import { hrefListaContratosExpress } from '@/lib/talento/hrefListaContratosExpress';
import { normalizarListaContratosExpressObrero } from '@/lib/talento/filtrarContratosExpressObrero';

type ExpressRow = {
  id: string;
  created_at: string;
  obrero_nombre: string;
  obrero_cedula: string;
  formalizado_empleado_id?: string | null;
  tipo_contrato?: string | null;
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
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busyPdfLote, setBusyPdfLote] = useState(false);

  const hrefExpress = useMemo(() => {
    const base = hrefListaContratosExpress();
    const first = (proyectoIdsAlcance?.[0] ?? moduloIntegralId).trim();
    if (!first || base.startsWith('http')) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}proyecto=${encodeURIComponent(first)}`;
  }, [moduloIntegralId, proyectoIdsAlcance]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setSelectedIds(new Set());
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
        .select('id,created_at,obrero_nombre,obrero_cedula,formalizado_empleado_id,tipo_contrato')
        .in('proyecto_id', proyectoIds)
        .order('created_at', { ascending: false });

      let data: unknown[] | null = resFull.data as unknown[] | null;
      let error = resFull.error;

      if (
        error &&
        /formalizado_empleado_id|tipo_contrato|42703|column|does not exist|schema cache/i.test(
          error.message ?? '',
        )
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

      setRows(normalizarListaContratosExpressObrero((data ?? []) as ExpressRow[]));
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
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  const todosSeleccionados = rows.length > 0 && selectedIds.size === rows.length;
  const algunoSeleccionado = selectedIds.size > 0;

  function toggleTodos() {
    if (todosSeleccionados) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((r) => r.id)));
  }

  function toggleUno(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pdfUnico(abrirParaImprimir: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Seleccione al menos un contrato.');
      return;
    }
    setBusyPdfLote(true);
    try {
      const out = await descargarPdfUnicoContratosExpress(ids, {
        abrirParaImprimir,
        nombreArchivo: `contratos-obra-${ids.length}.pdf`,
      });
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      toast.success(
        abrirParaImprimir
          ? `PDF único abierto (${ids.length}).`
          : `PDF único descargado (${ids.length}).`,
      );
    } catch {
      toast.error('Error al generar el PDF único.');
    } finally {
      setBusyPdfLote(false);
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
              Contratados por Talento sin expediente previo. La carga masiva (CSV) está en{' '}
              <Link href={hrefExpress} className="font-semibold text-amber-300 underline underline-offset-2">
                RRHH → Express
              </Link>{' '}
              (obra + entidad patrono).
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {rows.length > 0 ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyPdfLote || !algunoSeleccionado}
                onClick={() => void pdfUnico(false)}
                className="border-emerald-500/45 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/50"
                title="Descargar un solo PDF con los contratos seleccionados"
              >
                {busyPdfLote ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Files className="size-4" aria-hidden />
                )}
                <span className="ml-1.5 hidden sm:inline">
                  PDF único{algunoSeleccionado ? ` (${selectedIds.size})` : ''}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyPdfLote || !algunoSeleccionado}
                onClick={() => void pdfUnico(true)}
                className="border-emerald-500/35 text-emerald-100/90"
                title="Abrir PDF único para imprimir"
              >
                <Printer className="size-4" aria-hidden />
                <span className="ml-1.5 hidden md:inline">Imprimir</span>
              </Button>
            </>
          ) : null}
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
            href={hrefExpress}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/45 bg-amber-950/50 px-3 py-2 text-xs font-bold text-amber-50 transition hover:border-amber-400/70 hover:bg-amber-900/55"
          >
            <FileText className="size-3.5 shrink-0" aria-hidden />
            Carga masiva
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
            No hay contratos express en este alcance. Use{' '}
            <Link href={hrefExpress} className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200">
              RRHH → Express
            </Link>{' '}
            para la carga masiva.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-black/25">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-500/25 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                  <th className="w-10 px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={todosSeleccionados}
                      onChange={toggleTodos}
                      aria-label="Seleccionar todos"
                      className="size-3.5 accent-amber-500"
                    />
                  </th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Obrero</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-center">Contrato</th>
                  <th className="px-4 py-3 text-center">Editar</th>
                  <th className="px-4 py-3 text-right">Borrar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const formal = Boolean(r.formalizado_empleado_id);
                  const busy = busyDeleteId === r.id;
                  return (
                    <tr key={r.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleUno(r.id)}
                          aria-label={`Seleccionar ${r.obrero_nombre}`}
                          className="size-3.5 accent-amber-500"
                        />
                      </td>
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
                      <td className="px-4 py-2.5 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-amber-700/50 bg-amber-950/25 px-2 text-xs text-amber-100"
                          title="Editar datos del contrato y regenerar PDF"
                          aria-label={`Editar contrato ${r.obrero_nombre}`}
                          onClick={() => setEditId(r.id)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
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
          {rows.length} registro{rows.length === 1 ? '' : 's'} — marque y use PDF único para imprimir el
          lote. Carga masiva en RRHH → Express.
        </p>
      ) : null}

      <ModalEditarContratoExpress
        open={Boolean(editId)}
        contratoId={editId}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
        onGuardado={() => void load()}
      />
    </section>
  );
}
