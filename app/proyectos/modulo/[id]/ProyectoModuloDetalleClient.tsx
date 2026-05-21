'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProjectAsset } from '@/lib/supabase/project-media';

import ResumenObrerosProyectoModulo from '@/components/proyectos/ResumenObrerosProyectoModulo';
import InventarioEquiposProyecto from '@/components/proyectos/InventarioEquiposProyecto';
import {
  PROYECTO_EQUIPO_SELECT,
  PROYECTO_EQUIPO_SELECT_LEGACY,
  etiquetaCategoriaEquipo,
  isMaquinariaColumnMissing,
  mapProyectoEquipoRow,
  normalizarCategoriaEquipo,
  type ProyectoEquipoRow,
} from '@/lib/proyectos/proyectoEquipos';
import ModalNuevaVacante from './components/ModalNuevaVacante';
import SugerenciaCuadrilla from '@/components/proyectos/SugerenciaCuadrilla';
import DashboardUtilidadReal from '@/components/finanzas/DashboardUtilidadReal';
import ImportarPresupuestoLulo from '@/components/proyectos/ImportarPresupuestoLulo';
import ControlPlanosObra from '@/components/proyectos/ControlPlanosObra';
import HorarioObraEditor from '@/components/proyectos/HorarioObraEditor';

const LOAD_TIMEOUT_MS = 45_000;

type RrhhMenuDropdownProps = {
  irRrhhPanel: () => void;
  irCuadroSolicitados: () => void;
};

/** Botón RRHH con menú: panel personal y cuadro de obreros (solicitados). */
function RrhhMenuDropdown({ irRrhhPanel, irCuadroSolicitados }: RrhhMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const btnClass =
    'rounded-xl border border-fuchsia-500/45 bg-fuchsia-950/50 px-3 py-2 text-xs font-bold text-fuchsia-100 shadow-sm hover:bg-fuchsia-900/60';

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        className={`${btnClass} inline-flex items-center gap-1.5`}
        title="RRHH: panel personal y cuadro de obreros"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        RRHH
        <span className="text-[10px] font-normal opacity-80" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[13.5rem] overflow-hidden rounded-xl border border-white/15 bg-zinc-900 py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-950/60"
            onClick={() => {
              irRrhhPanel();
              setOpen(false);
            }}
          >
            Panel personal
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-xs font-semibold text-[#FF9500] hover:bg-[#FF9500]/10"
            onClick={() => {
              irCuadroSolicitados();
              setOpen(false);
            }}
          >
            Cuadro de obreros
          </button>
        </div>
      ) : null}
    </div>
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

type Equipo = ProyectoEquipoRow;

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
  const [equipos, setEquipos] = useState<Equipo[]>([]);
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
  const [trabajadorNombre, setTrabajadorNombre] = useState('');
  const [trabajadorTelefono, setTrabajadorTelefono] = useState('');
  const [copiedKit, setCopiedKit] = useState(false);
  const [generandoSugerencias, setGenerandoSugerencias] = useState(false);
  const [sugerenciasIA, setSugerenciasIA] = useState<string | null>(null);
  const [sugerenciasDesdeGemini, setSugerenciasDesdeGemini] = useState(false);
  const [vacanteModalOpen, setVacanteModalOpen] = useState(false);
  const [rrhhVacantesTick, setRrhhVacantesTick] = useState(0);
  const [borrandoProyecto, setBorrandoProyecto] = useState(false);
  const rrhhPanelRef = useRef<HTMLDivElement>(null);

  const irRrhhPanel = useCallback(() => {
    router.replace(`/proyectos/modulo/${id}?tab=rrhh`, { scroll: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rrhhPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [id, router]);

  const irCuadroSolicitados = useCallback(() => {
    router.replace(`/proyectos/modulo/${id}?tab=solicitados`, { scroll: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rrhhPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [id, router]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t !== 'rrhh' && t !== 'talento' && t !== 'solicitados' && t !== 'finanzas') return;
    const timer = window.setTimeout(() => {
      rrhhPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(timer);
  }, [searchParams, id]);

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
      const [p, e0, a, v] = await withTimeout(
        Promise.all([
          supabase.from('ci_proyectos').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('ci_proyecto_equipos')
            .select(PROYECTO_EQUIPO_SELECT)
            .eq('proyecto_id', id)
            .order('created_at', { ascending: false }),
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
      let equiposData: unknown[] | null = e0.data;
      let equiposErr = e0.error;
      if (equiposErr && isMaquinariaColumnMissing(equiposErr.message)) {
        const legacy = await supabase
          .from('ci_proyecto_equipos')
          .select(PROYECTO_EQUIPO_SELECT_LEGACY)
          .eq('proyecto_id', id)
          .order('created_at', { ascending: false });
        equiposData = legacy.data;
        equiposErr = legacy.error;
      }
      if (p.error || !p.data) {
        setProyecto(null);
        setEquipos([]);
        setArchivos([]);
        setVisitas([]);
        setError(p.error?.message ?? 'Proyecto no encontrado.');
        return;
      }
      setProyecto(p.data as Proyecto);
      setEquipos((equiposData ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
      setArchivos((a.data ?? []) as Archivo[]);
      setVisitas((v.data ?? []) as Visita[]);
      if (equiposErr?.message) setError((prev) => prev ?? equiposErr.message);
      if (a.error?.message) setError((prev) => prev ?? a.error.message);
      if (v.error?.message) setError((prev) => prev ?? v.error.message);
    } catch (err) {
      setProyecto(null);
      setEquipos([]);
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
      `¿Eliminar permanentemente el proyecto «${proyecto.nombre}»?\n\nEsta acción no se puede deshacer. Se eliminan equipos, archivos y visitas vinculados.`,
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
    setPeMonto(String(proyecto.monto_aproximado ?? 0));
    setPeMoneda(proyecto.moneda || 'USD');
    setPeObs(proyecto.observaciones ?? '');
    setPeLat(proyecto.lat != null ? String(proyecto.lat) : '');
    setPeLng(proyecto.lng != null ? String(proyecto.lng) : '');
    setPeEntidadId(proyecto.entidad_id ? String(proyecto.entidad_id) : '');
    setPeHorarioSemanalObra(proyecto.horario_semanal_obra_default ?? '');
    setPePuntoEncTransporteContrato(proyecto.punto_encuentro_transporte_contrato ?? '');
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
    const m = Number(String(peMonto).replace(',', '.'));
    if (!Number.isFinite(m) || m < 0) {
      setProyectoSaveError('Monto aproximado no válido.');
      return;
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
    const { error: upErr } = await supabase
      .from('ci_proyectos')
      .update({
        nombre: n,
        estado: peEstado,
        ubicacion_texto: u,
        monto_aproximado: m,
        moneda: (peMoneda.trim() || 'USD').slice(0, 8),
        observaciones: peObs.trim() || null,
        lat,
        lng,
        entidad_id: peEntidadId.trim() || null,
        horario_semanal_obra_default: peHorarioSemanalObra.trim() || null,
        punto_encuentro_transporte_contrato: pePuntoEncTransporteContrato.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setSavingProyecto(false);
    if (upErr) {
      setProyectoSaveError(upErr.message);
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

  const textoKitRecoleccion = useMemo(() => {
    if (!proyecto) return '';
    const encabezado = [
      `Orden de recoleccion de herramientas`,
      `Proyecto: ${proyecto.nombre}`,
      `Ubicacion: ${proyecto.ubicacion_texto}`,
      trabajadorNombre.trim() ? `Trabajador asignado: ${trabajadorNombre.trim()}` : null,
      '',
      'Lista de inventario a recolectar:',
    ]
      .filter(Boolean)
      .join('\n');

    const items = equipos.length
      ? equipos
          .map((e, idx) => {
            const cat = etiquetaCategoriaEquipo(e.categoria);
            const detalle = [e.marca, e.modelo].filter(Boolean).join(' ');
            let extra = '';
            if (normalizarCategoriaEquipo(e.categoria) === 'maquinaria_alquilada') {
              const partes = [
                e.arrendatario ? `Arrendatario: ${e.arrendatario}` : null,
                e.arrendatario_rif ? `RIF: ${e.arrendatario_rif}` : null,
                e.fecha_arriendo_inicio ? `Desde: ${e.fecha_arriendo_inicio}` : null,
                e.costo_arriendo != null ? `Costo: ${e.moneda_arriendo ?? 'USD'} ${e.costo_arriendo}` : null,
              ].filter(Boolean);
              if (partes.length) extra = ` · ${partes.join(' · ')}`;
            }
            return `${idx + 1}. [${cat}] ${e.nombre_equipo} - Cantidad: ${e.cantidad}${detalle ? ` (${detalle})` : ''}${e.serial ? ` - Serial: ${e.serial}` : ''}${extra}`;
          })
          .join('\n')
      : 'Sin equipos cargados.';

    return `${encabezado}\n${items}\n\nConfirmar disponibilidad y salida de almacen.`;
  }, [proyecto, equipos, trabajadorNombre]);

  async function copiarKit() {
    if (!textoKitRecoleccion) return;
    try {
      await navigator.clipboard.writeText(textoKitRecoleccion);
      setCopiedKit(true);
      setTimeout(() => setCopiedKit(false), 1800);
    } catch {
      setError('No se pudo copiar la orden al portapapeles.');
    }
  }

  const waLink = useMemo(() => {
    const telefono = trabajadorTelefono.replace(/\D+/g, '');
    if (!telefono || !textoKitRecoleccion) return null;
    return `https://wa.me/${telefono}?text=${encodeURIComponent(textoKitRecoleccion)}`;
  }, [trabajadorTelefono, textoKitRecoleccion]);

  const nombrePatronoVista = useMemo(() => {
    const eid = proyecto?.entidad_id;
    if (!eid) return null;
    const row = entidades.find((en) => en.id === String(eid).trim());
    return row?.nombre?.trim() || null;
  }, [proyecto?.entidad_id, entidades]);

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
          <ImportarPresupuestoLulo proyectoId={id} onSuccess={() => void load()} />
          <ControlPlanosObra proyectoId={id} />
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
      <>

        <SugerenciaCuadrilla
          nombreObra={proyecto.nombre}
          ubicacionObra={proyecto.ubicacion_texto}
          proyectoModuloId={id}
        />
      </>
    );
  }, [proyecto, id, rrhhVacantesTick, tabUrl, tabSolicitados]);

  async function generarSugerenciasIA() {
    if (!proyecto) return;
    setGenerandoSugerencias(true);
    setSugerenciasIA(null);
    try {
      const res = await fetch('/api/proyectos/sugerir-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto: {
            nombre: proyecto.nombre,
            ubicacion: proyecto.ubicacion_texto,
            observaciones: proyecto.observaciones,
          },
          inventarioActual: equipos.map((e) => ({
            nombre: e.nombre_equipo,
            categoria: normalizarCategoriaEquipo(e.categoria),
            marca: e.marca,
            modelo: e.modelo,
            cantidad: e.cantidad,
            arrendatario: e.arrendatario,
            costo_arriendo: e.costo_arriendo,
          })),
        }),
      });
      const data = (await res.json()) as { texto?: string; desdeGemini?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'No se pudieron generar sugerencias.');
        return;
      }
      setSugerenciasIA(data.texto ?? 'Sin contenido.');
      setSugerenciasDesdeGemini(Boolean(data.desdeGemini));
    } catch {
      setError('Error de red al consultar sugerencias.');
    } finally {
      setGenerandoSugerencias(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 pb-28 pt-4">
      <div className="mx-auto max-w-6xl w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/proyectos/modulo" className="text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline">
            ← Proyectos
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {!tabCabeceraMinimaSinAcciones && !modoEdicion ? (
              <Link
                href={`/proyectos/modulo/${id}?editar=1`}
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Modificar proyecto
              </Link>
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
                <RrhhMenuDropdown irRrhhPanel={irRrhhPanel} irCuadroSolicitados={irCuadroSolicitados} />
                <Link
                  href="/reclutamiento"
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
                <RrhhMenuDropdown irRrhhPanel={irRrhhPanel} irCuadroSolicitados={irCuadroSolicitados} />
                <Link
                  href="/reclutamiento"
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
            <RrhhMenuDropdown irRrhhPanel={irRrhhPanel} irCuadroSolicitados={irCuadroSolicitados} />
            <Link
              href={`/proyectos/modulo/${id}`}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10"
            >
              Volver a la ficha del proyecto
            </Link>
          </div>
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
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Horario semanal en obra (contratos laborales)
                  </label>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                    Se usa en el PDF estructurado si el contrato del obrero no define otro horario. Elige días y hora de
                    inicio y culminación por franja; puedes añadir otra franja (p. ej. viernes corto).
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
                    Parada del transporte (contrato laboral, cláusula SEXTA)
                  </label>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                    Texto que aparece en el PDF tras «desde el punto de encuentro» (hasta «hasta el sitio de la obra»).
                    Ej.: <span className="text-zinc-400">en el sector Jorge Coll (Municipio Maneiro)</span>. Si lo dejas
                    vacío, se usa ese ejemplo por defecto.
                  </p>
                  <textarea
                    value={pePuntoEncTransporteContrato}
                    onChange={(e) => setPePuntoEncTransporteContrato(e.target.value)}
                    rows={2}
                    placeholder="en el sector Jorge Coll (Municipio Maneiro)"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                  />
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
                    Monto aproximado
                  </label>
                  <input
                    value={peMonto}
                    onChange={(e) => setPeMonto(e.target.value)}
                    className="mt-1 w-full max-w-xs rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500/40"
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
                <div className="mt-4 flex flex-wrap items-start gap-4">
                  <ImportarPresupuestoLulo proyectoId={id} />
                  <Link
                    href={`/proyectos/modulo/${id}?tab=finanzas`}
                    className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/40"
                  >
                    Utilidad real y finanzas del módulo →
                  </Link>
                </div>
              </>
            ) : null}

            <div className={`space-y-4 ${tabVistaTalento && !modoEdicion ? 'mt-2' : 'mt-4'}`}>
              {modoEdicion || !tabVistaTalento ? (
              <>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <InventarioEquiposProyecto
                  proyectoId={id}
                  equipos={equipos}
                  onRefresh={() => void load()}
                  onError={setError}
                />
              </div>

              <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl lg:col-span-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xs font-bold uppercase text-zinc-400">Transmision al trabajador</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      value={trabajadorNombre}
                      onChange={(e) => setTrabajadorNombre(e.target.value)}
                      placeholder="Nombre del trabajador"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                    <input
                      value={trabajadorTelefono}
                      onChange={(e) => setTrabajadorTelefono(e.target.value)}
                      placeholder="WhatsApp (ej: 58412...)"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => void copiarKit()} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10">
                      {copiedKit ? 'Copiado' : 'Copiar orden de recoleccion'}
                    </button>
                    <a
                      href={waLink ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-xl px-3 py-2 text-xs font-semibold text-white ${waLink ? 'bg-emerald-600 hover:bg-emerald-500' : 'pointer-events-none bg-zinc-600'}`}
                    >
                      Enviar por WhatsApp
                    </a>
                    <button
                      onClick={() => void generarSugerenciasIA()}
                      disabled={generandoSugerencias}
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {generandoSugerencias ? 'Analizando...' : 'Sugerir herramientas e insumos (IA)'}
                    </button>
                  </div>
                  <textarea
                    value={textoKitRecoleccion}
                    readOnly
                    rows={7}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300"
                  />
                  {sugerenciasIA ? (
                    <div className="mt-3 rounded-xl border border-indigo-500/25 bg-indigo-950/40 p-3">
                      <p className="text-xs font-semibold text-indigo-300">
                        Sugerencia inteligente ({sugerenciasDesdeGemini ? 'Gemini' : 'modo local'})
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{sugerenciasIA}</p>
                    </div>
                  ) : null}
                </div>
              </section>

              <ControlPlanosObra proyectoId={id} className="mb-6" />

              <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl">
                <h2 className="text-sm font-bold uppercase text-zinc-500">Fotos / planos</h2>
                <form onSubmit={(e) => void addArchivo(e)} className="mt-3 grid gap-2">
                  <select
                    value={arTipo}
                    onChange={(e) => setArTipo(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
                  >
                    <option value="foto_proyecto">Foto de proyecto</option>
                    <option value="plano">Plano</option>
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
                            <option value="plano">plano</option>
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
              </section>
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl">
              <h2 className="text-sm font-bold uppercase text-zinc-500">Historial de visitas tecnicas</h2>
              <form onSubmit={(e) => void addVisita(e)} className="mt-3 grid gap-2">
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
            </section>
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
    </div>
  );
}
