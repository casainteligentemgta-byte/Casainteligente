'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  Package,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type LaborOverviewRow = {
  project_id: string;
  project_name: string;
  plazas_pedidas: number;
  plazas_asignadas: number;
  plazas_pendiente_funnel: number;
  cobertura_pct: number;
  solicitudes_pendientes: number;
  solicitudes_en_transito: number;
  disponibilidad_pool: number;
};

type UrgenciaRow = {
  id: string;
  created_at: string;
  project_id: string;
  specialty_codigo: string;
  specialty_nombre: string | null;
  quantity_requested: number;
};

type PendingLink = { project_id: string; specialty_codigo: string };

function sTrim(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function diasDesde(iso: string): number {
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.floor((Date.now() - t) / 86_400_000);
  } catch {
    return 0;
  }
}

export default function DashboardOperativoClient() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<LaborOverviewRow[]>([]);
  const [urgencias, setUrgencias] = useState<UrgenciaRow[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);

  const [filterProjectId, setFilterProjectId] = useState<string>('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: ov, error: e1 } = await supabase.from('global_labor_overview').select('*');
      if (e1) {
        const m = (e1.message ?? '').toLowerCase();
        if (m.includes('global_labor_overview') || m.includes('does not exist') || m.includes('schema cache')) {
          setError(
            'La vista global_labor_overview no está disponible. Aplica la migración 107_global_labor_overview.sql en Supabase.',
          );
        } else setError(e1.message);
        setOverview([]);
      } else {
        setOverview((ov ?? []) as LaborOverviewRow[]);
      }

      const { data: urg, error: e2 } = await supabase
        .from('labor_requests')
        .select('id,created_at,project_id,specialty_codigo,specialty_nombre,quantity_requested,status')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);
      if (e2 && !e1) setError(e2.message);
      setUrgencias((urg ?? []) as UrgenciaRow[]);

      const { data: sp } = await supabase
        .from('labor_requests')
        .select('project_id,specialty_codigo')
        .eq('status', 'pending')
        .limit(2000);
      const links = (sp ?? []) as PendingLink[];
      setPendingLinks(links);
      const setSp = new Set<string>();
      for (const r of links) {
        const c = sTrim(r.specialty_codigo);
        if (c) setSp.add(c);
      }
      setSpecialties(Array.from(setSp).sort((a, b) => a.localeCompare(b, 'es')));

      const { data: proy } = await supabase.from('ci_proyectos').select('id,nombre');
      const nm: Record<string, string> = {};
      for (const r of (proy ?? []) as { id: string; nombre?: string | null }[]) {
        nm[r.id] = sTrim(r.nombre) || r.id.slice(0, 8);
      }
      setProjectNames(nm);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of overview) {
      m.set(r.project_id, sTrim(r.project_name) || projectNames[r.project_id] || r.project_id.slice(0, 8));
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [overview, projectNames]);

  const overviewFiltrado = useMemo(() => {
    let rows = [...overview];
    if (filterProjectId) rows = rows.filter((r) => r.project_id === filterProjectId);
    if (filterSpecialty) {
      const setP = new Set(
        pendingLinks.filter((u) => sTrim(u.specialty_codigo) === filterSpecialty).map((u) => u.project_id),
      );
      rows = rows.filter((r) => setP.has(r.project_id));
    }
    return rows;
  }, [overview, filterProjectId, filterSpecialty, pendingLinks]);

  const kpis = useMemo(() => {
    const rows = overviewFiltrado;
    const ped = rows.reduce((a, r) => a + (Number(r.plazas_pedidas) || 0), 0);
    const asg = rows.reduce((a, r) => a + (Number(r.plazas_asignadas) || 0), 0);
    const pendPlazas = rows.reduce((a, r) => a + (Number(r.plazas_pendiente_funnel) || 0), 0);
    const solPen = rows.reduce((a, r) => a + (Number(r.solicitudes_pendientes) || 0), 0);
    const trans = rows.reduce((a, r) => a + (Number(r.solicitudes_en_transito) || 0), 0);
    const disp = rows.length ? Number(rows[0]?.disponibilidad_pool ?? 0) : 0;
    const cobertura = ped > 0 ? Math.round((1000 * asg) / ped) / 10 : 100;
    return {
      cobertura,
      pendientes: pendPlazas,
      enTransito: trans,
      solicitudesPendientes: solPen,
      disponibilidad: disp,
    };
  }, [overviewFiltrado]);

  const chartData = useMemo(() => {
    return overviewFiltrado
      .filter((r) => (r.plazas_pedidas ?? 0) + (r.plazas_asignadas ?? 0) > 0)
      .map((r) => {
        const nombre = sTrim(r.project_name) || projectNames[r.project_id] || 'Proyecto';
        const riesgo = Number(r.cobertura_pct) < 70 && (r.plazas_pedidas ?? 0) > 0;
        const label = riesgo ? `${nombre.slice(0, 18)}` : nombre.slice(0, 22);
        return {
          key: r.project_id,
          label,
          nombreCompleto: nombre,
          riesgo,
          asignados: Number(r.plazas_asignadas) || 0,
          pendientes: Math.max(0, Number(r.plazas_pendiente_funnel) || 0),
          cobertura_pct: Number(r.cobertura_pct) || 0,
        };
      })
      .sort((a, b) => b.pendientes + b.asignados - (a.pendientes + a.asignados));
  }, [overviewFiltrado, projectNames]);

  const urgenciasFiltradas = useMemo(() => {
    let u = [...urgencias];
    if (filterProjectId) u = u.filter((x) => x.project_id === filterProjectId);
    if (filterSpecialty) u = u.filter((x) => sTrim(x.specialty_codigo) === filterSpecialty);
    return u;
  }, [urgencias, filterProjectId, filterSpecialty]);

  return (
    <div className="min-h-screen bg-[#0b0f14] text-zinc-200">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              <LayoutDashboard className="h-4 w-4 text-sky-400" aria-hidden />
              Admin
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Dashboard operativo</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">
              Resumen de mano de obra desde <code className="text-zinc-400">global_labor_overview</code> y solicitudes
              pendientes.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Actualizar</span>
          </Button>
        </header>

        {error ? (
          <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs text-zinc-500">Proyecto</Label>
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
            >
              <option value="">Todos los proyectos</option>
              {projectOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs text-zinc-500">Perfil / cargo (especialidad)</Label>
            <select
              value={filterSpecialty}
              onChange={(e) => setFilterSpecialty(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
            >
              <option value="">Todos los perfiles</option>
              {specialties.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-emerald-500/20 bg-zinc-900/80 text-zinc-100 shadow-none backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-emerald-400/90">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Cobertura
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-white">
                {loading ? '—' : `${kpis.cobertura.toFixed(1)}%`}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              Plazas asignadas sobre plazas pedidas (solicitudes <span className="font-mono">pending</span>).
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-zinc-900/80 text-zinc-100 shadow-none backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-amber-300/90">
                <ClipboardList className="h-4 w-4" aria-hidden />
                Pendientes
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-white">
                {loading ? '—' : kpis.pendientes}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              Plazas sin cubrir en el embudo actual ({kpis.solicitudesPendientes} solicitudes pendientes).
            </CardContent>
          </Card>
          <Card className="border-sky-500/20 bg-zinc-900/80 text-zinc-100 shadow-none backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-sky-300/90">
                <Package className="h-4 w-4" aria-hidden />
                En tránsito
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-white">
                {loading ? '—' : kpis.enTransito}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              Solicitudes con asignación parcial (ya hay al menos uno y falta cupo).
            </CardContent>
          </Card>
          <Card className="border-fuchsia-500/20 bg-zinc-900/80 text-zinc-100 shadow-none backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-fuchsia-300/90">
                <Briefcase className="h-4 w-4" aria-hidden />
                Disponibilidad
              </CardDescription>
              <CardTitle className="text-3xl font-bold tabular-nums text-white">
                {loading ? '—' : kpis.disponibilidad}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-zinc-500">
              Obreros aprobados en estado disponible (pool global RRHH).
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 border-white/10 bg-zinc-900/60 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg text-white">Comparativo por proyecto</CardTitle>
            <CardDescription className="text-zinc-500">
              Barras apiladas: plazas asignadas vs pendientes. Cobertura &lt; 70% →{' '}
              <Badge variant="destructive" className="ml-1 align-middle">
                RIESGO
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[min(420px,55vh)] min-h-[280px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-zinc-500">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : chartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">Sin datos para el filtro actual.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#a1a1aa', fontSize: 10 }}
                    interval={0}
                    angle={-32}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: 8,
                      color: '#e4e4e7',
                    }}
                    formatter={(value, name) => [String(value ?? ''), String(name ?? '')]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { nombreCompleto?: string; cobertura_pct?: number; riesgo?: boolean } | undefined;
                      if (!p) return '';
                      return `${p.nombreCompleto} · ${p.cobertura_pct?.toFixed(1)}%${p.riesgo ? ' · RIESGO' : ''}`;
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }} />
                  <Bar dataKey="asignados" stackId="a" fill="#22c55e" name="Asignados" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pendientes" stackId="a" fill="#f59e0b" name="Pendientes" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
          <div className="flex flex-wrap gap-2 border-t border-white/10 px-6 py-3 text-[11px] text-zinc-500">
            {chartData
              .filter((d) => d.riesgo)
              .map((d) => (
                <span key={d.key} className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" aria-hidden />
                  <span className="text-zinc-300">{d.nombreCompleto}</span>
                  <Badge variant="destructive" className="text-[10px]">
                    RIESGO
                  </Badge>
                </span>
              ))}
            {chartData.every((d) => !d.riesgo) ? (
              <span>Ningún proyecto filtrado bajo 70% de cobertura con plazas pedidas.</span>
            ) : null}
          </div>
        </Card>

        <Card className="border-white/10 bg-zinc-900/60 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg text-white">Urgencias — solicitudes pendientes más antiguas</CardTitle>
            <CardDescription className="text-zinc-500">
              Hasta 10 registros por antigüedad. Más de 5 días sin atención en rojo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-zinc-500">Cargando…</p>
            ) : urgenciasFiltradas.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay solicitudes pendientes para los filtros.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Antigüedad</TableHead>
                    <TableHead className="text-zinc-400">Proyecto</TableHead>
                    <TableHead className="text-zinc-400">Perfil</TableHead>
                    <TableHead className="text-right text-zinc-400">Cant.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urgenciasFiltradas.map((u) => {
                    const días = diasDesde(u.created_at);
                    const urgente = días > 5;
                    return (
                      <TableRow
                        key={u.id}
                        className={
                          urgente
                            ? 'border-rose-500/30 bg-rose-950/25 hover:bg-rose-950/35'
                            : 'border-white/5 hover:bg-white/[0.03]'
                        }
                      >
                        <TableCell className={urgente ? 'font-medium text-rose-100' : 'text-zinc-300'}>
                          {días} día{días === 1 ? '' : 's'}
                          {urgente ? (
                            <Badge variant="destructive" className="ml-2 text-[10px]">
                              +5 días
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className={urgente ? 'text-rose-50' : 'text-zinc-200'}>
                          {projectNames[u.project_id] ?? u.project_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className={urgente ? 'text-rose-100' : 'text-zinc-300'}>
                          <span className="font-mono text-xs">{sTrim(u.specialty_codigo)}</span>
                          {u.specialty_nombre ? (
                            <span className="ml-1 text-xs text-zinc-500">· {u.specialty_nombre}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-zinc-200">{u.quantity_requested}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
