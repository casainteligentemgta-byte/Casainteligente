'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Calculator, Copy, Database, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calcularCostoHoraTotal, HORAS_MES_LEGAL } from '@/lib/finanzas/costoHoraNomina';
import {
  compararCodigoOficio,
  filasTabuladorGacetaReferencia,
  TABULADOR_GACETA_ETIQUETA,
  TABULADOR_GACETA_VIGENCIA_ISO,
} from '@/lib/nomina/tabuladorGacetaReferencia';
import { createClient } from '@/lib/supabase/client';

type Row = {
  id: string;
  vigencia_desde: string;
  tabulador_referencia: string | null;
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

function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function keyOficioRow(r: Row): string {
  const c = r.cargo_codigo?.trim();
  if (c) return `c:${c.toLowerCase()}`;
  return `n:${r.cargo_nombre.trim().toLowerCase()}`;
}

/** Para cada oficio, deja la fila con mayor `vigencia_desde` que no supere la fecha de corte. */
function filasVigentesAlCorte(rows: Row[], fechaCorteISO: string): Row[] {
  const corte = new Date(`${fechaCorteISO}T12:00:00`);
  if (Number.isNaN(corte.getTime())) return rows;
  const candidatas = rows.filter((r) => {
    const v = new Date(`${r.vigencia_desde}T12:00:00`);
    return !Number.isNaN(v.getTime()) && v <= corte;
  });
  candidatas.sort((a, b) => {
    const vc = a.vigencia_desde.localeCompare(b.vigencia_desde);
    if (vc !== 0) return vc;
    const ca = a.cargo_codigo?.trim() ?? '';
    const cb = b.cargo_codigo?.trim() ?? '';
    if (ca && cb) return compararCodigoOficio(ca, cb);
    return a.cargo_nombre.localeCompare(b.cargo_nombre, 'es');
  });
  const porClave = new Map<string, Row>();
  for (const r of candidatas) {
    porClave.set(keyOficioRow(r), r);
  }
  return Array.from(porClave.values()).sort((a, b) => {
    const ca = a.cargo_codigo?.trim();
    const cb = b.cargo_codigo?.trim();
    if (ca && cb) return compararCodigoOficio(ca, cb);
    return a.cargo_nombre.localeCompare(b.cargo_nombre, 'es');
  });
}

function mapRow(r: Record<string, unknown>): Row {
  const vig = r.vigencia_desde != null ? String(r.vigencia_desde).slice(0, 10) : TABULADOR_GACETA_VIGENCIA_ISO;
  return {
    id: String(r.id),
    vigencia_desde: vig,
    tabulador_referencia: (r.tabulador_referencia as string | null) ?? null,
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

function etiquetaVigencia(r: Row, hoyISO: string): 'futura' | 'pasada' | 'vigente' {
  if (r.vigencia_desde > hoyISO) return 'futura';
  if (r.vigencia_desde < hoyISO) return 'pasada';
  return 'vigente';
}

export default function RrhhOficiosSalariosPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [poblando, setPoblando] = useState(false);
  const [vistaModo, setVistaModo] = useState<'todas' | 'vigentes'>('todas');
  const [fechaCorte, setFechaCorte] = useState(isoHoy);

  const filasGaceta = useMemo(() => {
    const f = filasTabuladorGacetaReferencia();
    return [...f].sort((a, b) => a.nivel - b.nivel || compararCodigoOficio(a.codigo, b.codigo));
  }, []);

  const hoyISO = useMemo(() => isoHoy(), []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ci_config_nomina').select('*');
    setLoading(false);
    if (error) {
      const msg = error.message ?? '';
      if (msg.includes('vigencia_desde') || msg.includes('does not exist')) {
        toast.error('Aplica la migración 098 en Supabase (vigencia del tabulador) y recarga.');
      } else {
        toast.error(msg);
      }
      setRows([]);
      return;
    }
    const mapped = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    mapped.sort((a, b) => {
      const vd = b.vigencia_desde.localeCompare(a.vigencia_desde);
      if (vd !== 0) return vd;
      const ca = a.cargo_codigo?.trim();
      const cb = b.cargo_codigo?.trim();
      if (ca && cb) return compararCodigoOficio(ca, cb);
      return a.cargo_nombre.localeCompare(b.cargo_nombre, 'es');
    });
    setRows(mapped);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filasTablaEditables = useMemo(() => {
    if (vistaModo === 'vigentes') return filasVigentesAlCorte(rows, fechaCorte);
    const sorted = [...rows].sort((a, b) => {
      const vd = b.vigencia_desde.localeCompare(a.vigencia_desde);
      if (vd !== 0) return vd;
      const ca = a.cargo_codigo?.trim();
      const cb = b.cargo_codigo?.trim();
      if (ca && cb) return compararCodigoOficio(ca, cb);
      return a.cargo_nombre.localeCompare(b.cargo_nombre, 'es');
    });
    return sorted;
  }, [rows, vistaModo, fechaCorte]);

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
        vigencia_desde: r.vigencia_desde,
        tabulador_referencia: r.tabulador_referencia?.trim() || null,
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
        error.message.includes('duplicate') || error.message.includes('unique')
          ? 'Ya existe una fila con el mismo código (o nombre sin código) y la misma fecha de vigencia.'
          : error.message.includes('column') && error.message.includes('does not exist')
            ? 'Aplica migraciones 095 y 098 en Supabase y recarga.'
            : error.message,
      );
      return;
    }
    await load();
    toast.success('Oficio/salario actualizado');
  }

  async function addRow() {
    const { error } = await supabase.from('ci_config_nomina').insert({
      vigencia_desde: isoHoy(),
      tabulador_referencia: null,
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
          ? 'Aplica migraciones 095/098 en Supabase y vuelve a intentar.'
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

  async function poblarDesdeGaceta() {
    if (!window.confirm('Se insertarán en la BD los oficios del anexo que aún no existan para la vigencia 20-06-2023. ¿Continuar?')) {
      return;
    }
    setPoblando(true);
    try {
      const { data: existentes, error: e1 } = await supabase
        .from('ci_config_nomina')
        .select('cargo_codigo')
        .eq('vigencia_desde', TABULADOR_GACETA_VIGENCIA_ISO);
      if (e1) {
        toast.error(e1.message);
        return;
      }
      const ya = new Set(
        (existentes ?? [])
          .map((x) => (x as { cargo_codigo?: string | null }).cargo_codigo?.trim())
          .filter((c): c is string => Boolean(c)),
      );
      const aInsertar = filasGaceta.filter((f) => !ya.has(f.codigo));
      if (aInsertar.length === 0) {
        toast.message('No hay filas nuevas que insertar para esa vigencia.');
        return;
      }
      const chunk = 40;
      for (let i = 0; i < aInsertar.length; i += chunk) {
        const part = aInsertar.slice(i, i + chunk).map((f) => ({
          vigencia_desde: TABULADOR_GACETA_VIGENCIA_ISO,
          tabulador_referencia: TABULADOR_GACETA_ETIQUETA,
          cargo_nombre: f.nombre,
          cargo_codigo: f.codigo,
          salario_base_mensual: f.salarioBasicoMensualRef30,
          compensacion_garantizada: 0,
          total_bruto_mensual: null,
          deduccion_ispt: null,
          deduccion_seguro_social: null,
          neto_mensual: null,
          plazas: null,
          factor_prestacional: 1.6,
          cestaticket_mensual: 0,
        }));
        const { error: e2 } = await supabase.from('ci_config_nomina').insert(part);
        if (e2) {
          toast.error(e2.message);
          return;
        }
      }
      await load();
      toast.success(`Insertados ${aInsertar.length} oficios del anexo.`);
    } finally {
      setPoblando(false);
    }
  }

  async function clonarNuevaVigencia(r: Row) {
    const def = r.vigencia_desde >= hoyISO ? r.vigencia_desde : hoyISO;
    const raw = window.prompt('Nueva fecha de vigencia (AAAA-MM-DD). Debe ser distinta a la fila actual para el mismo código.', def);
    if (raw == null) return;
    const nv = raw.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nv)) {
      toast.error('Fecha inválida.');
      return;
    }
    if (nv === r.vigencia_desde) {
      toast.error('Elige otra fecha distinta a la vigencia actual.');
      return;
    }
    const { error } = await supabase.from('ci_config_nomina').insert({
      vigencia_desde: nv,
      tabulador_referencia: r.tabulador_referencia?.trim() || null,
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
    });
    if (error) {
      toast.error(
        error.message.includes('duplicate') || error.message.includes('unique')
          ? 'Ya existe fila con ese código y esa vigencia.'
          : error.message,
      );
      return;
    }
    await load();
    toast.success('Revisión creada; ajusta montos y guarda si hace falta.');
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
              Anexo «Oficios y Salarios» (GOE 6.752, 2023) como referencia legal; abajo, tabulador en base de datos con
              vigencias para registrar aumentos futuros sin perder el histórico.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="elite" disabled={poblando} onClick={() => void poblarDesdeGaceta()}>
              <Database className="mr-2 h-4 w-4" aria-hidden />
              Poblar BD (anexo jun 2023)
            </Button>
            <Button type="button" variant="elite" onClick={() => void addRow()}>
              Nuevo nivel
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Anexo oficial — referencia</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {TABULADOR_GACETA_ETIQUETA}. Salario básico diario por nivel salarial (1–9) según tabla numérica homologada;
            columna mensual = diario × 30 solo como referencia de pantalla.
          </p>
          <div className="relative mt-4 max-h-[min(55vh,560px)] overflow-auto rounded-xl border border-white/10 bg-black/40">
            <Table className="min-w-[720px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-right">Nivel</TableHead>
                  <TableHead className="min-w-[72px]">Nº oficio</TableHead>
                  <TableHead>Denominación</TableHead>
                  <TableHead className="text-right">SB diario (VES)</TableHead>
                  <TableHead className="text-right">SB mensual ref. (×30)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasGaceta.map((f) => (
                  <TableRow key={f.codigo}>
                    <TableCell className="text-right tabular-nums text-zinc-400">{f.nivel}</TableCell>
                    <TableCell className="font-mono text-sky-300/90">{f.codigo}</TableCell>
                    <TableCell className="text-zinc-200">{f.nombre}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtVes(f.salarioBasicoDiarioVes)}</TableCell>
                    <TableCell className="text-right font-mono text-zinc-400 tabular-nums">
                      {fmtVes(f.salarioBasicoMensualRef30)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl backdrop-blur-xl">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Imagen de referencia</h2>
          <p className="mt-1 text-xs text-zinc-500">Cuadro enviado como guía visual (zoom del navegador si hace falta).</p>
          <div className="relative mt-4 max-h-[min(50vh,520px)] overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2">
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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">Tabulador en base de datos</h2>
              <p className="mt-1 max-w-2xl text-xs text-zinc-500">
                «Total» en gris = sueldo base + compensación si no indicas total manual. Usa «Vigentes al» para ver qué
                fila aplica por oficio a una fecha (p. ej. hoy o cierre de mes). «Clonar vigencia» copia la fila con otra
                fecha para subidas futuras.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-[10px] uppercase text-zinc-500">Vista</Label>
                <select
                  className="mt-1 block rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  value={vistaModo}
                  onChange={(e) => setVistaModo(e.target.value as 'todas' | 'vigentes')}
                >
                  <option value="todas">Todas las revisiones</option>
                  <option value="vigentes">Vigentes al…</option>
                </select>
              </div>
              {vistaModo === 'vigentes' ? (
                <div>
                  <Label className="text-[10px] uppercase text-zinc-500">Fecha corte</Label>
                  <Input
                    type="date"
                    value={fechaCorte}
                    onChange={(e) => setFechaCorte(e.target.value)}
                    className="mt-1 w-[160px] border-white/15 bg-black/40 text-white"
                  />
                </div>
              ) : null}
            </div>
          </div>
          {loading ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              Sin filas en BD. Pulsa «Poblar BD» para cargar el anexo oficial o «Nuevo nivel».
            </p>
          ) : null}
          {!loading && filasTablaEditables.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <Table className="min-w-[1280px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[108px]">Vigencia</TableHead>
                    <TableHead className="min-w-[120px]">Estado</TableHead>
                    <TableHead className="min-w-[140px]">Referencia</TableHead>
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
                  {filasTablaEditables.map((r) => {
                    const live = previewCosto(r);
                    const totalCalc = totalBrutoMostrado(r);
                    const ev = etiquetaVigencia(r, hoyISO);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.vigencia_desde}
                            onChange={(e) => patchLocal(r.id, { vigencia_desde: e.target.value })}
                            className="w-[128px] border-white/10 bg-black/30 font-mono text-xs text-white"
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          {ev === 'futura' ? (
                            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-200">Futura</span>
                          ) : ev === 'pasada' ? (
                            <span className="rounded-md bg-zinc-600/30 px-2 py-0.5 text-zinc-400">Histórica</span>
                          ) : (
                            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-200">En vigor</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.tabulador_referencia ?? ''}
                            onChange={(e) => patchLocal(r.id, { tabulador_referencia: e.target.value || null })}
                            placeholder="GOE / nota"
                            className="min-w-[120px] border-white/10 bg-black/30 text-xs text-white"
                          />
                        </TableCell>
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
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="elite"
                              title="Nueva vigencia con los mismos montos"
                              onClick={() => void clonarNuevaVigencia(r)}
                            >
                              <Copy className="h-4 w-4" aria-hidden />
                            </Button>
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
