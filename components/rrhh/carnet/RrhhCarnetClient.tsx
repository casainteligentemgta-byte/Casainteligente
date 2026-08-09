'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Download, Loader2, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import CarnetDigitalCard from '@/components/rrhh/carnet/CarnetDigitalCard';
import type { DatosCarnetDigital } from '@/lib/rrhh/carnetDigital';
import { apiUrl } from '@/lib/http/apiUrl';

type EmpOpt = {
  id: string;
  nombre_completo: string | null;
  cedula: string | null;
  documento: string | null;
  cargo_nombre: string | null;
  estatus: string | null;
};

export default function RrhhCarnetClient() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const initialId = (searchParams.get('empleado') ?? searchParams.get('id') ?? '').trim();

  const [empleados, setEmpleados] = useState<EmpOpt[]>([]);
  const [empleadoId, setEmpleadoId] = useState(initialId);
  const [datos, setDatos] = useState<DatosCarnetDigital | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingCard, setLoadingCard] = useState(false);
  const [busyEmit, setBusyEmit] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoadingList(true);
      const { data, error } = await supabase
        .from('ci_empleados')
        .select('id,nombre_completo,cedula,documento,cargo_nombre,estatus')
        .eq('rol_examen', 'obrero')
        .order('nombre_completo')
        .limit(400);
      if (!alive) return;
      if (error) toast.error(error.message);
      else setEmpleados((data ?? []) as EmpOpt[]);
      setLoadingList(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const cargar = useCallback(async (id: string) => {
    if (!id) {
      setDatos(null);
      return;
    }
    setLoadingCard(true);
    try {
      const res = await fetch(apiUrl(`/api/rrhh/carnet/${encodeURIComponent(id)}?format=json`), {
        credentials: 'include',
        cache: 'no-store',
      });
      const j = (await res.json()) as { ok?: boolean; carnet?: DatosCarnetDigital; error?: string };
      if (!res.ok) throw new Error(j.error || 'No se pudo cargar el carnet');
      setDatos(j.carnet ?? null);
    } catch (e) {
      setDatos(null);
      toast.error(e instanceof Error ? e.message : 'Error al cargar carnet');
    } finally {
      setLoadingCard(false);
    }
  }, []);

  useEffect(() => {
    if (empleadoId) void cargar(empleadoId);
  }, [empleadoId, cargar]);

  const emitir = async () => {
    if (!empleadoId) return;
    setBusyEmit(true);
    try {
      const res = await fetch(apiUrl(`/api/rrhh/carnet/${encodeURIComponent(empleadoId)}`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as { ok?: boolean; carnet?: DatosCarnetDigital; error?: string };
      if (!res.ok) throw new Error(j.error || 'No se pudo emitir');
      setDatos(j.carnet ?? null);
      toast.success('Carnet emitido / actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al emitir');
    } finally {
      setBusyEmit(false);
    }
  };

  const pdfUrl = empleadoId
    ? apiUrl(`/api/rrhh/carnet/${encodeURIComponent(empleadoId)}?emitir=1&format=pdf`)
    : '';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <CreditCard className="h-6 w-6 text-amber-400" />
          Carnet digital
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Credencial del obrero tras contrato firmado (obrero + compañía) y formalización. Incluye
          oficio del tabulador, obra y foto de la hoja de vida.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Trabajador
          <select
            className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={empleadoId}
            disabled={loadingList}
            onChange={(e) => setEmpleadoId(e.target.value)}
          >
            <option value="">Seleccione obrero…</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {(e.nombre_completo ?? 'Sin nombre').trim()} ·{' '}
                {(e.cedula ?? e.documento ?? '').trim() || e.id.slice(0, 8)}
                {e.cargo_nombre ? ` · ${e.cargo_nombre}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!empleadoId || loadingCard}
            onClick={() => void cargar(empleadoId)}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!empleadoId || busyEmit}
            onClick={() => void emitir()}
          >
            {busyEmit ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            )}
            Emitir carnet
          </Button>
          {pdfUrl ? (
            <>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center rounded-md border border-white/15 bg-transparent px-3 text-xs font-semibold text-zinc-200 hover:bg-white/5"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </a>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-6">
        {loadingCard ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : datos ? (
          <CarnetDigitalCard datos={datos} />
        ) : (
          <p className="max-w-sm text-center text-sm text-zinc-500">
            Seleccione un obrero contratado para ver o emitir su carnet digital.
          </p>
        )}
      </div>
    </div>
  );
}
