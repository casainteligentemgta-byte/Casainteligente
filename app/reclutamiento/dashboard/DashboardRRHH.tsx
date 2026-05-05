'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/lib/http/apiUrl'
import {
  Briefcase,
  CheckCircle,
  Clock,
  Filter,
  Link2,
  MessageCircle,
  Users,
} from 'lucide-react'
import SemaforoRiesgo from '@/components/reclutamiento/SemaforoRiesgo'
import { calcularRiesgoObrero, type NivelRiesgoContratacion } from '@/lib/talento/calcularRiesgoObrero'

/** Fila de `recruitment_needs` enriquecida con nombre de `ci_proyectos` y plazas cubiertas (`ci_empleados.estado = aprobado`). */
export type RequisicionInboxItem = {
  id: string
  proyectoNombre: string
  cargo: string
  cantidadTotal: number
  cubiertos: number
  urgente?: boolean
  protocolActive?: boolean
}

type KanbanColumnId = 'invitados' | 'evaluando' | 'banca' | 'asignados'

type CandidatoKanban = {
  id: string
  nombre: string
  cargo: string
  nivel: string
  columna: KanbanColumnId
  /** Campos alineados con `ci_empleados` (evaluación obrero) para semáforo de riesgo */
  perfil_color?: string | null
  puntuacion_logica?: number | null
  tiempo_respuesta?: number | null
}

type FiltroRiesgo = 'todos' | NivelRiesgoContratacion | 'sin_datos'

const COLUMNAS: {
  id: KanbanColumnId
  titulo: string
  subtitulo: string
  icon: typeof Users
  destacada?: boolean
}[] = [
  {
    id: 'invitados',
    titulo: 'Invitados',
    subtitulo: 'Link enviado · esperando CV',
    icon: Clock,
  },
  {
    id: 'evaluando',
    titulo: 'Evaluando',
    subtitulo: 'Prueba IA (~15 min)',
    icon: Users,
  },
  {
    id: 'banca',
    titulo: 'La Banca',
    subtitulo: 'Aprobados · listos para firmar',
    icon: CheckCircle,
    destacada: true,
  },
  {
    id: 'asignados',
    titulo: 'Asignados',
    subtitulo: 'Contrato · en obra',
    icon: Briefcase,
  },
]

function linkEntrevista(needId: string) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/reclutamiento?need=${needId}`
}

function mensajeWhatsapp(needId: string, proyecto: string, cargo: string) {
  const url = linkEntrevista(needId)
  const texto = encodeURIComponent(
    `Hola, te invitamos a completar tu perfil para *${cargo}* en *${proyecto}*. Enlace: ${url}`,
  )
  return `https://wa.me/?text=${texto}`
}

const FILTROS_RIESGO: { id: FiltroRiesgo; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'verde', label: 'Solo verde' },
  { id: 'amarillo', label: 'Solo ámbar' },
  { id: 'rojo', label: 'Solo rojo' },
  { id: 'sin_datos', label: 'Sin evaluar' },
]

type FunnelApi = {
  needs?: RequisicionInboxItem[]
  candidatos?: CandidatoKanban[]
  error?: string
}

export default function DashboardRRHH() {
  const [toast, setToast] = useState<string | null>(null)
  const [requisiciones, setRequisiciones] = useState<RequisicionInboxItem[]>([])
  const [candidatosServer, setCandidatosServer] = useState<CandidatoKanban[]>([])
  /** Ajuste local al arrastrar tarjetas (no persiste en base de datos). */
  const [columnOverrides, setColumnOverrides] = useState<Partial<Record<string, KanbanColumnId>>>({})
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [filtroRiesgo, setFiltroRiesgo] = useState<FiltroRiesgo>('todos')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const cargarEmbudo = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const res = await fetch(apiUrl('/api/recruitment/dashboard-funnel'), { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as FunnelApi & { error?: string }
      if (res.status === 401) {
        setRequisiciones([])
        setCandidatosServer([])
        setErrorCarga('Inicia sesión CEO o define la clave en la URL (?key=…) para ver datos de vacantes y postulantes.')
        return
      }
      if (!res.ok) {
        setRequisiciones([])
        setCandidatosServer([])
        setErrorCarga(data.error ?? `Error ${res.status}`)
        return
      }
      setRequisiciones(Array.isArray(data.needs) ? data.needs : [])
      setCandidatosServer(Array.isArray(data.candidatos) ? data.candidatos : [])
      setColumnOverrides({})
    } catch {
      setErrorCarga('Error de red al cargar el embudo.')
      setRequisiciones([])
      setCandidatosServer([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargarEmbudo()
  }, [cargarEmbudo])

  const candidatos = useMemo(
    () =>
      candidatosServer.map((c) => ({
        ...c,
        columna: columnOverrides[c.id] ?? c.columna,
      })),
    [candidatosServer, columnOverrides],
  )

  const candidatosFiltrados = useMemo(() => {
    if (filtroRiesgo === 'todos') return candidatos
    return candidatos.filter((c) => {
      const { nivel } = calcularRiesgoObrero({
        perfil_color: c.perfil_color,
        puntuacion_logica: c.puntuacion_logica,
        tiempo_respuesta: c.tiempo_respuesta,
      })
      return nivel === filtroRiesgo
    })
  }, [candidatos, filtroRiesgo])

  const porColumna = useMemo(() => {
    const map: Record<KanbanColumnId, CandidatoKanban[]> = {
      invitados: [],
      evaluando: [],
      banca: [],
      asignados: [],
    }
    for (const c of candidatosFiltrados) map[c.columna].push(c)
    return map
  }, [candidatosFiltrados])

  const copiarLinkNeed = useCallback((need: RequisicionInboxItem) => {
    const url = linkEntrevista(need.id)
    void navigator.clipboard.writeText(url).then(
      () => {
        setToast('Enlace copiado al portapapeles.')
        window.setTimeout(() => setToast(null), 2400)
      },
      () => setToast('No se pudo copiar; copia manualmente la URL.'),
    )
  }, [])

  const abrirWhatsapp = useCallback((need: RequisicionInboxItem) => {
    window.open(mensajeWhatsapp(need.id, need.proyectoNombre, need.cargo), '_blank', 'noopener,noreferrer')
  }, [])

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
  }, [])

  const handleDropColumna = useCallback(
    (col: KanbanColumnId) => {
      if (!draggingId) return
      setColumnOverrides((prev) => ({ ...prev, [draggingId]: col }))
      setDraggingId(null)
    },
    [draggingId],
  )

  return (
    <div className="mb-10 max-w-full min-w-0 space-y-10 rounded-2xl border border-white/10 bg-[#0A0A0F]/95 p-5 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-8">
      {toast ? (
        <p className="animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200">
          {toast}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <p className="text-xs text-zinc-500">
          Datos desde <code className="text-zinc-400">recruitment_needs</code>,{' '}
          <code className="text-zinc-400">ci_proyectos</code> y <code className="text-zinc-400">ci_empleados</code>.
        </p>
        <button
          type="button"
          disabled={cargando}
          onClick={() => void cargarEmbudo()}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-50"
        >
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {errorCarga ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">{errorCarga}</p>
      ) : null}

      {/* —— Sección 1: Inbox —— */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white md:text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Briefcase className="h-5 w-5 text-[#FFD60A]" aria-hidden />
              </span>
              Bandeja de requisiciones
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Vacantes activas por proyecto (módulo integral u obra en <code className="text-[#FF9500]">ci_proyectos</code>
              ). «Cubierto» cuenta postulantes con <code className="text-zinc-400">estado = aprobado</code> vinculados a
              esa vacante.
            </p>
          </div>
        </div>

        {cargando && requisiciones.length === 0 ? (
          <p className="text-sm text-zinc-500">Cargando vacantes…</p>
        ) : null}

        <div className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin] md:snap-x md:snap-mandatory">
          {requisiciones.map((need) => {
            const pct =
              need.cantidadTotal > 0 ? Math.min(100, Math.round((need.cubiertos / need.cantidadTotal) * 100)) : 0
            const cerrada = need.protocolActive === false
            return (
              <article
                key={need.id}
                className={`min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border bg-white/5 p-4 shadow-lg transition hover:bg-white/[0.07] md:min-w-[300px] ${
                  need.urgente && !cerrada
                    ? 'border-[#FF9500]/50 shadow-[0_0_20px_rgba(249,115,22,0.12)]'
                    : cerrada
                      ? 'border-zinc-700 opacity-70'
                      : 'border-white/10'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#FF9500]">
                  {cerrada ? 'Cerrada' : need.urgente ? 'Urgente' : 'Estándar'}
                </p>
                <h3 className="mt-2 line-clamp-2 text-base font-semibold text-white">{need.proyectoNombre}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{need.cargo}</p>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Cubierto</span>
                    <span className="font-mono text-zinc-300">
                      {need.cubiertos}/{need.cantidadTotal}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FFD60A] to-[#FF9500] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copiarLinkNeed(need)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:border-[#FF9500]/40 hover:bg-[#FF9500]/10"
                  >
                    <Link2 className="h-3.5 w-3.5 text-[#FFD60A]" aria-hidden />
                    Atender &amp; Generar Link
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirWhatsapp(need)}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-950/50"
                    title="Abrir WhatsApp con mensaje e invitación"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    WA
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        {!cargando && requisiciones.length === 0 && !errorCarga ? (
          <p className="text-sm text-zinc-500">
            No hay vacantes en <code className="text-zinc-400">recruitment_needs</code>. Crea una desde un proyecto
            (RRHH) o con «Requisición personal» arriba.
          </p>
        ) : null}
      </section>

      {/* —— Sección 2: Ficha candidatos + riesgo —— */}
      <section className="space-y-4 border-t border-white/10 pt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white md:text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <Filter className="h-5 w-5 text-[#FFD60A]" aria-hidden />
              </span>
              Ficha del obrero · riesgo de contratación
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Semáforo derivado de <code className="text-[#FF9500]/90">perfil_color</code>,{' '}
              <code className="text-[#FF9500]/90">puntuacion_logica</code> y{' '}
              <code className="text-[#FF9500]/90">tiempo_respuesta</code> en{' '}
              <code className="text-zinc-400">ci_empleados</code> (postulantes con vacante asignada).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Filtrar</span>
            {FILTROS_RIESGO.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroRiesgo(f.id)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  filtroRiesgo === f.id
                    ? 'border-[#FF9500]/50 bg-[#FF9500]/15 text-[#FFD60A]'
                    : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25 shadow-inner">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Embudo</th>
                <th className="px-4 py-3">Estatus de riesgo</th>
              </tr>
            </thead>
            <tbody>
              {candidatosFiltrados.map((c) => {
                const colLabel =
                  c.columna === 'invitados'
                    ? 'Invitados'
                    : c.columna === 'evaluando'
                      ? 'Evaluando'
                      : c.columna === 'banca'
                        ? 'La Banca'
                        : 'Asignados'
                return (
                  <tr key={c.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-semibold text-white">{c.nombre}</td>
                    <td className="px-4 py-3 text-zinc-400">{c.cargo}</td>
                    <td className="px-4 py-3 text-xs text-[#FF9500]">{c.nivel}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{colLabel}</td>
                    <td className="px-4 py-3">
                      <SemaforoRiesgo
                        perfil_color={c.perfil_color}
                        puntuacion_logica={c.puntuacion_logica}
                        tiempo_respuesta={c.tiempo_respuesta}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {candidatosFiltrados.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">Ningún candidato coincide con el filtro.</p>
          ) : null}
        </div>
      </section>

      {/* —— Sección 3: Kanban —— */}
      <section className="space-y-4 border-t border-white/10 pt-10">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white md:text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Users className="h-5 w-5 text-[#FFD60A]" aria-hidden />
            </span>
            Tablero Kanban · embudo de talento
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Columnas inferidas desde <code className="text-zinc-500">estado_proceso</code> y{' '}
            <code className="text-zinc-500">estado</code> en <code className="text-zinc-500">ci_empleados</code>. Puedes
            reordenar localmente al arrastrar (no se guarda en base de datos). La columna{' '}
            <strong className="text-[#FFD60A]">La Banca</strong> agrupa examen completado pendiente de aprobación RRHH.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNAS.map((col) => {
            const Icon = col.icon
            const lista = porColumna[col.id]
            const destacada = col.destacada
            return (
              <div
                key={col.id}
                role="region"
                aria-label={col.titulo}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={() => handleDropColumna(col.id)}
                className={`flex min-h-[280px] flex-col rounded-2xl border p-3 transition-colors md:min-h-[320px] ${
                  destacada
                    ? 'border-emerald-400/50 bg-emerald-950/15 shadow-[0_0_28px_rgba(234,179,8,0.18),inset_0_1px_0_rgba(255,214,10,0.08)]'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <header className="mb-3 flex items-start gap-2 border-b border-white/10 pb-3">
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${destacada ? 'text-emerald-400' : 'text-zinc-400'}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <h3 className={`text-sm font-bold ${destacada ? 'text-emerald-100' : 'text-white'}`}>
                      {col.titulo}
                    </h3>
                    <p className="text-[11px] leading-snug text-zinc-500">{col.subtitulo}</p>
                  </div>
                  <span className="ml-auto rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                    {lista.length}
                  </span>
                </header>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  {lista.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => handleDragStart(c.id)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab rounded-xl border px-3 py-2.5 text-left shadow-md transition active:cursor-grabbing ${
                        draggingId === c.id
                          ? 'border-[#FF9500]/60 bg-[#FF9500]/10 opacity-90'
                          : 'border-white/10 bg-zinc-900/80 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold text-white">{c.nombre}</p>
                        <SemaforoRiesgo
                          perfil_color={c.perfil_color}
                          puntuacion_logica={c.puntuacion_logica}
                          tiempo_respuesta={c.tiempo_respuesta}
                          mostrarEtiqueta={false}
                          className="shrink-0 scale-90"
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{c.cargo}</p>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#FF9500]">{c.nivel}</p>
                    </div>
                  ))}
                  {lista.length === 0 ? (
                    <p className="py-6 text-center text-xs text-zinc-600">Suelta aquí candidatos</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
