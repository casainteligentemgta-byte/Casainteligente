'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchCuadroContratados,
  type FilaNominaContratado,
} from '@/lib/nomina/fetchCuadroContratados';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Props = {
  /** Si se indica, solo contratados del módulo / obras hijas. */
  proyectoModuloId?: string;
  className?: string;
  titulo?: string;
};

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function CuadroNominaContratados({
  proyectoModuloId,
  className = '',
  titulo = 'Contratados — nómina',
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaNominaContratado[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCuadroContratados(supabase, {
        proyectoModuloId: proyectoModuloId?.trim() || undefined,
      });
      setFilas(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el cuadro de nómina.');
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [proyectoModuloId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl ${className}`.trim()}
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <Users className="h-5 w-5 text-emerald-400" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-300">{titulo}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {loading ? 'Actualizando…' : `${filas.length} obrero${filas.length === 1 ? '' : 's'} con contrato activo`}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Cargando contratados…</p>
      ) : filas.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No hay obreros con contrato activo
          {proyectoModuloId ? ' en este proyecto' : ''}.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Apellidos</TableHead>
                <TableHead className="text-zinc-400">Cédula</TableHead>
                <TableHead className="text-right text-zinc-400">Bono (USD)</TableHead>
                <TableHead className="text-zinc-400">Fecha ingreso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.id} className="border-white/5 hover:bg-white/[0.03]">
                  <TableCell className="font-medium text-white">{f.nombres}</TableCell>
                  <TableCell className="text-zinc-300">{f.apellidos}</TableCell>
                  <TableCell className="font-mono text-sm text-zinc-400">{f.cedula}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-emerald-300/95">
                    {fmtUsd(f.bonoUsd)}
                  </TableCell>
                  <TableCell className="text-zinc-400">{fmtFecha(f.fechaIngreso)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
