'use client';

import { Loader2, PenTool, Printer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GlassModal } from '@/components/nexus/GlassModal';
import { createClient } from '@/lib/supabase/client';

type EmpleadoEmbed = {
  nombre_completo: string | null;
  cedula: string | null;
  documento: string | null;
  firma_electronica_at: string | null;
};

/** Sitio de obra (FK obra_id → ci_proyectos tras migración 086). */
type ObraSitioEmbed = { nombre: string | null };

export type FilaFirmaPendiente = {
  id: string;
  empleado_id: string;
  obra_id: string | null;
  proyecto_id: string | null;
  ci_empleados: EmpleadoEmbed | EmpleadoEmbed[] | null;
  obra_sitio: ObraSitioEmbed | ObraSitioEmbed[] | null;
};

function uno<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function cedulaDe(emp: EmpleadoEmbed | null): string {
  if (!emp) return '';
  return (emp.cedula ?? emp.documento ?? '').trim();
}

function nombreProyectoObra(row: FilaFirmaPendiente, nombresProyecto: Map<string, string>): string {
  const obra = uno(row.obra_sitio);
  const on = (obra?.nombre ?? '').trim();
  if (on) return on;
  const pid = (row.proyecto_id ?? '').trim();
  if (pid) return nombresProyecto.get(pid) ?? 'Proyecto';
  return '—';
}

function tiempoRelativo(iso: string | null | undefined, ahoraMs: number): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.floor((ahoraMs - t) / 1000));
  if (s < 45) return 'Hace un momento';
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `Hace ${m} min`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return `Hace ${h} h`;
  }
  const d = Math.floor(s / 86400);
  return `Hace ${d} d`;
}

export default function WidgetFirmasPendientes() {
  const supabase = useMemo(() => createClient(), []);
  const [filas, setFilas] = useState<FilaFirmaPendiente[]>([]);
  const [nombresProyecto, setNombresProyecto] = useState<Map<string, string>>(() => new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filaModal, setFilaModal] = useState<FilaFirmaPendiente | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from('ci_contratos_empleado_obra')
      .select(
        `
        id,
        empleado_id,
        obra_id,
        proyecto_id,
        ci_empleados ( nombre_completo, cedula, documento, firma_electronica_at ),
        obra_sitio:ci_proyectos!ci_contratos_empleado_obra_obra_id_fkey ( nombre )
      `,
      )
      .eq('estado_contrato', 'firmado_electronico')
      .order('created_at', { ascending: false });

    if (err) {
      setFilas([]);
      setError(err.message);
      return;
    }

    const rows = (data ?? []) as FilaFirmaPendiente[];
    const pids = Array.from(new Set(rows.map((r) => (r.proyecto_id ?? '').trim()).filter(Boolean)));
    let map = new Map<string, string>();
    if (pids.length) {
      const { data: prs, error: e2 } = await supabase.from('ci_proyectos').select('id,nombre').in('id', pids);
      if (!e2 && prs) {
        map = new Map((prs as { id: string; nombre: string | null }[]).map((p) => [p.id, (p.nombre ?? '').trim() || 'Proyecto']));
      }
    }
    setNombresProyecto(map);
    setFilas(rows);
  }, [supabase]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      await cargar();
      if (vivo) setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [cargar]);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('widget_firmas_pendientes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ci_contratos_empleado_obra' },
        () => {
          void cargar();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ci_empleados' },
        () => {
          void cargar();
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[WidgetFirmasPendientes]', status, err?.message ?? err);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, cargar]);

  function abrirModalImprimir(row: FilaFirmaPendiente) {
    const emp = uno(row.ci_empleados);
    const ced = cedulaDe(emp);
    if (!ced) {
      toast.error('No hay cédula en el expediente; no se puede generar el PDF.');
      return;
    }
    const pdf = `/api/registro/planilla-empleo-pdf?empleadoId=${encodeURIComponent(row.empleado_id)}&cedula=${encodeURIComponent(ced)}&tipo=hoja_empleo`;
    window.open(pdf, '_blank', 'noopener,noreferrer');
    setFilaModal(row);
    setModalAbierto(true);
  }

  async function confirmarFisica() {
    if (!filaModal) return;
    setFinalizando(true);
    try {
      const res = await fetch(`/api/talento/contratos/${encodeURIComponent(filaModal.id)}/firmar-fisica`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? 'No se pudo actualizar el contrato.');
        return;
      }
      toast.success('Contrato marcado como firmado físico y activo.');
      setModalAbierto(false);
      setFilaModal(null);
      await cargar();
    } finally {
      setFinalizando(false);
    }
  }

  const empModal = uno(filaModal?.ci_empleados ?? null);

  return (
    <section
      className="rounded-2xl border border-orange-500/30 bg-white/[0.04] p-5 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(10,10,15,0.72)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/35">
            <PenTool className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">Firmas físicas pendientes</h2>
            <p className="text-xs text-zinc-500">
              Contratos con firma electrónica lista; falta huella y autógrafo en papel (LOTTT).
            </p>
          </div>
        </div>
        {filas.length > 0 ? (
          <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-200">
            {filas.length} pendiente{filas.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <div className="mt-4 min-h-[120px]">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
            Cargando…
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-500/25 bg-red-950/30 p-4 text-sm text-red-200/90">
            {error}
            <span className="mt-2 block text-xs text-red-300/80">
              Si el error menciona «column» o «estado_contrato», aplica la migración{' '}
              <code className="rounded bg-black/40 px-1">068_contratos_estado_firma_realtime.sql</code> en Supabase.
            </span>
          </p>
        ) : filas.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No hay contratos en espera de firma física.</p>
        ) : (
          <ul className="flex max-h-[min(52vh,420px)] flex-col gap-2 overflow-y-auto pr-1">
            {filas.map((row) => {
              const emp = uno(row.ci_empleados);
              const nombre = (emp?.nombre_completo ?? '').trim() || 'Sin nombre';
              const firmaAt = emp?.firma_electronica_at ?? null;
              const lugar = nombreProyectoObra(row, nombresProyecto);
              const rel = tiempoRelativo(firmaAt, tick);
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-semibold text-white">{nombre}</p>
                    <p className="truncate text-xs text-zinc-400">
                      <span className="text-zinc-500">Obra / proyecto:</span> {lugar}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="rounded-md border border-zinc-600/60 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                        {rel}
                      </span>
                      {firmaAt ? (
                        <span className="text-[10px] text-zinc-600">
                          Firma digital:{' '}
                          {new Date(firmaAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirModalImprimir(row)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-4 py-2.5 text-xs font-bold text-black transition hover:opacity-95"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir y finalizar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <GlassModal
        open={modalAbierto}
        onOpenChange={(o) => {
          setModalAbierto(o);
          if (!o) setFilaModal(null);
        }}
        title="Firma física y huella"
        description={
          empModal
            ? `Confirma que ${(empModal.nombre_completo ?? '').trim() || 'el obrero'} ya estampó huella dactilar y firmó a mano sobre la planilla impresa.`
            : 'Confirma la firma física antes de activar el contrato.'
        }
        className="border-orange-500/30 shadow-[0_0_0_1px_rgba(249,115,22,0.2),0_24px_80px_rgba(0,0,0,0.65)]"
      >
        <p className="text-sm leading-relaxed text-zinc-400">
          El PDF con la Sección XIII y la firma electrónica debería haberse abierto en una pestaña nueva. Solo marca como
          listo cuando RRHH haya verificado el documento impreso.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={finalizando}
            onClick={() => setModalAbierto(false)}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 min-[400px]:flex-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={finalizando}
            onClick={() => void confirmarFisica()}
            className="inline-flex min-h-[42px] flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF9500] to-orange-700 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Firmado físico y activo
          </button>
        </div>
      </GlassModal>
    </section>
  );
}
