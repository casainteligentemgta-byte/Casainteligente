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
  Plus,
  RefreshCw,
  Upload,
  CheckCircle2,
  XCircle,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiUrl } from '@/lib/http/apiUrl';
import AccionesContratoPdfFila from '@/components/rrhh/AccionesContratoPdfFila';
import {
  esUuidProyectoModulo,
  guardarProyectoRrhhContexto,
  leerProyectoRrhhContexto,
} from '@/lib/rrhh/proyectoRrhhContexto';
import {
  generarPlantillaContratoTrabajoXlsx,
  parseContratoTrabajoObreroTabla,
  type FilaContratoTrabajoObrero,
} from '@/lib/talento/parseContratoTrabajoObreroTabla';
import { nacionalidadDesdeCedula, trabajadorFemeninoDesdeEstadoCivil } from '@/lib/talento/cedulaAuth';
import { normalizarListaContratosExpressObrero } from '@/lib/talento/filtrarContratosExpressObrero';

type Vista = 'lista' | 'nuevo' | 'masiva';

type ProyectoOpt = { id: string; nombre: string };
type NominaOpt = { id: string; cargo_nombre: string };

type ContratoRow = {
  id: string;
  created_at: string;
  obrero_nombre: string;
  obrero_cedula: string;
  cargo_nombre_snapshot?: string | null;
  formalizado_empleado_id?: string | null;
  tipo_contrato?: string | null;
};

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

/** Parte nombres/apellidos para el cuadro (si el Excel trae nombre completo). */
function partesNombreFila(f: FilaContratoTrabajoObrero): { nombres: string; apellidos: string } {
  const n = (f.nombres ?? '').trim();
  const a = (f.apellidos ?? '').trim();
  if (n || a) return { nombres: n || '—', apellidos: a || '—' };
  const full = (f.nombreCompleto ?? '').trim();
  if (!full) return { nombres: '—', apellidos: '—' };
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { nombres: parts[0]!, apellidos: '—' };
  const mid = Math.ceil(parts.length / 2);
  return {
    nombres: parts.slice(0, mid).join(' '),
    apellidos: parts.slice(mid).join(' '),
  };
}

function fechaFilaMostrada(f: FilaContratoTrabajoObrero, defaultIso: string): string {
  const raw = (f.fechaIngreso || defaultIso || '').trim();
  if (!raw) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  }
  return raw;
}

const inputClass =
  'w-full rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/25';

export default function ContratoTrabajoObreroClient() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const proyectoUrl =
    searchParams.get('proyecto')?.trim() ||
    searchParams.get('proyecto_modulo')?.trim() ||
    '';

  const vistaUrl = (searchParams.get('vista') ?? '').trim().toLowerCase();
  const [vista, setVista] = useState<Vista>(
    vistaUrl === 'nuevo' || vistaUrl === 'masiva' ? (vistaUrl as Vista) : 'lista',
  );

  const [proyectos, setProyectos] = useState<ProyectoOpt[]>([]);
  const [nominas, setNominas] = useState<NominaOpt[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  /** Prefill desde URL/contexto RRHH; el usuario siempre puede cambiar la obra. */
  const [proyectoId, setProyectoId] = useState(() =>
    esUuidProyectoModulo(proyectoUrl) ? proyectoUrl : '',
  );
  const [obraPreseleccionada, setObraPreseleccionada] = useState(() =>
    esUuidProyectoModulo(proyectoUrl),
  );
  const [configNominaId, setConfigNominaId] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(hoyIso);
  const [jornada, setJornada] = useState<'DIURNA' | 'NOCTURNA' | 'MIXTA'>('DIURNA');
  const [horarioDefault, setHorarioDefault] = useState('');
  /** Si la fila del Excel no trae estado civil, se usa este valor (default Soltero). */
  const [estadoCivilDefault, setEstadoCivilDefault] = useState('Soltero');

  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  /** Formulario «Nuevo contrato» */
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [cedula, setCedula] = useState('');
  const [direccion, setDireccion] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [estadoRes, setEstadoRes] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [bonoUsd, setBonoUsd] = useState('0');
  const [guardandoUno, setGuardandoUno] = useState(false);
  const nacionalidadDesdeDoc =
    nacionalidadDesdeCedula(cedula, trabajadorFemeninoDesdeEstadoCivil(estadoCivil)) ??
    (cedula.trim() ? (trabajadorFemeninoDesdeEstadoCivil(estadoCivil) ? 'venezolana' : 'venezolano') : '—');

  const [filas, setFilas] = useState<FilaContratoTrabajoObrero[]>([]);
  const [avisosParse, setAvisosParse] = useState<string[]>([]);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [progreso, setProgreso] = useState({ done: 0, total: 0 });
  const [resultados, setResultados] = useState<ResultadoFila[]>([]);
  const [regenerandoTodos, setRegenerandoTodos] = useState(false);

  const proyectoNombre = useMemo(
    () => proyectos.find((p) => p.id === proyectoId)?.nombre ?? null,
    [proyectos, proyectoId],
  );

  const backHref = proyectoId
    ? `/rrhh/hojas-vida?proyecto_modulo=${encodeURIComponent(proyectoId)}`
    : '/rrhh/hojas-vida';

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

  const cargarContratos = useCallback(async () => {
    if (!proyectoId.trim()) {
      setContratos([]);
      setErrorLista(null);
      return;
    }
    setLoadingLista(true);
    setErrorLista(null);
    try {
      const full = await supabase
        .from('ci_contratos_express')
        .select(
          'id,created_at,obrero_nombre,obrero_cedula,cargo_nombre_snapshot,formalizado_empleado_id,tipo_contrato',
        )
        .eq('proyecto_id', proyectoId.trim())
        .order('created_at', { ascending: false });

      let data = full.data as ContratoRow[] | null;
      let error = full.error;

      if (
        error &&
        /formalizado_empleado_id|cargo_nombre_snapshot|tipo_contrato|42703|column|schema cache/i.test(
          error.message ?? '',
        )
      ) {
        const lite = await supabase
          .from('ci_contratos_express')
          .select('id,created_at,obrero_nombre,obrero_cedula')
          .eq('proyecto_id', proyectoId.trim())
          .order('created_at', { ascending: false });
        data = lite.data as ContratoRow[] | null;
        error = lite.error;
      }

      if (error) {
        setErrorLista(error.message);
        setContratos([]);
      } else {
        setContratos(normalizarListaContratosExpressObrero(data ?? []));
      }
    } catch {
      setErrorLista('No se pudo cargar la lista de contratados.');
      setContratos([]);
    } finally {
      setLoadingLista(false);
    }
  }, [proyectoId, supabase]);

  const regenerarTodosPdf = useCallback(async () => {
    if (!contratos.length || regenerandoTodos) return;
    const okConfirm = window.confirm(
      `¿Regenerar el PDF de ${contratos.length} contrato(s)? Se actualizarán nacionalidad (V/E) y estado civil (Soltero si falta).`,
    );
    if (!okConfirm) return;
    setRegenerandoTodos(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const r of contratos) {
        try {
          const res = await fetch(
            apiUrl(`/api/talento/contratos-express/${encodeURIComponent(r.id)}/regenerar-pdf`),
            { method: 'POST', credentials: 'include' },
          );
          const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
          if (res.ok && j.ok) ok += 1;
          else fail += 1;
        } catch {
          fail += 1;
        }
      }
      if (fail === 0) toast.success(`${ok} PDF regenerado(s)`);
      else toast.message(`Regenerados: ${ok}. Fallidos: ${fail}.`);
    } finally {
      setRegenerandoTodos(false);
    }
  }, [contratos, regenerandoTodos]);

  useEffect(() => {
    void cargarOpciones();
  }, [cargarOpciones]);

  useEffect(() => {
    if (esUuidProyectoModulo(proyectoUrl)) {
      setProyectoId(proyectoUrl);
      setObraPreseleccionada(true);
      guardarProyectoRrhhContexto(proyectoUrl);
      return;
    }
    // Sin ?proyecto=: preseleccionar última obra del contexto, sin bloquear el select.
    const stored = leerProyectoRrhhContexto();
    if (stored) {
      setProyectoId((prev) => prev || stored);
      setObraPreseleccionada(true);
    }
  }, [proyectoUrl]);

  useEffect(() => {
    if (vista === 'lista') void cargarContratos();
  }, [vista, cargarContratos]);

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

  async function generarUno(body: Record<string, unknown>): Promise<{
    ok: boolean;
    id?: string;
    signed_url?: string | null;
    error?: string;
  }> {
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
    if (!res.ok) return { ok: false, error: j.error ?? `Error HTTP ${res.status}` };
    return { ok: true, id: j.id, signed_url: j.signed_url };
  }

  async function guardarNuevoContrato(e: React.FormEvent) {
    e.preventDefault();
    if (!proyectoId.trim()) {
      toast.error('Seleccione la obra / proyecto');
      return;
    }
    if (!configNominaId.trim()) {
      toast.error('Seleccione el cargo (tabulador)');
      return;
    }
    if (!nombres.trim() || !apellidos.trim() || !cedula.trim()) {
      toast.error('Nombres, apellidos y cédula son obligatorios');
      return;
    }
    setGuardandoUno(true);
    try {
      const out = await generarUno({
        proyecto_id: proyectoId.trim(),
        config_nomina_id: configNominaId.trim(),
        obrero_nombres: nombres.trim(),
        obrero_apellidos: apellidos.trim(),
        obrero_cedula: cedula.trim(),
        obrero_direccion: direccion.trim() || null,
        obrero_municipio_residencia: municipio.trim() || null,
        obrero_estado_residencia: estadoRes.trim() || null,
        nacionalidad: null,
        estado_civil: estadoCivil.trim() || 'Soltero',
        fecha_ingreso: fechaIngreso,
        jornada_trabajo: jornada,
        horario_semanal_texto: horarioDefault.trim() || null,
        bono_manual_usd: Number.parseFloat(bonoUsd.replace(',', '.')) || 0,
      });
      if (!out.ok) {
        toast.error(out.error ?? 'No se pudo generar');
        return;
      }
      toast.success('Contrato de trabajo generado');
      setNombres('');
      setApellidos('');
      setCedula('');
      setDireccion('');
      setMunicipio('');
      setEstadoRes('');
      setEstadoCivil('');
      setBonoUsd('0');
      setVista('lista');
      void cargarContratos();
      if (out.signed_url) window.open(out.signed_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error de red');
    } finally {
      setGuardandoUno(false);
    }
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
      if (parsed.filas.length === 0) toast.error('No se extrajeron filas del archivo');
      else toast.success(`${parsed.filas.length} fila(s) leídas de «${file.name}»`);
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
      toast.error('Seleccione la obra / proyecto para la contratación masiva.');
      return;
    }
    // Cargo por defecto opcional si cada fila trae «Cargo» de la tabla de nómina.
    if (!configNominaId.trim() && !filas.some((f) => f.errores.length === 0 && f.cargo)) {
      toast.error('Seleccione un cargo por defecto o incluya la columna Cargo en el Excel');
      return;
    }
    if (filas.length === 0) {
      toast.error('Cargue la plantilla Excel/CSV con los obreros');
      return;
    }

    const pendientes = filas.filter((f) => f.errores.length === 0);
    if (pendientes.length === 0) {
      toast.error('Ninguna fila válida para generar');
      return;
    }

    const sinEstadoCivil = pendientes.filter((f) => !(f.estadoCivil ?? '').trim()).length;
    if (sinEstadoCivil > 0) {
      toast.message(
        `${sinEstadoCivil} fila(s) sin estado civil: se usará «${estadoCivilDefault.trim() || 'Soltero'}».`,
      );
    }

    setGenerando(true);
    setProgreso({ done: 0, total: pendientes.length });
    setResultados(
      filas.map((f) => ({
        filaExcel: f.filaExcel,
        cedula: f.cedula,
        nombre: nombreFila(f),
        status: f.errores.length ? 'omitida' : 'pendiente',
        error: f.errores.length ? f.errores.join('; ') : undefined,
      })),
    );

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
        const cargoTxt = (f.cargo ?? '').trim();
        setResultados((prev) =>
          prev.map((r) =>
            r.filaExcel === f.filaExcel
              ? {
                  ...r,
                  status: 'error',
                  error: !proy
                    ? 'Sin proyecto'
                    : cargoTxt
                      ? `Cargo «${cargoTxt}» no está en el tabulador; elija un cargo por defecto o corrija el Excel`
                      : 'Sin cargo/tabulador (columna cargo o selección por defecto)',
                }
              : r,
          ),
        );
        continue;
      }

      try {
        const out = await generarUno({
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
          nacionalidad: null,
          estado_civil: (f.estadoCivil ?? '').trim() || estadoCivilDefault.trim() || 'Soltero',
          objeto_contrato: f.objetoContrato,
          obrero_municipio_residencia: f.municipio,
          obrero_estado_residencia: f.estadoResidencia,
        });
        done += 1;
        setProgreso({ done, total: pendientes.length });
        if (!out.ok) {
          fail += 1;
          setResultados((prev) =>
            prev.map((r) =>
              r.filaExcel === f.filaExcel
                ? { ...r, status: 'error', error: out.error ?? 'Error' }
                : r,
            ),
          );
        } else {
          ok += 1;
          setResultados((prev) =>
            prev.map((r) =>
              r.filaExcel === f.filaExcel
                ? { ...r, status: 'ok', id: out.id, signedUrl: out.signed_url ?? null }
                : r,
            ),
          );
        }
      } catch (err) {
        fail += 1;
        done += 1;
        setProgreso({ done, total: pendientes.length });
        setResultados((prev) =>
          prev.map((r) =>
            r.filaExcel === f.filaExcel
              ? {
                  ...r,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Error de red',
                }
              : r,
          ),
        );
      }
    }

    setGenerando(false);
    if (fail === 0) toast.success(`${ok} contrato(s) generados`);
    else toast.message(`Serie terminada: ${ok} ok, ${fail} con error`);
    void cargarContratos();
  }

  const validas = filas.filter((f) => f.errores.length === 0).length;
  const invalidas = filas.length - validas;

  function onCambiarObra(id: string) {
    setProyectoId(id);
    setObraPreseleccionada(false);
    if (esUuidProyectoModulo(id)) guardarProyectoRrhhContexto(id);
  }

  function DefaultsObraCargo({
    required = true,
    omitObra = false,
  }: {
    required?: boolean;
    /** En masiva la obra ya se pregunta arriba. */
    omitObra?: boolean;
  }) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {omitObra ? null : (
          <div className="block space-y-1.5 sm:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Obra / proyecto {required ? '*' : ''}
            </span>
            <select
              className={inputClass}
              value={proyectoId}
              onChange={(e) => onCambiarObra(e.target.value)}
              disabled={loadingOpts}
            >
              <option value="">Seleccione…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {obraPreseleccionada && proyectoId ? (
              <p className="text-[10px] text-amber-200/70">
                Preseleccionada desde RRHH — cámbiala si la obra es otra (p. ej. Asfaltado).
              </p>
            ) : null}
          </div>
        )}
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Cargo (tabulador) {required ? '*' : ''}
          </span>
          <select
            className={inputClass}
            value={configNominaId}
            onChange={(e) => setConfigNominaId(e.target.value)}
            disabled={loadingOpts}
          >
            <option value="">Seleccione… (o columna Cargo del Excel)</option>
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
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Jornada</span>
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
        <label className="block space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Estado civil (por defecto)
          </span>
          <input
            className={inputClass}
            value={estadoCivilDefault}
            onChange={(e) => setEstadoCivilDefault(e.target.value)}
            placeholder="Soltero"
            list="ci-estado-civil-opts"
          />
          <datalist id="ci-estado-civil-opts">
            <option value="Soltero" />
            <option value="Soltera" />
            <option value="Casado" />
            <option value="Casada" />
            <option value="Unión libre" />
            <option value="Divorciado" />
            <option value="Divorciada" />
            <option value="Viudo" />
            <option value="Viuda" />
          </datalist>
          <p className="text-[10px] text-zinc-500">
            Si el Excel no trae estado civil, se usa este valor. Nacionalidad: ciudadano → venezolano; ciudadana →
            venezolana (V/E según cédula).
          </p>
        </label>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white px-4 py-6 pb-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href={backHref}
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
            {proyectoNombre
              ? `Contratados de «${proyectoNombre}». Nuevo contrato individual o contratación masiva con Excel.`
              : 'Seleccione la obra para ver contratados, crear uno nuevo o cargar una plantilla Excel.'}
          </p>
        </header>

        {/* Acciones principales */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setVista('lista')}
            className={`inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
              vista === 'lista'
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-50'
                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            Ya contratados
          </button>
          <button
            type="button"
            onClick={() => setVista('nuevo')}
            className={`inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
              vista === 'nuevo'
                ? 'border-sky-400/60 bg-sky-500/20 text-sky-50'
                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            Nuevo contrato
          </button>
          <button
            type="button"
            onClick={() => setVista('masiva')}
            className={`inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
              vista === 'masiva'
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-50'
                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
            Contratación masiva
          </button>
        </div>

        {/* LISTA */}
        {vista === 'lista' ? (
          <section className="space-y-4 rounded-2xl border border-amber-500/25 bg-amber-950/15 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Ya contratados</h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Contratos de trabajo de esta obra (PDF generado).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {contratos.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void regenerarTodosPdf()}
                    disabled={regenerandoTodos || loadingLista || !proyectoId}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
                    title="Regenerar todos los PDF con nacionalidad V/E y estado civil actualizado"
                  >
                    {regenerandoTodos ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Regenerar PDFs
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void cargarContratos()}
                  disabled={loadingLista || !proyectoId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingLista ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>
            </div>

            <div className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Obra / proyecto *
              </span>
              <select
                className={inputClass}
                value={proyectoId}
                onChange={(e) => onCambiarObra(e.target.value)}
                disabled={loadingOpts}
              >
                <option value="">Seleccione…</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {obraPreseleccionada && proyectoId ? (
                <p className="text-[10px] text-amber-200/70">
                  Preseleccionada desde RRHH — puedes cambiarla.
                </p>
              ) : null}
            </div>

            {!proyectoId ? (
              <p className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
                Elija la obra para ver los contratados.
              </p>
            ) : loadingLista ? (
              <p className="py-8 text-center text-sm text-zinc-500">Cargando…</p>
            ) : errorLista ? (
              <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {errorLista}
              </p>
            ) : contratos.length === 0 ? (
              <p className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
                Aún no hay contratos en esta obra. Use <strong className="text-zinc-300">Nuevo contrato</strong> o{' '}
                <strong className="text-zinc-300">Contratación masiva</strong>.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-black/25">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-amber-500/25 text-[10px] font-bold uppercase tracking-wide text-amber-200/90">
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Obrero</th>
                      <th className="px-4 py-3">Cédula</th>
                      <th className="px-4 py-3">Cargo</th>
                      <th className="px-4 py-3 text-center">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratos.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 text-zinc-500">
                          {new Date(r.created_at).toLocaleDateString('es-VE')}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-zinc-100">{r.obrero_nombre}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">
                          {r.obrero_cedula}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400">
                          {r.cargo_nombre_snapshot ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <AccionesContratoPdfFila
                            empleadoRowId={`ci-express-${r.id}`}
                            nombreObrero={r.obrero_nombre}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-white/10 px-3 py-2 text-[11px] text-zinc-500">
                  {contratos.length} contratado{contratos.length === 1 ? '' : 's'}. Icono PDF → Regenerar
                  PDF (uno) o use «Regenerar PDFs» arriba (todos).
                </p>
              </div>
            )}
          </section>
        ) : null}

        {/* NUEVO */}
        {vista === 'nuevo' ? (
          <section className="space-y-4 rounded-2xl border border-sky-500/25 bg-sky-950/15 p-5">
            <h2 className="text-sm font-bold text-white">Nuevo contrato</h2>
            <form onSubmit={(e) => void guardarNuevoContrato(e)} className="space-y-4">
              <DefaultsObraCargo />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Nombres *
                  </span>
                  <input className={inputClass} value={nombres} onChange={(e) => setNombres(e.target.value)} required />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Apellidos *
                  </span>
                  <input
                    className={inputClass}
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Cédula *
                  </span>
                  <input
                    className={inputClass}
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="V-12345678"
                    required
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Bono USD
                  </span>
                  <input
                    className={inputClass}
                    value={bonoUsd}
                    onChange={(e) => setBonoUsd(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Dirección
                  </span>
                  <input
                    className={inputClass}
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Municipio
                  </span>
                  <input
                    className={inputClass}
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Estado
                  </span>
                  <input
                    className={inputClass}
                    value={estadoRes}
                    onChange={(e) => setEstadoRes(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Nacionalidad (según cédula)
                  </span>
                  <input
                    className={`${inputClass} bg-zinc-900/50 text-zinc-300`}
                    value={nacionalidadDesdeDoc}
                    readOnly
                    title="Ciudadano → venezolano; ciudadana → venezolana (V/E según cédula)"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Estado civil
                  </span>
                  <input
                    className={inputClass}
                    value={estadoCivil}
                    onChange={(e) => setEstadoCivil(e.target.value)}
                    placeholder="Soltero"
                    list="ci-estado-civil-opts"
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Horario semanal (opcional)
                  </span>
                  <textarea
                    className={`${inputClass} min-h-[3.5rem] resize-y`}
                    value={horarioDefault}
                    onChange={(e) => setHorarioDefault(e.target.value)}
                    placeholder="Si la obra ya tiene horario, puede dejarlo vacío"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={guardandoUno}
                className="inline-flex w-full min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-black hover:bg-sky-400 disabled:opacity-50"
              >
                {guardandoUno ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Generar contrato
              </button>
            </form>
          </section>
        ) : null}

        {/* MASIVA */}
        {vista === 'masiva' ? (
          <section className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-300" aria-hidden />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Contratación masiva</h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Confirme la obra, descargue la plantilla, complete una fila por obrero y cárguela.
                    Se generan los PDF en serie.
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

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300/90">
                ¿Obra / proyecto?
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Debe estar preseleccionada si entró por proyecto → RRHH → Express. Cámbiela si
                corresponde a otra obra.
              </p>
              <div className="mt-3">
                <select
                  className={inputClass}
                  value={proyectoId}
                  onChange={(e) => onCambiarObra(e.target.value)}
                  disabled={loadingOpts}
                  aria-label="Obra o proyecto"
                >
                  <option value="">Seleccione la obra…</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                {obraPreseleccionada && proyectoId ? (
                  <p className="mt-1.5 text-[10px] text-amber-200/70">
                    Preseleccionada desde RRHH — puedes cambiarla.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
              <p className="font-semibold text-zinc-300">Formato Excel</p>
              <p className="mt-1">
                <span className="text-emerald-300">Columnas:</span> Nombres, Apellidos, Cédula,
                Cargo, Fecha de ingreso, Jornada, Bono, Estado civil.
              </p>
              <p className="mt-1">
                Lugar de trabajo, nombre de obra, fase técnica, punto de encuentro y domicilio procesal
                salen de la <span className="text-zinc-200">obra seleccionada</span> (datos PM). Completa
                estado civil en el Excel (si falta → Soltero). Nacionalidad: ciudadano → venezolano; ciudadana →
                venezolana (V/E según cédula).
              </p>
              <p className="mt-1">
                Si una fila no trae fecha, jornada o bono, se usan los valores por defecto de abajo.
                También se aceptan plantillas antiguas (Nombre Completo / C.I.).
              </p>
            </div>

            <DefaultsObraCargo omitObra />

            <label className="block space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Horario semanal por defecto (opcional)
              </span>
              <textarea
                className={`${inputClass} min-h-[3.5rem] resize-y`}
                value={horarioDefault}
                onChange={(e) => setHorarioDefault(e.target.value)}
              />
            </label>

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
                {archivoNombre ? archivoNombre : 'Cargar plantilla Excel o CSV'}
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
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Nombres</th>
                      <th className="px-3 py-2">Apellidos</th>
                      <th className="px-3 py-2">Cédula</th>
                      <th className="px-3 py-2">Cargo</th>
                      <th className="px-3 py-2">Fecha de ingreso</th>
                      <th className="px-3 py-2">Jornada</th>
                      <th className="px-3 py-2">Bono</th>
                      <th className="px-3 py-2">Estado civil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const partes = partesNombreFila(f);
                      const err = f.errores.length > 0;
                      return (
                        <tr
                          key={f.filaExcel}
                          className={`border-b border-white/5 ${err ? 'bg-red-950/20 text-red-200' : 'text-zinc-300'}`}
                          title={err ? f.errores.join('; ') : undefined}
                        >
                          <td className="px-3 py-2">{partes.nombres}</td>
                          <td className="px-3 py-2">{partes.apellidos}</td>
                          <td className="px-3 py-2 font-mono">{f.cedula || '—'}</td>
                          <td className="px-3 py-2 text-zinc-400">{f.cargo ?? '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {fechaFilaMostrada(f, fechaIngreso)}
                          </td>
                          <td className="px-3 py-2">{(f.jornada || jornada).trim() || '—'}</td>
                          <td className="px-3 py-2">{Number.isFinite(f.bonoUsd) ? f.bonoUsd : '—'}</td>
                          <td className="px-3 py-2">
                            {(f.estadoCivil ?? '').trim() || (
                              <span className="text-zinc-500 italic">
                                {estadoCivilDefault.trim() || 'Soltero'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="border-t border-white/10 px-3 py-2 text-[11px] text-zinc-500">
                  {validas} válida(s)
                  {invalidas > 0 ? ` · ${invalidas} con error (se omiten; pase el cursor para ver el detalle)` : null}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void generarEnSerie()}
              disabled={generando || filas.length === 0 || !proyectoId}
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

            {resultados.length > 0 ? (
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
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
