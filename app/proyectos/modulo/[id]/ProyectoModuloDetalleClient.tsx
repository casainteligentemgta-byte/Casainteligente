'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadProjectAsset } from '@/lib/supabase/project-media';
import FeedNotificacionesRealtime from '@/components/proyectos/FeedNotificacionesRealtime';
import GestionRRHHLocal from '@/components/proyectos/GestionRRHHLocal';
import ModalNuevaVacante from './components/ModalNuevaVacante';

const LOAD_TIMEOUT_MS = 45_000;

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
};

type EntidadOpt = { id: string; nombre: string; rif: string | null };

type Equipo = {
  id: string;
  nombre_equipo: string;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
  cantidad: number;
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
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);

  const [savingEquipo, setSavingEquipo] = useState(false);
  const [savingArchivo, setSavingArchivo] = useState(false);
  const [savingVisita, setSavingVisita] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editEquipoId, setEditEquipoId] = useState<string | null>(null);
  const [editVisitaId, setEditVisitaId] = useState<string | null>(null);
  const [editArchivoId, setEditArchivoId] = useState<string | null>(null);

  const [eqNombre, setEqNombre] = useState('');
  const [eqMarca, setEqMarca] = useState('');
  const [eqModelo, setEqModelo] = useState('');
  const [eqSerial, setEqSerial] = useState('');
  const [eqCantidad, setEqCantidad] = useState('1');

  const [arTipo, setArTipo] = useState('foto_proyecto');
  const [arTitulo, setArTitulo] = useState('');
  const [arFile, setArFile] = useState<File | null>(null);

  const [vTecnico, setVTecnico] = useState('');
  const [vFechaHora, setVFechaHora] = useState(() => new Date().toISOString().slice(0, 16));
  const [vInforme, setVInforme] = useState('');
  const [vFotoAntes, setVFotoAntes] = useState<File | null>(null);

  const [eeNombre, setEeNombre] = useState('');
  const [eeMarca, setEeMarca] = useState('');
  const [eeModelo, setEeModelo] = useState('');
  const [eeSerial, setEeSerial] = useState('');
  const [eeCantidad, setEeCantidad] = useState('1');

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

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t !== 'rrhh' && t !== 'talento') return;
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
  const [entidades, setEntidades] = useState<EntidadOpt[]>([]);
  const [savingProyecto, setSavingProyecto] = useState(false);
  const [proyectoSaveError, setProyectoSaveError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('ci_entidades').select('id,nombre,rif').order('nombre');
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
      const [p, e, a, v] = await withTimeout(
        Promise.all([
          supabase.from('ci_proyectos').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('ci_proyecto_equipos')
            .select('id,nombre_equipo,marca,modelo,serial,cantidad')
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
      if (p.error || !p.data) {
        setProyecto(null);
        setEquipos([]);
        setArchivos([]);
        setVisitas([]);
        setError(p.error?.message ?? 'Proyecto no encontrado.');
        return;
      }
      setProyecto(p.data as Proyecto);
      setEquipos((e.data ?? []) as Equipo[]);
      setArchivos((a.data ?? []) as Archivo[]);
      setVisitas((v.data ?? []) as Visita[]);
      if (e.error?.message) setError((prev) => prev ?? e.error.message);
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

  async function addEquipo(e: React.FormEvent) {
    e.preventDefault();
    if (!eqNombre.trim()) return;
    setSavingEquipo(true);
    const { error: insErr } = await supabase.from('ci_proyecto_equipos').insert({
      proyecto_id: id,
      nombre_equipo: eqNombre.trim(),
      marca: eqMarca.trim() || null,
      modelo: eqModelo.trim() || null,
      serial: eqSerial.trim() || null,
      cantidad: Number(eqCantidad || 1),
    });
    setSavingEquipo(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setEqNombre('');
    setEqMarca('');
    setEqModelo('');
    setEqSerial('');
    setEqCantidad('1');
    void load();
  }

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

  async function saveEquipoEdit() {
    if (!editEquipoId) return;
    setBusyId(editEquipoId);
    const { error: upErr } = await supabase
      .from('ci_proyecto_equipos')
      .update({
        nombre_equipo: eeNombre.trim(),
        marca: eeMarca.trim() || null,
        modelo: eeModelo.trim() || null,
        serial: eeSerial.trim() || null,
        cantidad: Number(eeCantidad || 1),
      })
      .eq('id', editEquipoId);
    setBusyId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setEditEquipoId(null);
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
            const detalle = [e.marca, e.modelo].filter(Boolean).join(' ');
            return `${idx + 1}. ${e.nombre_equipo} - Cantidad: ${e.cantidad}${detalle ? ` (${detalle})` : ''}${e.serial ? ` - Serial: ${e.serial}` : ''}`;
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

  /** Enlace directo ?tab=rrhh|talento: cabecera mínima (sin atajos duplicados al panel RRHH). */
  const tabVistaTalento = searchParams.get('tab') === 'rrhh' || searchParams.get('tab') === 'talento';

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
            marca: e.marca,
            modelo: e.modelo,
            cantidad: e.cantidad,
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
            {proyecto && !tabVistaTalento && !modoEdicion ? (
              <FeedNotificacionesRealtime
                proyectoId={id}
                onIrGestionTalento={irRrhhPanel}
              />
            ) : null}
            {!tabVistaTalento && !modoEdicion ? (
              <Link
                href={`/proyectos/modulo/${id}?editar=1`}
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Modificar proyecto
              </Link>
            ) : null}
            {!tabVistaTalento && !modoEdicion ? (
              <>
                <button
                  type="button"
                  onClick={() => setVacanteModalOpen(true)}
                  className="rounded-xl border border-[#FF9500]/45 bg-gradient-to-r from-[#FFD60A]/15 to-[#FF9500]/15 px-3 py-2 text-xs font-semibold text-[#FFD60A] hover:from-[#FFD60A]/25 hover:to-[#FF9500]/25"
                >
                  Nueva vacante
                </button>
                <button
                  type="button"
                  onClick={irRrhhPanel}
                  className="rounded-xl border border-fuchsia-500/45 bg-fuchsia-950/50 px-3 py-2 text-xs font-bold text-fuchsia-100 shadow-sm hover:bg-fuchsia-900/60"
                  title="Personal solicitado, enlaces WhatsApp y copiar"
                >
                  RRHH
                </button>
                <Link
                  href="/reclutamiento/dashboard"
                  className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
                >
                  Reclutamiento
                </Link>
              </>
            ) : null}
            {!tabVistaTalento && !modoEdicion ? (
              <Link
                href="/proyectos/modulo"
                className="rounded-xl border border-white/10 bg-[#0A0A0F] px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
              >
                Terminar y volver a los proyectos
              </Link>
            ) : null}
          </div>
        </div>
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
            ) : tabVistaTalento ? null : (
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
            )}

            <div className={`space-y-4 ${tabVistaTalento && !modoEdicion ? 'mt-2' : 'mt-4'}`}>
              {modoEdicion || !tabVistaTalento ? (
              <>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-lg backdrop-blur-xl">
                <h2 className="text-sm font-bold uppercase text-zinc-500">Inventario de equipos</h2>
                <form onSubmit={(e) => void addEquipo(e)} className="mt-3 grid gap-2">
                  <input
                    value={eqNombre}
                    onChange={(e) => setEqNombre(e.target.value)}
                    placeholder="Equipo *"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      value={eqMarca}
                      onChange={(e) => setEqMarca(e.target.value)}
                      placeholder="Marca"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                    <input
                      value={eqModelo}
                      onChange={(e) => setEqModelo(e.target.value)}
                      placeholder="Modelo"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                    <input
                      value={eqSerial}
                      onChange={(e) => setEqSerial(e.target.value)}
                      placeholder="Serial"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                    />
                  </div>
                  <input
                    value={eqCantidad}
                    onChange={(e) => setEqCantidad(e.target.value)}
                    placeholder="Cantidad"
                    className="max-w-[180px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
                  />
                  <button disabled={savingEquipo} className="w-fit rounded-xl bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0062CC] disabled:opacity-50">
                    {savingEquipo ? 'Guardando...' : 'Agregar equipo'}
                  </button>
                </form>
                <ul className="mt-4 space-y-2 text-sm">
                  {equipos.map((e) => (
                    <li key={e.id} className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
                      {editEquipoId === e.id ? (
                        <div className="space-y-2">
                          <input
                            value={eeNombre}
                            onChange={(x) => setEeNombre(x.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 outline-none"
                          />
                          <div className="grid gap-2 sm:grid-cols-4">
                            <input
                              value={eeMarca}
                              onChange={(x) => setEeMarca(x.target.value)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 outline-none"
                            />
                            <input
                              value={eeModelo}
                              onChange={(x) => setEeModelo(x.target.value)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 outline-none"
                            />
                            <input
                              value={eeSerial}
                              onChange={(x) => setEeSerial(x.target.value)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 outline-none"
                            />
                            <input
                              value={eeCantidad}
                              onChange={(x) => setEeCantidad(x.target.value)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-zinc-500 outline-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => void saveEquipoEdit()} className="rounded-lg bg-[#007AFF] px-2 py-1 text-xs font-semibold text-white hover:bg-[#0062CC]">Guardar</button>
                            <button onClick={() => setEditEquipoId(null)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="font-semibold text-white">{e.nombre_equipo}</span> · {e.marca ?? '—'} {e.modelo ?? ''} · Serial: {e.serial ?? '—'} · Cant: {e.cantidad}
                          </span>
                          <span className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditEquipoId(e.id);
                                setEeNombre(e.nombre_equipo);
                                setEeMarca(e.marca ?? '');
                                setEeModelo(e.modelo ?? '');
                                setEeSerial(e.serial ?? '');
                                setEeCantidad(String(e.cantidad));
                              }}
                              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10"
                            >
                              Editar
                            </button>
                            <button onClick={() => void deleteById('ci_proyecto_equipos', e.id)} disabled={busyId === e.id} className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
                              {busyId === e.id ? '...' : 'Borrar'}
                            </button>
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-3">
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
              <div ref={rrhhPanelRef} className={modoEdicion || !tabVistaTalento ? 'mt-8 space-y-4' : 'space-y-4'}>
                <GestionRRHHLocal
                  proyectoModuloId={id}
                  listaRefresco={rrhhVacantesTick}
                  nombreProyecto={proyecto?.nombre ?? null}
                />
              </div>
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
