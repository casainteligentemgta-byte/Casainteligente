'use client';

import Link from 'next/link';
import { FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type EmpleadoRow = {
  id: string;
  nombre_completo: string | null;
  documento: string | null;
  cedula: string | null;
  created_at: string;
  estado_proceso: string | null;
  cargo_nombre: string | null;
  recruitment_need_id: string | null;
  proyecto_modulo_id: string | null;
};

function docMostrado(row: EmpleadoRow): string {
  return (row.cedula ?? row.documento ?? '').trim() || '—';
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function RrhhHojasVidaPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<EmpleadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('ci_empleados')
      .select(
        'id,nombre_completo,documento,cedula,created_at,estado_proceso,cargo_nombre,recruitment_need_id,proyecto_modulo_id',
      )
      .eq('estado_proceso', 'cv_completado')
      .order('created_at', { ascending: false })
      .limit(300);

    setLoading(false);
    if (err) {
      setError(err.message);
      setRows([]);
      return;
    }
    setRows((data ?? []) as EmpleadoRow[]);
  }, [supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const borrarEmpleado = useCallback(
    async (r: EmpleadoRow) => {
      const nombre = (r.nombre_completo ?? '').trim() || 'este registro';
      if (
        !window.confirm(
          `¿Eliminar a «${nombre}» de la base de datos?\n\nSe borrará el expediente (ci_empleados). Esta acción no se puede deshacer.`,
        )
      ) {
        return;
      }
      setDeletingId(r.id);
      setError(null);
      const { error: delErr } = await supabase.from('ci_empleados').delete().eq('id', r.id);
      setDeletingId(null);
      if (delErr) {
        setError(delErr.message);
        return;
      }
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    },
    [supabase],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-8">
      <header className="mb-8">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Casa Inteligente</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">RRHH — Hojas de vida recibidas</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Expedientes con estado «cv_completado». Usa <span className="text-zinc-200">Hoja de empleo</span> para el PDF
              completo (I–IV: trabajador, patrono, obra, contratación + resto). <span className="text-zinc-200">Hoja de vida</span>{' '}
              omite patrono, obra y contratación. En onboarding sigue disponible{' '}
              <code className="text-zinc-500">/api/talento/hoja-vida/pdf?token=…</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Cargando lista…</p>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-zinc-500">
          Aún no hay registros con hoja de vida completada.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((r) => {
            const nombre = (r.nombre_completo ?? '').trim() || 'Sin nombre';
            const cargo = (r.cargo_nombre ?? '').trim() || '—';
            const doc = docMostrado(r);
            const pdfBase = `/registro/planilla?empleadoId=${encodeURIComponent(r.id)}&cedula=${encodeURIComponent(doc === '—' ? '' : doc)}`;
            const pdfHojaVida = `${pdfBase}&tipo=hoja_vida`;
            const pdfHojaEmpleo = `${pdfBase}&tipo=hoja_empleo`;
            const proyectoHref = r.proyecto_modulo_id
              ? `/proyectos/modulo/${encodeURIComponent(r.proyecto_modulo_id)}?tab=rrhh`
              : null;

            return (
              <li
                key={r.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{nombre}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Cédula / doc.: <span className="text-zinc-300">{doc}</span>
                    {' · '}
                    <span className="text-zinc-500">{fechaCorta(r.created_at)}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Cargo: <span className="text-zinc-200">{cargo}</span>
                    {r.recruitment_need_id ? (
                      <span className="text-zinc-600"> · Vacante vinculada</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {doc !== '—' ? (
                    <>
                      <a
                        href={pdfHojaEmpleo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#FF9500]/35 bg-[#FF9500]/15 px-3 py-2 text-xs font-bold text-[#FFD60A] transition hover:bg-[#FF9500]/25"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Hoja de empleo
                      </a>
                      <a
                        href={pdfHojaVida}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                      >
                        <FileText className="h-3.5 w-3.5 opacity-70" />
                        Hoja de vida
                      </a>
                    </>
                  ) : null}
                  {proyectoHref ? (
                    <Link
                      href={proyectoHref}
                      className="inline-flex rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/10"
                    >
                      Proyecto RRHH
                    </Link>
                  ) : null}
                  <Link
                    href={`/empleados/${encodeURIComponent(r.id)}`}
                    className="inline-flex rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
                  >
                    Ficha
                  </Link>
                  <button
                    type="button"
                    onClick={() => void borrarEmpleado(r)}
                    disabled={deletingId === r.id}
                    title="Eliminar expediente del obrero"
                    aria-label={`Eliminar expediente de ${nombre}`}
                    className="inline-flex items-center justify-center rounded-lg border border-red-500/25 bg-red-950/20 p-2 text-red-300 transition hover:border-red-400/50 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    <Trash2 className={`h-4 w-4 ${deletingId === r.id ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
