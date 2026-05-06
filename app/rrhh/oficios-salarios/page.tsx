'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Calculator, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calcularCostoHoraTotal, HORAS_MES_LEGAL } from '@/lib/finanzas/costoHoraNomina';
import { createClient } from '@/lib/supabase/client';

type Row = {
  id: string;
  cargo_nombre: string;
  cargo_codigo: string | null;
  salario_base_mensual: number;
  compensacion_garantizada: number;
  total_bruto_mensual: number | null;
  deduccion_ispt: number | null;
  deduccion_seguro_social: number | null;
  neto_mensual: number | null;
  plazas: number | null;
  factor_prestacional: number;
  cestaticket_mensual: number;
  costo_hora_total?: number;
};

function fmtVes(n: number) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function totalBrutoMostrado(r: Row): number {
  if (r.total_bruto_mensual != null && Number.isFinite(r.total_bruto_mensual)) {
    return r.total_bruto_mensual;
  }
  return r.salario_base_mensual + r.compensacion_garantizada;
}

function mapRow(r: Record<string, unknown>): Row {
  return {
    id: String(r.id),
    cargo_nombre: String(r.cargo_nombre ?? ''),
    cargo_codigo: (r.cargo_codigo as string | null) ?? null,
    salario_base_mensual: Number(r.salario_base_mensual ?? 0),
    compensacion_garantizada: Number(r.compensacion_garantizada ?? 0),
    total_bruto_mensual: r.total_bruto_mensual != null ? Number(r.total_bruto_mensual) : null,
    deduccion_ispt: r.deduccion_ispt != null ? Number(r.deduccion_ispt) : null,
    deduccion_seguro_social: r.deduccion_seguro_social != null ? Number(r.deduccion_seguro_social) : null,
    neto_mensual: r.neto_mensual != null ? Number(r.neto_mensual) : null,
    plazas: r.plazas != null ? Number(r.plazas) : null,
    factor_prestacional: Number(r.factor_prestacional ?? 1.6),
    cestaticket_mensual: Number(r.cestaticket_mensual ?? 0),
    costo_hora_total: r.costo_hora_total != null ? Number(r.costo_hora_total) : undefined,
  };
}

export default function RrhhOficiosSalariosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ci_config_nomina').select('*').order('cargo_nombre');
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    setRows((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewCosto = useCallback((r: Row) => {
    return calcularCostoHoraTotal(r.salario_base_mensual, r.factor_prestacional, r.cestaticket_mensual);
  }, []);

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function saveRow(r: Row) {
    setSavingId(r.id);
    const { error } = await supabase
      .from('ci_config_nomina')
      .update({
        cargo_nombre: r.cargo_nombre.trim(),
        cargo_codigo: r.cargo_codigo?.trim() || null,
        salario_base_mensual: r.salario_base_mensual,
        compensacion_garantizada: r.compensacion_garantizada,
        total_bruto_mensual: r.total_bruto_mensual,
        deduccion_ispt: r.deduccion_ispt,
        deduccion_seguro_social: r.deduccion_seguro_social,
        neto_mensual: r.neto_mensual,
        plazas: r.plazas,
        factor_prestacional: r.factor_prestacional,
        cestaticket_mensual: r.cestaticket_mensual,
      })
      .eq('id', r.id);
    setSavingId(null);
    if (error) {
      toast.error(
        error.message.includes('column') && error.message.includes('does not exist')
          ? 'Aplica la migración 095 en Supabase (tabulador de salarios) y recarga.'
          : error.message,
      );
      return;
    }
    await load();
    toast.success('Oficio/salario actualizado');
  }

  async function addRow() {
    const { error } = await supabase.from('ci_config_nomina').insert({
      cargo_nombre: 'Nuevo nivel / oficio',
      cargo_codigo: null,
      salario_base_mensual: 0,
      compensacion_garantizada: 0,
      total_bruto_mensual: null,
      deduccion_ispt: null,
      deduccion_seguro_social: null,
      neto_mensual: null,
      plazas: null,
      factor_prestacional: 1.6,
      cestaticket_mensual: 0,
    });
    if (error) {
      toast.error(
        error.message.includes('column') && error.message.includes('does not exist')
          ? 'Aplica la migración 095 en Supabase y vuelve a intentar.'
          : error.message,
      );
      return;
    }
    await load();
    toast.success('Fila creada');
  }

  async function deleteRow(id: string) {
    if (!window.confirm('¿Eliminar este oficio del tabulador?')) return;
    const { error } = await supabase.from('ci_config_nomina').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((p) => p.filter((x) => x.id !== id));
    toast.success('Eliminado');
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-8 text-zinc-200 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link href="/rrhh/hojas-vida" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
              ← RRHH
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">RRHH — Oficios y salarios</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Tabulador editable alineado a cuadros tipo: nivel, sueldo base, compensación garantizada, total, deducciones
              (ISPT / seguro social) y neto. Los campos de factor y cestaticket siguen sirviendo para el costo hora interno.
            </p>
          </div>
          <Button type="button" variant="elite" onClick={() => void addRow()}>
            Nuevo nivel
          </Button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Referencia enviada</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Imagen de inspiración para trasladar fila por fila al tabulador editable. Puedes ampliar con el zoom del navegador.
          </p>
          <div className="relative mt-4 max-h-[min(70vh,720px)] overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2">
            <Image
              src="/ref/tabulador-salarios-referencia.png"
              alt="Tabulador de salarios de referencia"
              width={900}
              height={2400}
              className="mx-auto h-auto w-full max-w-3xl object-contain"
              unoptimized
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10">
              <Calculator className="h-5 w-5 text-sky-400" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Costo hora (referencia interna)</h2>
              <p className="mt-2 text-sm text-zinc-300">
                Costo hora total (VES) ={' '}
                <span className="font-mono text-emerald-300/95">
                  ((Salario base × Factor prestacional) + Cestaticket) ÷ {HORAS_MES_LEGAL}
                </span>
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Tabulador editable</h2>
          <p className="mt-1 text-xs text-zinc-500">
            «Total» en gris = sueldo base + compensación si no indicas total manual. Deja vacíos ISPT / seguro / neto si no
            aplican.
          </p>
          {loading ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Sin filas. Pulsa «Nuevo nivel» o carga datos desde tu cuadro.</p>
          ) : null}
          {!loading && rows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Nivel / oficio</TableHead>
                    <TableHead className="min-w-[72px]">Código</TableHead>
                    <TableHead className="text-right">Sueldo base</TableHead>
                    <TableHead className="text-right">Comp. garantizada</TableHead>
                    <TableHead className="text-right">Total (cuadro)</TableHead>
                    <TableHead className="text-right">ISPT</TableHead>
                    <TableHead className="text-right">Seg. social</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">Plazas</TableHead>
                    <TableHead className="text-right">Factor</TableHead>
                    <TableHead className="text-right">Cesta</TableHead>
                    <TableHead className="text-right">Costo h</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const live = previewCosto(r);
                    const totalCalc = totalBrutoMostrado(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Label className="sr-only" htmlFor={`cn-${r.id}`}>
                            Nivel
                          </Label>
                          <Input
                            id={`cn-${r.id}`}
                            value={r.cargo_nombre}
                            onChange={(e) => patchLocal(r.id, { cargo_nombre: e.target.value })}
                            className="border-white/10 bg-black/30 font-medium text-white"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.cargo_codigo ?? ''}
                            onChange={(e) => patchLocal(r.id, { cargo_codigo: e.target.value || null })}
                            className="border-white/10 bg-black/30 text-white"
                            placeholder="—"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.salario_base_mensual}
                            onChange={(e) =>
                              patchLocal(r.id, { salario_base_mensual: Number(e.target.value.replace(',', '.')) || 0 })
                            }
                            className="ml-auto w-[104px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.compensacion_garantizada}
                            onChange={(e) =>
                              patchLocal(r.id, { compensacion_garantizada: Number(e.target.value.replace(',', '.')) || 0 })
                            }
                            className="ml-auto w-[104px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.total_bruto_mensual ?? ''}
                            placeholder={String(totalCalc)}
                            onChange={(e) => patchLocal(r.id, { total_bruto_mensual: numOrNull(e.target.value) })}
                            className="ml-auto w-[104px] border-white/10 bg-black/30 text-right font-mono text-zinc-300 tabular-nums"
                          />
                          <span className="mt-0.5 block text-[10px] text-zinc-600">Calc: {fmtVes(totalCalc)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.deduccion_ispt ?? ''}
                            onChange={(e) => patchLocal(r.id, { deduccion_ispt: numOrNull(e.target.value) })}
                            className="ml-auto w-[88px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.deduccion_seguro_social ?? ''}
                            onChange={(e) => patchLocal(r.id, { deduccion_seguro_social: numOrNull(e.target.value) })}
                            className="ml-auto w-[88px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.neto_mensual ?? ''}
                            onChange={(e) => patchLocal(r.id, { neto_mensual: numOrNull(e.target.value) })}
                            className="ml-auto w-[96px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={r.plazas ?? ''}
                            onChange={(e) => patchLocal(r.id, { plazas: numOrNull(e.target.value) })}
                            className="ml-auto w-[64px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.factor_prestacional}
                            onChange={(e) =>
                              patchLocal(r.id, { factor_prestacional: Number(e.target.value.replace(',', '.')) || 1 })
                            }
                            className="ml-auto w-[72px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={r.cestaticket_mensual}
                            onChange={(e) =>
                              patchLocal(r.id, { cestaticket_mensual: Number(e.target.value.replace(',', '.')) || 0 })
                            }
                            className="ml-auto w-[88px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-300/95">
                          {fmtVes(live)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="elitePrimary"
                              disabled={savingId === r.id}
                              onClick={() => void saveRow(r)}
                            >
                              Guardar
                            </Button>
                            <Button type="button" size="sm" variant="elite" onClick={() => void deleteRow(r.id)}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
