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
  SOBRE_AYUDANTE_USD,
  SOBRE_CLASIFICADO_USD,
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
  /** Arreglo pactado en el contrato (USD). Sin valor: monto por defecto de la clase. */
  sobreUsd?: number | null;
  mensualUsd?: number | null;
  /** `false`: el contrato firmado aún no se cargó. */
  contratoCargado?: boolean;
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
      setFilas(next);
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
    void loadContratados();
    setPreviews(null);
    setItemIds({});
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
        sobre_usd: f.sobreUsd,
        mensual_usd: f.mensualUsd,
      })),
      previasPorEmpleado: {},
      tasaBcvPago: tasaNum,
      tasaAnclaCestaBcv: tasaNum,
    });
  }

  async function calcular(guardar: boolean) {
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
          items: filas.map((f) => ({
            empleado_id: f.empleadoId,
            clase: f.clase,
            dias_laborados: f.dias,
            cargo_codigo: f.cargoCodigo,
            cargo_nombre: f.cargoNombre,
            incluir_adelanto: f.incluirAdelanto,
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
        if (mig) {
          setAvisoMigracion(j.error ?? 'Migración 333 pendiente.');
          if (guardar) toast.error('El preview sí se calcula; para guardar hay que aplicar la migración 333.');
        }
        const list = j.previews ?? j.items ?? previewLocal();
        setPreviews(list);
        toast.success('Cálculo listo. Revisa los dos recibos.');
        return;
      }
      const list = j.previews ?? j.items ?? null;
      setPreviews(list);
      if (j.item_ids) setItemIds(j.item_ids);
      if (guardar) toast.success('Semana guardada.');
      else if (list) toast.success('Cálculo listo. Revisa los dos recibos.');
    } catch (e) {
      try {
        setPreviews(previewLocal());
        toast.success('Cálculo listo (preview local). Revisa los dos recibos.');
      } catch {
        toast.error(e instanceof Error ? e.message : 'Error de red.');
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

  async function firmarAdelanto(fila: FilaUi) {
    const itemId = itemIds[`${fila.empleadoId}:adelanto_prestaciones`];
    if (!itemId) {
      toast.error('Guarda la semana primero para registrar el adelanto.');
      return;
    }
    setTrabajando(true);
    try {
      const res = await fetch(apiUrl('/api/rrhh/nomina/adelanto'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          firmar: true,
          firmante_nombre: `${fila.nombres} ${fila.apellidos}`.trim(),
          solicitud_texto:
            'Solicito adelanto de prestaciones sociales conforme al artículo 144 de la LOTTT, por la quinta semana pactada cada cuatro semanas trabajadas.',
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error || 'No se registró el adelanto.');
        return;
      }
      toast.success('Adelanto firmado y descontado del saldo.');
      const p = previewDe(fila.empleadoId);
      if (p?.adelanto) await pdfDe(fila, 'adelanto', p.adelanto);
    } finally {
      setTrabajando(false);
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
            Se paga el arreglo pactado en cada contrato (por defecto: ayudante USD {SOBRE_AYUDANTE_USD} · clasificado
            USD {SOBRE_CLASIFICADO_USD}), cesta incluida · pago mensual cada 4 semanas trabajadas.
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
        </div>
      </div>

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
                <TableHead className="text-zinc-400">Días</TableHead>
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
                            <>
                              <label className="flex items-center gap-1 text-[11px] text-amber-200">
                                <input
                                  type="checkbox"
                                  checked={f.incluirAdelanto}
                                  onChange={(e) =>
                                    setFilas((prev) =>
                                      prev.map((x) =>
                                        x.empleadoId === f.empleadoId
                                          ? { ...x, incluirAdelanto: e.target.checked }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                                5ª semana
                              </label>
                              {p.adelanto ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => void pdfDe(f, 'adelanto', p.adelanto!)}
                                  >
                                    PDF adelanto
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={trabajando}
                                    onClick={() => void firmarAdelanto(f)}
                                  >
                                    Firmar adelanto
                                  </Button>
                                </>
                              ) : (
                                <span className="text-[11px] text-zinc-500">Recalcular para incluirla</span>
                              )}
                            </>
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
