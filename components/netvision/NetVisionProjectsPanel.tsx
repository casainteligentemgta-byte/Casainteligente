'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Cloud, FolderOpen, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import { Mono } from '@/components/nexus/Mono'
import {
  cloudDeleteProject,
  cloudListProjects,
  cloudPushAll,
  type NetVisionCloudIndexEntry,
} from '@/lib/netvision/cloud'
import { bajarProyectoDeNube } from '@/lib/netvision/bajarDeNube'
import {
  createProject,
  deleteProject,
  listLocalProjects,
  listProjectIndex,
  openProject,
} from '@/lib/netvision/storage'
import type { NetVisionProject, NetVisionProjectIndexEntry } from '@/lib/netvision/types'

type Props = {
  activeId: string
  projectName: string
  onOpen: (project: NetVisionProject) => void
  onNameChange: (name: string) => void
  triggerSize?: 'default' | 'sm'
  /** Si se pasa, el diálogo se controla desde fuera (p. ej. menú Archivo). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('es-VE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function NetVisionProjectsPanel({
  activeId,
  projectName,
  onOpen,
  onNameChange,
  triggerSize = 'default',
  open: openProp,
  onOpenChange,
  showTrigger = true,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [entries, setEntries] = useState<NetVisionProjectIndexEntry[]>([])
  const [cloudEntries, setCloudEntries] = useState<NetVisionCloudIndexEntry[]>([])
  const [cloudAuth, setCloudAuth] = useState<boolean | null>(null)
  const [cloudMsg, setCloudMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [newName, setNewName] = useState('')

  const isControlled = openProp !== undefined
  const open = isControlled ? Boolean(openProp) : internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const refreshLocal = useCallback(() => setEntries(listProjectIndex()), [])

  const refreshCloud = useCallback(async () => {
    const r = await cloudListProjects()
    setCloudAuth(r.authenticated)
    if (r.ok && r.projects) {
      setCloudEntries(r.projects)
      setCloudMsg(null)
    } else if (!r.authenticated) {
      setCloudEntries([])
      setCloudMsg('Inicia sesión para sincronizar con la nube')
    } else {
      setCloudMsg(r.error || 'No se pudo listar la nube')
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    refreshLocal()
    void refreshCloud()
  }, [open, activeId, refreshLocal, refreshCloud])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, setOpen])

  const pushAll = async () => {
    setSyncing(true)
    setCloudMsg(null)
    try {
      const r = await cloudPushAll(listLocalProjects())
      if (!r.ok) {
        setCloudMsg(r.error || 'Error al subir')
        setCloudAuth(r.authenticated)
      } else {
        setCloudMsg(
          r.conflictos.length > 0
            ? `Subidos ${r.saved} proyecto(s). No se subieron ${r.conflictos.length} porque la nube tiene otra versión: ${r.conflictos.join(', ')}. Ábrelos para elegir con cuál quedarte.`
            : `Subidos ${r.saved} proyecto(s) a la nube`,
        )
        await refreshCloud()
      }
    } finally {
      setSyncing(false)
    }
  }

  const pullCloud = async (id: string) => {
    setSyncing(true)
    setCloudMsg(null)
    try {
      const r = await bajarProyectoDeNube(id)
      if (!r.ok) {
        setCloudMsg(r.error)
        return
      }
      const merged = r.project
      const opened = openProject(merged.id) ?? merged
      onOpen(opened)
      refreshLocal()
      setOpen(false)
    } finally {
      setSyncing(false)
    }
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="netvision-projects-title"
            data-nv-mis-proyectos-dialog
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              aria-label="Cerrar panel de proyectos"
              onClick={() => setOpen(false)}
            />
            <div className="relative z-[1] flex max-h-[min(92dvh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0d1118] p-4 shadow-2xl shadow-black/60">
              <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    id="netvision-projects-title"
                    className="text-[10px] uppercase text-[var(--nexus-text-dim)]"
                  >
                    Proyecto activo
                  </p>
                  <input
                    value={projectName}
                    onChange={(e) => onNameChange(e.target.value)}
                    className="mt-0.5 min-h-11 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-sm font-semibold text-white"
                    placeholder="Nombre del proyecto"
                  />
                </div>
                <button
                  type="button"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded text-[var(--nexus-text-dim)] hover:text-white"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    disabled={syncing}
                    onClick={() => void pushAll()}
                    title="Subir proyectos locales a Supabase"
                  >
                    <Cloud className="mr-1 h-3.5 w-3.5" />
                    Subir nube
                  </Button>
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    disabled={syncing}
                    onClick={() => void refreshCloud()}
                  >
                    <RefreshCw
                      className={`mr-1 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`}
                    />
                    Actualizar
                  </Button>
                </div>

                {cloudMsg ? (
                  <p className="mb-2 text-[10px] text-amber-200/90">{cloudMsg}</p>
                ) : cloudAuth ? (
                  <p className="mb-2 text-[10px] text-[var(--nexus-green)]">
                    Sesión activa · {cloudEntries.length} en nube
                  </p>
                ) : null}

                <div className="mb-3 flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nuevo proyecto…"
                    className="min-h-11 min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="min-h-11 min-w-11"
                    title="Crear proyecto"
                    onClick={() => {
                      const p = createProject(newName || undefined)
                      setNewName('')
                      onOpen(p)
                      refreshLocal()
                      setOpen(false)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--nexus-text-dim)]">
                  En este navegador
                </p>
                <ul className="mb-3 space-y-1.5">
                  {entries.length === 0 ? (
                    <li className="rounded-lg border border-white/10 px-3 py-3 text-xs text-[var(--nexus-text-dim)]">
                      Sin proyectos locales. Crea uno arriba o, si ya los tenías en
                      otro iPad, inicia sesión y pulsa Actualizar.
                    </li>
                  ) : (
                    entries.map((e) => {
                      const active = e.id === activeId
                      return (
                        <li
                          key={e.id}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
                            active
                              ? 'border-[rgba(0,242,254,0.4)] bg-[rgba(0,242,254,0.08)]'
                              : 'border-white/10 bg-black/30'
                          }`}
                        >
                          <button
                            type="button"
                            data-nv-abrir-proyecto={e.id}
                            className="min-h-11 min-w-0 flex-1 text-left"
                            onClick={() => {
                              try {
                                const p = openProject(e.id)
                                if (!p) {
                                  setCloudMsg(
                                    `No se pudo abrir «${e.name}». Elige otro o recarga la página.`,
                                  )
                                  return
                                }
                                onOpen(p)
                                setOpen(false)
                              } catch (err) {
                                setCloudMsg(
                                  err instanceof Error
                                    ? err.message
                                    : `No se pudo abrir «${e.name}».`,
                                )
                              }
                            }}
                          >
                            <p className="truncate text-sm font-semibold text-white">
                              {e.name}
                            </p>
                            <p className="truncate text-[10px] text-[var(--nexus-text-dim)]">
                              <Mono>
                                {e.cameraCount} cam · {e.networkCount} red
                                {e.planDeviceCount
                                  ? ` · ${e.planDeviceCount} eq`
                                  : ''}
                                {e.structureCount ? ` · ${e.structureCount} muros` : ''}
                              </Mono>
                              {e.updatedAt ? ` · ${formatWhen(e.updatedAt)}` : ''}
                            </p>
                          </button>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--nexus-cyan)]">
                            Abrir
                          </span>
                          <button
                            type="button"
                            title="Eliminar local"
                            className="flex min-h-11 min-w-11 items-center justify-center rounded p-1 text-[var(--nexus-text-dim)] hover:text-red-300"
                            onClick={() => {
                              if (!confirm(`¿Eliminar local «${e.name}»?`)) return
                              const next = deleteProject(e.id)
                              void cloudDeleteProject(e.id)
                              onOpen(next)
                              refreshLocal()
                              void refreshCloud()
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>

                {cloudAuth && cloudEntries.length > 0 ? (
                  <>
                    <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--nexus-text-dim)]">
                      En Supabase
                    </p>
                    <ul className="mb-1 space-y-1.5">
                      {cloudEntries.map((e) => (
                        <li
                          key={`cloud-${e.id}`}
                          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2 py-2"
                        >
                          <button
                            type="button"
                            className="min-h-11 min-w-0 flex-1 text-left"
                            disabled={syncing}
                            onClick={() => void pullCloud(e.id)}
                            title="Descargar y abrir"
                          >
                            <p className="truncate text-sm font-semibold text-white">
                              <Cloud className="mr-1 inline h-3 w-3 text-[var(--nexus-cyan)]" />
                              {e.name}
                            </p>
                            <p className="truncate text-[10px] text-[var(--nexus-text-dim)]">
                              <Mono>
                                {e.cameraCount} cam · {e.networkCount} red
                              </Mono>
                              {e.updatedAt ? ` · ${formatWhen(e.updatedAt)}` : ''}
                              {e.hasPlano ? ' · plano' : ''}
                            </p>
                          </button>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--nexus-cyan)]">
                            Abrir
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>

              <p className="mt-2 shrink-0 text-[10px] text-[var(--nexus-text-dim)]">
                Guarda CCTV, internet, domótica, sonido y eléctrico en este
                navegador. Nube: usuario autenticado. Toca un nombre para
                abrirlo.
              </p>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {showTrigger ? (
        <Button
          type="button"
          variant="glass"
          size={triggerSize}
          data-nv-mis-proyectos
          className="w-full shrink-0 justify-start"
          onClick={() => setOpen(true)}
        >
          <FolderOpen
            className={triggerSize === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4'}
          />
          Mis proyectos
        </Button>
      ) : null}
      {dialog}
    </>
  )
}
