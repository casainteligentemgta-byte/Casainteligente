'use client';

import Link from 'next/link';
import { Download, FileText, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { bonoUsdABs, tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import { cn } from '@/lib/utils';

/** Relación many-to-one: PostgREST a veces devuelve objeto único o array de un elemento. */
export type ProyectoExpressJoin = {
  nombre: string;
  ci_entidades?: { nombre: string; rif: string | null } | { nombre: string; rif: string | null }[] | null;
};

/** Fila devuelta por PostgREST con relaciones anidadas (nombres según el `select` del servidor). */
export type ContratoExpressListItem = {
  id: string;
  created_at: string;
  obrero_cedula: string;
  obrero_nombre: string;
  proyecto_id: string;
  /** Bono variable en USD; en Bs al pagar con tasa BCV del día (ver env). */
  bono_manual_usd: number | string | null;
  salario_base_mensual_snapshot: number | string | null;
  pdf_storage_path: string;
  formalizado?: boolean | null;
  formalizado_empleado_id?: string | null;
  ci_proyectos?: ProyectoExpressJoin | ProyectoExpressJoin[] | null;
};

function proyectoRel(r: ContratoExpressListItem): ProyectoExpressJoin | null {
  const p = r.ci_proyectos;
  if (p == null) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

function entidadRel(p: ProyectoExpressJoin | null): { nombre: string; rif: string | null } | null {
  if (!p?.ci_entidades) return null;
  const e = p.ci_entidades;
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

const fmtBs = (n: number) =>
  new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function salarioSnapshotBs(r: ContratoExpressListItem): number {
  const s = Number(r.salario_base_mensual_snapshot);
  return Number.isFinite(s) && s > 0 ? s : 0;
}

function bonoUsdNum(r: ContratoExpressListItem): number {
  const b = Number(r.bono_manual_usd);
  return Number.isFinite(b) && b >= 0 ? b : 0;
}

function nombreProyecto(r: ContratoExpressListItem): string {
  const p = proyectoRel(r);
  const n = p?.nombre?.trim();
  return n || r.proyecto_id.slice(0, 8);
}

function textoEntidad(r: ContratoExpressListItem): string {
  const e = entidadRel(proyectoRel(r));
  if (!e) return '—';
  const nombre = (e.nombre ?? '').trim();
  const rif = (e.rif ?? '').trim();
  if (nombre && rif) return `${nombre} · ${rif}`;
  return nombre || rif || '—';
}

type Props = {
  initialData: ContratoExpressListItem[];
  fetchError?: string | null;
};

export function FastContratosExpressTable({ initialData, fetchError }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ContratoExpressListItem[]>(initialData);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialData);
  }, [initialData]);

  async function handleDownload(path: string, nombre: string, rowId: string) {
    const p = (path ?? '').trim();
    if (!p) {
      toast.error('No se encontró la ruta del archivo');
      return;
    }
    setBusyId(rowId);
    try {
      const { data, error: stErr } = await supabase.storage.from('contratos_obreros').download(p);
      if (!stErr && data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Contrato_${nombre.replace(/\s/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const res = await fetch(`/api/talento/contratos-express/${rowId}/pdf-url`);
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        toast.error(j.error ?? stErr?.message ?? 'Error al descargar el PDF');
        return;
      }
      const blob = await fetch(j.url).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contrato_${nombre.replace(/\s/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al descargar el PDF');
    } finally {
      setBusyId(null);
    }
  }

  async function formalizar(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}/formalizar`, { method: 'POST' });
      const j = (await res.json()) as { empleado_id?: string; error?: string };
      if (res.status === 409 && j.empleado_id) {
        toast.message(j.error ?? 'Conflicto', { description: `Expediente: ${j.empleado_id.slice(0, 8)}…` });
        router.refresh();
        return;
      }
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo formalizar');
        return;
      }
      toast.success('Expediente creado en Talento', {
        description: j.empleado_id ? `ID: ${j.empleado_id}` : undefined,
      });
      router.refresh();
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyId(null);
    }
  }

  const totalesLista = useMemo(() => {
    const tasa = tasaBcvVesPorUsdFromEnv();
    let base = 0;
    let bonosUsd = 0;
    for (const c of rows) {
      base += salarioSnapshotBs(c);
      bonosUsd += bonoUsdNum(c);
    }
    const bonosBsRef = tasa != null ? bonoUsdABs(bonosUsd, tasa) : null;
    return { base, bonosUsd, bonosBsRef, tasa };
  }, [rows]);

  if (fetchError) {
    return (
      <p className="text-sm text-red-400">
        No se pudieron cargar los contratos: {fetchError}
      </p>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 pb-28">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-3">
          <Link href="/talento" className="text-zinc-500 hover:text-zinc-300">
            ← Talento
          </Link>
          <Link href="/talento/admin/contratos" className="text-zinc-500 hover:text-zinc-300">
            Contratos dinámicos
          </Link>
          <Link href="/talento/admin/contratos/fast-create" className="inline-flex items-center gap-1 text-amber-500/90 hover:text-amber-400">
            <FileText className="size-3.5 shrink-0" />
            Nuevo express
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contratos express (fast-track)</h1>
          <p className="text-sm text-zinc-400">
            Sin registro previo en <code className="text-zinc-500">ci_empleados</code>. Salario base: snapshot{' '}
            <strong className="text-zinc-300">mensual en Bs</strong> (tabulador). Bono: <strong className="text-zinc-300">USD</strong>; en cada pago (p. ej. viernes) se convierte a Bs con la tasa oficial del BCV de ese día. Para equivalentes en pantalla, define{' '}
            <code className="text-zinc-500">NEXT_PUBLIC_TASA_BCV_VES_POR_USD</code> (Bs por USD) y actualízala el día de pago.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay registros. Usa «Nuevo express» para generar uno.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-sm text-zinc-400">Salario base (snapshot tabulador, mensual)</p>
              <p className="text-2xl font-bold tabular-nums text-zinc-100">{fmtBs(totalesLista.base)} Bs</p>
            </div>
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4">
              <p className="text-sm text-amber-200/80">Total bonos (USD)</p>
              <p className="text-2xl font-bold tabular-nums text-amber-400">{fmtUsd(totalesLista.bonosUsd)}</p>
            </div>
            <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/25 p-4">
              <p className="text-sm text-emerald-200/80">Bonos en Bs (referencia, tasa BCV configurada)</p>
              {totalesLista.bonosBsRef != null && totalesLista.tasa != null ? (
                <>
                  <p className="text-2xl font-bold tabular-nums text-emerald-400">{fmtBs(totalesLista.bonosBsRef)} Bs</p>
                  <p className="mt-1 text-[11px] text-emerald-200/60">
                    Suma de USD × {fmtBs(totalesLista.tasa)} Bs/USD (solo referencia; el pago usa la tasa del viernes).
                  </p>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  Sin tasa: añade <code className="text-zinc-600">NEXT_PUBLIC_TASA_BCV_VES_POR_USD</code> en el entorno.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/90 text-zinc-100">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Obrero</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead className="text-right">Salario (Bs/mes)</TableHead>
                  <TableHead className="text-right">Bono (USD)</TableHead>
                  <TableHead className="text-right">Bono ref. (Bs)</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const busy = busyId === c.id;
                  const formalizado = Boolean(c.formalizado_empleado_id) || c.formalizado === true;
                  const salBs = salarioSnapshotBs(c);
                  const bonUsd = bonoUsdNum(c);
                  const tasa = totalesLista.tasa;
                  const bonBsRef = tasa != null ? bonoUsdABs(bonUsd, tasa) : null;
                  return (
                    <TableRow key={c.id} className="border-zinc-800">
                      <TableCell className="whitespace-nowrap text-zinc-400">
                        {new Date(c.created_at).toLocaleDateString('es-VE')}
                      </TableCell>
                      <TableCell className="font-medium text-white">{c.obrero_nombre}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300">{c.obrero_cedula}</TableCell>
                      <TableCell className="text-zinc-300">{nombreProyecto(c)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-zinc-400" title={textoEntidad(c)}>
                        {textoEntidad(c)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-zinc-200" title="Snapshot tabulador (mensual)">
                        {fmtBs(salBs)} Bs
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-amber-300" title="Acordado en USD">
                        {fmtUsd(bonUsd)}
                      </TableCell>
                      <TableCell
                        className={cn('text-right text-sm tabular-nums text-emerald-400/90')}
                        title={
                          tasa != null
                            ? `Equivalente con tasa referencia ${tasa} Bs/USD (actualizar el día de pago BCV)`
                            : 'Configure NEXT_PUBLIC_TASA_BCV_VES_POR_USD para ver equivalente'
                        }
                      >
                        {bonBsRef != null ? `${fmtBs(bonBsRef)} Bs` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                            onClick={() => void handleDownload(c.pdf_storage_path, c.obrero_nombre, c.id)}
                          >
                            <Download className="size-4" />
                            PDF
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy || formalizado}
                            className="text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300"
                            title={formalizado ? 'Ya formalizado' : 'Convertir a empleado regular (ci_empleados)'}
                            onClick={() => void formalizar(c.id)}
                          >
                            <UserPlus className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/** Alias compatible con el nombre sugerido en plantillas. */
export const FastContratosTable = FastContratosExpressTable;
