'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiUrl } from '@/lib/http/apiUrl';
import { fetchCuadroContratados, type FilaNominaContratado } from '@/lib/nomina/fetchCuadroContratados';
import type { ResultadoSemanaObra } from '@/lib/nomina/calcularSemanaObra';
import { previewItemsNomina, type PreviewItemNomina } from '@/lib/nomina/persistirSemanaObra';
import {
  type ClasePagoObra,
  inferirClasePagoObra,
  semanaAdicionalFijaUsd,
  TASA_ANCLA_CESTA_BCV,
} from '@/lib/nomina/reglasPagoObra';
import { domingoDeSemanaIso, lunesDeSemanaIso } from '@/lib/nomina/semanaIsoNomina';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type FilaUi = {
  empleadoId: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  cargoCodigo: string | null;
  cargoNombre: string | null;
  clase: ClasePagoObra;
  dias: number;
  incluirAdelanto: boolean;
  /** Cl. SEXTA c): complemento de alimentación potestativo; `false` = no se otorga esta semana. */
  otorgarBono?: boolean;
  /** Arreglo pactado en el contrato (USD). Sin valor: monto por defecto de la clase. */
  sobreUsd?: number | null;
  mensualUsd?: number | null;
  /** `false`: el contrato firmado aún no se cargó. */
  contratoCargado?: boolean;
};

type ItemGuardado = {
  id: string;
  empleado_id: string;
  tipo: string;
  clase?: string | null;
  dias_laborados?: number | null;
  snapshot?: unknown;
};

type PeriodoGuardado = {
  id: string;
  estado?: string | null;
  tasa_bcv_pago?: number | string | null;
  ci_nomina_obra_items?: ItemGuardado[] | null;
};

type Props = {
  proyectoModuloId: string;
  nombreObra?: string | null;
};

function uuidEmpleado(id: string): string | null {
  if (id.startsWith('express-')) return null;
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
function fmtVes(n: number) {
  return `Bs. ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function triggerBlobDownload(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.download = nombre;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function descargarPdf(payload: unknown, nombre: string) {
  try {
    const res = await fetch(apiUrl('/api/rrhh/nomina/recibo'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      triggerBlobDownload(await res.blob(), nombre);
      return;
    }
  } catch {
    /* preview local */
  }
  const body = payload as { meta: import('@/lib/nomina/ReciboNominaObraPdf').MetaReciboNomina; calc: ResultadoSemanaObra };
  const { createElement } = await import('react');
  const { pdf } = await import('@react-pdf/renderer');
  const { ReciboNominaObraPdf } = await import('@/lib/nomina/ReciboNominaObraPdf');
  const node = createElement(ReciboNominaObraPdf, { meta: body.meta, calc: body.calc });
  const blob = await pdf(node as Parameters<typeof pdf>[0]).toBlob();
  triggerBlobDownload(blob, nombre);
}

export default function NominaSemanalObra({ proyectoModuloId, nombreObra }: Props) {
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);
  const hoyIso = new Date().toISOString().slice(0, 10);
  const { tasa: tasaHoy } = useTasaBcvHoy(hoyIso);

  const [semana, setSemana] = useState(() => lunesDeSemanaIso(hoyIso));
  const [tasaBcv, setTasaBcv] = useState('');
  const [filas, setFilas] = useState<FilaUi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [previews, setPreviews] = useState<PreviewItemNomina[] | null>(null);
  const [itemIds, setItemIds] = useState<Record<string, string>>({});
  const [trabajando, setTrabajando] = useState(false);
  const [avisoMigracion, setAvisoMigracion] = useState<string | null>(null);
  /** Semana ya guardada: se reabre con lo cargado (días, clase, tasa y recibos). */
  const [guardada, setGuardada] = useState<{ estado: 'abierto' | 'pagado' } | null>(null);

  useEffect(() => {
    if (tasaHoy && !tasaBcv) setTasaBcv(String(tasaHoy));
  }, [tasaHoy, tasaBcv]);

  const loadContratados = useCallback(async () => {
    setCargando(true);
    try {
      const stub =
        !supabase ||
        /example\.supabase\.co|your-project-url/i.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
      if (stub) {
        setFilas([]);
        return;
      }
      const data = await Promise.race([
        fetchCuadroContratados(supabase, { proyectoModuloId }),
        new Promise<never>((_, rej) => {
          window.setTimeout(() => rej(new Error('timeout-contratados')), 4000);
        }),
      ]);
      const next: FilaUi[] = [];
      const finSemana = domingoDeSemanaIso(semana);
      for (const f of data as FilaNominaContratado[]) {
        const eid = uuidEmpleado(f.id);
        if (!eid) continue;
        // Entra a la nómina desde su fecha de ingreso.
        if (f.fechaIngreso && f.fechaIngreso > finSemana) continue;
        next.push({
          empleadoId: eid,
          nombres: f.nombres,
          apellidos: f.apellidos,
          cedula: f.cedula,
          cargoCodigo: f.cargoCodigo,
          cargoNombre: f.cargoNombre,
          clase: inferirClasePagoObra(f.cargoCodigo, f.cargoNombre),
          dias: 5,
          incluirAdelanto: true,
          sobreUsd: f.arregloSemanalUsd ?? null,
          mensualUsd: f.arregloMensualUsd ?? null,
          contratoCargado: f.contratoCargado,
        });
      }

      // Si la semana ya se guardó, se reabre tal como quedó.
      let previosGuardados: PreviewItemNomina[] | null = null;
      let idsGuardados: Record<string, string> = {};
      let estadoGuardado: { estado: 'abierto' | 'pagado' } | null = null;
      try {
        const res = await fetch(
          apiUrl(
            `/api/rrhh/nomina/semana?proyecto_id=${encodeURIComponent(proyectoModuloId)}&semana=${encodeURIComponent(semana)}`,
          ),
          { credentials: 'include', cache: 'no-store' },
        );
        const j = (await res.json().catch(() => ({}))) as { periodo?: PeriodoGuardado | null };
        const periodo = res.ok ? j.periodo ?? null : null;
        if (periodo) {
          const items = periodo.ci_nomina_obra_items ?? [];
          estadoGuardado = { estado: periodo.estado === 'pagado' ? 'pagado' : 'abierto' };
          const tasaGuardada = Number(periodo.tasa_bcv_pago);
          if (Number.isFinite(tasaGuardada) && tasaGuardada > 0) setTasaBcv(String(tasaGuardada));
          const porEmpleado: Record<string, { semanal?: ItemGuardado; adelanto?: ItemGuardado }> = {};
          for (const it of items) {
            const k = String(it.empleado_id);
            porEmpleado[k] = porEmpleado[k] ?? {};
            if (it.tipo === 'adelanto_prestaciones') porEmpleado[k].adelanto = it;
            else porEmpleado[k].semanal = it;
            idsGuardados[`${k}:${it.tipo}`] = String(it.id);
          }
          for (const f of next) {
            const g = porEmpleado[f.empleadoId];
            if (!g?.semanal) continue;
            f.dias = Math.max(0, Math.min(5, Number(g.semanal.dias_laborados) || 0));
            const claseGuardada = g.semanal.clase;
            if (claseGuardada === 'ayudante' || claseGuardada === 'clasificado') f.clase = claseGuardada;
            f.incluirAdelanto = Boolean(g.adelanto);
            f.otorgarBono = (g.semanal.snapshot as { bonoOtorgado?: boolean } | undefined)?.bonoOtorgado !== false;
          }
          previosGuardados = next
            .filter((f) => porEmpleado[f.empleadoId]?.semanal?.snapshot)
            .map((f) => {
              const g = porEmpleado[f.empleadoId]!;
              return {
                empleado_id: f.empleadoId,
                semanas_trabajadas_previas: 0,
                toca_adelanto: Boolean(g.adelanto),
                semanal: g.semanal!.snapshot as ResultadoSemanaObra,
                adelanto: (g.adelanto?.snapshot as ResultadoSemanaObra | undefined) ?? null,
              };
            });
          const sinFila = Object.keys(porEmpleado).filter((id) => !next.some((f) => f.empleadoId === id));
          if (sinFila.length > 0) {
            toast.message(
              `${sinFila.length} trabajador(es) de la semana guardada ya no aparecen como contratados en esta obra; sus recibos guardados se conservan.`,
            );
          }
        }
      } catch {
        /* sin semana guardada: se arma desde cero */
      }

      setFilas(next);
      setGuardada(estadoGuardado);
      setPreviews(previosGuardados && previosGuardados.length > 0 ? previosGuardados : null);
      setItemIds(idsGuardados);
    } catch (e) {
      if (!(e instanceof Error && e.message === 'timeout-contratados')) {
        toast.error(e instanceof Error ? e.message : 'No se cargaron contratados.');
      }
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [proyectoModuloId, supabase, semana]);

  useEffect(() => {
    setPreviews(null);
    setItemIds({});
    setGuardada(null);
    void loadContratados();
  }, [loadContratados, semana]);

  const tasaNum = Number(String(tasaBcv).replace(',', '.'));

  function previewLocal(): PreviewItemNomina[] {
    return previewItemsNomina({
      items: filas.map((f) => ({
        empleado_id: f.empleadoId,
        clase: f.clase,
        dias_laborados: f.dias,
        cargo_codigo: f.cargoCodigo,
        cargo_nombre: f.cargoNombre,
        incluir_adelanto: f.incluirAdelanto,
        otorgar_bono: f.otorgarBono !== false,
        sobre_usd: f.sobreUsd,
        mensual_usd: f.mensualUsd,
      })),
      previasPorEmpleado: {},
      tasaBcvPago: tasaNum,
      tasaAnclaCestaBcv: TASA_ANCLA_CESTA_BCV,
    });
  }

  async function calcular(guardar: boolean, marcarPagado = false) {
    let reabrir = false;
    if (guardar && guardada?.estado === 'pagado' && !marcarPagado) {
      if (!window.confirm('Esta semana ya está marcada como pagada. ¿Volver a guardarla con estos datos?')) return;
      reabrir = true;
    }
    if (!Number.isFinite(tasaNum) || tasaNum <= 0) {
      toast.error('Indica la tasa BCV del viernes.');
      return;
    }
    if (filas.length === 0) {
      toast.error('No hay obreros en la semana.');
      return;
    }
    setTrabajando(true);
    setAvisoMigracion(null);
    try {
      const res = await fetch(apiUrl('/api/rrhh/nomina/semana'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoModuloId,
          semana_inicio: semana,
          tasa_bcv_pago: tasaNum,
          preview: !guardar,
          guardar,
          marcar_pagado: guardar && marcarPagado,
          reabrir,
          items: filas.map((f) => ({
            empleado_id: f.empleadoId,
            clase: f.clase,
            dias_laborados: f.dias,
            cargo_codigo: f.cargoCodigo,
            cargo_nombre: f.cargoNombre,
            incluir_adelanto: f.incluirAdelanto,
            otorgar_bono: f.otorgarBono !== false,
          })),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        items?: PreviewItemNomina[];
        previews?: PreviewItemNomina[];
        item_ids?: Record<string, string>;
      };
      if (!res.ok) {
        const mig = j.code === 'MIGRATION_333' || /migración 333/i.test(j.error ?? '');
        if (mig) setAvisoMigracion(j.error ?? 'Migración 333 pendiente.');
        if (guardar) {
          // Un guardado fallido nunca se presenta como hecho.
          toast.error(j.error ?? 'No se pudo guardar la semana.');
          return;
        }
        setPreviews(j.previews ?? j.items ?? previewLocal());
        toast.message('Cálculo hecho en este equipo (el servidor no respondió). Revise antes de guardar.');
        return;
      }
      const list = j.previews ?? j.items ?? null;
      setPreviews(list);
      if (j.item_ids) setItemIds(j.item_ids);
      if (guardar) {
        setGuardada({ estado: marcarPagado || reabrir ? 'pagado' : 'abierto' });
        toast.success(marcarPagado ? 'Semana guardada y marcada como pagada.' : 'Semana guardada.');
      } else if (list) toast.success('Cálculo listo. Revisa los dos recibos.');
    } catch (e) {
      if (guardar) {
        toast.error(e instanceof Error ? `No se pudo guardar: ${e.message}` : 'No se pudo guardar la semana.');
      } else {
        try {
          setPreviews(previewLocal());
          toast.message('Cálculo hecho en este equipo (sin conexión con el servidor). Revise antes de guardar.');
        } catch {
          toast.error(e instanceof Error ? e.message : 'Error de red.');
        }
      }
    } finally {
      setTrabajando(false);
    }
  }

  function previewDe(empleadoId: string): PreviewItemNomina | undefined {
    return previews?.find((p) => p.empleado_id === empleadoId);
  }

  async function pdfDe(fila: FilaUi, cara: 'legal' | 'patio' | 'adelanto', calc: ResultadoSemanaObra) {
    try {
      await descargarPdf(
        {
          cara,
          meta: {
            cara,
            empresa: 'Casa Inteligente',
            obra: nombreObra ?? '',
            trabajadorNombre: `${fila.nombres} ${fila.apellidos}`.trim(),
            trabajadorCedula: fila.cedula,
            semanaInicio: semana,
            semanaFin: domingoDeSemanaIso(semana),
            firmanteNombre: `${fila.nombres} ${fila.apellidos}`.trim(),
          },
          calc,
        },
        `recibo-${cara}-${fila.cedula.replace(/\s/g, '')}.pdf`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF no generado.');
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-5">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <Wallet className="h-5 w-5 text-emerald-400" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-100">Nómina semanal</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Cl. SEXTA: salario del oficio + cesta ticket + complemento de alimentación. Cl. SÉPTIMA:
            cada 4 semanas nace una semana adicional (90 USD ayudante / 115 USD clasificado), que se paga al finiquito.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold text-zinc-400">
          Lunes de la semana
          <Input
            type="date"
            value={semana}
            onChange={(e) => setSemana(lunesDeSemanaIso(e.target.value || hoyIso))}
            className="mt-1 border-white/15 bg-zinc-950 text-white"
          />
        </label>
        <label className="space-y-1 text-xs font-semibold text-zinc-400">
          Tasa BCV del pago (Bs/USD)
          <Input
            inputMode="decimal"
            value={tasaBcv}
            onChange={(e) => setTasaBcv(e.target.value)}
            placeholder="Ej. 200,00"
            className="mt-1 border-white/15 bg-zinc-950 text-white"
          />
        </label>
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" disabled={trabajando || cargando} onClick={() => void calcular(false)}>
            Calcular
          </Button>
          <Button type="button" disabled={trabajando || cargando} onClick={() => void calcular(true)}>
            Guardar semana
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={trabajando || cargando || guardada?.estado === 'pagado'}
            onClick={() => {
              if (window.confirm('¿Guardar la semana y marcarla como pagada? Después solo se podrá cambiar confirmándolo.')) {
                void calcular(true, true);
              }
            }}
          >
            Marcar pagada
          </Button>
        </div>
      </div>

      {guardada ? (
        <p
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            guardada.estado === 'pagado'
              ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
              : 'border-sky-500/30 bg-sky-950/30 text-sky-100'
          }`}
        >
          {guardada.estado === 'pagado'
            ? 'Semana guardada y pagada. Se muestra tal como quedó; para corregirla hay que confirmarlo al guardar.'
            : 'Semana guardada (abierta). Se muestra lo que se guardó; puede corregir y volver a guardar.'}
        </p>
      ) : null}

      {avisoMigracion ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          {avisoMigracion} El cálculo en pantalla y los PDF de preview sí funcionan.
        </p>
      ) : null}

      {!cargando && filas.some((f) => f.contratoCargado === false) ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          {filas.filter((f) => f.contratoCargado === false).length} trabajador(es) sin contrato firmado cargado. Puede
          pagarles; cargue el contrato firmado en Contratos de trabajo.
        </p>
      ) : null}

      {cargando ? (
        <p className="mt-4 text-sm text-zinc-500">Cargando contratados…</p>
      ) : filas.length === 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-zinc-500">No hay contratos activos para armar la semana.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setFilas([
                {
                  empleadoId: '00000000-0000-4000-8000-000000000021',
                  nombres: 'Ejemplo',
                  apellidos: 'Ayudante',
                  cedula: 'V-00.000.001',
                  cargoCodigo: '2.1',
                  cargoNombre: 'AYUDANTE',
                  clase: 'ayudante',
                  dias: 5,
                  incluirAdelanto: true,
                },
                {
                  empleadoId: '00000000-0000-4000-8000-000000000051',
                  nombres: 'Ejemplo',
                  apellidos: 'Clasificado',
                  cedula: 'V-00.000.002',
                  cargoCodigo: '5.1',
                  cargoNombre: 'ALBAÑIL DE 1ra.',
                  clase: 'clasificado',
                  dias: 5,
                  incluirAdelanto: true,
                },
              ])
            }
          >
            Probar con ayudante y clasificado de ejemplo
          </Button>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Obrero</TableHead>
                <TableHead className="text-zinc-400">Clase</TableHead>
                <TableHead className="text-zinc-400" title="Días trabajados más faltas justificadas (reposo, permiso). El complemento de alimentación de la Cl. SEXTA no depende de la asistencia.">Días (trab. + justif.)</TableHead>
                <TableHead className="text-right text-zinc-400">Legal</TableHead>
                <TableHead className="text-right text-zinc-400">Patio</TableHead>
                <TableHead className="text-zinc-400">Recibos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => {
                const p = previewDe(f.empleadoId);
                return (
                  <TableRow key={f.empleadoId} className="border-white/5 hover:bg-white/[0.03]">
                    <TableCell className="text-white">
                      <div className="font-medium">
                        {f.nombres} {f.apellidos}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{f.cedula}</div>
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        {f.sobreUsd
                          ? `Arreglo: USD ${f.sobreUsd} semanal · USD ${f.mensualUsd ?? f.sobreUsd} mensual`
                          : 'Arreglo: monto por defecto'}
                      </div>
                      {f.contratoCargado === false ? (
                        <span className="mt-1 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                          Contrato sin cargar
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <select
                        className="rounded-lg border border-white/15 bg-zinc-950 px-2 py-1.5 text-sm text-white"
                        value={f.clase}
                        onChange={(e) =>
                          setFilas((prev) =>
                            prev.map((x) =>
                              x.empleadoId === f.empleadoId
                                ? { ...x, clase: e.target.value as ClasePagoObra }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="ayudante">Ayudante (2.1)</option>
                        <option value="clasificado">Clasificado (de 1ra)</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={5}
                        step={1}
                        value={f.dias}
                        onChange={(e) =>
                          setFilas((prev) =>
                            prev.map((x) =>
                              x.empleadoId === f.empleadoId
                                ? { ...x, dias: Math.max(0, Math.min(5, Number(e.target.value) || 0)) }
                                : x,
                            ),
                          )
                        }
                        className="w-16 border-white/15 bg-zinc-950 text-white"
                      />
                      <label
                        className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400"
                        title="Cláusula SEXTA c): complemento del beneficio de alimentación, potestativo con carácter general; no depende de la asistencia"
                      >
                        <input
                          type="checkbox"
                          checked={f.otorgarBono !== false}
                          onChange={(e) =>
                            setFilas((prev) =>
                              prev.map((x) =>
                                x.empleadoId === f.empleadoId ? { ...x, otorgarBono: e.target.checked } : x,
                              ),
                            )
                          }
                        />
                        Complemento alimentación
                      </label>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-zinc-300">
                      {p ? (
                        <>
                          {p.semanal.oficio.codigo} · {fmtVes(p.semanal.totalVes)}
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-300">
                      {p ? fmtUsd(p.semanal.totalUsd) : '—'}
                    </TableCell>
                    <TableCell>
                      {p ? (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() => void pdfDe(f, 'legal', p.semanal)}
                          >
                            <FileText className="h-3 w-3" /> Legal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-[11px]"
                            onClick={() => void pdfDe(f, 'patio', p.semanal)}
                          >
                            Patio
                          </Button>
                          {p.toca_adelanto ? (
                            <span className="text-[11px] text-amber-200/90">
                              Se causó 1 semana adicional (USD {semanaAdicionalFijaUsd(f.clase)}). Se paga al finiquito.
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">Calcular</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
