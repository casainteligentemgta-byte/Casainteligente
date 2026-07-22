'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type NexusRightPanelApi = {
  open: boolean
  toggle: () => void
}

type NexusRightPanelContextValue = {
  panel: NexusRightPanelApi | null
  register: (api: NexusRightPanelApi | null) => void
}

const NexusRightPanelContext = createContext<NexusRightPanelContextValue | null>(
  null,
)

export function NexusRightPanelProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [panel, setPanel] = useState<NexusRightPanelApi | null>(null)
  const register = useCallback((api: NexusRightPanelApi | null) => {
    setPanel(api)
  }, [])
  const value = useMemo(() => ({ panel, register }), [panel, register])
  return (
    <NexusRightPanelContext.Provider value={value}>
      {children}
    </NexusRightPanelContext.Provider>
  )
}

export function useNexusRightPanelSlot() {
  return useContext(NexusRightPanelContext)
}

/** Registra el panel derecho en el header de NexusShell (p. ej. NetVision). */
export function useRegisterNexusRightPanel(
  open: boolean,
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void,
) {
  const ctx = useContext(NexusRightPanelContext)
  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [setOpen])

  useEffect(() => {
    if (!ctx) return
    ctx.register({ open, toggle })
  }, [ctx, open, toggle])

  useEffect(() => {
    if (!ctx) return
    return () => ctx.register(null)
  }, [ctx])
}
