'use client'

import { useCallback, useEffect, useState } from 'react'
import { Cloud, FolderOpen, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import { Mono } from '@/components/nexus/Mono'
import {
  cloudDeleteProject,
  cloudGetProject,
  cloudListProjects,
  cloudPushAll,
  type NetVisionCloudIndexEntry,
} from '@/lib/netvision/cloud'
import {
  createProject,
  deleteProject,
  listLocalProjects,
  listProjectIndex,
  openProject,
  upsertLocalProject,
} from '@/lib/netvision/storage'
import type { NetVisionProject, NetVisionProjectIndexEntry } from '@/lib/netvision/types'

type Props = {
  activeId: string
  projectName: string
  onOpen: (project: NetVisionProject) => void
  onNameChange: (name: string) => void
  triggerSize?: 'default' | 'sm'
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
}: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<NetVisionProjectIndexEntry[]>([])
  const [cloudEntries, setCloudEntries] = useState<NetVisionCloudIndexEntry[]>([])
  const [cloudAuth, setCloudAuth] = useState<boolean | null>(null)
  const [cloudMsg, setCloudMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [newName, setNewName] = useState('')

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
  }, [open])

  const pushAll = async () => {
    setSyncing(true)
    setCloudMsg(null)
    try {
      const r = await cloudPushAll(listLocalProjects())
      if (!r.ok) {
        setCloudMsg(r.error || 'Error al subir')
        setCloudAuth(r.authenticated)
      } else {
        setCloudMsg(`Subidos ${r.saved} proyecto(s) a Supabase`)
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
      const r = await cloudGetProject(id)
      if (!r.ok || !r.project) {
        setCloudMsg(r.error || 'No se pudo descargar')
        return
      }
      const merged = upsertLocalProject(r.project)
      const opened = openProject(merged.id) ?? merged
      onOpen(opened)
      refreshLocal()
      setOpen(false)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="glass"
        size={triggerSize}
        className="shrink-0"
        onClick={() => setOpen((v) => !v)}
      >
        <FolderOpen
          className={triggerSize === 'sm' ? 'mr-1.5 h-3.5 w-3.5' : 'mr-2 h-4 w-4'}
        />
        Mis proyectos
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="netvision-projects-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Cerrar panel de proyectos"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[1] flex max-h-[min(85vh,640px)] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0d1118] p-4 shadow-2xl shadow-black/60">
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
                  className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-sm font-semibold text-white"
                  placeholder="Nombre del proyecto"
                />
              </div>
              <button
                type="button"
                className="rounded p-1 text-[var(--nexus-text-dim)] hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
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
                  className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
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
              <ul className="mb-3 max-h-40 space-y-1 overflow-auto">
                {entries.length === 0 ? (
                  <li className="text-xs text-[var(--nexus-text-dim)]">
                    Sin proyectos locales.
                  </li>
                ) : (
                  entries.map((e) => {
                    const active = e.id === activeId
                    return (
                      <li
                        key={e.id}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                          active
                            ? 'border-[rgba(0,242,254,0.4)] bg-[rgba(0,242,254,0.08)]'
                            : 'border-white/10 bg-black/30'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            const p = openProject(e.id)
                            if (p) {
                              onOpen(p)
                              setOpen(false)
                            }
                          }}
                        >
                          <p className="truncate text-xs font-semibold text-white">
                            {e.name}
                          </p>
                          <p className="truncate text-[10px] text-[var(--nexus-text-dim)]">
                            <Mono>
                              {e.cameraCount} cam · {e.networkCount} red
                            </Mono>
                            {e.updatedAt ? ` · ${formatWhen(e.updatedAt)}` : ''}
                          </p>
                        </button>
                        <button
                          type="button"
                          title="Eliminar local"
                          className="rounded p-1 text-[var(--nexus-text-dim)] hover:text-red-300"
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
                  <ul className="mb-1 max-h-36 space-y-1 overflow-auto">
                    {cloudEntries.map((e) => (
                      <li
                        key={`cloud-${e.id}`}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          disabled={syncing}
                          onClick={() => void pullCloud(e.id)}
                          title="Descargar y abrir"
                        >
                          <p className="truncate text-xs font-semibold text-white">
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
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>

            <p className="mt-2 shrink-0 text-[10px] text-[var(--nexus-text-dim)]">
              Local siempre disponible. Nube: usuario autenticado + migración 274.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
