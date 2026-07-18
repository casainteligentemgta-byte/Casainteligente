'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/nexus/ui/button'
import { Mono } from '@/components/nexus/Mono'
import {
  createProject,
  deleteProject,
  listProjectIndex,
  openProject,
} from '@/lib/netvision/storage'
import type { NetVisionProject, NetVisionProjectIndexEntry } from '@/lib/netvision/types'

type Props = {
  activeId: string
  projectName: string
  onOpen: (project: NetVisionProject) => void
  onNameChange: (name: string) => void
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
}: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<NetVisionProjectIndexEntry[]>([])
  const [newName, setNewName] = useState('')

  const refresh = () => setEntries(listProjectIndex())

  useEffect(() => {
    if (open) refresh()
  }, [open, activeId])

  return (
    <div className="relative">
      <Button type="button" variant="glass" onClick={() => setOpen((v) => !v)}>
        <FolderOpen className="mr-2 h-4 w-4" />
        Mis proyectos
      </Button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,360px)] rounded-xl border border-white/15 bg-[#0d1118] p-3 shadow-xl shadow-black/50">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase text-[var(--nexus-text-dim)]">
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
                refresh()
                setOpen(false)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ul className="max-h-56 space-y-1 overflow-auto">
            {entries.length === 0 ? (
              <li className="text-xs text-[var(--nexus-text-dim)]">Sin proyectos guardados.</li>
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
                      <p className="truncate text-xs font-semibold text-white">{e.name}</p>
                      <p className="truncate text-[10px] text-[var(--nexus-text-dim)]">
                        <Mono>
                          {e.cameraCount} cam · {e.networkCount} red
                        </Mono>
                        {e.updatedAt ? ` · ${formatWhen(e.updatedAt)}` : ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      className="rounded p-1 text-[var(--nexus-text-dim)] hover:text-red-300"
                      onClick={() => {
                        if (!confirm(`¿Eliminar «${e.name}»?`)) return
                        const next = deleteProject(e.id)
                        onOpen(next)
                        refresh()
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          <p className="mt-2 text-[10px] text-[var(--nexus-text-dim)]">
            Guardado local en este navegador (localStorage).
          </p>
        </div>
      ) : null}
    </div>
  )
}
