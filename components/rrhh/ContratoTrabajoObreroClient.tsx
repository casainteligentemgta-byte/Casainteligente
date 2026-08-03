'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  Upload,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiUrl } from '@/lib/http/apiUrl';
import {
  generarPlantillaContratoTrabajoXlsx,
  parseContratoTrabajoObreroTabla,
  type FilaContratoTrabajoObrero,
} from '@/lib/talento/parseContratoTrabajoObreroTabla';

type ProyectoOpt = { id: string; nombre: string };
type NominaOpt = { id: string; cargo_nombre: string };

type ResultadoFila = {
  filaExcel: number;
  cedula: string;
  nombre: string;
  status: 'pendiente' | 'ok' | 'error' | 'omitida';
  error?: string;
  id?: string;
  signedUrl?: string | null;
};

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normCargo(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function nombreFila(f: FilaContratoTrabajoObrero): string {
  if (f.nombres && f.apellidos) return `${f.nombres} ${f.apellidos}`.trim();
  return (f.nombreCompleto ?? '').trim() || '—';
}

const inputClass =
  'w-full rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25';

export default function ContratoTrabajoObreroClient() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [nominas, setNominas] = useState<NominaOpt[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [proyectoId, setProyectoId] = useState(() => searchParams.get('proyecto')?.trim() || '');
  const [configNominaId, setConfigNominaId] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(hoyIso);
  const [jornada, setJornada] = useState<'DIURNA' | 'NOCTURNA' | 'MIXTA'>('DIURNA');
  const [horarioDefault, setHorarioDefault] = useState('');

  const [filas, setFilas] = useState<FilaContratoTrabajoObrero[]>([]);
  const [avisosParse, setAvisosParse] = useState<string[]>([]);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);

  const [generando, setGenerando] = useState(false);
  const [progreso, setProgreso] = useState({ done: 0, total: 0 });
  const [resultados, setResultados] = useState<ResultadoFila[]>([]);

  const cargarOpciones = useCallback(async () => {
    setLoadingOpts(true);
    try {
      const [pr, nom] = await Promise.all([
        supabase.from('ci_proyectos').select('id,nombre').order('nombre').limit(400),
        supabase.from('ci_config_nomina').select('id,cargo_nombre').order('cargo_nombre').limit(500),
      ]);
      if (!pr.error && pr.data) {
        setProyectos(
          (pr.data as ProyectoOpt[]).map((p) => ({
            id: p.id,
            nombre: (p.nombre ?? '').trim() || p.id.slice(0, 8),
          })),
        );
      }
      if (!nom.error && nom.data) {
        setNominas(
          (nom.data as NominaOpt[])
            .map((n) => ({
              id: n.id,
              cargo_nombre: (n.cargo_nombre ?? '').trim() || 'Sin nombre',
            }))
            .filter((n) => n.cargo_nombre),
        );
      }
    } finally {
      setLoadingOpts(false);
    }
  }, [supabase]);

  useEffect(() => {
    void cargarOpciones();
  }, [cargarOpciones]);

  function resolverNominaId(fila: FilaContratoTrabajoObrero): string | null {
    if (fila.configNominaId?.trim()) return fila.configNominaId.trim();
    if (fila.cargo?.trim()) {
      const target = normCargo(fila.cargo);
      const hit = nominas.find((n) => normCargo(n.cargo_nombre) === target);
      if (hit) return hit.id;
      const partial = nominas.find(
        (n) =>
          normCargo(n.cargo_nombre).includes(target) || target.includes(normCargo(n.cargo_nombre)),
      );
      if (partial) return partial.id;
    }
    return configNominaId.trim() || null;
  }

  function resolverProyectoId(fila: FilaContratoTrabajoObrero): string | null {
    if (fila.proyectoId?.trim()) return fila.proyectoId.trim();
    if (fila.proyectoNombre?.trim()) {
      const target = normCargo(fila.proyectoNombre);
      const hit = proyectos.find((p) => normCargo(p.nombre) === target);
      if (hit) return hit.id;
    }
    return proyectoId.trim() || null;
  }

  async function onFile(file: File | null) {
    setResultados([]);
    setFilas([]);
    setAvisosParse([]);
    setArchivoNombre(null);
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseContratoTrabajoObreroTabla(buf, file.name);
      setFilas(parsed.filas);
      setAvisosParse(parsed.avisos);
      setArchivoNombre(file.name);
      if (parsed.filas.length === 0) {
        toast.error('No se extrajeron filas del archivo');
      } else {
        toast.success(`${parsed.filas.length} fila(s) leídas de «${file.name}»`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    }
  }

  function descargarPlantilla() {
    const buf = generarPlantillaContratoTrabajoXlsx();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-contrato-trabajo-obrero.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generarEnSerie() {
    if (!proyectoId.trim()) {
      toast.error('Seleccione la obra / proyecto por defecto');
      return;
    }
    if (!configNominaId.trim()) {
      toast.error('Seleccione el cargo (tabulador) por defecto');
      return;
    }
    if (filas.length === 0) {
      toast.error('Cargue una tabla Excel/CSV con los obreros');
      return;
    }

    const pendientes = filas.filter((f) => f.errores.length === 0);
    if (pendientes.length === 0) {
      toast.error('Ninguna fila válida para generar');
      return;
    }

    setGenerando(true);
    setProgreso({ done: 0, total: pendientes.length });
    const init: ResultadoFila[] = filas.map((f) => ({
      filaExcel: f.filaExcel,
      cedula: f.cedula,
      nombre: nombreFila(f),
      status: f.errores.length ? 'omitida' : 'pendiente',
      error: f.errores.length ? f.errores.join('; ') : undefined,
    }));
    setResultados(init);

    let ok = 0;
    let fail = 0;
    let done = 0;

    for (const f of pendientes) {
      const proy = resolverProyectoId(f);
      const nomina = resolverNominaId(f);
      if (!proy || !nomina) {
        fail += 1;
        done += 1;
        setProgreso({ done, total: pendientes.length });
        setResultados((prev) =>
          prev.map((r) =>
            r.filaExcel === f.filaExcel
              ? {
                  ...r,
                  status: 'error',
                  error: !proy
                    ? 'Sin proyecto (defínalo arriba o en la fila)'
                    : 'Sin cargo/tabulador (defínalo arriba o en la columna cargo)',
                }
              : r,
          ),
        );
        continue;
      }

      try {
        const body = {
          proyecto_id: proy,
          config_nomina_id: nomina,
          obrero_cedula: f.cedula,
          obrero_nombres: f.nombres,
          obrero_apellidos: f.apellidos,
          obrero_nombre: f.nombreCompleto,
          obrero_direccion: f.direccion,
          bono_manual_usd: f.bonoUsd,
          fecha_ingreso: f.fechaIngreso || fechaIngreso,
          jornada_trabajo: f.jornada || jornada,
          horario_semanal_texto: f.horario || horarioDefault || null,
          nacionalidad: f.nacionalidad,
          estado_civil: f.estadoCivil,
          objeto_contrato: f.objetoContrato,
          obrero_municipio_residencia: f.municipio,
          obrero_estado_residencia: f.estadoResidencia,
        };
        const res = await fetch(apiUrl('/api/talento/contratos-fast'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = (await res.json()) as {
          id?: string;
          signed_url?: string | null;
          error?: string;
        };
        done += 1;
        setProgreso({ done, total: pendientes.length });
        if (!res.ok) {
          fail += 1;
          setResultados((prev) =>
            prev.map((r) =>
              r.filaExcel === f.filaExcel
                ? { ...r, status: 'error', error: j.error ?? `Error HTTP ${res.status}` }
                : r,
            ),
          );
        } else {
          ok += 1;
          setResultados((prev) =>
            prev.map((r) =>
              r.filaExcel === f.filaExcel
                ? {
                    ...r,
                    status: 'ok',
                    id: j.id,
                    signedUrl: j.signed_url ?? null,
                  }
                : r,
            ),
          );
        }
      } catch (e) {
        fail += 1;
        done += 1;
        setProgreso({ done, total: pendientes.length });
        setResultados((prev) =>
          prev.map((r) =>
            r.filaExcel === f.filaExcel
              ? {
                  ...r,
                  status: 'error',
                  error: e instanceof Error ? e.message : 'Error de red',
                }
              : r,
          ),
        );
      }
    }

    setGenerando(false);
    if (fail === 0) {
      toast.success(`${ok} contrato(s) de trabajo generados`);
    } else {
      toast.message(`Serie terminada: ${ok} ok, ${fail} con error`);
    }
  }

  const validas = filas.filter((f) => f.errores.length === 0).length;
  const invalidas = filas.length - validas;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-4 py-6 pb-24">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/rrhh"
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-amber-400"
        >
          <ArrowLeft size={14} />
          Volver a RRHH
        </Link>

        <header className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Contrato de trabajo (obrero)
          </h1>
          <p className="text-sm text-zinc-500">
            Genere contratos en serie cargando una tabla Excel/CSV con los datos que falten. La obra,
            el cargo del tabulador y la jornada se pueden fijar aquí como valores por defecto.
          </p>
        </header>

        {/* Defaults */}
        <section className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-amber-200/90">
            Datos comunes (obra y cargo)
          </h2>
          {loadingOpts ? (
            <p className="text-sm text-zinc-500">Cargando proyectos y tabulador…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Obra / proyecto *
                </span>
                <select
                  className={inputClass}
                  value={proyectoId}
                  onChange={(e) => setProyectoId(e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Cargo (tabulador) *
                </span>
                <select
                  className={inputClass}
                  value={configNominaId}
                  onChange={(e) => setConfigNominaId(e.target.value)}
                >
                  <option value="">Seleccione…</option>
                  {nominas.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.cargo_nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Fecha de ingreso
                </span>
                <input
                  type="date"
                  className={inputClass}
                  value={fechaIngreso}
                  onChange={(e) => setFechaIngreso(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Jornada
                </span>
                <select
                  className={inputClass}
                  value={jornada}
                  onChange={(e) => setJornada(e.target.value as typeof jornada)}
                >
                  <option value="DIURNA">Diurna</option>
                  <option value="NOCTURNA">Nocturna</option>
                  <option value="MIXTA">Mixta</option>
                </select>
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Horario semanal (opcional)
                </span>
                <textarea
                  className={`${inputClass} min-h-[4rem] resize-y`}
                  value={horarioDefault}
                  onChange={(e) => setHorarioDefault(e.target.value)}
                  placeholder="Si la obra ya tiene horario en el proyecto, puede dejarlo vacío"
                />
              </label>
            </div>
          )}
        </section>

        {/* Excel */}
        <section className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15">
                <FileSpreadsheet className="h-5 w-5 text-emerald-300" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Tabla Excel / CSV</h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Columnas: cedula, nombres, apellidos (o nombre_completo), direccion, municipio,
                  estado, nacionalidad, estado_civil, fecha_ingreso, jornada, horario, bono_usd,
                  cargo, objeto_contrato.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={descargarPlantilla}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Descargar plantilla
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={generando}
            className="inline-flex w-full min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate leading-none">
              {archivoNombre ? archivoNombre : 'Seleccionar archivo Excel o CSV'}
            </span>
          </button>

          {avisosParse.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
              {avisosParse.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}

          {filas.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-zinc-500">
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Cédula</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Cargo</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.filaExcel} className="border-b border-white/5 text-zinc-300">
                      <td className="px-3 py-2 font-mono text-zinc-500">{f.filaExcel}</td>
                      <td className="px-3 py-2 font-mono">{f.cedula || '—'}</td>
                      <td className="px-3 py-2">{nombreFila(f)}</td>
                      <td className="px-3 py-2 text-zinc-400">{f.cargo ?? '—'}</td>
                      <td className="px-3 py-2">
                        {f.errores.length ? (
                          <span className="text-red-400">{f.errores[0]}</span>
                        ) : (
                          <span className="text-emerald-400">Lista</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-white/10 px-3 py-2 text-[11px] text-zinc-500">
                {validas} válida(s)
                {invalidas > 0 ? ` · ${invalidas} con error (se omiten)` : null}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void generarEnSerie()}
            disabled={generando || filas.length === 0 || !proyectoId || !configNominaId}
            className="inline-flex w-full min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-black hover:bg-amber-400 disabled:opacity-50"
          >
            {generando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Generando {progreso.done}/{progreso.total}…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden />
                Generar contratos en serie
              </>
            )}
          </button>
        </section>

        {resultados.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Resultado</h2>
            <ul className="space-y-2">
              {resultados.map((r) => (
                <li
                  key={`${r.filaExcel}-${r.cedula}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-200">
                      Fila {r.filaExcel} · {r.nombre}
                    </p>
                    <p className="font-mono text-zinc-500">{r.cedula}</p>
                    {r.error ? <p className="mt-0.5 text-red-400">{r.error}</p> : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === 'ok' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
                        {r.signedUrl ? (
                          <a
                            href={r.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-300 underline underline-offset-2 hover:text-amber-200"
                          >
                            PDF
                          </a>
                        ) : null}
                      </>
                    ) : r.status === 'error' || r.status === 'omitida' ? (
                      <XCircle className="h-4 w-4 text-red-400" aria-hidden />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-500" aria-hidden />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
