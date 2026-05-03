'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Briefcase,
  CheckCircle,
  Clock,
  Link2,
  MessageCircle,
  Users,
} from 'lucide-react'

/** Simula filas de `recruitment_needs` con estado «abierta» (hasta acople real a Supabase). */
export type RequisicionInboxItem = {
  id: string
  proyectoNombre: string
  cargo: string
  cantidadTotal: number
  cubiertos: number
  urgente?: boolean
}

const MOCK_REQUISICIONES: RequisicionInboxItem[] = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    proyectoNombre: 'Torre Inteligente A',
    cargo: '5.1 ALBAÑIL DE 1ra.',
    cantidadTotal: 3,
    cubiertos: 0,
    urgente: true,
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    proyectoNombre: 'Residencial Elite Park',
    cargo: '2.7 AYUDANTE DE TOPOGRAFO',
    cantidadTotal: 1,
    cubiertos: 0,
    urgente: false,
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    proyectoNombre: 'Ampliación planta industrial',
    cargo: '5.5 ELECTRICISTA DE 1ra.',
    cantidadTotal: 2,
    cubiertos: 1,
    urgente: true,
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    proyectoNombre: 'Nexus Fase II',
    cargo: '8.2 OPERADOR DE EQUIPO PESADO DE 1ra.',
    cantidadTotal: 1,
    cubiertos: 0,
    urgente: false,
  },
  {
    id: '11111111-1111-4111-8111-111111111105',
    proyectoNombre: 'Torre Inteligente A',
    cargo: '3.12 OPERADOR DE PLANTA FIJA DE 2da.',
    cantidadTotal: 2,
    cubiertos: 2,
    urgente: false,
  },
]

type KanbanColumnId = 'invitados' | 'evaluando' | 'banca' | 'asignados'

type CandidatoKanban = {
  id: string
  nombre: string
  cargo: string
  nivel: string
  columna: KanbanColumnId
}

const MOCK_CANDIDATOS_INICIAL: CandidatoKanban[] = [
  { id: 'c1', nombre: 'María R. López', cargo: 'Albañil 1ra', nivel: 'Grupo 5', columna: 'invitados' },
  { id: 'c2', nombre: 'José A. Pérez', cargo: 'Electricista 1ra', nivel: 'Grupo 5', columna: 'invitados' },
  { id: 'c3', nombre: 'Ana K. Méndez', cargo: 'Topografía / Ayudante', nivel: 'Grupo 2', columna: 'evaluando' },
  { id: 'c4', nombre: 'Luis F. Oropeza', cargo: 'Operador equipo pesado', nivel: 'Grupo 8', columna: 'evaluando' },
  { id: 'c5', nombre: 'Carla S. Núñez', cargo: 'Albañil 1ra', nivel: 'Grupo 5', columna: 'banca' },
  { id: 'c6', nombre: 'Diego M. Ríos', cargo: 'Plomero 1ra', nivel: 'Grupo 5', columna: 'banca' },
  { id: 'c7', nombre: 'Ricardo T. Silva', cargo: 'Caporal', nivel: 'Grupo 3', columna: 'asignados' },
]

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

export default function DashboardRRHH() {
  const [toast, setToast] = useState<string | null>(null)
  const [candidatos, setCandidatos] = useState<CandidatoKanban[]>(MOCK_CANDIDATOS_INICIAL)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const porColumna = useMemo(() => {
    const map: Record<KanbanColumnId, CandidatoKanban[]> = {
      invitados: [],
      evaluando: [],
      banca: [],
      asignados: [],
    }
    for (const c of candidatos) map[c.columna].push(c)
    return map
  }, [candidatos])

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
      setCandidatos((prev) => prev.map((c) => (c.id === draggingId ? { ...c, columna: col } : c)))
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
              Peticiones desde proyectos (simulación). Estado objetivo: <span className="text-zinc-300">abierta</span>{' '}
              en <code className="text-[#FF9500]">recruitment_needs</code>.
            </p>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin] md:snap-x md:snap-mandatory">
          {MOCK_REQUISICIONES.map((need) => {
            const pct =
              need.cantidadTotal > 0 ? Math.min(100, Math.round((need.cubiertos / need.cantidadTotal) * 100)) : 0
            return (
              <article
                key={need.id}
                className={`min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border bg-white/5 p-4 shadow-lg transition hover:bg-white/[0.07] md:min-w-[300px] ${
                  need.urgente
                    ? 'border-[#FF9500]/50 shadow-[0_0_20px_rgba(249,115,22,0.12)]'
                    : 'border-white/10'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#FF9500]">
                  {need.urgente ? 'Urgente' : 'Estándar'}
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
      </section>

      {/* —— Sección 2: Kanban —— */}
      <section className="space-y-4 border-t border-white/10 pt-10">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white md:text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Users className="h-5 w-5 text-[#FFD60A]" aria-hidden />
            </span>
            Tablero Kanban · embudo de talento
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Arrastra tarjetas entre columnas (simulación local). La columna <strong className="text-[#FFD60A]">La Banca</strong>{' '}
            destaca al talento aprobado.
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
                      <p className="text-sm font-semibold text-white">{c.nombre}</p>
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
