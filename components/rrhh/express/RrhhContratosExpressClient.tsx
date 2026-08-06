'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  FileSpreadsheet,
  Files,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import AccionesContratoPdfFila from '@/components/rrhh/AccionesContratoPdfFila';
import ModalEditarContratoExpress from '@/components/rrhh/express/ModalEditarContratoExpress';
import { SelectorFaseTecnicaContrato } from '@/components/rrhh/express/SelectorFaseTecnicaContrato';
import RrhhSubnavEnlaces from '@/components/rrhh/RrhhSubnavEnlaces';
import { Button } from '@/components/ui/button';
import { descargarPdfUnicoContratosExpress } from '@/lib/rrhh/descargarPdfUnicoCliente';
import {
  descargarPlantillaXlsxContratosExpress,
  normalizarFechaIngresoIso,
  parseArchivoContratosExpress,
  PLANTILLA_CSV_CONTRATOS_EXPRESS,
  type FilaCsvContratoExpress,
} from '@/lib/talento/parseCsvContratosExpress';

type EntidadOpt = { id: string; nombre: string };
type OficioOpt = { id: string; cargo_nombre: string };
type ProyectoOpt = {
  id: string;
  nombre: string;
  entidad_id: string | null;
  proyecto_modulo_origen_id?: string | null;
};
type ExpressRow = {
  id: string;
  created_at: string;
  obrero_nombre: string;
  obrero_cedula: string;
  cargo_nombre_snapshot?: string | null;
  bono_manual_usd?: number | null;
  formalizado_empleado_id?: string | null;
};

/** Entidad patrono de la obra; si falta, toma la del módulo integral padre. */
async function resolverEntidadIdProyecto(
  supabase: ReturnType<typeof createClient>,
  proyecto: Pick<ProyectoOpt, 'entidad_id' | 'proyecto_modulo_origen_id'>,
): Promise<string | null> {
  const directa = (proyecto.entidad_id ?? '').trim();
  if (directa) return directa;
  const padreId = (proyecto.proyecto_modulo_origen_id ?? '').trim();
  if (!padreId) return null;
  const { data } = await supabase
    .from('ci_proyectos')
    .select('entidad_id')
    .eq('id', padreId)
    .maybeSingle();
  return ((data as { entidad_id?: string | null } | null)?.entidad_id ?? '').trim() || null;
}

type ResultadoMasivo =
  | { fila: number; ok: true; id: string; obrero: string; cedula: string; cargo?: string }
  | { fila: number; ok: false; error: string; obrero?: string; cedula?: string };

type FilaEditable = FilaCsvContratoExpress & { key: string };

const selectClass =
  'w-full rounded-lg border border-amber-500/35 bg-zinc-950/80 px-3 py-2 text-sm text-amber-50 outline-none focus:border-amber-400/70';

export default function RrhhContratosExpressClient() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [oficios, setOficios] = useState<OficioOpt[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [entidadId, setEntidadId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [configNominaDefaultId, setConfigNominaDefaultId] = useState('');
  const [faseTecnica, setFaseTecnica] = useState('');
  const [fasesSugeridas, setFasesSugeridas] = useState<string[]>([]);
  const [entidadNombre, setEntidadNombre] = useState<string | null>(null);

  const [rows, setRows] = useState<ExpressRow[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingLista, setLoadingLista] = useState(false);
  const [errLista, setErrLista] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busyPdfLote, setBusyPdfLote] = useState(false);

  const [tabla, setTabla] = useState<FilaEditable[] | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoMasivo[] | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const proyectoNombre = useMemo(
    () => proyectos.find((p) => p.id === proyectoId)?.nombre ?? null,
    [proyectos, proyectoId],
  );

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const entRes = await supabase.from('ci_entidades').select('id,nombre,nombre_legal').order('nombre');
      const ofiRes = await supabase
        .from('ci_config_nomina')
        .select('id,cargo_nombre')
        .order('cargo_nombre')
        .limit(500);
      void fetch('/api/talento/fases-tecnicas')
        .then(async (r) => {
          const j = (await r.json()) as { fases?: { texto?: string }[] };
          const textos = (j.fases ?? [])
            .map((f) => (f.texto ?? '').trim())
            .filter((t) => t.length >= 2);
          setFasesSugeridas(Array.from(new Set(textos)));
        })
        .catch(() => setFasesSugeridas([]));
      if (!ofiRes.error && ofiRes.data) {
        setOficios(
          (ofiRes.data as { id: string; cargo_nombre?: string | null }[])
            .map((o) => ({
              id: o.id,
              cargo_nombre: (o.cargo_nombre ?? '').trim() || o.id.slice(0, 8),
            }))
            .filter((o) => o.cargo_nombre),
        );
      } else {
        setOficios([]);
      }

      let proyData: unknown[] | null = null;
      let proyErr: { message?: string } | null = null;
      {
        const full = await supabase
          .from('ci_proyectos')
          .select('id,nombre,entidad_id,proyecto_modulo_origen_id')
          .order('nombre')
          .limit(800);
        proyData = full.data as unknown[] | null;
        proyErr = full.error;
        if (
          proyErr &&
          /proyecto_modulo_origen_id|42703|column|does not exist|schema cache/i.test(proyErr.message ?? '')
        ) {
          const bare = await supabase
            .from('ci_proyectos')
            .select('id,nombre,entidad_id')
            .order('nombre')
            .limit(800);
          proyData = bare.data as unknown[] | null;
          proyErr = bare.error;
        }
      }

      const ents = ((entRes.data ?? []) as { id: string; nombre?: string | null; nombre_legal?: string | null }[]).map(
        (e) => ({
          id: e.id,
          nombre: (e.nombre_legal ?? e.nombre ?? '').trim() || e.id.slice(0, 8),
        }),
      );
      setEntidades(ents);

      let proys = ((proyData ?? []) as ProyectoOpt[]).filter((p) => p.id);

      const qsProy = (searchParams.get('proyecto') ?? searchParams.get('obra') ?? '').trim();
      const qsEnt = (searchParams.get('entidad') ?? '').trim();

      let nextEnt = qsEnt;
      let nextProy = qsProy;

      // Obra en URL: entidad patrono = la de ese proyecto (p. ej. Asfaltado → DIMAQUINAS).
      if (nextProy) {
        let p = proys.find((x) => x.id === nextProy) ?? null;
        if (!p) {
          let oneData: unknown = null;
          const fullOne = await supabase
            .from('ci_proyectos')
            .select('id,nombre,entidad_id,proyecto_modulo_origen_id')
            .eq('id', nextProy)
            .maybeSingle();
          oneData = fullOne.data;
          if (
            fullOne.error &&
            /proyecto_modulo_origen_id|42703|column|does not exist|schema cache/i.test(
              fullOne.error.message ?? '',
            )
          ) {
            const bareOne = await supabase
              .from('ci_proyectos')
              .select('id,nombre,entidad_id')
              .eq('id', nextProy)
              .maybeSingle();
            oneData = bareOne.data;
          }
          if (oneData && (oneData as ProyectoOpt).id) {
            p = oneData as ProyectoOpt;
            proys = [p, ...proys.filter((x) => x.id !== p!.id)];
          }
        }
        if (p) {
          let eid = await resolverEntidadIdProyecto(supabase, p);
          // Respaldo: obras Asfaltado sin entidad_id → DIMAQUINAS (patrono habitual).
          if (!eid && /asfalt/i.test(p.nombre ?? '')) {
            eid = ents.find((e) => /dimaquinas/i.test(e.nombre))?.id ?? null;
          }
          if (eid) {
            nextEnt = eid;
            p = { ...p, entidad_id: eid };
            proys = proys.map((x) => (x.id === p!.id ? p! : x));
          }
        }
      } else if (nextEnt) {
        const first = proys.find((p) => p.entidad_id === nextEnt);
        nextProy = first?.id ?? '';
      } else {
        const dima = ents.find((e) => /dimaquinas/i.test(e.nombre));
        if (dima) {
          nextEnt = dima.id;
          const asfalt = proys.find(
            (p) => (p.entidad_id === dima.id || !p.entidad_id) && /asfalt/i.test(p.nombre ?? ''),
          );
          nextProy = asfalt?.id ?? proys.find((p) => p.entidad_id === dima.id)?.id ?? '';
          if (nextProy) {
            const p = proys.find((x) => x.id === nextProy);
            if (p && !p.entidad_id) {
              const eid = await resolverEntidadIdProyecto(supabase, p);
              if (eid) {
                nextEnt = eid;
                proys = proys.map((x) => (x.id === p.id ? { ...x, entidad_id: eid } : x));
              }
            }
          }
        }
      }

      setProyectos(proys);
      setEntidadId(nextEnt);
      setProyectoId(nextProy);
      setEntidadNombre(ents.find((e) => e.id === nextEnt)?.nombre ?? null);
      if (nextProy) {
        const { data: proyFase } = await supabase
          .from('ci_proyectos')
          .select('fase_tecnica_contrato_default')
          .eq('id', nextProy)
          .maybeSingle();
        const def =
          ((proyFase as { fase_tecnica_contrato_default?: string | null } | null)
            ?.fase_tecnica_contrato_default ?? '').trim();
        if (def) setFaseTecnica(def);
      }
    } finally {
      setLoadingMeta(false);
    }
  }, [searchParams, supabase]);

  const loadLista = useCallback(async () => {
    if (!proyectoId) {
      setRows([]);
      setSelectedIds(new Set());
      return;
    }
    setLoadingLista(true);
    setSelectedIds(new Set());
    setErrLista(null);
    try {
      const res = await supabase
        .from('ci_contratos_express')
        .select(
          'id,created_at,obrero_nombre,obrero_cedula,cargo_nombre_snapshot,bono_manual_usd,formalizado_empleado_id',
        )
        .eq('proyecto_id', proyectoId)
        .order('created_at', { ascending: false });

      if (res.error) {
        if (/cargo_nombre_snapshot|bono_manual_usd|formalizado_empleado_id|42703/i.test(res.error.message)) {
          const bare = await supabase
            .from('ci_contratos_express')
            .select('id,created_at,obrero_nombre,obrero_cedula')
            .eq('proyecto_id', proyectoId)
            .order('created_at', { ascending: false });
          if (bare.error) {
            setErrLista(bare.error.message);
            setRows([]);
          } else {
            setRows((bare.data ?? []) as ExpressRow[]);
          }
        } else {
          setErrLista(res.error.message);
          setRows([]);
        }
      } else {
        setRows((res.data ?? []) as ExpressRow[]);
      }
    } catch {
      setErrLista('No se pudo cargar la lista.');
      setRows([]);
    } finally {
      setLoadingLista(false);
    }
  }, [proyectoId, supabase]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    setEntidadNombre(entidades.find((e) => e.id === entidadId)?.nombre ?? null);
  }, [entidadId, entidades]);

  useEffect(() => {
    void loadLista();
  }, [loadLista]);

  const proyectosFiltrados = useMemo(() => {
    if (!entidadId) return proyectos;
    return proyectos.filter((p) => p.entidad_id === entidadId);
  }, [entidadId, proyectos]);

  function onChangeEntidad(id: string) {
    setEntidadId(id);
    setTabla(null);
    setResultados(null);
    const list = proyectos.filter((p) => p.entidad_id === id);
    if (!list.some((p) => p.id === proyectoId)) {
      const asfalt = list.find((p) => /asfalt/i.test(p.nombre ?? ''));
      setProyectoId(asfalt?.id ?? list[0]?.id ?? '');
    }
  }

  async function onChangeProyecto(id: string) {
    setProyectoId(id);
    setTabla(null);
    setResultados(null);
    const p = proyectos.find((x) => x.id === id);
    if (id) {
      const { data: proy } = await supabase
        .from('ci_proyectos')
        .select('fase_tecnica_contrato_default')
        .eq('id', id)
        .maybeSingle();
      const def =
        ((proy as { fase_tecnica_contrato_default?: string | null } | null)
          ?.fase_tecnica_contrato_default ?? '').trim();
      if (def) setFaseTecnica(def);
    }
    if (!p) return;
    if (p.entidad_id) {
      setEntidadId(p.entidad_id);
      return;
    }
    const eid = await resolverEntidadIdProyecto(supabase, p);
    if (eid) {
      setEntidadId(eid);
      setProyectos((prev) => prev.map((x) => (x.id === id ? { ...x, entidad_id: eid } : x)));
    }
  }

  function descargarPlantillaCsv() {
    const blob = new Blob([PLANTILLA_CSV_CONTRATOS_EXPRESS], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-contratos-express.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function descargarPlantillaXlsx() {
    try {
      descargarPlantillaXlsxContratosExpress();
    } catch {
      toast.error('No se pudo generar la plantilla Excel');
    }
  }

  async function onArchivoImport(file: File | null) {
    if (!file) return;
    setResultados(null);
    try {
      const parsed = await parseArchivoContratosExpress(file);
      if (!parsed.ok) {
        toast.error(parsed.error);
        return;
      }
      if (parsed.filas.length > 40) {
        toast.error(`Máximo 40 filas por lote (hay ${parsed.filas.length}).`);
        return;
      }
      setTabla(
        parsed.filas.map((f, i) => ({
          ...f,
          key: `${f.fila}-${i}-${f.cedula}`,
        })),
      );
      toast.success(`${parsed.filas.length} fila(s) cargadas — revise la tabla y confirme`);
    } catch {
      toast.error('No se pudo leer el archivo. Use .xlsx, .xls o .csv');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function actualizarFila(key: string, patch: Partial<FilaCsvContratoExpress>) {
    setTabla((prev) => (prev ? prev.map((r) => (r.key === key ? { ...r, ...patch } : r)) : prev));
  }

  function quitarFila(key: string) {
    setTabla((prev) => (prev ? prev.filter((r) => r.key !== key) : prev));
  }

  async function confirmarCarga() {
    if (!tabla?.length) {
      toast.error('No hay filas en la tabla');
      return;
    }
    if (!proyectoId) {
      toast.error('Seleccione la obra (p. ej. Asfaltado)');
      return;
    }
    if (!entidadId) {
      toast.error('Seleccione la entidad patrono (p. ej. DIMAQUINAS, C.A.)');
      return;
    }
    if (
      !window.confirm(
        `Crear ${tabla.length} contrato(s) express\nObra: ${proyectoNombre ?? proyectoId}\nEntidad: ${entidadNombre ?? entidadId}\n\n¿Continuar?`,
      )
    ) {
      return;
    }

    setImportando(true);
    setResultados(null);
    try {
      const res = await fetch('/api/talento/contratos-fast/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          entidad_patrono_id: entidadId,
          config_nomina_id: configNominaDefaultId.trim() || null,
          objeto_contrato: faseTecnica.trim() || null,
          filas: tabla.map((f) => ({
            fila: f.fila,
            obrero_nombres: f.nombres,
            obrero_apellidos: f.apellidos,
            obrero_cedula: f.cedula,
            cargo: f.cargo || null,
            remuneracion_semanal: f.remuneracion_semanal,
            fecha_ingreso: normalizarFechaIngresoIso(f.fecha_ingreso) || f.fecha_ingreso || null,
            nivel_generico: f.nivel_generico,
          })),
        }),
      });
      const j = (await res.json()) as {
        error?: string;
        creados?: number;
        fallidos?: number;
        resultados?: ResultadoMasivo[];
      };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo importar');
        return;
      }
      setResultados(j.resultados ?? []);
      const creados = j.creados ?? 0;
      const fallidos = j.fallidos ?? 0;
      if (creados > 0) {
        toast.success(`${creados} contrato(s) creado(s)${fallidos ? ` · ${fallidos} con error` : ''}`);
        setTabla(null);
        await loadLista();
        if (faseTecnica.trim().length >= 2) {
          void fetch('/api/talento/fases-tecnicas')
            .then(async (r) => {
              const fj = (await r.json()) as { fases?: { texto?: string }[] };
              const textos = (fj.fases ?? [])
                .map((f) => (f.texto ?? '').trim())
                .filter((t) => t.length >= 2);
              setFasesSugeridas(Array.from(new Set(textos)));
            })
            .catch(() => undefined);
        }
      } else {
        const primerErr =
          (j.resultados ?? []).find((r): r is Extract<ResultadoMasivo, { ok: false }> => !r.ok)?.error ??
          null;
        toast.error(
          primerErr
            ? `Ningún contrato creado (${fallidos} error(es)): ${primerErr}`
            : `Ningún contrato creado (${fallidos} error(es))`,
          { duration: 12_000 },
        );
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setImportando(false);
    }
  }

  async function eliminarFila(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar el contrato express de «${nombre}»?`)) return;
    setBusyDeleteId(id);
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}`, { method: 'DELETE' });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo eliminar');
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Eliminado');
    } catch {
      toast.error('Error de red');
    } finally {
      setBusyDeleteId(null);
    }
  }

  const todosSeleccionados = rows.length > 0 && selectedIds.size === rows.length;
  const algunoSeleccionado = selectedIds.size > 0;

  function toggleTodos() {
    if (todosSeleccionados) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((r) => r.id)));
  }

  function toggleUno(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pdfUnico(abrirParaImprimir: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Seleccione al menos un contrato.');
      return;
    }
    setBusyPdfLote(true);
    try {
      const slug = (proyectoNombre ?? 'obra')
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñ]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      const out = await descargarPdfUnicoContratosExpress(ids, {
        abrirParaImprimir,
        nombreArchivo: `contratos-${slug || 'obra'}-${ids.length}.pdf`,
      });
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      toast.success(
        abrirParaImprimir
          ? `PDF único abierto (${ids.length} contrato${ids.length === 1 ? '' : 's'}).`
          : `PDF único descargado (${ids.length} contrato${ids.length === 1 ? '' : 's'}).`,
      );
    } catch {
      toast.error('Error al generar el PDF único.');
    } finally {
      setBusyPdfLote(false);
    }
  }

  const inputCell =
    'w-full min-w-[7rem] rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-500/50';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Casa Inteligente</p>
      <h1 className="text-2xl font-bold tracking-tight text-white">Contratos express</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        RRHH · carga masiva por obra y entidad patrono. Ejemplo: obra Asfaltado · entidad DIMAQUINAS, C.A.
      </p>

      <header className="mb-6 mt-8">
        <RrhhSubnavEnlaces proyectoModuloId={proyectoId || null} />
      </header>

      <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/35 to-zinc-950/80 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Entidad (patrono)
            <select
              className={selectClass}
              value={entidadId}
              disabled={loadingMeta}
              onChange={(e) => onChangeEntidad(e.target.value)}
            >
              <option value="">Seleccione entidad…</option>
              {entidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Obra / proyecto
            <select
              className={selectClass}
              value={proyectoId}
              disabled={loadingMeta || !entidadId}
              onChange={(e) => void onChangeProyecto(e.target.value)}
            >
              <option value="">Seleccione obra…</option>
              {proyectosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre || p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {entidadNombre && proyectoNombre ? (
          <p className="mt-3 text-xs text-amber-100/80">
            Contexto activo:{' '}
            <span className="font-semibold text-amber-50">{proyectoNombre}</span>
            {' · '}
            <span className="font-semibold text-amber-50">{entidadNombre}</span>
          </p>
        ) : null}

        <div className="mt-5 rounded-xl border border-amber-500/25 bg-black/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="size-4 text-amber-300" aria-hidden />
            <h2 className="text-sm font-bold text-amber-100">Carga masiva</h2>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Acepta <span className="font-semibold text-zinc-400">.xlsx / .xls / .csv</span>. Plantilla:{' '}
            <span className="font-mono text-zinc-400">nombres · apellidos · cedula · cargo · remuneracion_semanal · fecha_ingreso</span>
            . También listados de obra con{' '}
            <span className="font-mono text-zinc-400">NOMBRES Y APELLIDOS · C.I. · FECHA INI · CARGO</span>
            {' '}(título arriba OK). El cargo se empareja con el tabulador; si no calza, usa el oficio por defecto.
          </p>
          <label className="mt-3 flex max-w-md flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Oficio por defecto (si el cargo del Excel no está en el tabulador)
            <select
              className={selectClass}
              value={configNominaDefaultId}
              onChange={(e) => setConfigNominaDefaultId(e.target.value)}
            >
              <option value="">— Opcional —</option>
              {oficios.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.cargo_nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 max-w-xl space-y-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <span>Fase técnica (cláusula PRIMERA — todos los contratos del lote)</span>
            <SelectorFaseTecnicaContrato
              value={faseTecnica}
              onChange={setFaseTecnica}
              controlClassName={selectClass}
              recientes={fasesSugeridas}
              helperText="Elija categoría y marque una o varias fases. Al generar quedan grabadas para próximas obras."
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={descargarPlantillaXlsx}
              className="border-zinc-600 bg-zinc-900/60 text-zinc-200"
            >
              <Download className="size-3.5" aria-hidden />
              <span className="ml-1.5">Plantilla Excel</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={descargarPlantillaCsv}
              className="border-zinc-600 bg-zinc-900/60 text-zinc-200"
            >
              <Download className="size-3.5" aria-hidden />
              <span className="ml-1.5">Plantilla CSV</span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!proyectoId || !entidadId || importando}
              onClick={() => fileRef.current?.click()}
              className="bg-amber-600 text-zinc-950 hover:bg-amber-500"
            >
              <Upload className="size-3.5" aria-hidden />
              <span className="ml-1.5">Subir Excel / CSV</span>
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv,text/csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => void onArchivoImport(e.target.files?.[0] ?? null)}
            />
          </div>

          {tabla && tabla.length > 0 ? (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-300">
                  Tabla cargada · {tabla.length} obrero(s) — revise y confirme
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={importando}
                    onClick={() => setTabla(null)}
                    className="border-zinc-600 text-zinc-300"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={importando}
                    onClick={() => void confirmarCarga()}
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    {importando ? (
                      <RefreshCw className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    <span className={importando ? 'ml-1.5' : ''}>
                      {importando ? 'Generando contratos…' : 'Confirmar y generar'}
                    </span>
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-amber-500/20">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-amber-500/25 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                      <th className="px-2 py-2">Nombres</th>
                      <th className="px-2 py-2">Apellidos</th>
                      <th className="px-2 py-2">Cédula</th>
                      <th className="px-2 py-2">Cargo</th>
                      <th className="px-2 py-2">Remun. semanal (USD)</th>
                      <th className="px-2 py-2">Fecha ingreso (d/m/a)</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {tabla.map((r) => (
                      <tr key={r.key} className="border-b border-white/[0.06]">
                        <td className="px-2 py-1.5">
                          <input
                            className={inputCell}
                            value={r.nombres}
                            onChange={(e) => actualizarFila(r.key, { nombres: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={inputCell}
                            value={r.apellidos}
                            onChange={(e) => actualizarFila(r.key, { apellidos: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={inputCell}
                            value={r.cedula}
                            onChange={(e) => actualizarFila(r.key, { cedula: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={inputCell}
                            value={r.cargo}
                            onChange={(e) => actualizarFila(r.key, { cargo: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className={inputCell}
                            value={r.remuneracion_semanal}
                            onChange={(e) =>
                              actualizarFila(r.key, {
                                remuneracion_semanal: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="date"
                            className={inputCell}
                            value={r.fecha_ingreso}
                            onChange={(e) => actualizarFila(r.key, { fecha_ingreso: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="text-red-300/80 hover:text-red-200"
                            onClick={() => quitarFila(r.key)}
                            aria-label="Quitar fila"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {resultados && resultados.length > 0 ? (
            <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-red-500/30 bg-red-950/20 text-[11px]">
              <p className="sticky top-0 border-b border-red-500/20 bg-red-950/80 px-3 py-1.5 font-semibold text-red-100">
                Detalle de errores / resultados
              </p>
              <ul className="divide-y divide-white/5">
                {resultados.map((r) => (
                  <li
                    key={`${r.fila}-${r.ok ? r.id : r.error}`}
                    className={`px-3 py-1.5 ${r.ok ? 'text-emerald-300/90' : 'text-red-200'}`}
                  >
                    Fila {r.fila}
                    {r.obrero ? ` · ${r.obrero}` : ''}
                    {r.ok ? ' · OK' : ` · ${r.error}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">Contratos en esta obra</h2>
          <div className="flex flex-wrap items-center gap-2">
            {rows.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyPdfLote || !algunoSeleccionado}
                  onClick={() => void pdfUnico(false)}
                  className="border-emerald-500/45 bg-emerald-950/35 text-emerald-100"
                  title="Descargar un solo PDF con los contratos seleccionados"
                >
                  {busyPdfLote ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Files className="size-3.5" aria-hidden />
                  )}
                  <span className="ml-1.5">
                    PDF único{algunoSeleccionado ? ` (${selectedIds.size})` : ''}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyPdfLote || !algunoSeleccionado}
                  onClick={() => void pdfUnico(true)}
                  className="border-emerald-500/35 text-emerald-100/90"
                  title="Abrir PDF único para imprimir"
                >
                  <Printer className="size-3.5" aria-hidden />
                  <span className="ml-1.5 hidden sm:inline">Imprimir lote</span>
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingLista || !proyectoId}
              onClick={() => void loadLista()}
              className="border-amber-500/40 text-amber-100"
            >
              <RefreshCw className={`size-3.5 ${loadingLista ? 'animate-spin' : ''}`} aria-hidden />
              <span className="ml-1.5">Actualizar</span>
            </Button>
          </div>
        </div>

        <div className="mt-3">
          {!proyectoId ? (
            <p className="text-sm text-zinc-500">Seleccione entidad y obra para ver y cargar contratos.</p>
          ) : loadingLista ? (
            <p className="py-6 text-center text-sm text-zinc-500">Cargando…</p>
          ) : errLista ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {errLista}
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
              Sin contratos express en esta obra. Suba un CSV arriba.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-black/25">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-amber-500/25 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                    <th className="w-10 px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        onChange={toggleTodos}
                        aria-label="Seleccionar todos"
                        className="size-3.5 accent-amber-500"
                      />
                    </th>
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Obrero</th>
                    <th className="px-3 py-2.5">Cédula</th>
                    <th className="px-3 py-2.5">Cargo</th>
                    <th className="px-3 py-2.5 text-center">PDF</th>
                    <th className="px-3 py-2.5 text-center">Editar</th>
                    <th className="px-3 py-2.5 text-right">Borrar</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleUno(r.id)}
                          aria-label={`Seleccionar ${r.obrero_nombre}`}
                          className="size-3.5 accent-amber-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                        {new Date(r.created_at).toLocaleDateString('es-VE')}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-100">{r.obrero_nombre}</td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-400">{r.obrero_cedula}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400">
                        {r.cargo_nombre_snapshot ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <AccionesContratoPdfFila
                          empleadoRowId={`ci-express-${r.id}`}
                          nombreObrero={r.obrero_nombre}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-amber-700/50 bg-amber-950/25 px-2 text-xs text-amber-100"
                          onClick={() => setEditId(r.id)}
                          title="Editar datos del contrato"
                          aria-label={`Editar datos de ${r.obrero_nombre}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyDeleteId === r.id}
                          className="h-8 border-red-900/55 bg-red-950/30 px-2 text-xs text-red-200"
                          onClick={() => void eliminarFila(r.id, r.obrero_nombre)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-600">
          Oficios del tabulador en{' '}
          <Link href="/rrhh/oficios-salarios" className="text-amber-300/90 underline underline-offset-2">
            Oficios y salarios
          </Link>
          . Marque contratos y use <span className="text-zinc-400">PDF único</span> para imprimir el
          lote. Tras ensamblar, use <span className="text-zinc-400">Editar</span> para corregir datos y
          regenerar el PDF.
        </p>
      </section>

      <ModalEditarContratoExpress
        open={Boolean(editId)}
        contratoId={editId}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
        onGuardado={() => void loadLista()}
      />
    </div>
  );
}
