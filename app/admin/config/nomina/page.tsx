'use client';

import Link from 'next/link';
import CuadroNominaContratados from '@/components/nomina/CuadroNominaContratados';
import KpiEficienciaAdOficina from '@/components/admin/KpiEficienciaAdOficina';
import { Calculator, RefreshCw, Trash2, FileJson } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calcularCostoHoraTotal, HORAS_MES_LEGAL } from '@/lib/finanzas/costoHoraNomina';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import { createClient } from '@/lib/supabase/client';
import { filasTabuladorGacetaReferencia } from '@/lib/nomina/tabuladorGacetaReferencia';
import { CESTATICKET_MENSUAL_USD } from '@/lib/nomina/cestaticketLegalUsd';
import { tasaBcvVesPorUsdFromEnv } from '@/lib/nomina/tasaBcvVesPorUsd';
import {
  esCargoGastoAdministrativo,
  esCargoManoObraDirecta,
} from '@/lib/nomina/clasificarCargoNomina';
import { costoMensualCargoVes } from '@/lib/nomina/calcularEficienciaAdOficina';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

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

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function AdminConfigNominaPage() {
  const supabase = useMemo(() => createClient(), []);
  const { tasa: tasaBcv } = useTasaBcvHoy();
  const { isSubmitting, runLocked } = useSyncSubmitLock();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ci_config_nomina').select('*').order('cargo_codigo');
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

  const rowsObra = useMemo(
    () => rows.filter((r) => esCargoManoObraDirecta(r.cargo_codigo)),
    [rows],
  );
  const rowsOficina = useMemo(
    () => rows.filter((r) => esCargoGastoAdministrativo(r.cargo_codigo)),
    [rows],
  );

  const previewCosto = useCallback((r: Row) => {
    return calcularCostoHoraTotal(r.salario_base_mensual, r.factor_prestacional, r.cestaticket_mensual);
  }, []);

  const previewCostoUsd = useCallback(
    (r: Row) => {
      const ves = previewCosto(r);
      return tasaBcv && tasaBcv > 0 ? ves / tasaBcv : null;
    },
    [previewCosto, tasaBcv],
  );

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
    toast.success('Cargo actualizado');
  }

  const addRow = (tipo: 'obra' | 'oficina') =>
    runLocked(async () => {
      const { error } = await supabase.from('ci_config_nomina').insert({
        cargo_nombre: tipo === 'obra' ? 'Nuevo oficio obra' : 'Nuevo cargo administrativo',
        cargo_codigo: tipo === 'obra' ? '1.1' : 'ADM',
        salario_base_mensual: tipo === 'obra' ? 300 : 800,
        factor_prestacional: 1.6,
        cestaticket_mensual: 95,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      await load();
      toast.success('Fila creada');
    });

  const deleteRow = (id: string) =>
    runLocked(async () => {
      if (!window.confirm('¿Eliminar este cargo del tabulador?')) return;
      const { error } = await supabase.from('ci_config_nomina').delete().eq('id', id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setRows((p) => p.filter((x) => x.id !== id));
      toast.success('Eliminado');
    });

  const aplicarProyectos = () =>
    runLocked(async () => {
      const res = await fetch('/api/admin/config-nomina/aplicar-proyectos', { method: 'POST' });
      const j = (await res.json()) as { ok?: boolean; error?: string; actualizados?: number; revisados?: number };
      if (!res.ok) {
        toast.error(j.error ?? 'Error');
        return;
      }
      toast.success(
        `Presupuesto mano de obra actualizado en ${j.actualizados ?? 0} / ${j.revisados ?? 0} proyectos activos.`,
      );
    });

  const syncGaceta = () =>
    runLocked(async () => {
      if (
        !window.confirm(
          '¿Sincronizar tabulador con todos los oficios de la Gaceta 6.752? Se agregarán los cargos faltantes.',
        )
      )
        return;

      const gaceta = filasTabuladorGacetaReferencia();
      const existingCodigos = new Set(rows.map((r) => r.cargo_codigo).filter(Boolean));
      const missing = gaceta.filter((g) => !existingCodigos.has(g.codigo));

      if (missing.length === 0) {
        toast.info('El tabulador ya contiene todos los oficios de la Gaceta.');
        return;
      }

      const toInsert = missing.map((m) => {
        const tasa = tasaBcvVesPorUsdFromEnv() ?? 36.5;
        const cestaticketVes = Math.round(CESTATICKET_MENSUAL_USD * tasa * 100) / 100;
        return {
          cargo_nombre: m.nombre,
          cargo_codigo: m.codigo,
          salario_base_mensual: m.salarioBasicoMensualRef30,
          factor_prestacional: 1.6,
          cestaticket_mensual: Math.max(1300, cestaticketVes),
        };
      });

      const { error } = await supabase.from('ci_config_nomina').insert(toInsert);
      if (error) {
        toast.error(error.message);
        return;
      }
      await load();
      toast.success(`Sincronizados ${missing.length} cargos nuevos.`);
    });

  function renderTabulador(filas: Row[], titulo: string, emptyMsg: string) {
    const chartData = [...filas]
      .map((r) => ({
        cargo: r.cargo_nombre.slice(0, 14),
        costo_hora: previewCosto(r),
      }))
      .sort((a, b) => b.costo_hora - a.costo_hora);

    const totalMensualVes = filas.reduce(
      (acc, r) =>
        acc + costoMensualCargoVes(r.salario_base_mensual, r.factor_prestacional, r.cestaticket_mensual),
      0,
    );
    const totalMensualUsd = tasaBcv && tasaBcv > 0 ? totalMensualVes / tasaBcv : null;

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">{titulo}</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Bimonetario: Bs {fmtVes(totalMensualVes)}/mes
                {totalMensualUsd !== null ? ` · ${fmtUsd(totalMensualUsd)}/mes USD` : ''}
              </p>
            </div>
          </div>
          {loading ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : null}
          {!loading && filas.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{emptyMsg}</p>
          ) : null}
          {!loading && filas.length > 0 ? (
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Salario base / mes</TableHead>
                  <TableHead className="text-right">Factor</TableHead>
                  <TableHead className="text-right">Cestaticket</TableHead>
                  <TableHead className="text-right">Costo h</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((r) => {
                  const live = previewCosto(r);
                  const usd = previewCostoUsd(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Label className="sr-only" htmlFor={`cn-${r.id}`}>
                          Cargo
                        </Label>
                        <Input
                          id={`cn-${r.id}`}
                          value={r.cargo_nombre}
                          onChange={(e) => patchLocal(r.id, { cargo_nombre: e.target.value })}
                          className="select-none border-white/10 bg-black/30 font-medium text-white"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.cargo_codigo ?? ''}
                          onChange={(e) => patchLocal(r.id, { cargo_codigo: e.target.value || null })}
                          className="select-none border-white/10 bg-black/30 text-white"
                          placeholder="COD"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={r.salario_base_mensual}
                          onChange={(e) =>
                            patchLocal(r.id, {
                              salario_base_mensual: Number(e.target.value.replace(',', '.')) || 0,
                            })
                          }
                          className="ml-auto max-w-[140px] select-none border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={r.factor_prestacional}
                          onChange={(e) =>
                            patchLocal(r.id, {
                              factor_prestacional: Number(e.target.value.replace(',', '.')) || 1,
                            })
                          }
                          className="ml-auto max-w-[100px] select-none border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={r.cestaticket_mensual}
                          onChange={(e) =>
                            patchLocal(r.id, {
                              cestaticket_mensual: Number(e.target.value.replace(',', '.')) || 0,
                            })
                          }
                          className="ml-auto max-w-[120px] select-none border-white/10 bg-black/30 text-right font-mono text-white tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-300/95">
                        {fmtVes(live)} <span className="text-zinc-500">VES/h</span>
                        {usd !== null ? (
                          <span className="mt-0.5 block text-[10px] font-normal text-sky-400/90">
                            {fmtUsd(usd)}/h USD
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="elitePrimary"
                            disabled={isSubmitting || savingId === r.id}
                            onClick={() => void saveRow(r)}
                            className="select-none touch-manipulation"
                          >
                            Guardar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="elite"
                            disabled={isSubmitting}
                            onClick={() => void deleteRow(r.id)}
                            className="select-none touch-manipulation"
                          >
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

        {chartData.length > 0 ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
              Comparativa costo hora (VES)
            </h2>
            <div className="mt-4 h-[240px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="cargo"
                    width={100}
                    tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: '#111118',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${fmtVes(Number(v))} VES/h`, 'Costo']}
                  />
                  <Bar dataKey="costo_hora" fill="url(#barNomina)" radius={[0, 6, 6, 0]} maxBarSize={22} />
                  <defs>
                    <linearGradient id="barNomina" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#5AC8FA" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 py-8 text-zinc-200 md:px-8" style={{ backgroundColor: '#0A0A0F' }}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link href="/admin/dashboard" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
              ← Admin
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Nóminas bimonetarias — Personal y costos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Mano de obra directa en proyectos y gasto administrativo de oficina, con alerta de eficiencia AD en
              tiempo real.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10">
              <Calculator className="h-5 w-5 text-sky-400" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Visualizador de fórmula</h2>
              <p className="mt-2 text-sm text-zinc-300">
                Costo hora total (VES) ={' '}
                <span className="font-mono text-emerald-300/95">
                  ((Salario base × Factor prestacional) + Cestaticket) ÷ {HORAS_MES_LEGAL}
                </span>
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Conversión USD vía tasa BCV del día{tasaBcv ? ` (${fmtVes(tasaBcv)} Bs/USD)` : ''}.
              </p>
            </div>
          </div>
        </section>

        <Tabs defaultValue="proyectos" className="w-full">
          <TabsList className="grid h-14 w-full max-w-3xl grid-cols-2 border border-white/10 bg-white/[0.04] p-1">
            <TabsTrigger
              value="proyectos"
              className="select-none rounded-xl text-xs font-bold uppercase tracking-wide data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              Mano de Obra Directa (Proyectos)
            </TabsTrigger>
            <TabsTrigger
              value="oficina"
              className="select-none rounded-xl text-xs font-bold uppercase tracking-wide data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              Gasto Administrativo (Oficina)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proyectos" className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || loading}
                onClick={() => void syncGaceta()}
                className="select-none touch-manipulation"
              >
                <FileJson className="mr-2 h-4 w-4" aria-hidden />
                Sincronizar Gaceta
              </Button>
              <Button
                type="button"
                variant="elitePrimary"
                disabled={isSubmitting}
                onClick={() => void aplicarProyectos()}
                className="select-none touch-manipulation"
              >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                Aplicar a proyectos activos
              </Button>
              <Button
                type="button"
                variant="elite"
                disabled={isSubmitting}
                onClick={() => void addRow('obra')}
                className="select-none touch-manipulation"
              >
                Nuevo oficio obra
              </Button>
            </div>

            <CuadroNominaContratados titulo="Contratados activos en obra" />

            {renderTabulador(
              rowsObra,
              'Tabulador — Mano de obra directa',
              'Sin cargos de obra. Sincronice la Gaceta o agregue un oficio.',
            )}
          </TabsContent>

          <TabsContent value="oficina" className="mt-6 space-y-6">
            <KpiEficienciaAdOficina filasOficina={rowsOficina} />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="elite"
                disabled={isSubmitting}
                onClick={() => void addRow('oficina')}
                className="select-none touch-manipulation"
              >
                Nuevo cargo administrativo
              </Button>
            </div>

            {renderTabulador(
              rowsOficina,
              'Tabulador — Gasto administrativo oficina',
              'Sin cargos administrativos. Agregue personal de oficina (códigos fuera del tabulador obrero).',
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
