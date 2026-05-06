'use client';

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
  factor_prestacional: number;
  cestaticket_mensual: number;
  costo_hora_total?: number;
};

function fmtVes(n: number) {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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
    setRows(
      (data ?? []).map((r) => ({
        id: String((r as { id: string }).id),
        cargo_nombre: String((r as { cargo_nombre: string }).cargo_nombre),
        cargo_codigo: (r as { cargo_codigo?: string | null }).cargo_codigo ?? null,
        salario_base_mensual: Number((r as { salario_base_mensual: unknown }).salario_base_mensual),
        factor_prestacional: Number((r as { factor_prestacional: unknown }).factor_prestacional),
        cestaticket_mensual: Number((r as { cestaticket_mensual?: unknown }).cestaticket_mensual ?? 0),
        costo_hora_total: Number((r as { costo_hora_total?: unknown }).costo_hora_total),
      })),
    );
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
        factor_prestacional: r.factor_prestacional,
        cestaticket_mensual: r.cestaticket_mensual,
      })
      .eq('id', r.id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
    toast.success('Oficio/salario actualizado');
  }

  async function addRow() {
    const { error } = await supabase
      .from('ci_config_nomina')
      .insert({
        cargo_nombre: 'Nuevo oficio',
        cargo_codigo: null,
        salario_base_mensual: 300,
        factor_prestacional: 1.6,
        cestaticket_mensual: 95,
      });
    if (error) {
      toast.error(error.message);
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
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link href="/rrhh/hojas-vida" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
              ← RRHH
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">RRHH — Oficios y salarios</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Sección editable para administrar tabulador de oficios, salarios y factores de cálculo. Diseñada para cargar
              ajustes salariales futuros.
            </p>
          </div>
          <Button type="button" variant="elite" onClick={() => void addRow()}>
            Nuevo oficio
          </Button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10">
              <Calculator className="h-5 w-5 text-sky-400" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Fórmula de referencia</h2>
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
          {loading ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Sin filas. Crea el primer oficio o carga tu cuadro inicial.</p>
          ) : null}
          {!loading && rows.length > 0 ? (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Oficio</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Salario base / mes</TableHead>
                  <TableHead className="text-right">Factor</TableHead>
                  <TableHead className="text-right">Cestaticket</TableHead>
                  <TableHead className="text-right">Costo h / VES</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const live = previewCosto(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Label className="sr-only" htmlFor={`cn-${r.id}`}>
                          Oficio
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
                          placeholder="COD"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={r.salario_base_mensual}
                          onChange={(e) => patchLocal(r.id, { salario_base_mensual: Number(e.target.value.replace(',', '.')) || 0 })}
                          className="ml-auto max-w-[140px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={r.factor_prestacional}
                          onChange={(e) => patchLocal(r.id, { factor_prestacional: Number(e.target.value.replace(',', '.')) || 1 })}
                          className="ml-auto max-w-[100px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={r.cestaticket_mensual}
                          onChange={(e) => patchLocal(r.id, { cestaticket_mensual: Number(e.target.value.replace(',', '.')) || 0 })}
                          className="ml-auto max-w-[120px] border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-300/95">
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
          ) : null}
        </section>
      </div>
    </div>
  );
}
