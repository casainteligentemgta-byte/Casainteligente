'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProjectAsset } from '@/lib/supabase/project-media';

import ResumenObrerosProyectoModulo from '@/components/proyectos/ResumenObrerosProyectoModulo';
import ModalNuevaVacante from './components/ModalNuevaVacante';
import GenerarContratoDelegadoModal from '@/components/proyectos/GenerarContratoDelegadoModal';
import ProyectoAdLogisticaBanner from '@/components/proyectos/ProyectoAdLogisticaBanner';
import { useContratoAdProyecto } from '@/hooks/useContratoAdProyecto';
import DashboardUtilidadReal from '@/components/finanzas/DashboardUtilidadReal';
import CuadroNominaContratados from '@/components/nomina/CuadroNominaContratados';
import ImportarPresupuestoLulo from '@/components/proyectos/ImportarPresupuestoLulo';
import ControlPlanosObra from '@/components/proyectos/ControlPlanosObra';
import MetronPlanosClient from '@/components/metron/MetronPlanosClient';
import SeccionTituloHover from '@/components/proyectos/SeccionTituloHover';
import HorarioObraEditor from '@/components/proyectos/HorarioObraEditor';
import { hrefRrhhHub } from '@/lib/rrhh/hrefSolicitudPersonal';
import { hrefCcoProyecto } from '@/lib/contabilidad/cco/hrefCcoProyecto';
import { guardarProyectoRrhhContexto } from '@/lib/rrhh/proyectoRrhhContexto';
import { evaluarChecklistObraContratoPm } from '@/lib/talento/datosObraContratoPm';
import dynamic from 'next/dynamic';

const ProjectLocationPicker = dynamic(
  () => import('@/components/proyectos/ProjectLocationPicker'),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
    ),
  },
);

const LOAD_TIMEOUT_MS = 45_000;

/** Mismo hub RRHH que el icono del menú inferior, con la obra preseleccionada. */
function RrhhHubLink({ proyectoModuloId }: { proyectoModuloId: string }) {
  return (
    <Link
      href={hrefRrhhHub({ proyectoModuloId })}
      className="rounded-xl border border-fuchsia-500/45 bg-fuchsia-950/50 px-3 py-2 text-xs font-bold text-fuchsia-100 shadow-sm hover:bg-fuchsia-900/60"
      title="Abrir RRHH (mismo módulo del menú inferior)"
    >
      RRHH
    </Link>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Tiempo de espera (${Math.round(ms / 1000)} s). Revisa conexion y Supabase.`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

type Proyecto = {
  id: string;
  nombre: string;
  estado: string;
  ubicacion_texto: string;
  lat: number | null;
  lng: number | null;
  monto_aproximado: number;
  moneda: string;
  observaciones: string | null;
  entidad_id?: string | null;
  /** Horario por defecto en contratos PDF si el contrato no trae texto propio. */
  horario_semanal_obra_default?: string | null;
  /** Parada del transporte gratuito (cláusula SEXTA del contrato laboral). */
  punto_encuentro_transporte_contrato?: string | null;
  /** Fase técnica / objeto de obra determinada (cláusula PRIMERA). PM una vez por obra. */
  fase_tecnica_contrato?: string | null;
  updated_at?: string;
};

type EntidadOpt = {
  id: string;
  nombre: string;
  rif: string | null;
  direccion_fiscal?: string | null;
  rep_legal_nombre?: string | null;
  rep_legal_cedula?: string | null;
  rep_legal_cargo?: string | null;
  registro_mercantil?: unknown;
};

type Archivo = {
  id: string;
  tipo: string;
  titulo: string | null;
  public_url: string | null;
  created_at: string;
};

type Visita = {
  id: string;
  tecnico_nombre: string;
  fecha_hora_visita: string;
  informe_breve: string;
  foto_antes_public_url: string | null;
};

const ESTADOS_PROYECTO = [
  'nuevo',
  'levantamiento',
  'presupuestado',
  'ejecucion',
  'entregado',
  'cerrado',
  'cancelado',
] as const;

export default function ProyectoModuloDetalleClient({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoEdicion = searchParams.get('editar') === '1';
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);

  const [savingArchivo, setSavingArchivo] = useState(false);
  const [savingVisita, setSavingVisita] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editVisitaId, setEditVisitaId] = useState<string | null>(null);
  const [editArchivoId, setEditArchivoId] = useState<string | null>(null);

  const [arTipo, setArTipo] = useState('foto_proyecto');
  const [arTitulo, setArTitulo] = useState('');
  const [arFile, setArFile] = useState<File | null>(null);

  const [vTecnico, setVTecnico] = useState('');
  const [vFechaHora, setVFechaHora] = useState(() => new Date().toISOString().slice(0, 16));
  const [vInforme, setVInforme] = useState('');
  const [vFotoAntes, setVFotoAntes] = useState<File | null>(null);

  const [evTecnico, setEvTecnico] = useState('');
  const [evFechaHora, setEvFechaHora] = useState('');
  const [evInforme, setEvInforme] = useState('');

  const [eaTitulo, setEaTitulo] = useState('');
  const [eaTipo, setEaTipo] = useState('foto_proyecto');
  const [vacanteModalOpen, setVacanteModalOpen] = useState(false);
  const [contratoAdModalOpen, setContratoAdModalOpen] = useState(false);
  const {
    autorizado: logisticaAutorizada,
    loading: cargandoContratoAd,
    contrato: contratoAd,
    refrescar: refrescarContratoAd,
  } = useContratoAdProyecto(id);
  const [rrhhVacantesTick, setRrhhVacantesTick] = useState(0);
  const [borrandoProyecto, setBorrandoProyecto] = useState(false);
  const rrhhPanelRef = useRef<HTMLDivElement>(null);

  /** RRHH/talento/solicitados → hub unificado; finanzas → CCO de esta obra. */
  useEffect(() => {
    guardarProyectoRrhhContexto(id);
    const t = searchParams.get('tab');
    if (t === 'solicitados' || t === 'rrhh' || t === 'talento') {
      router.replace(hrefRrhhHub({ proyectoModuloId: id }));
      return;
    }
    if (t === 'finanzas') {
      router.replace(hrefCcoProyecto(id));
      return;
    }
  }, [searchParams, id, router]);

  const [peNombre, setPeNombre] = useState('');
  const [peEstado, setPeEstado] = useState('');
  const [peUbicacion, setPeUbicacion] = useState('');
  const [peMonto, setPeMonto] = useState('');
  const [peMoneda, setPeMoneda] = useState('USD');
  const [peObs, setPeObs] = useState('');
  const [peLat, setPeLat] = useState('');
  const [peLng, setPeLng] = useState('');
  const [peEntidadId, setPeEntidadId] = useState('');
  const [peHorarioSemanalObra, setPeHorarioSemanalObra] = useState('');
  const [pePuntoEncTransporteContrato, setPePuntoEncTransporteContrato] = useState('');
  const [peFaseTecnicaContrato, setPeFaseTecnicaContrato] = useState('');
  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [savingProyecto, setSavingProyecto] = useState(false);
  const [proyectoSaveError, setProyectoSaveError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('ci_entidades')
        .select('id,nombre,rif,direccion_fiscal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo,registro_mercantil')
        .order('nombre');
      setEntidades((data ?? []) as EntidadOpt[]);
    })();
  }, [supabase]);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setError('Identificador de proyecto no valido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, a, v] = await withTimeout(
        Promise.all([
          supabase.from('ci_proyectos').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('ci_proyecto_archivos')
            .select('id,tipo,titulo,public_url,created_at')
            .eq('proyecto_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('ci_proyecto_visitas')
            .select('id,tecnico_nombre,fecha_hora_visita,informe_breve,foto_antes_public_url')
            .eq('proyecto_id', id)
            .order('fecha_hora_visita', { ascending: false }),
        ]),
        LOAD_TIMEOUT_MS,
      );
      if (p.error || !p.data) {
        setProyecto(null);
        setArchivos([]);
        setVisitas([]);
        setError(p.error?.message ?? 'Proyecto no encontrado.');
        return;
      }
      setProyecto(p.data as Proyecto);
      setArchivos((a.data ?? []) as Archivo[]);
      setVisitas((v.data ?? []) as Visita[]);
      if (a.error?.message) setError((prev) => prev ?? a.error.message);
      if (v.error?.message) setError((prev) => prev ?? v.error.message);
    } catch (err) {
      setProyecto(null);
      setArchivos([]);
      setVisitas([]);
      setError(err instanceof Error ? err.message : 'Error cargando el proyecto.');
    } finally {
      setLoading(false);
    }
  }, [supabase, id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Identificador de proyecto no valido en la URL.');
      return;
    }
    void load();
  }, [load, id]);

  async function addArchivo(e: React.FormEvent) {
    e.preventDefault();
    if (!arFile) return;
    setSavingArchivo(true);
    const up = await uploadProjectAsset(supabase, arFile, {
      proyectoId: id,
      category: arTipo === 'plano' ? 'plano' : 'proyecto',
      folderHint: arTipo,
    });
    if (up.error || !up.publicUrl) {
      setSavingArchivo(false);
      setError(up.error ?? 'No se pudo subir archivo.');
      return;
    }
    const { error: insErr } = await supabase.from('ci_proyecto_archivos').insert({
      proyecto_id: id,
      tipo: arTipo,
      titulo: arTitulo.trim() || arFile.name,
      storage_bucket: up.bucket,
      storage_path: up.path,
      public_url: up.publicUrl,
      mime_type: arFile.type || null,
    });
    setSavingArchivo(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setArTitulo('');
    setArFile(null);
    void load();
  }

  async function addVisita(e: React.FormEvent) {
    e.preventDefault();
    if (!vTecnico.trim() || !vFechaHora || !vInforme.trim()) return;
    setSavingVisita(true);

    let fotoBucket: string | null = null;
    let fotoPath: string | null = null;
    let fotoUrl: string | null = null;
    if (vFotoAntes) {
      const up = await uploadProjectAsset(supabase, vFotoAntes, {
        proyectoId: id,
        category: 'visita',
        folderHint: 'foto-antes',
      });
      if (up.error) {
        setSavingVisita(false);
        setError(up.error);
        return;
      }
      fotoBucket = up.bucket;
      fotoPath = up.path;
      fotoUrl = up.publicUrl;
    }

    const { error: insErr } = await supabase.from('ci_proyecto_visitas').insert({
      proyecto_id: id,
      tecnico_nombre: vTecnico.trim(),
      fecha_hora_visita: new Date(vFechaHora).toISOString(),
      informe_breve: vInforme.trim(),
      foto_antes_storage_bucket: fotoBucket,
      foto_antes_storage_path: fotoPath,
      foto_antes_public_url: fotoUrl,
    });
    setSavingVisita(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setVTecnico('');
    setVInforme('');
    setVFotoAntes(null);
    setVFechaHora(new Date().toISOString().slice(0, 16));
    void load();
  }

  async function deleteById(table: string, rowId: string) {
    setBusyId(rowId);
    const { error: delErr } = await supabase.from(table).delete().eq('id', rowId);
    setBusyId(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    void load();
  }

  async function borrarProyectoActual() {
    if (!proyecto) return;
    const ok = window.confirm(
      `¿Eliminar permanentemente el proyecto «${proyecto.nombre}»?\n\nEsta acción no se puede deshacer. Se eliminan archivos y visitas vinculados.`,
    );
    if (!ok) return;
    setBorrandoProyecto(true);
    setError(null);
    const { error: delErr } = await supabase.from('ci_proyectos').delete().eq('id', id);
    setBorrandoProyecto(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    router.push('/proyectos/modulo');
  }

  useEffect(() => {
    if (!proyecto) return;
    setPeNombre(proyecto.nombre);
    setPeEstado(
      ESTADOS_PROYECTO.includes(proyecto.estado as (typeof ESTADOS_PROYECTO)[number])
        ? proyecto.estado
        : 'nuevo',
    );
    setPeUbicacion(proyecto.ubicacion_texto);
    setPeMonto(
      proyecto.monto_aproximado != null && Number(proyecto.monto_aproximado) > 0
        ? String(proyecto.monto_aproximado)
        : '',
    );
    setPeMoneda(proyecto.moneda || 'USD');
    setPeObs(proyecto.observaciones ?? '');
    setPeLat(proyecto.lat != null ? String(proyecto.lat) : '');
    setPeLng(proyecto.lng != null ? String(proyecto.lng) : '');
    setPeEntidadId(proyecto.entidad_id ? String(proyecto.entidad_id) : '');
    setPeHorarioSemanalObra(proyecto.horario_semanal_obra_default ?? '');
    setPePuntoEncTransporteContrato(proyecto.punto_encuentro_transporte_contrato ?? '');
    setPeFaseTecnicaContrato(proyecto.fase_tecnica_contrato ?? '');
    setProyectoSaveError(null);
  }, [proyecto]);

  async function guardarProyectoBasico(e: React.FormEvent) {
    e.preventDefault();
    if (!proyecto) return;
    const n = peNombre.trim();
    const u = peUbicacion.trim();
    if (!n || !u) {
      setProyectoSaveError('Nombre y ubicación son obligatorios.');
      return;
    }
    if (!peEntidadId.trim()) {
      setProyectoSaveError('Selecciona el patrono / empresa ejecutora.');
      return;
    }
    const montoRaw = String(peMonto).trim().replace(',', '.');
    let m = 0;
    if (montoRaw !== '') {
      m = Number(montoRaw);
      if (!Number.isFinite(m) || m < 0) {
        setProyectoSaveError('Monto aproximado no válido (usa un número ≥ 0 o déjalo vacío).');
        return;
      }
    }
    let lat: number | null = null;
    let lng: number | null = null;
    if (peLat.trim() !== '') {
      lat = Number(peLat);
      if (Number.isNaN(lat)) {
        setProyectoSaveError('Latitud no válida.');
        return;
      }
    }
    if (peLng.trim() !== '') {
      lng = Number(peLng);
      if (Number.isNaN(lng)) {
        setProyectoSaveError('Longitud no válida.');
        return;
      }
    }
    setSavingProyecto(true);
    setProyectoSaveError(null);
    const payloadCore = {
      nombre: n,
      estado: peEstado,
      ubicacion_texto: u,
      monto_aproximado: m,
      moneda: (peMoneda.trim() || 'USD').slice(0, 8),
      observaciones: peObs.trim() || null,
      lat,
      lng,
      entidad_id: peEntidadId.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const payloadContrato = {
      horario_semanal_obra_default: peHorarioSemanalObra.trim() || null,
      punto_encuentro_transporte_contrato: pePuntoEncTransporteContrato.trim() || null,
      fase_tecnica_contrato: peFaseTecnicaContrato.trim() || null,
    };

    const intentos: Array<{ patch: Record<string, unknown>; aviso: string | null }> = [
      { patch: { ...payloadCore, ...payloadContrato }, aviso: null },
      {
        patch: {
          ...payloadCore,
          horario_semanal_obra_default: payloadContrato.horario_semanal_obra_default,
          punto_encuentro_transporte_contrato:
            payloadContrato.punto_encuentro_transporte_contrato,
        },
        aviso:
          'Guardado parcial: aplica la migración 307/308 (fase técnica) en Supabase SQL Editor.',
      },
      {
        patch: {
          ...payloadCore,
          horario_semanal_obra_default: payloadContrato.horario_semanal_obra_default,
        },
        aviso:
          'Guardado parcial: falta la columna punto_encuentro_transporte_contrato. Ejecute sql_editor_308_… + notify pgrst.',
      },
      {
        patch: payloadCore,
        aviso:
          'Guardado parcial: faltan columnas de contrato en ci_proyectos. Ejecute sql_editor_308_ci_proyectos_punto_encuentro_transporte_ensure.sql en Supabase.',
      },
    ];

    let upErr: { message: string } | null = null;
    let avisoParcial: string | null = null;
    for (const intento of intentos) {
      const res = await supabase.from('ci_proyectos').update(intento.patch).eq('id', id);
      upErr = res.error;
      if (!upErr) {
        avisoParcial = intento.aviso;
        break;
      }
      const msg = upErr.message ?? '';
      const esSchema =
        /schema cache|column|punto_encuentro_transporte_contrato|horario_semanal_obra_default|fase_tecnica_contrato/i.test(
          msg,
        );
      if (!esSchema) break;
    }

    setSavingProyecto(false);
    if (upErr) {
      setProyectoSaveError(
        /punto_encuentro_transporte_contrato|schema cache/i.test(upErr.message)
          ? `${upErr.message} — Ejecute en SQL Editor: supabase/sql_editor_308_ci_proyectos_punto_encuentro_transporte_ensure.sql`
          : upErr.message,
      );
      return;
    }
    if (avisoParcial) {
      setProyectoSaveError(avisoParcial);
      void load();
      return;
    }
    router.replace(`/proyectos/modulo/${id}`);
    void load();
  }

  async function saveVisitaEdit() {
    if (!editVisitaId) return;
    setBusyId(editVisitaId);
    const { error: upErr } = await supabase
      .from('ci_proyecto_visitas')
      .update({
        tecnico_nombre: evTecnico.trim(),
        fecha_hora_visita: new Date(evFechaHora).toISOString(),
        informe_breve: evInforme.trim(),
      })
      .eq('id', editVisitaId);
    setBusyId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setEditVisitaId(null);
    void load();
  }

  async function saveArchivoEdit() {
    if (!editArchivoId) return;
    setBusyId(editArchivoId);
    const { error: upErr } = await supabase
      .from('ci_proyecto_archivos')
      .update({ titulo: eaTitulo.trim() || null, tipo: eaTipo })
      .eq('id', editArchivoId);
    setBusyId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setEditArchivoId(null);
    void load();
  }

  const nombrePatronoVista = useMemo(() => {
    const eid = proyecto?.entidad_id;
    if (!eid) return null;
    const row = entidades.find((en) => en.id === String(eid).trim());
    return row?.nombre?.trim() || null;
  }, [proyecto?.entidad_id, entidades]);

  const checklistContratoPm = useMemo(() => {
    if (!proyecto) return null;
    return evaluarChecklistObraContratoPm({
      ubicacion: proyecto.ubicacion_texto,
      fase_tecnica_contrato: proyecto.fase_tecnica_contrato,
      horario_semanal_obra_default: proyecto.horario_semanal_obra_default,
      punto_encuentro_transporte_contrato: proyecto.punto_encuentro_transporte_contrato,
    });
  }, [proyecto]);

  /** Enlace directo ?tab=rrhh|talento|solicitados|finanzas: vistas compactas / cuadro RRHH / utilidad real. */
  const tabVistaTalento =
    searchParams.get('tab') === 'rrhh' ||
    searchParams.get('tab') === 'talento' ||
    searchParams.get('tab') === 'solicitados' ||
    searchParams.get('tab') === 'finanzas';
  const tabSolicitados = searchParams.get('tab') === 'solicitados';
  /** rrhh/talento/solicitados/finanzas: sin barra superior de acciones (modificar, vacante, enlaces RRHH, etc.). */
  const tabCabeceraMinimaSinAcciones =
    searchParams.get('tab') === 'rrhh' ||
    searchParams.get('tab') === 'talento' ||
    searchParams.get('tab') === 'solicitados' ||
    searchParams.get('tab') === 'finanzas';
  const tabUrl = searchParams.get('tab') ?? '';
  /** Ficha normal del módulo (sin ?tab=): sin vacante, RRHH, reclutamiento, gestión laboral ni «Terminar». */
  const fichaModuloSinPestaña = tabUrl === '';

  const panelRrhhModulo = useMemo(() => {
    if (!proyecto) return null;
    /** `tab=finanzas` o `tab=rrhh`: consolidado de utilidad real (mismo dashboard). */
    if (tabUrl === 'finanzas' || tabUrl === 'rrhh') {
      return (
        <div className="space-y-6">
          <Link
            href={`/proyectos/modulo/${encodeURIComponent(id)}/lulo?tab=presupuesto`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-sky-500/35 bg-gradient-to-r from-sky-950/50 to-zinc-900/80 px-4 py-3 hover:border-sky-400/50 transition-colors"
          >
            <span className="text-sm font-semibold text-sky-100">
              Módulo Lulo · importar MDB, presupuesto y explorar tablas Access
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400/90 shrink-0">
              Abrir Lulo →
            </span>
          </Link>
          <ImportarPresupuestoLulo proyectoId={id} onSuccess={() => void load()} />
          <ControlPlanosObra proyectoId={id} />
          <MetronPlanosClient
            proyectoId={id}
            nombreObra={proyecto.nombre}
            className="mt-4"
          />
          <CuadroNominaContratados proyectoModuloId={id} titulo="Contratados — nómina del proyecto" />
          <DashboardUtilidadReal proyectoId={id} className="" />
        </div>
      );
    }
    if (tabSolicitados) {
      return (
        <div className="space-y-4">
          <ResumenObrerosProyectoModulo
            proyectoModuloId={id}
            listaRefresco={rrhhVacantesTick}
            tabUrl={tabUrl}
            demoListasObrero={searchParams.get('demo_listas') === '1'}
          />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-violet-500/25 bg-violet-950/20 px-4 py-4">
        <p className="text-sm font-semibold text-violet-100">Configuración de equipo recomendada</p>
        <p className="mt-1 text-xs text-violet-100/75">
          La composición ideal de cuadrilla (DISC + fase de obra) está en RRHH.
        </p>
        <Link
          href={`${hrefRrhhHub({ proyectoModuloId: id })}#equipo-recomendado`}
          className="mt-3 inline-flex rounded-xl border border-violet-400/40 bg-violet-600/30 px-3 py-2 text-xs font-bold text-violet-50 hover:bg-violet-600/45"
        >
          Abrir en RRHH →
        </Link>
      </div>
    );
  }, [proyecto, id, rrhhVacantesTick, tabUrl, tabSolicitados]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 pb-28 pt-4">
      <div className="mx-auto max-w-6xl w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/proyectos/modulo" className="text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline">
            ← Proyectos
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {proyecto ? (
              <>
                <button
                  type="button"
                  onClick={() => setContratoAdModalOpen(true)}
                  className="rounded-xl border border-amber-500/40 bg-amber-950/45 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/60"
                  title="Contrato de Administración Delegada"
                >
                  {contratoAd?.estado === 'exitoso' ? 'Contrato AD ✓' : 'Contrato AD'}
                </button>
                {logisticaAutorizada ? (
                  <Link
                    href={`/almacen/procurement?proyectoId=${encodeURIComponent(id)}&fromProject=1&bloquearProyecto=1`}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-950/45 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60"
                  >
                    + Factura (este proyecto)
                  </Link>
                ) : (
                  <span
                    className="cursor-not-allowed rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-500"
                    title="Requiere Contrato AD registrado"
                  >
                    + Factura (bloqueado)
                  </span>
                )}
              </>
            ) : null}
            {modoEdicion && proyecto && !tabCabeceraMinimaSinAcciones && !fichaModuloSinPestaña ? (
              <>
                <button
                  type="button"
                  onClick={() => setVacanteModalOpen(true)}
                  className="rounded-xl border border-[#FF9500]/45 bg-gradient-to-r from-[#FFD60A]/15 to-[#FF9500]/15 px-3 py-2 text-xs font-semibold text-[#FFD60A] hover:from-[#FFD60A]/25 hover:to-[#FF9500]/25"
                >
                  Nueva vacante
                </button>
                <RrhhHubLink proyectoModuloId={id} />
                <Link
                  href="/rrhh/reclutamiento"
                  className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
                >
                  Reclutamiento
                </Link>
                <Link
                  href={`/rrhh/gestion-personal?solo=pendientes&proyecto_modulo=${encodeURIComponent(id)}`}
                  className="rounded-xl border border-violet-500/40 bg-violet-950/40 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-900/55"
                >
                  Gestión laboral
                </Link>
              </>
            ) : null}
            {!tabCabeceraMinimaSinAcciones && !modoEdicion && !fichaModuloSinPestaña ? (
              <>
                <button
                  type="button"
                  onClick={() => setVacanteModalOpen(true)}
                  className="rounded-xl border border-[#FF9500]/45 bg-gradient-to-r from-[#FFD60A]/15 to-[#FF9500]/15 px-3 py-2 text-xs font-semibold text-[#FFD60A] hover:from-[#FFD60A]/25 hover:to-[#FF9500]/25"
                >
                  Nueva vacante
                </button>
                <RrhhHubLink proyectoModuloId={id} />
                <Link
                  href="/rrhh/reclutamiento"
                  className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
                >
                  Reclutamiento
                </Link>
                <Link
                  href={`/rrhh/gestion-personal?solo=pendientes&proyecto_modulo=${encodeURIComponent(id)}`}
                  className="rounded-xl border border-violet-500/40 bg-violet-950/40 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-900/55"
                >
                  Gestión laboral
                </Link>
              </>
            ) : null}
          </div>
        </div>
        {proyecto && tabVistaTalento && !modoEdicion && tabUrl !== 'solicitados' && tabUrl !== 'rrhh' && tabUrl !== 'finanzas' ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
            <RrhhHubLink proyectoModuloId={id} />
            <Link
              href={`/proyectos/modulo/${id}`}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
            >
              Volver a la ficha del proyecto
            </Link>
          </div>
        ) : null}
        {proyecto && !cargandoContratoAd && !logisticaAutorizada ? (
          <ProyectoAdLogisticaBanner
            proyectoId={id}
            autorizado={logisticaAutorizada}
            onAbrirContratoAd={() => setContratoAdModalOpen(true)}
            className="mt-4"
          />
        ) : null}
        {loading ? <p className="mt-6 text-sm text-zinc-500">Cargando...</p> : null}
        {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}
        {!loading && !proyecto && !error ? (
          <p className="mt-6 text-sm text-zinc-400">No se obtuvo el proyecto. Revisa la URL o vuelve al listado.</p>
        ) : null}

        {proyecto ? (
          <>
            {modoEdicion ? (
              <form
                onSubmit={(e) => void guardarProyectoBasico(e)}
                className="mt-4 space-y-4 rounded-2xl border border-sky-500/35 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h1 className="text-xl font-bold text-sky-100">Modificar proyecto</h1>
                  <Link
                    href={`/proyectos/modulo/${id}`}
                    className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                  >
                    Cancelar
                  </Link>
                </div>
                {proyectoSaveError ? <p className="text-sm text-red-400">{proyectoSaveError}</p> : null}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Nombre *</label>
                  <input
                    required
                    value={peNombre}
                    onChange={(e) => setPeNombre(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Patrono / empresa ejecutora *
                  </label>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    <Link href="/configuracion/entidades" className="font-semibold text-sky-400 underline hover:text-sky-300">
                      Gestionar entidades
                    </Link>
                  </p>
                  <select
                    required
                    value={peEntidadId}
                    onChange={(e) => setPeEntidadId(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/40"
                  >
                    <option value="">— Selecciona patrono —</option>
                    {entidades.map((en) => (
                      <option key={en.id} value={en.id} className="bg-zinc-900">
                        {en.nombre}
                        {en.rif ? ` · ${en.rif}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Ubicación (texto) *
                  </label>
                  <input
                    required
                    value={peUbicacion}
                    onChange={(e) => setPeUbicacion(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/40"
                  />
                </div>

                <div className="rounded-2xl border border-sky-500/25 bg-sky-950/20 p-4 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300/90">
                      Datos de obra para contrato (PM · una vez)
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                      Completa estos campos al abrir la obra. RRHH los reutiliza al generar cada contrato; no hace falta
                      pedirlos por obrero.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      Fase técnica (cláusula PRIMERA)
                    </label>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      Objeto de la obra determinada. Ej.: estructura y fundaciones; acabados; instalaciones eléctricas.
                    </p>
                    <textarea
                      value={peFaseTecnicaContrato}
                      onChange={(e) => setPeFaseTecnicaContrato(e.target.value)}
                      rows={2}
                      placeholder="Ej.: ejecución de estructura y fundaciones de la obra"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      Horario semanal en obra (contratos laborales)
                    </label>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      Se usa en el PDF si el contrato del obrero no define otro horario. Elige días y hora de inicio y
                      culminación por franja; puedes añadir otra (p. ej. viernes corto).
                    </p>
                    <div className="mt-2">
                      <HorarioObraEditor
                        key={`${id}:${proyecto.updated_at ?? ''}`}
                        value={peHorarioSemanalObra}
                        onChange={setPeHorarioSemanalObra}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      Parada del transporte (contrato laboral)
                    </label>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      Texto tras «desde el punto de encuentro» hasta el sitio de la obra. Ej.:{' '}
                      <span className="text-zinc-400">en el sector Jorge Coll (Municipio Maneiro)</span>.
                    </p>
                    <textarea
                      value={pePuntoEncTransporteContrato}
                      onChange={(e) => setPePuntoEncTransporteContrato(e.target.value)}
                      rows={2}
                      placeholder="en el sector Jorge Coll (Municipio Maneiro)"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Estado</label>
                    <select
                      value={peEstado}
                      onChange={(e) => setPeEstado(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/40"
                    >
                      {ESTADOS_PROYECTO.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Moneda</label>
                    <input
                      value={peMoneda}
                      onChange={(e) => setPeMoneda(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Monto aproximado (USD)
                  </label>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Puedes dejarlo vacío y completarlo cuando tengas el monto.
                  </p>
                  <input
                    value={peMonto}
                    onChange={(e) => setPeMonto(e.target.value)}
                    placeholder="Opcional"
                    inputMode="decimal"
                    className="mt-1 w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Latitud</label>
                    <input
                      value={peLat}
                      onChange={(e) => setPeLat(e.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      Longitud
                    </label>
                    <input
                      value={peLng}
                      onChange={(e) => setPeLng(e.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Mapa / pegar ubicación
                  </p>
                  <ProjectLocationPicker
                    lat={peLat.trim() ? Number(peLat) : null}
                    lng={peLng.trim() ? Number(peLng) : null}
                    onChange={(v) => {
                      setPeLat(String(v.lat));
                      setPeLng(String(v.lng));
                      if (v.label && !peUbicacion.trim()) setPeUbicacion(v.label);
                    }}
                    onLabelFromShare={(label) => {
                      if (!peUbicacion.trim()) setPeUbicacion(label);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Observaciones
                  </label>
                  <textarea
                    value={peObs}
                    onChange={(e) => setPeObs(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingProyecto}
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {savingProyecto ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </form>
            ) : null}
            {modoEdicion && panelRrhhModulo ? (
              <div ref={rrhhPanelRef} className="mt-6 scroll-mt-24 space-y-4">
                {panelRrhhModulo}
              </div>
            ) : null}
            {!modoEdicion && !tabVistaTalento ? (
              <>
                <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-2xl font-bold text-white">{proyecto.nombre}</h1>
                      <p className="mt-1 text-sm text-zinc-400">{proyecto.ubicacion_texto}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Patrono:{' '}
                        <span className="font-semibold text-zinc-200">
                          {nombrePatronoVista ?? 'Sin asignar — Modificar proyecto'}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        GPS: {proyecto.lat ?? '—'}, {proyecto.lng ?? '—'} · Estado: {proyecto.estado}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void borrarProyectoActual()}
                      disabled={borrandoProyecto}
                      className="shrink-0 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {borrandoProyecto ? 'Borrando…' : 'Borrar proyecto'}
                    </button>
                  </div>
                </div>
                {checklistContratoPm ? (
                  <div
                    className={`mt-4 rounded-2xl border p-4 ${
                      checklistContratoPm.listos
                        ? 'border-emerald-500/30 bg-emerald-950/20'
                        : 'border-amber-500/30 bg-amber-950/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p
                          className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                            checklistContratoPm.listos ? 'text-emerald-300/90' : 'text-amber-300/90'
                          }`}
                        >
                          Contrato laboral · datos PM
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {checklistContratoPm.listos
                            ? 'Listos: RRHH puede generar contratos sin pedirte más datos de obra.'
                            : `Faltan ${checklistContratoPm.faltantes.length} dato(s) de obra. Completa una sola vez en Modificar proyecto.`}
                        </p>
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {checklistContratoPm.campos.map((c) => (
                            <li key={c.id} className="text-[11px] text-zinc-300">
                              <span className={c.completo ? 'text-emerald-400' : 'text-amber-400'}>
                                {c.completo ? '✓' : '○'}
                              </span>{' '}
                              {c.etiqueta}
                              {!c.completo ? null : c.valor ? (
                                <span className="block truncate pl-4 text-zinc-500" title={c.valor}>
                                  {c.valor}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {!checklistContratoPm.listos ? (
                        <Link
                          href={`/proyectos/modulo/${id}?editar=1`}
                          className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/25"
                        >
                          Completar datos PM
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap items-start gap-4">
                  <ImportarPresupuestoLulo proyectoId={id} />
                  <Link
                    href={`/proyectos/modulo/${id}/control-obra/equipo`}
                    className="rounded-xl border border-indigo-500/40 bg-indigo-950/35 px-4 py-3 text-xs font-semibold text-indigo-100 hover:bg-indigo-900/45"
                  >
                    Equipo →
                  </Link>
                  <Link
                    href={hrefCcoProyecto(id)}
                    className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/40"
                    title="Control Contable de Obra (CCO)"
                  >
                    Finanzas · CCO de esta obra →
                  </Link>
                </div>
              </>
            ) : null}

            <div className={`space-y-4 ${tabVistaTalento && !modoEdicion ? 'mt-2' : 'mt-4'}`}>
              {modoEdicion || !tabVistaTalento ? (
              <>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <ControlPlanosObra proyectoId={id} className="mb-2" />
              </div>
              <MetronPlanosClient
                proyectoId={id}
                nombreObra={proyecto?.nombre}
                className="mb-6 lg:col-span-2"
              />

              <SeccionTituloHover
                className="border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl lg:col-span-2"
                titulo="Fotos de obra"
                hint="Pasa el cursor sobre el título para subir foto o archivo"
                descripcion="Fotos y documentos de campo. Los planos técnicos van en Planos y especificaciones."
                panelOculto={
                  <form onSubmit={(e) => void addArchivo(e)} className="grid gap-2">
                    <select
                      value={arTipo}
                      onChange={(e) => setArTipo(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
                    >
                      <option value="foto_proyecto">Foto de proyecto</option>
                      <option value="documento">Documento</option>
                      <option value="otro">Otro</option>
                    </select>
                    <input
                      value={arTitulo}
                      onChange={(e) => setArTitulo(e.target.value)}
                      placeholder="Titulo"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none"
                    />
                    <input
                      type="file"
                      onChange={(e) => setArFile(e.target.files?.[0] ?? null)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white"
                    />
                    <button disabled={savingArchivo || !arFile} className="w-fit rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {savingArchivo ? 'Subiendo...' : 'Subir archivo'}
                    </button>
                  </form>
                }
              >
                <ul className="mt-4 space-y-2 text-sm">
                  {archivos.map((a) => (
                    <li key={a.id} className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
                      {editArchivoId === a.id ? (
                        <div className="space-y-2">
                          <select
                            value={eaTipo}
                            onChange={(x) => setEaTipo(x.target.value)}
                            style={{ colorScheme: 'dark' }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                          >
                            <option value="foto_proyecto">foto_proyecto</option>
                            <option value="documento">documento</option>
                            <option value="otro">otro</option>
                          </select>
                          <input
                            value={eaTitulo}
                            onChange={(x) => setEaTitulo(x.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => void saveArchivoEdit()} className="rounded-lg bg-[#007AFF] px-2 py-1 text-xs font-semibold text-white hover:bg-[#0062CC]">Guardar</button>
                            <button onClick={() => setEditArchivoId(null)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="font-semibold text-white">{a.tipo}</span> · {a.titulo ?? 'Sin titulo'}{' '}
                            {a.public_url ? (
                              <a className="ml-2 text-sky-400 underline hover:text-sky-300" href={a.public_url} target="_blank" rel="noreferrer">
                                abrir
                              </a>
                            ) : null}
                          </span>
                          <span className="flex gap-1">
                            <button onClick={() => { setEditArchivoId(a.id); setEaTitulo(a.titulo ?? ''); setEaTipo(a.tipo); }} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10">Editar</button>
                            <button onClick={() => void deleteById('ci_proyecto_archivos', a.id)} disabled={busyId === a.id} className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">{busyId === a.id ? '...' : 'Borrar'}</button>
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </SeccionTituloHover>
            </div>

            <SeccionTituloHover
              className="mt-6 border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl"
              titulo="Historial de visitas técnicas"
              tituloClassName="text-emerald-400/90"
              hint="Pasa el cursor sobre el título para registrar una inspección"
              descripcion="Visitas técnicas con informe y foto previa a la inspección."
              panelOculto={
                <form onSubmit={(e) => void addVisita(e)} className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={vTecnico}
                      onChange={(e) => setVTecnico(e.target.value)}
                      placeholder="Tecnico *"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={vFechaHora}
                      onChange={(e) => setVFechaHora(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                    />
                  </div>
                  <textarea
                    value={vInforme}
                    onChange={(e) => setVInforme(e.target.value)}
                    rows={3}
                    placeholder="Informe breve de inspeccion *"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none"
                  />
                  <div>
                    <label className="text-xs font-semibold uppercase text-zinc-500">Foto antes de inspeccionar</label>
                    <input
                      type="file"
                      onChange={(e) => setVFotoAntes(e.target.files?.[0] ?? null)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white"
                    />
                  </div>
                  <button disabled={savingVisita} className="w-fit rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {savingVisita ? 'Guardando...' : 'Registrar visita'}
                  </button>
                </form>
              }
            >
              <ul className="mt-4 space-y-3">
                {visitas.map((v) => (
                  <li key={v.id} className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3">
                    {editVisitaId === v.id ? (
                      <div className="space-y-2">
                        <input
                          value={evTecnico}
                          onChange={(x) => setEvTecnico(x.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                        />
                        <input
                          type="datetime-local"
                          value={evFechaHora}
                          onChange={(x) => setEvFechaHora(x.target.value)}
                          style={{ colorScheme: 'dark' }}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                        />
                        <textarea
                          value={evInforme}
                          onChange={(x) => setEvInforme(x.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => void saveVisitaEdit()} className="rounded-lg bg-[#007AFF] px-2 py-1 text-xs font-semibold text-white hover:bg-[#0062CC]">Guardar</button>
                          <button onClick={() => setEditVisitaId(null)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            {v.tecnico_nombre} · {new Date(v.fecha_hora_visita).toLocaleString()}
                          </p>
                          <span className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditVisitaId(v.id);
                                setEvTecnico(v.tecnico_nombre);
                                setEvFechaHora(new Date(v.fecha_hora_visita).toISOString().slice(0, 16));
                                setEvInforme(v.informe_breve);
                              }}
                              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10"
                            >
                              Editar
                            </button>
                            <button onClick={() => void deleteById('ci_proyecto_visitas', v.id)} disabled={busyId === v.id} className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
                              {busyId === v.id ? '...' : 'Borrar'}
                            </button>
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-300">{v.informe_breve}</p>
                        {v.foto_antes_public_url ? (
                          <a href={v.foto_antes_public_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-sky-400 underline hover:text-sky-300">
                            Ver foto antes
                          </a>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </SeccionTituloHover>
              </>
              ) : null}
              {!modoEdicion && panelRrhhModulo ? (
                <div ref={rrhhPanelRef} className={!tabVistaTalento ? 'mt-8 space-y-4' : 'space-y-4'}>
                  {panelRrhhModulo}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <ModalNuevaVacante
        open={vacanteModalOpen}
        onClose={() => setVacanteModalOpen(false)}
        proyectoModuloId={id}
        proyectoNombre={proyecto?.nombre ?? null}
        onVacanteCreada={() => setRrhhVacantesTick((n) => n + 1)}
      />
      <GenerarContratoDelegadoModal
        open={contratoAdModalOpen}
        onClose={() => setContratoAdModalOpen(false)}
        proyectoId={id}
        proyectoNombre={proyecto?.nombre ?? null}
        onContratoGenerado={() => void refrescarContratoAd()}
      />
    </div>
  );
}
